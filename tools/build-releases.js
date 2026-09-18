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

/* The marker written under each dated heading. A trailing full stop and a
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
 * Pulls the value blocks out of one release section and joins them, in the order written.
 * Each block runs from its marker to the next heading, the next horizontal rule, the next
 * marker, or the end of the section, so a block may be several paragraphs or a short list.
 *
 * IT GATHERS EVERY BLOCK, AND TAKING ONLY THE FIRST WAS A SILENT LOSS OF PUBLISHED CONTENT.
 * A dated section holds one "###" block per change and most days ship more than one. This
 * function used to find the first marker and stop, so every block after the first was dropped
 * from the page with nothing anywhere reporting it: --check compares the page to the changelog
 * and the page WAS faithful to the first block, so it printed "releases.html is current" over
 * a page missing a whole change. Measured on 2026-09-10: merging a new block in above the
 * previous sitting's took its five bullets off the page and printed exit 0, and the second
 * block of the section below it had already been absent for a day. The "###" headings are
 * never rendered, so joining the blocks is what the reader was always meant to receive.
 */
function extractValueBlock(sectionLines) {
  const out = [];
  let i = 0;

  while (i < sectionLines.length) {
    if (!MARKER.test(sectionLines[i])) { i++; continue; }

    const block = [sectionLines[i].replace(MARKER, '')];
    i++;
    for (; i < sectionLines.length; i++) {
      const line = sectionLines[i];
      if (/^#{1,6}\s/.test(line)) break;
      if (/^-{3,}\s*$/.test(line)) break;
      if (MARKER.test(line)) break;
      block.push(line);
    }

    while (block.length && block[0].trim() === '') block.shift();
    while (block.length && block[block.length - 1].trim() === '') block.pop();
    if (block.length) {
      if (out.length) out.push('');
      for (const l of block) out.push(l);
    }
  }

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
    ['/releases', '06', 'Releases'],
    ['/reference', '07', 'Reference']
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

/* The one SEO gap that survived re-measurement. The page already carries a per-release id, a
   machine-readable <time> for each, and a deep link that opens the release it names, so two of
   the three gaps this ticket reported were closed before anyone acted on it. This one was real:
   index.html declares a graph and this page declared nothing.

   ItemList rather than thirteen Articles. What this page IS, structurally, is an ordered list of
   releases each with its own address, and that is a shape search engines already read. Thirteen
   TechArticle blocks would describe something the page is not, and a claim in structured data is
   a claim like any other. The ids are the SAME ids the homepage graph uses, so the two pages
   describe one site rather than two. */
function structuredData(releases) {
  const items = releases.map(function (r, i) {
    return {
      '@type': 'ListItem',
      position: i + 1,
      name: 'Startup Studio release, ' + formatDate(r.date),
      url: SITE + '/releases#r-' + r.date
    };
  });
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': SITE + '/releases#webpage',
        url: SITE + '/releases',
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'en',
        isPartOf: { '@id': SITE + '/#website' },
        about: { '@id': SITE + '/#app' },
        author: { '@id': SITE + '/#author' },
        dateModified: releases.length ? releases[0].date : undefined
      },
      {
        '@type': 'ItemList',
        '@id': SITE + '/releases#list',
        name: 'Startup Studio releases, newest first',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: releases.length,
        itemListElement: items
      }
    ]
  };
  /* JSON.stringify drops undefined, which is what should happen to dateModified when there is
     nothing to date: an empty string would be a false claim rather than a missing one.
     The split/join stops a value ever closing this script tag early. It is written with
     fromCharCode rather than an escape on purpose. Eight literal control bytes have been written
     into this repository in one day, every one of them a backslash that passed through something
     that treated it as an escape, so the backslash that MUST survive is spelled out. */
  const json = JSON.stringify(graph, null, 2)
    .split('</').join('<' + String.fromCharCode(92) + '/');
  return '<script type="application/ld+json">\n' + json + '\n</script>';
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
'\n' +
structuredData(releases) + '\n' +
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
'    <p class="rel-intro">Every release, newest first, written as what you get rather than what was touched. The most recent one is open below. Any term here that is not ordinary English is defined on the <a href="/reference#glossary">reference page</a>.</p>\n' +
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

  // A SECTION THE PARSER REFUSED USED TO VANISH IN SILENCE AND THE PAGE STILL REPORTED CURRENT.
  // The date pattern is anchored at both ends, so a heading that is NEARLY a date matched no
  // release and set the current section to nothing: every line under it was dropped and the build
  // carried on. A peer session wrote "## 2026-09-11 (second entry)" to get past the duplicate-date
  // refusal below, and its whole entry was about to ship in the public export announced by no page
  // and no release note, while --check returned 0. A parser that stops looking and reports clean
  // is the defect this repository has now paid for three times, and it was found by a reviewer
  // reading git log rather than by any instrument.
  //
  // THE REFUSAL IS DELIBERATELY NARROW. Only a heading that OPENS with something date shaped and
  // is not exactly a date can trip it, so "## Earlier" and "## How to test" are untouched and a
  // reader keeping their own headings is not locked out of their own changelog.
  // THE SECOND HALF IS A TOTAL RATHER THAN A PATTERN, and it came from the peer session whose
  // entry this caught. A pattern only finds the near miss somebody has already thought of; asking
  // instead whether every heading in the file was CONSUMED by a section finds the ones nobody has.
  // It warns rather than refusing, because a reader's changelog may carry structural headings this
  // build knows nothing about, and refusing on those is the reader lockout this repository has
  // shipped three times. The near miss above still refuses, because that one is never deliberate.
  const STRUCTURAL = ['Earlier', 'How to test'];
  const nearMiss = [];
  const unconsumed = [];
  let fenced = false;
  // ST-268. AN UNCONSUMED HEADING WITH RELEASE CONTENT UNDER IT NOW THROWS, exactly as a
  // near-miss date does, and only a heading with NO release content stays a warning.
  //
  // The asymmetry was the hole the critical came through. "## Unreleased" carrying five entries
  // produced a warning and exit 0, while "## 2026-09-1" produced a throw, although the two do
  // the same damage: Get-ReleaseNote matches only a DATED heading, so an undated one silently
  // selects the PREVIOUS release's note for both the private and the public commit. On
  // 2026-09-18 that was one command from publishing five entries under the 2026-09-13 headline.
  // A human caught it. No check did, and one was watching.
  //
  // WHAT COUNTS AS RELEASE CONTENT is a "### " entry heading or a "- **" bullet before the next
  // "## ". That is the shape every entry in this changelog has, and it is what separates a
  // heading somebody is drafting under from a prose divider like "Earlier". A heading with
  // neither is still only a warning, because it genuinely costs the reader nothing.
  let current = null;
  const withContent = new Set();
  for (const line of String(changelogText).split(/\r?\n/)) {
    if (/^\s{0,3}(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const h2 = /^##\s+(\S.*?)\s*$/.exec(line);
    if (h2) {
      current = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(h2[1])) continue;
      if (/^\d{4}-\d{2}-\d{2}/.test(h2[1])) { nearMiss.push(h2[1]); continue; }
      if (STRUCTURAL.indexOf(h2[1]) === -1) { unconsumed.push(h2[1]); current = h2[1]; }
      continue;
    }
    if (current && (/^###\s+\S/.test(line) || /^\s*-\s+\*\*/.test(line))) withContent.add(current);
  }
  const carrying = unconsumed.filter(h => withContent.has(h));
  if (carrying.length) {
    throw new Error('the heading "## ' + carrying[0] + '" carries release content and is not a ' +
      'date, so everything under it would be dropped from the page AND the release note would be ' +
      'taken from the previous dated section without a word. Give it a date heading: "## ' +
      new Date().toISOString().slice(0, 10) + '". ST-268.');
  }
  if (unconsumed.length) {
    warnings.push('WARNING: ' + unconsumed.length + ' heading(s) matched no release and were ' +
      'dropped from the page, the first being "## ' + unconsumed[0] + '". If that is a release, ' +
      'give it a date heading. If it is not, this is only telling you it is not on the page.');
  }
  if (nearMiss.length) {
    throw new Error('the heading "## ' + nearMiss[0] + '" is nearly a date and matches no ' +
      'release, so everything under it would be dropped from the page and from the release note ' +
      'without a word. Write it as "## ' + nearMiss[0].slice(0, 10) + '" and merge it into any ' +
      'section already carrying that date, because two sections cannot share one.');
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

/**
 * WHOSE TREE IS THIS, ASKED AS AN OPT-IN RATHER THAN INFERRED.
 *
 * THE FIRST VERSION OF THIS ASKED THE WRONG QUESTION AND A REVIEWER CAUGHT IT. It tested whether
 * studio.config.ps1 exists, on the reasoning that the file is the private half of the publisher
 * and is deliberately absent from the publish manifest. What that file actually means is that the
 * tool is CONFIGURED AT ALL: studio.ps1 refuses to publish anything without it, so every reader
 * who sets the tool up for their own project has one, and the refusal this predicate exists to
 * remove came straight back for them. Measured one line apart in a reader tree: exit 3 without
 * the file, exit 1 with a single leak-pattern line in it.
 *
 * SO IT IS DECLARED RATHER THAN DEDUCED. No inference from a file's presence can separate "this
 * tree publishes our releases page" from "this tree uses our tool", because every publisher is
 * also a user. A key nobody sets by accident can. Absent, the page and the changelog beside it
 * are treated as somebody else's artefacts, which is the safe direction: the cost of being wrong
 * that way is an advisory row here, and the cost of being wrong the other way is a refusal in a
 * stranger's repository that they cannot clear.
 *
 * It is a FUNCTION rather than two copies of one existsSync, because this predicate now decides
 * two different refusals and a partial borrow reads as a shared definition without being one
 * (S173). Change the evidence here and both sites move together.
 */
function publishesThisPage() {
  const cfg = path.join(ROOT, 'studio.config.ps1');
  let text;
  try { text = fs.readFileSync(cfg, 'utf8'); } catch (e) { return false; }
  return /^[^\S\r\n]*\$PublishesReleasesPage[^\S\r\n]*=[^\S\r\n]*\$true\b/mi.test(text);
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

  // EXIT 3 IS NOTHING TO COMPARE AGAINST, AND IT IS NOT A PASS.
  //
  // This check moved into the set every reader runs at session start, and until it did, the only
  // caller was a release in this repository where a changelog and a page both certainly exist.
  // Someone who clones the public export to run the METHOD and not the WEBSITE has neither, and a
  // check with only 0 and 1 turns that ordinary state into a red row at every session start with
  // no remedy except generating a page for a site they do not publish. That is the lockout class
  // this project has now shipped three times, each time by moving a check to a wider audience
  // without asking what the wider audience's tree looks like.
  //
  // The distinction the exit codes draw is DRIFT versus ABSENCE. A page that exists and disagrees
  // with the changelog is a finding and stays exit 1. A page that was never generated, or a
  // changelog with nothing dated in it yet, is not a disagreement between two things: there is
  // only one thing. The cost is stated rather than hidden: deleting releases.html in THIS
  // repository now reports advisory instead of red. That is accepted because the file is tracked,
  // so git reports it, and the publish regenerates it regardless.
  if (!fs.existsSync(changelogPath)) {
    process.stderr.write('NOTHING TO COMPARE: no changelog at ' + changelogPath +
      '. This project publishes no releases page, so there is nothing to hold to it.\n');
    return 3;
  }

  let result;
  try {
    result = build(fs.readFileSync(changelogPath, 'utf8'), { strict: strict });
  } catch (err) {
    if (/no dated releases found/.test(err.message)) {
      process.stderr.write('NOTHING TO COMPARE: ' + err.message +
        ' A changelog with no dated section yet is a project that has not released, not a fault.\n');
      return 3;
    }
    // A READER'S CHANGELOG THAT CANNOT PRODUCE OUR PAGE IS NOT A FAULT IN THEIR TREE.
    //
    // The whose-tree guard below was the right test in the wrong place. build() throws before it
    // can ever run, so the guard could only save a reader whose changelog parsed. The ordinary
    // reader state does not parse: this project's own non-negotiable rule tells them to write a
    // changelog entry before shipping, they write one in their own house style with no
    // "**What this gives you.**" block, and build() throws "not one release carries" at exit 1.
    // That reached them at EVERY session start, in a published artefact, with a remedy telling
    // them to rewrite their own changelog. Measured in a reader layout: session-start reported
    // FAILED releases-page exit 1, 3 failed, exit 1.
    //
    // ONLY IN --check, AND ONLY IN SOMEBODY ELSE'S TREE. A reader who RUNS the builder asked for
    // a page and gets the real error at exit 1, because then the throw is the answer to their
    // question. Here nobody asked: the check is comparing two files, and in a tree that does not
    // publish this page there is nothing it has standing to compare.
    if (check && !publishesThisPage()) {
      process.stderr.write('NOTHING TO COMPARE: your changelog does not build this studio\'s ' +
        'releases page (' + err.message + '), and this tree does not publish that page -- ' +
        'studio.config.ps1 is absent, so the page came with the export rather than being ' +
        'generated here. Your changelog is yours. If you do want to publish your own releases ' +
        'page, run: node tools/build-releases.js\n');
      return 3;
    }
    process.stderr.write('ERROR: ' + err.message + '\n');
    return 1;
  }

  const warnings = result.warnings.concat(
    checkSitemap(path.join(path.dirname(outPath), 'sitemap.xml'), result.releases[0].date));

  for (const w of warnings) process.stderr.write('WARNING: ' + w + '\n');

  if (check) {
    // ABSENT IS NOT STALE. Reading a missing file as an empty string made "never generated" and
    // "generated and now wrong" the same red row, and only the second is a disagreement.
    if (!fs.existsSync(outPath)) {
      process.stderr.write('NOTHING TO COMPARE: no page at ' + outPath +
        '. Generate one with: node tools/build-releases.js\n');
      return 3;
    }
    const existing = fs.readFileSync(outPath, 'utf8');
    if (existing === result.html) {
      process.stdout.write('releases.html is current: ' + result.releases.length +
        ' releases.\n');
      return 0;
    }

    // WHOSE PAGE IS THIS. The exit-3 split above separated DRIFT from ABSENCE and that was the
    // wrong axis, because the reader state that actually happens is DRIFT and it reached exit 1.
    //
    // The public manifest ships CHANGELOG.md, releases.html and tools/ together, and this
    // project's own non-negotiable rule tells every reader to write a changelog entry before
    // shipping anything. So a reader following the method adds a dated section to a changelog
    // that arrived with OUR generated page beside it, and the two legitimately disagree. That
    // read as drift and refused, at every session start, for as long as they kept using the
    // method. The only documented remedy regenerates the page, which writes this studio's own
    // marketing domain into their repository -- measured at 36 occurrences becoming 37.
    //
    // AND THE TWO STATES ARE IDENTICAL ON DISK. A reader's drift and ours are the same two files
    // in the same relation; nothing inside either file can tell them apart. The distinguishing
    // fact is whose tree it is, so that is what is asked. studio.config.ps1 is the private half
    // of the publisher: it holds the deploy hook and the leak samples, it is deliberately absent
    // from the publish manifest, and it exists only in the tree that actually publishes this
    // page. Absent, the page is somebody else's artefact and holding it to a changelog they now
    // own is a claim we have no standing to make.
    //
    // ADVISORY AND NOT SILENT. Exit 3 still prints, still shows in the row, and still names the
    // remedy for a reader who DOES want to publish their own page. What it does not do is refuse.
    if (!publishesThisPage()) {
      process.stderr.write('NOTHING TO COMPARE: releases.html disagrees with the changelog, but ' +
        'this tree does not publish that page -- studio.config.ps1 is absent, so the page came ' +
        'with the export rather than being generated here. Your changelog is yours and the page ' +
        'is ours. If you do publish your own releases page, run: node tools/build-releases.js\n');
      return 3;
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
