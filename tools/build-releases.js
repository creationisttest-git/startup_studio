#!/usr/bin/env node
/**
 * build-releases.js -- generates releases.html from CHANGELOG.md.
 *
 * Why this is generated and not written by hand. The public release notes and the changelog
 * are the same facts in two registers, and two hand-maintained copies of the same facts
 * disagree by the second release. CHANGELOG.md is the single source: each dated section
 * carries a short block, marked "What this gives you", written as what a reader gets rather
 * than how it was built. This tool reads only those blocks. Nothing else from the changelog
 * reaches the page, which is what keeps internal detail off the public site.
 *
 *   node tools/build-releases.js            regenerate releases.html
 *   node tools/build-releases.js --check    fail if releases.html is stale, write nothing
 *   node tools/build-releases.js --strict   treat a missing value block as an error
 *   node tools/build-releases.js --changelog <path> --out <path>
 *
 * Guarantees, each with a test in build-releases.test.js:
 *   - deterministic. No clock, no locale, no environment. Running twice is byte-identical.
 *   - a release with no value block is SKIPPED and NAMED on stderr, never emitted empty.
 *   - if no release has a value block the tool fails and writes nothing, because a release
 *     notes page with nothing on it reads as a broken site rather than as missing content.
 *   - the output is UTF-8, no byte order mark, LF endings, no control characters, and
 *     carries no em dash, which this house bans in anything that publishes.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://startupstudio.projectfreedom.xyz';

const TITLE = 'Release notes: what each Startup Studio release gives you';
const DESCRIPTION =
  'Every Startup Studio release in plain language, newest first, written as what it gives ' +
  'you rather than how it was built. Filter to a single release by date.';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/* The marker the content lead writes under each dated heading. A trailing full stop and a
   colon are both accepted: a value block dropped because someone left the stop off would be
   a silent loss of the exact content this page exists to show. */
const MARKER = /^\*\*What this gives you[.:]?\*\*\s*/;
const MARKER_LOOSE = /what this gives you/i;

const EM_DASH = String.fromCharCode(0x2014);  // by code point, so this file carries none
const CODE_TOKEN = '@@RELCODE';

/* ---------- parsing ---------- */

/**
 * Splits CHANGELOG.md into dated sections. Only a line starting "## YYYY-MM-DD" outside a
 * fenced code block starts a release: the changelog contains a "## How to test" heading
 * inside a fence, and a parser blind to fences would invent a release out of it.
 */
function parseChangelog(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const releases = [];
  let inFence = false;
  let cur = null;

  for (const line of lines) {
    const isFence = /^\s{0,3}(```|~~~)/.test(line);

    if (!inFence && !isFence) {
      const h2 = /^##\s+(\S.*?)\s*$/.exec(line);
      if (h2) {
        const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(h2[1]);
        cur = null;
        if (iso) {
          cur = { date: iso[1], lines: [] };
          releases.push(cur);
        }
        continue;
      }
      if (/^#\s+/.test(line)) { cur = null; continue; }
    }

    if (isFence) inFence = !inFence;
    if (cur) cur.lines.push(line);
  }

  return releases;
}

/**
 * Pulls the value block out of one release section. It runs from the marker to the next
 * heading, the next horizontal rule, or the end of the section, so a block may be several
 * paragraphs or a short list.
 */
function extractValueBlock(sectionLines) {
  let start = -1;
  for (let i = 0; i < sectionLines.length; i++) {
    if (MARKER.test(sectionLines[i])) { start = i; break; }
  }
  if (start === -1) return null;

  const out = [sectionLines[start].replace(MARKER, '')];
  for (let i = start + 1; i < sectionLines.length; i++) {
    const line = sectionLines[i];
    if (/^#{1,6}\s/.test(line)) break;
    if (/^-{3,}\s*$/.test(line)) break;
    if (MARKER.test(line)) break;
    out.push(line);
  }

  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.length ? out : null;
}

/* ---------- formatting ---------- */

/**
 * "2026-08-21" becomes "21 August 2026". Hand rolled rather than toLocaleDateString, which
 * depends on the machine's locale and would make the output differ between a laptop and CI.
 */
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error('not an ISO date: ' + iso);
  const month = MONTHS[Number(m[2]) - 1];
  const day = Number(m[3]);
  if (!month) throw new Error('month out of range: ' + iso);
  if (day < 1 || day > 31) throw new Error('day out of range: ' + iso);
  return String(day) + ' ' + month + ' ' + m[1];
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The small slice of markdown a value block may use: code spans, bold, italic and links.
 * Everything is escaped first, so anything not on that list arrives on the page as the
 * literal characters the author typed rather than as markup.
 */
function inline(text) {
  if (text.indexOf(CODE_TOKEN) !== -1) {
    throw new Error('value block contains the reserved token ' + CODE_TOKEN);
  }

  const codes = [];
  let s = text.replace(/`([^`]+)`/g, function (_, code) {
    codes.push(code);
    return CODE_TOKEN + (codes.length - 1) + '@@';
  });

  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]\[]+)\]\(([^)\s*]+)\)/g, function (whole, label, href) {
    if (!/^(https?:\/\/|\/|#|mailto:)/.test(href)) return whole;
    return '<a href="' + href + '">' + label + '</a>';
  });

  s = s.replace(new RegExp(CODE_TOKEN + '(\\d+)@@', 'g'), function (_, n) {
    return '<code>' + escapeHtml(codes[Number(n)]) + '</code>';
  });

  return s;
}

/** Value block lines become paragraphs and, where the author used them, a short list. */
function renderBody(lines, indent) {
  const pad = ' '.repeat(indent);
  const html = [];
  let para = [];
  let list = [];

  function flushPara() {
    if (!para.length) return;
    html.push(pad + '<p>' + inline(para.join(' ')) + '</p>');
    para = [];
  }
  function flushList() {
    if (!list.length) return;
    html.push(pad + '<ul class="rel-points">');
    for (const item of list) html.push(pad + '  <li>' + inline(item) + '</li>');
    html.push(pad + '</ul>');
    list = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flushPara(); flushList(); continue; }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (bullet) { flushPara(); list.push(bullet[1]); continue; }
    if (list.length) { list[list.length - 1] += ' ' + line; continue; }
    para.push(line);
  }
  flushPara();
  flushList();
  return html;
}

/* ---------- the page ---------- */

function navBlock(currentHref) {
  const pages = [
    ['/', '01', 'Home'],
    ['/problem', '02', 'The Problem'],
    ['/solution', '03', 'The Solution'],
    ['/prototypes', '04', 'Product prototypes'],
    ['/how-to', '05', 'How to run it'],
    ['/releases', '06', 'Releases']
  ];
  return pages.map(function (p) {
    const current = p[0] === currentHref ? ' aria-current="page"' : '';
    return '    <a href="' + p[0] + '"' + current + '><span class="n">' + p[1] + '</span> ' +
      p[2] + '</a>';
  }).join('\n');
}

function optionsBlock(releases) {
  const opts = ['      <option value="all">All releases, newest first</option>'];
  for (const r of releases) {
    opts.push('      <option value="' + r.date + '">' + escapeHtml(formatDate(r.date)) +
      '</option>');
  }
  return opts.join('\n');
}

function cardsBlock(releases) {
  return releases.map(function (r, i) {
    const label = formatDate(r.date);
    const tag = i === 0 ? '<span class="rel-tag">Latest release</span>' : '';
    const open = i === 0 ? ' open' : '';
    return [
      '    <details class="rel" id="r-' + r.date + '" data-release="' + r.date + '"' + open + '>',
      '      <summary class="rel-sum">',
      '        <h3 class="rel-h"><time datetime="' + r.date + '">' + escapeHtml(label) +
        '</time>' + tag + '</h3>',
      '      </summary>',
      '      <div class="rel-copy">',
      renderBody(r.body, 8).join('\n'),
      '      </div>',
      '    </details>'
    ].join('\n');
  }).join('\n');
}

function renderPage(releases) {
  return '<!doctype html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'\n' +
'<title>' + TITLE + '</title>\n' +
'<meta name="description" content="' + DESCRIPTION + '">\n' +
'<link rel="canonical" href="' + SITE + '/releases">\n' +
'<link rel="stylesheet" href="/site.css">\n' +
'\n' +
'<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Crect width=\'32\' height=\'32\' fill=\'%23050806\'/%3E%3Cpath d=\'M7 9l7 7-7 7\' stroke=\'%2335d06a\' stroke-width=\'3.4\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3Crect x=\'17\' y=\'20\' width=\'9\' height=\'3.4\' fill=\'%2335d06a\'/%3E%3C/svg%3E">\n' +
'<meta name="robots" content="index, follow, max-image-preview:large">\n' +
'<meta name="color-scheme" content="dark">\n' +
'<meta name="theme-color" content="#050806">\n' +
'\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:site_name" content="Startup Studio">\n' +
'<meta property="og:url" content="' + SITE + '/releases">\n' +
'<meta property="og:title" content="' + TITLE + '">\n' +
'<meta property="og:description" content="' + DESCRIPTION + '">\n' +
'<meta property="og:image" content="' + SITE + '/og.png">\n' +
'<meta property="og:image:width" content="1200">\n' +
'<meta property="og:image:height" content="630">\n' +
'<meta property="og:image:alt" content="Startup Studio, a dark terminal page describing a shared team of AI agents.">\n' +
'\n' +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + TITLE + '">\n' +
'<meta name="twitter:description" content="' + DESCRIPTION + '">\n' +
'<meta name="twitter:image" content="' + SITE + '/og.png">\n' +
'\n' +
'<!-- The filter is a control only while the script that drives it is running, so it stays\n' +
'     styled off until this class is set. The reason is in the comment beside the form. -->\n' +
'<script>document.documentElement.classList.add("js");</script>\n' +
'</head>\n' +
'<body>\n' +
'<nav class="sitemap" aria-label="Pages">\n' +
'  <button class="navtoggle" type="button" aria-expanded="false" aria-controls="navlinks">\n' +
'    <span class="navicon" aria-hidden="true">&#9776;</span><span class="navlabel">Menu</span>\n' +
'  </button>\n' +
'  <p class="sitemap-title">Startup Studio</p>\n' +
'  <div class="sitemap-links" id="navlinks">\n' +
navBlock('/releases') + '\n' +
'  </div>\n' +
'  <div class="sitemap-cta">\n' +
'    <a class="bar-cta" href="https://github.com/creationisttest-git/startup_studio">Get the agents <span aria-hidden="true">&#8594;</span></a>\n' +
'  </div>\n' +
'</nav>\n' +
'\n' +
'<div class="wrap">\n' +
'\n' +
'<section id="releases">\n' +
'    <p class="eyebrow">Release notes</p>\n' +
'    <h2>What each release gives you</h2>\n' +
'    <p class="rel-intro">Every release, newest first, written as what you get rather than what was touched. The most recent one is open below.</p>\n' +
'\n' +
'    <!-- A dropdown cannot filter a static page on its own: submitting it reloads the same\n' +
'         document and nothing changes, which is worse than having no control at all. So it\n' +
'         is revealed by the js class and driven by site.js, and with scripting off every\n' +
'         release is on the page anyway, newest first, with the latest one open. -->\n' +
'    <form class="rel-filter" method="get" action="/releases">\n' +
'      <label for="release-filter">Show</label>\n' +
'      <select id="release-filter" name="release">\n' +
optionsBlock(releases) + '\n' +
'      </select>\n' +
'      <button class="rel-go" type="submit">Show release</button>\n' +
'    </form>\n' +
'    <noscript>\n' +
'      <p class="rel-noscript">Every release is listed below, newest first.</p>\n' +
'    </noscript>\n' +
'\n' +
'    <!-- site.js writes the result of the filter into this paragraph. It is not decoration:\n' +
'         remove it and the reader loses the only confirmation that the filter did anything,\n' +
'         and site.js is written to fail loudly rather than quietly skip. -->\n' +
'    <p class="rel-status" id="rel-status" role="status" aria-live="polite"></p>\n' +
'\n' +
'    <div class="rel-list" id="rel-list">\n' +
cardsBlock(releases) + '\n' +
'    </div>\n' +
'\n' +
'    <p class="rel-foot">The full technical detail behind every release is in <a href="https://github.com/creationisttest-git/startup_studio/blob/main/CHANGELOG.md">the changelog</a>.</p>\n' +
'  </section>\n' +
'\n' +
'  <footer>\n' +
'    <span>STARTUP STUDIO</span>\n' +
'    <span><a href="https://www.projectfreedom.xyz">PROJECTFREEDOM.XYZ</a></span>\n' +
'    <span>AGPL-3.0 / IMPROVE IT / SEND IT BACK</span>\n' +
'  </footer>\n' +
'\n' +
'</div>\n' +
'\n' +
'<script src="/site.js"></script>\n' +
'</body>\n' +
'</html>\n';
}

/* ---------- build ---------- */

/**
 * The whole build as one function over text, so the tests drive it on fixtures without
 * touching the filesystem. Returns the page and every warning, and throws only for the
 * conditions that must stop a release rather than merely be noted.
 */
function build(changelogText, options) {
  const opts = options || {};
  const warnings = [];
  const sections = parseChangelog(changelogText);

  if (!sections.length) {
    throw new Error('no dated releases found. Expected headings of the form "## 2026-08-21".');
  }

  const seen = new Set();
  for (const s of sections) {
    if (seen.has(s.date)) {
      throw new Error('the changelog has two sections dated ' + s.date +
        '. Each release needs its own date, because the date is the link to it.');
    }
    seen.add(s.date);
  }

  const releases = [];
  for (const s of sections) {
    const body = extractValueBlock(s.lines);
    if (!body) {
      const near = s.lines.some(function (l) { return MARKER_LOOSE.test(l); });
      warnings.push(near
        ? 'release ' + s.date + ' mentions "What this gives you" but not as a line that ' +
          'begins with it in bold, so it was skipped. Fix the marker and it will appear.'
        : 'release ' + s.date + ' has no "What this gives you" block and was skipped.');
      continue;
    }
    releases.push({ date: s.date, body: body });
  }

  if (!releases.length) {
    throw new Error(
      'not one release carries a "What this gives you" block, so there is nothing to ' +
      'publish and nothing was written. Add the block under a dated heading in CHANGELOG.md.');
  }

  const ordered = releases.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  const asWritten = releases.map(function (r) { return r.date; }).join(',');
  if (asWritten !== ordered.map(function (r) { return r.date; }).join(',')) {
    warnings.push('the changelog is not in newest-first order. The page has been sorted, ' +
      'but the two now disagree and the file is worth putting back in order.');
  }

  const html = renderPage(ordered);

  const bad = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.exec(html);
  if (bad) {
    throw new Error('a control character reached the page from the changelog, at offset ' +
      bad.index + '. Nothing was written.');
  }
  if (html.charCodeAt(0) === 0xFEFF) {
    throw new Error('the page starts with a byte order mark. Nothing was written.');
  }
  const dash = html.indexOf(EM_DASH);
  if (dash !== -1) {
    const line = html.slice(0, dash).split('\n').length;
    throw new Error('an em dash reached the page from the changelog, at line ' + line +
      '. This house bans it in anything that publishes. Nothing was written.');
  }

  if (opts.strict && warnings.length) {
    throw new Error('strict mode, and there are ' + warnings.length + ' warnings:\n  - ' +
      warnings.join('\n  - '));
  }

  return { html: html, releases: ordered, warnings: warnings };
}

/**
 * The sitemap is hand maintained, so this only looks and says. It does not write: a tool that
 * quietly edits a file nobody asked it to touch is how a hand-maintained file stops being
 * trustworthy.
 */
function checkSitemap(sitemapPath, newestDate) {
  if (!fs.existsSync(sitemapPath)) {
    return ['sitemap.xml was not found beside the page, so its date could not be checked.'];
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  if (xml.indexOf('/releases<') === -1) {
    return ['sitemap.xml does not list /releases. Search engines will not find the page.'];
  }
  const block = /<url>\s*<loc>[^<]*\/releases<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/.exec(xml);
  if (!block) return ['sitemap.xml lists /releases with no lastmod date.'];
  if (block[1] !== newestDate) {
    return ['sitemap.xml gives /releases a lastmod of ' + block[1] + ', and the newest ' +
      'release is ' + newestDate + '. Update it so the page is recrawled.'];
  }
  return [];
}

function main(argv) {
  const args = argv.slice(2);
  if (args.indexOf('--help') !== -1 || args.indexOf('-h') !== -1) {
    process.stdout.write(
      'node tools/build-releases.js [--check] [--strict] [--changelog <path>] [--out <path>]\n');
    return 0;
  }

  function flagValue(name, fallback) {
    const i = args.indexOf(name);
    if (i === -1) return fallback;
    if (i + 1 >= args.length) throw new Error(name + ' needs a path after it');
    return args[i + 1];
  }

  const changelogPath = path.resolve(flagValue('--changelog', path.join(ROOT, 'CHANGELOG.md')));
  const outPath = path.resolve(flagValue('--out', path.join(ROOT, 'releases.html')));
  const check = args.indexOf('--check') !== -1;
  const strict = args.indexOf('--strict') !== -1;

  if (!fs.existsSync(changelogPath)) {
    process.stderr.write('ERROR: no changelog at ' + changelogPath + '\n');
    return 1;
  }

  let result;
  try {
    result = build(fs.readFileSync(changelogPath, 'utf8'), { strict: strict });
  } catch (err) {
    process.stderr.write('ERROR: ' + err.message + '\n');
    return 1;
  }

  const warnings = result.warnings.concat(
    checkSitemap(path.join(path.dirname(outPath), 'sitemap.xml'), result.releases[0].date));

  for (const w of warnings) process.stderr.write('WARNING: ' + w + '\n');

  if (check) {
    const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
    if (existing === result.html) {
      process.stdout.write('releases.html is current: ' + result.releases.length +
        ' releases.\n');
      return 0;
    }
    process.stderr.write('ERROR: releases.html does not match the changelog. ' +
      'Run: node tools/build-releases.js\n');
    return 1;
  }

  fs.writeFileSync(outPath, result.html, { encoding: 'utf8' });
  process.stdout.write('wrote ' + path.relative(ROOT, outPath) + ': ' +
    result.releases.length + ' releases, newest ' + result.releases[0].date + '.\n');
  if (warnings.length) {
    process.stdout.write(warnings.length + ' warning(s) above. Nothing was hidden.\n');
  }
  return 0;
}

module.exports = {
  parseChangelog: parseChangelog,
  extractValueBlock: extractValueBlock,
  formatDate: formatDate,
  escapeHtml: escapeHtml,
  inline: inline,
  renderBody: renderBody,
  renderPage: renderPage,
  build: build,
  checkSitemap: checkSitemap
};

if (require.main === module) {
  process.exit(main(process.argv));
}
