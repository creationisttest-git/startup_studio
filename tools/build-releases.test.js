#!/usr/bin/env node
/**
 * Unit tests for build-releases.js.
 *
 *   node tools/build-releases.test.js
 *
 * Exit code 0 = all passed, 1 = at least one failed. No dependencies, no network, no clock,
 * and nothing here reads or writes the real site files: the fixtures are strings and the two
 * command line tests build a throwaway directory under TEMP.
 *
 * What these cover is the layer under the interface: parsing, the guards that decide whether
 * a release reaches the page at all, date formatting, escaping, and the contract the page
 * makes with site.js and with a reader who has scripting turned off. The filter interaction
 * itself belongs to the end to end suite.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const B = require('./build-releases.js');

const TOOL = path.join(__dirname, 'build-releases.js');
const EM_DASH = String.fromCharCode(0x2014);

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (err) {
    fail++;
    process.stdout.write('FAIL  ' + name + '\n      ' + err.message.split('\n')[0] + '\n');
  }
}

function throws(fn, matcher, message) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  if (!threw) throw new Error(message || 'expected a throw, got none');
  if (matcher && !matcher.test(threw.message)) {
    throw new Error('threw the wrong error: ' + threw.message);
  }
  return threw;
}

/* ---------- fixtures ---------- */

const TWO_GOOD = [
  '# Changelog',
  '',
  '## 2026-08-21',
  '',
  '**What this gives you.** The health check now compares what is installed against the',
  'source, so an old copy cannot sit there looking healthy.',
  '',
  '### The internal heading nobody outside should read',
  '',
  'Byte order marks, mutation testing, PowerShell decoding.',
  '',
  '## 2026-08-11',
  '',
  '**What this gives you.** A name you asked to remove is actually gone.',
  '',
  '---',
  ''
].join('\n');

/* ---------- date formatting ---------- */

test('formatDate drops the leading zero from the day', function () {
  assert.strictEqual(B.formatDate('2026-08-03'), '3 August 2026');
});

test('formatDate names the month in full', function () {
  assert.strictEqual(B.formatDate('2026-08-21'), '21 August 2026');
  assert.strictEqual(B.formatDate('2025-12-31'), '31 December 2025');
  assert.strictEqual(B.formatDate('2026-01-01'), '1 January 2026');
});

test('formatDate refuses anything that is not an ISO date', function () {
  throws(function () { B.formatDate('21 August 2026'); }, /not an ISO date/);
  throws(function () { B.formatDate('2026-13-01'); }, /month out of range/);
  throws(function () { B.formatDate('2026-08-40'); }, /day out of range/);
});

/* ---------- parsing ---------- */

test('parseChangelog finds every dated section, newest first as written', function () {
  const got = B.parseChangelog(TWO_GOOD).map(function (r) { return r.date; });
  assert.deepStrictEqual(got, ['2026-08-21', '2026-08-11']);
});

test('parseChangelog ignores a dated heading inside a fenced code block', function () {
  const text = [
    '## 2026-08-21',
    '',
    '**What this gives you.** Real.',
    '',
    '```',
    '## 2026-01-01',
    '## How to test',
    '```',
    ''
  ].join('\n');
  const got = B.parseChangelog(text).map(function (r) { return r.date; });
  assert.deepStrictEqual(got, ['2026-08-21'], 'a fenced heading became a release');
});

test('parseChangelog ignores a level two heading that is not a date', function () {
  const text = '## Earlier\n\n**What this gives you.** No.\n\n## 2026-08-21\n\n**What this gives you.** Yes.\n';
  const got = B.parseChangelog(text).map(function (r) { return r.date; });
  assert.deepStrictEqual(got, ['2026-08-21']);
});

test('a level one heading ends the current section', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** In.\n\n# Something else\n\nOut of the section.\n';
  const section = B.parseChangelog(text)[0];
  assert.ok(section.lines.join('\n').indexOf('Out of the section') === -1);
});

/* ---------- the value block ---------- */

test('the value block is taken from the marker to the next heading', function () {
  const section = B.parseChangelog(TWO_GOOD)[0];
  const body = B.extractValueBlock(section.lines).join(' ');
  assert.ok(body.indexOf('health check now compares') !== -1, 'lost the block');
  assert.ok(body.indexOf('Byte order marks') === -1, 'internal detail leaked past the heading');
});

test('the value block stops at a horizontal rule', function () {
  const lines = ['**What this gives you.** Kept.', '', '---', '', 'Dropped.'];
  assert.deepStrictEqual(B.extractValueBlock(lines), ['Kept.']);
});

test('a release with no marker yields no block', function () {
  assert.strictEqual(B.extractValueBlock(['### A heading', 'Some prose.']), null);
});

test('the marker is accepted with or without its full stop', function () {
  assert.deepStrictEqual(B.extractValueBlock(['**What this gives you** Fine.']), ['Fine.']);
  assert.deepStrictEqual(B.extractValueBlock(['**What this gives you:** Fine.']), ['Fine.']);
});

test('a value block may run to several paragraphs', function () {
  const lines = ['**What this gives you.** One.', '', 'Two.', '', '### stop'];
  assert.deepStrictEqual(B.extractValueBlock(lines), ['One.', '', 'Two.']);
});

/* A DATED SECTION HOLDS ONE BLOCK PER CHANGE AND MOST DAYS SHIP MORE THAN ONE. Taking only the
   first dropped every later block from the page and nothing reported it, because --check compares
   the page against the changelog and the page was faithful to the first block. Measured on
   2026-09-10 against the real file: 144 list items published where the changelog holds 168, so
   twenty four bullets of release notes had been missing with the tool printing "current".
   The three assertions below are separate on purpose. The first is the defect itself. The second
   proves the SECOND block's own content arrives rather than merely a bullet count rising, because
   a count can be satisfied by duplicating the first. The third pins the ORDER, since a page that
   carries both blocks in the wrong order still misreports which change is which. Mutation: put
   `break` back after the first block and the first two go red together while the paragraph
   assertion above stays green, which is what proves these carry the property on their own. */
test('every value block in a dated section is gathered, not just the first', function () {
  const lines = [
    '### Newest change', '',
    '**What this gives you.** One.', '',
    '### Older change on the same day', '',
    '**What this gives you.** Two.'
  ];
  assert.deepStrictEqual(B.extractValueBlock(lines), ['One.', '', 'Two.']);
});

test('the later block reaches the page with its own content, not a repeat of the first', function () {
  const md = [
    '# Changelog', '',
    '## 2026-01-02', '',
    '### First', '',
    '**What this gives you.**',
    '- Alpha bullet.', '',
    '### Second', '',
    '**What this gives you.**',
    '- Omega bullet.', ''
  ].join('\n');
  const html = B.build(md).html;
  assert.ok(html.indexOf('Alpha bullet.') !== -1, 'the first block never reached the page');
  assert.ok(html.indexOf('Omega bullet.') !== -1,
    'the SECOND block was dropped from the page, which is the defect this test exists for');
});

test('gathered blocks keep the order they were written in', function () {
  const lines = [
    '**What this gives you.** Alpha.', '',
    '### next', '',
    '**What this gives you.** Omega.'
  ];
  const body = B.extractValueBlock(lines).join('\n');
  assert.ok(body.indexOf('Alpha.') < body.indexOf('Omega.'),
    'the blocks came back out of order, so the page misreports which change is which');
});

/* ---------- rendering prose ---------- */

test('renderBody turns a wrapped paragraph into one p element', function () {
  const html = B.renderBody(['A sentence that', 'was wrapped.'], 0).join('\n');
  assert.strictEqual(html, '<p>A sentence that was wrapped.</p>');
});

test('renderBody turns dashes into a list', function () {
  const html = B.renderBody(['- one', '- two'], 0).join('\n');
  assert.ok(html.indexOf('<ul class="rel-points">') === 0, html);
  assert.strictEqual((html.match(/<li>/g) || []).length, 2);
});

test('inline markup covers bold, italic, code and links, and nothing else', function () {
  assert.strictEqual(B.inline('**bold**'), '<strong>bold</strong>');
  assert.strictEqual(B.inline('*soft*'), '<em>soft</em>');
  assert.strictEqual(B.inline('`studio -Doctor`'), '<code>studio -Doctor</code>');
  assert.strictEqual(B.inline('[the board](/how-to)'), '<a href="/how-to">the board</a>');
  assert.strictEqual(B.inline('# not a heading'), '# not a heading');
});

test('a link to anything other than http, a path, an anchor or mail is left as text', function () {
  const out = B.inline('[tap](javascript:alert(1))');
  assert.ok(out.indexOf('<a') === -1, 'emitted a script URL: ' + out);
});

test('markup inside a code span is not interpreted', function () {
  assert.strictEqual(B.inline('`**not bold**`'), '<code>**not bold**</code>');
});

test('html in the changelog is escaped, never rendered', function () {
  const out = B.inline('<script>alert(1)</script> & "quotes"');
  assert.ok(out.indexOf('<script>') === -1, out);
  assert.ok(out.indexOf('&lt;script&gt;') !== -1, out);
  assert.ok(out.indexOf('&amp;') !== -1, out);
});

/* ---------- the guards ---------- */

test('a release with no value block is skipped and named in the warning', function () {
  const text = TWO_GOOD + '\n## 2026-08-06\n\n### Internal only\n\nNothing public here.\n';
  const out = B.build(text);
  assert.deepStrictEqual(out.releases.map(function (r) { return r.date; }),
    ['2026-08-21', '2026-08-11']);
  assert.strictEqual(out.warnings.length, 1);
  assert.ok(out.warnings[0].indexOf('2026-08-06') !== -1, out.warnings[0]);
  assert.ok(out.html.indexOf('2026-08-06') === -1, 'an empty card was emitted anyway');
});

test('a near miss on the marker warns differently, so the fix is obvious', function () {
  const text = TWO_GOOD + '\n## 2026-08-06\n\n### What this gives you\n\nWrong shape.\n';
  const out = B.build(text);
  assert.ok(/not as a line that begins with it in bold/.test(out.warnings[0]), out.warnings[0]);
});

test('a changelog where no release has a block fails and produces no page', function () {
  const text = '## 2026-08-21\n\n### Internal\n\nDetail.\n';
  throws(function () { B.build(text); }, /nothing was written/);
});

test('a changelog with no dated heading at all fails', function () {
  throws(function () { B.build('# Changelog\n\nnothing dated here\n'); }, /no dated releases/);
});

test('two sections on the same date fail rather than colliding on one anchor', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## 2026-08-21\n\n**What this gives you.** B.\n';
  throws(function () { B.build(text); }, /two sections dated 2026-08-21/);
});

// A HEADING THE PARSER REFUSED USED TO VANISH AND THE PAGE STILL REPORTED CURRENT. The date
// pattern is anchored at both ends, so "## 2026-09-11 (second entry)" matched no release and set
// the current section to nothing: every line under it was dropped and the build carried on at
// exit 0. That is not hypothetical. A peer session wrote exactly that heading to get past the
// duplicate-date refusal above, and its whole entry was about to ship in the public export
// announced by no page and no release note. It was found by a reviewer reading git log, because no
// instrument could see a section the parser had skipped.
//
// The two peer sessions asked about it both named the same generalisation, independently: the
// defect is a check that cannot tell "nothing to report" from "I parsed nothing", and the guard
// has to be a COUNT of what was consumed rather than a pattern for the near miss somebody already
// thought of. Hence the second test: an unrecognised heading is counted and reported, and it only
// WARNS, because a reader's changelog may carry structural headings this build knows nothing
// about and refusing on those is the reader lockout this repository has shipped three times.
test('a heading that is nearly a date refuses, rather than dropping its section in silence', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## 2026-08-21 (second entry)\n\n**What this gives you.** B.\n';
  throws(function () { B.build(text); }, /nearly a date and matches no release/);
});

test('an unrecognised heading is counted and warned about rather than silently dropped', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## Release five\n\n**What this gives you.** B.\n';
  const r = B.build(text);
  if (!r.warnings.some(function (w) { return /Release five/.test(w); })) {
    throw new Error('no warning named the dropped heading: ' + JSON.stringify(r.warnings));
  }
});

// ST-268. The asymmetry above is what the release of 2026-09-18 came through: a near-miss date
// threw and "## Unreleased" carrying five entries only warned, although both make Get-ReleaseNote
// select the PREVIOUS dated section's note for the private AND the public commit. These three
// cases hold the line where it now sits: content under the heading throws, no content still warns.
test('an undated heading CARRYING ENTRIES refuses, because the release note would come from the previous date', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## Unreleased\n\n### Something shipped\n\n**What this gives you.** B.\n';
  throws(function () { B.build(text); }, /carries release content and is not a date/);
});

test('an undated heading carrying a bulleted entry refuses as well, since that is the other entry shape', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## Unreleased\n\n- **A thing.** B.\n';
  throws(function () { B.build(text); }, /carries release content and is not a date/);
});

test('an undated heading with no entries under it still only WARNS, so a reader with prose dividers is not locked out', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## Notes\n\nJust a paragraph, no entry.\n';
  const r = B.build(text);
  if (!r.warnings.some(function (w) { return /Notes/.test(w); })) {
    throw new Error('an empty unconsumed heading should warn: ' + JSON.stringify(r.warnings));
  }
});

test('an entry under a DATED heading is not mistaken for content under an earlier undated one', function () {
  // The section tracker has to reset at every "## ". Without the reset, entries belonging to the
  // dated section below would be attributed to the undated heading above it and the build would
  // refuse a changelog that is completely correct, which is the reader lockout in a new costume.
  const text = '## Notes\n\nJust a paragraph.\n\n## 2026-08-21\n\n### Real entry\n\n**What this gives you.** A.\n';
  const r = B.build(text);
  if (!r.warnings.some(function (w) { return /Notes/.test(w); })) {
    throw new Error('expected a warning and not a refusal: ' + JSON.stringify(r.warnings));
  }
});

test('a structural heading the build knows is not warned about, so the count is not noise', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** A.\n\n## Earlier\n\nolder notes\n';
  const r = B.build(text);
  if (r.warnings.some(function (w) { return /Earlier/.test(w); })) {
    throw new Error('warned about a structural heading: ' + JSON.stringify(r.warnings));
  }
});

test('an em dash reaching the page stops the build and names the line', function () {
  const text = '## 2026-08-21\n\n**What this gives you.** One thing ' + EM_DASH + ' and another.\n';
  const err = throws(function () { B.build(text); }, /em dash/);
  assert.ok(/at line \d+/.test(err.message), err.message);
});

test('a control character reaching the page stops the build', function () {
  const bell = String.fromCharCode(7);
  const text = '## 2026-08-21\n\n**What this gives you.** Bad' + bell + 'char.\n';
  throws(function () { B.build(text); }, /control character/);
});

test('strict turns every warning into a failure', function () {
  const text = TWO_GOOD + '\n## 2026-08-06\n\n### Internal only\n\nNothing public.\n';
  assert.strictEqual(B.build(text).warnings.length, 1);
  throws(function () { B.build(text, { strict: true }); }, /strict mode/);
});

test('out of order releases are sorted newest first, and the file is flagged', function () {
  const text = '## 2026-08-11\n\n**What this gives you.** Older.\n\n## 2026-08-21\n\n**What this gives you.** Newer.\n';
  const out = B.build(text);
  assert.deepStrictEqual(out.releases.map(function (r) { return r.date; }),
    ['2026-08-21', '2026-08-11']);
  assert.ok(/newest-first order/.test(out.warnings.join(' ')), 'sorted silently');
});

/* ---------- the page contract ---------- */

test('the build is idempotent: the same input gives byte identical output', function () {
  assert.strictEqual(B.build(TWO_GOOD).html, B.build(TWO_GOOD).html);
});

test('carriage returns in the changelog do not reach the page', function () {
  const crlf = TWO_GOOD.replace(/\n/g, '\r\n');
  const out = B.build(crlf);
  assert.ok(out.html.indexOf('\r') === -1, 'a carriage return survived');
  assert.strictEqual(out.html, B.build(TWO_GOOD).html, 'line endings changed the output');
});

test('the page has no byte order mark and ends with one newline', function () {
  const html = B.build(TWO_GOOD).html;
  assert.notStrictEqual(html.charCodeAt(0), 0xFEFF);
  assert.ok(/<\/html>\n$/.test(html), 'the page does not end cleanly');
});

test('the latest release is the first card and the only one open', function () {
  const html = B.build(TWO_GOOD).html;
  const cards = html.match(/<details class="rel"[^>]*>/g);
  assert.strictEqual(cards.length, 2);
  assert.ok(/id="r-2026-08-21"/.test(cards[0]), cards[0]);
  assert.ok(/ open>/.test(cards[0]), 'the latest release is not open: ' + cards[0]);
  assert.ok(!/ open>/.test(cards[1]), 'an older release is open: ' + cards[1]);
});

test('only the latest release carries the Latest release tag', function () {
  const html = B.build(TWO_GOOD).html;
  assert.strictEqual((html.match(/class="rel-tag"/g) || []).length, 1);
});

test('with scripting off every release is still on the page', function () {
  const html = B.build(TWO_GOOD).html;
  assert.ok(html.indexOf('id="r-2026-08-21"') !== -1);
  assert.ok(html.indexOf('id="r-2026-08-11"') !== -1);
  assert.ok(html.indexOf('<noscript>') !== -1, 'no fallback message for a reader without JS');
  assert.ok(html.indexOf('A name you asked to remove is actually gone.') !== -1,
    'an older release has a card but no readable copy');
});

test('the filter lists every release by date, plus an all option', function () {
  const html = B.build(TWO_GOOD).html;
  const opts = html.match(/<option value="[^"]*">[^<]*<\/option>/g);
  assert.strictEqual(opts.length, 3, opts.join('\n'));
  assert.ok(/value="all"/.test(opts[0]), opts[0]);
  assert.ok(opts[1].indexOf('21 August 2026') !== -1, opts[1]);
  assert.ok(opts[2].indexOf('11 August 2026') !== -1, opts[2]);
});

test('the select has a label bound to it by id', function () {
  const html = B.build(TWO_GOOD).html;
  assert.ok(/<label for="release-filter">/.test(html), 'the select has no label');
  assert.ok(/<select id="release-filter"/.test(html), 'the label points at nothing');
});

test('the status paragraph site.js writes into is always emitted', function () {
  const html = B.build(TWO_GOOD).html;
  assert.ok(/id="rel-status"/.test(html), 'the status target is missing');
  assert.ok(/role="status"/.test(html) && /aria-live="polite"/.test(html),
    'the status target is not announced');
});

test('the nav matches the other pages and Releases is the current one', function () {
  const html = B.build(TWO_GOOD).html;
  const links = html.match(/<a href="\/[a-z-]*"[^>]*><span class="n">\d\d<\/span>[^<]*<\/a>/g);
  /* A hardcoded count, updated by hand when a page is added. That is the point rather than an
     inconvenience: this page's nav is GENERATED and the other six are hand-written, so the only
     thing stopping them drifting apart is a number somebody changes on purpose. It earned its
     keep the first time it was tested, going red the moment Reference reached the other pages. */
  assert.strictEqual(links.length, 7, links.join('\n'));
  assert.ok(links[5].indexOf('06') !== -1 && links[5].indexOf('Releases') !== -1, links[5]);
  assert.ok(links[6].indexOf('07') !== -1 && links[6].indexOf('Reference') !== -1, links[6]);
  assert.strictEqual((html.match(/aria-current="page"/g) || []).length, 1);
  assert.ok(/href="\/releases" aria-current="page"/.test(html), 'the wrong link is current');
});

test('the head carries the canonical and social tags the other five pages carry', function () {
  const html = B.build(TWO_GOOD).html;
  const need = [
    '<link rel="canonical" href="https://startupstudio.projectfreedom.xyz/releases">',
    '<meta property="og:url" content="https://startupstudio.projectfreedom.xyz/releases">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="color-scheme" content="dark">',
    '<link rel="stylesheet" href="/site.css">',
    '<script src="/site.js"></script>'
  ];
  need.forEach(function (n) {
    assert.ok(html.indexOf(n) !== -1, 'missing from the page: ' + n);
  });
});

test('no internal heading from the changelog reaches the page', function () {
  const html = B.build(TWO_GOOD).html;
  assert.ok(html.indexOf('The internal heading nobody outside should read') === -1);
  assert.ok(html.indexOf('PowerShell decoding') === -1);
});

/* ---------- the sitemap check ---------- */

test('checkSitemap says so when the page is not listed', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const p = path.join(dir, 'sitemap.xml');
  fs.writeFileSync(p, '<urlset><url><loc>https://x/</loc><lastmod>2026-08-17</lastmod></url></urlset>');
  const out = B.checkSitemap(p, '2026-08-21');
  assert.strictEqual(out.length, 1);
  assert.ok(/does not list \/releases/.test(out[0]), out[0]);
});

test('checkSitemap says so when the date has fallen behind the newest release', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const p = path.join(dir, 'sitemap.xml');
  fs.writeFileSync(p,
    '<urlset><url><loc>https://x/releases</loc><lastmod>2026-08-17</lastmod></url></urlset>');
  const stale = B.checkSitemap(p, '2026-08-21');
  assert.strictEqual(stale.length, 1);
  assert.ok(/lastmod of 2026-08-17/.test(stale[0]), stale[0]);
  assert.deepStrictEqual(B.checkSitemap(p, '2026-08-17'), []);
});

/* ---------- the command line ---------- */

function run(args, cwd) {
  const r = cp.spawnSync(process.execPath, [TOOL].concat(args), {
    cwd: cwd, encoding: 'utf8'
  });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

test('running it twice writes the same bytes', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const cl = path.join(dir, 'CHANGELOG.md');
  const out = path.join(dir, 'releases.html');
  fs.writeFileSync(cl, TWO_GOOD);

  const first = run(['--changelog', cl, '--out', out], dir);
  assert.strictEqual(first.code, 0, first.err);
  const a = fs.readFileSync(out);
  run(['--changelog', cl, '--out', out], dir);
  const b = fs.readFileSync(out);
  assert.ok(a.equals(b), 'the second run produced different bytes');
});

test('a skipped release is named on stderr, not swallowed', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const cl = path.join(dir, 'CHANGELOG.md');
  fs.writeFileSync(cl, TWO_GOOD + '\n## 2026-08-06\n\n### Internal\n\nDetail.\n');
  const r = run(['--changelog', cl, '--out', path.join(dir, 'releases.html')], dir);
  assert.strictEqual(r.code, 0, r.err);
  assert.ok(/WARNING: release 2026-08-06/.test(r.err), 'no warning on stderr: ' + r.err);
});

test('a changelog with no value blocks exits non zero and writes no file', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const cl = path.join(dir, 'CHANGELOG.md');
  const out = path.join(dir, 'releases.html');
  fs.writeFileSync(cl, '## 2026-08-21\n\n### Internal\n\nDetail.\n');
  const r = run(['--changelog', cl, '--out', out], dir);
  assert.strictEqual(r.code, 1, 'it succeeded on an empty page');
  assert.ok(!fs.existsSync(out), 'it wrote a page anyway');
  assert.ok(/^ERROR: /m.test(r.err), r.err);
});

test('check mode fails on a stale page and writes nothing', function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  const cl = path.join(dir, 'CHANGELOG.md');
  const out = path.join(dir, 'releases.html');
  fs.writeFileSync(cl, TWO_GOOD);
  run(['--changelog', cl, '--out', out], dir);
  assert.strictEqual(run(['--check', '--changelog', cl, '--out', out], dir).code, 0);

  fs.writeFileSync(cl, TWO_GOOD + '\n## 2026-08-22\n\n**What this gives you.** New.\n');
  const before = fs.readFileSync(out, 'utf8');
  const r = run(['--check', '--changelog', cl, '--out', out], dir);
  assert.strictEqual(r.code, 1, 'check mode passed a stale page');
  assert.strictEqual(fs.readFileSync(out, 'utf8'), before, 'check mode wrote to the page');
});

/* ---------- the page it actually ships ---------- */

test('the shipped releases.html matches the changelog it was built from', function () {
  const root = path.resolve(__dirname, '..');
  const page = path.join(root, 'releases.html');
  if (!fs.existsSync(page)) {
    throw new Error('releases.html has not been generated yet');
  }
  const built = B.build(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).html;
  assert.strictEqual(fs.readFileSync(page, 'utf8'), built,
    'releases.html has drifted from CHANGELOG.md. Run: node tools/build-releases.js');
});

/* ---------- structured data ---------- */

/* Parsed as JSON, then asserted on the parsed object. A substring check against the HTML would
   pass on a block that is malformed, truncated, or describes the wrong page, and this whole
   studio has a standing rule that a check must fail for the reason it claims to test. */
function graphOf(html) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('the page carries no structured data at all');
  return JSON.parse(m[1])['@graph'];
}

test('the page declares structured data that is valid JSON', function () {
  const g = graphOf(B.build(TWO_GOOD).html);
  assert.ok(Array.isArray(g), 'the graph is not an array');
});

test('the structured data describes this page and links the site graph', function () {
  const page = graphOf(B.build(TWO_GOOD).html).filter(function (n) {
    return n['@type'] === 'WebPage';
  })[0];
  assert.ok(page, 'no WebPage node');
  assert.ok(/\/releases$/.test(page.url), 'the WebPage url is not the releases page');
  /* isPartOf and about point at ids the HOMEPAGE declares. Without them search engines read two
     unrelated pages instead of one site, which is the entire reason for using @id. */
  assert.ok(page.isPartOf && /#website$/.test(page.isPartOf['@id']), 'not part of the site graph');
  assert.ok(page.about && /#app$/.test(page.about['@id']), 'not linked to the application node');
});

test('every release on the page is listed in the structured data', function () {
  const built = B.build(TWO_GOOD);
  const list = graphOf(built.html).filter(function (n) { return n['@type'] === 'ItemList'; })[0];
  assert.ok(list, 'no ItemList node');
  /* Against the RELEASES, not against a hard-coded number. A count that agrees with itself would
     survive the generator dropping a release, which is the failure worth catching. */
  assert.strictEqual(list.numberOfItems, built.releases.length, 'numberOfItems disagrees');
  assert.strictEqual(list.itemListElement.length, built.releases.length, 'wrong number of items');
});

test('each listed release links to the anchor that opens it', function () {
  const built = B.build(TWO_GOOD);
  const list = graphOf(built.html).filter(function (n) { return n['@type'] === 'ItemList'; })[0];
  built.releases.forEach(function (r, i) {
    const item = list.itemListElement[i];
    assert.strictEqual(item.position, i + 1, 'positions are out of order');
    assert.ok(item.url.endsWith('/releases#r-' + r.date),
      'item ' + i + ' does not link to #r-' + r.date + ', so the address is not the one the page uses');
    /* The anchor has to EXIST in the markup. A url that points at nothing is worse than no url:
       it is a claim the page does not support, which is the studio's S25 in one line. */
    assert.ok(built.html.indexOf('id="r-' + r.date + '"') !== -1,
      'the page has no element with id r-' + r.date);
  });
});

test('the structured data dates itself from the newest release', function () {
  const built = B.build(TWO_GOOD);
  const page = graphOf(built.html).filter(function (n) { return n['@type'] === 'WebPage'; })[0];
  assert.strictEqual(page.dateModified, built.releases[0].date,
    'dateModified is not the newest release, so the freshness signal is wrong');
});

test('no release prose reaches the structured data', function () {
  /* This replaced an injection test that stayed GREEN under mutation, which is the only honest
     verdict available: the block carries dates, titles and urls and NO body text, so a hostile
     value in the prose cannot reach it and the escaping guard is unreachable today. A test that
     cannot fail is worth less than no test, because it is read as coverage.

     So this asserts the property that IS true and IS worth defending: the structured data
     describes the page, it does not republish it. The day somebody adds a description field
     built from a release body, this goes red and the guard stops being decorative. */
  const marker = 'UNIQUEPROSEMARKER';
  const withProse = TWO_GOOD.replace('**What this gives you.**',
    '**What this gives you.** ' + marker);
  assert.ok(withProse.indexOf(marker) !== -1, 'the fixture does not contain what it is testing');
  const html = B.build(withProse).html;
  assert.ok(html.indexOf(marker) !== -1, 'the marker never reached the page, so this proves nothing');
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(block, 'the page carries no structured data');
  assert.strictEqual(block[1].indexOf(marker), -1,
    'release prose reached the structured data. Either escape it properly or do not put it there.');
  JSON.parse(block[1]);
});

/* ---------- whose page is it: the reader's layout, not this one ----------

   THE FAULT THESE ASSERT WAS NEVER TRUE IN THIS REPOSITORY, which is why it shipped. This
   repository always has studio.config.ps1, a changelog and a page it generated itself, so every
   path a test could reach from here was already green. The reader who clones the public export
   gets CHANGELOG.md, releases.html and tools/ together and is told by this project's own
   non-negotiable rule to write a changelog entry before shipping -- and that read as drift and
   refused, at every session start, once the check moved into the session-start set.

   So these build a TREE rather than passing flags: the tool is copied into a fixture's tools/
   directory, because the tool asks about the tree it is installed in. Asserting from here with
   --changelog and --out would keep resolving against this repository and prove nothing: a
   published check has to be measured in the layout its reader has. Each case fails alone. */

function readerTree(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-reader-'));
  fs.mkdirSync(path.join(dir, 'tools'));
  fs.copyFileSync(TOOL, path.join(dir, 'tools', 'build-releases.js'));
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), opts.changelog, 'utf8');
  if (opts.page !== undefined) fs.writeFileSync(path.join(dir, 'releases.html'), opts.page, 'utf8');
  if (opts.publisher) {
    fs.writeFileSync(path.join(dir, 'studio.config.ps1'), '$PublishesReleasesPage = $true\n', 'utf8');
  }
  // CONFIGURED BUT NOT OPTED IN. This is the state that had no fixture and no assertion, and the
  // predicate's first version treated it as the publisher: studio.ps1 refuses to publish without
  // a configuration, so every reader who uses the tool for their own project is standing here.
  if (opts.configured) {
    fs.writeFileSync(path.join(dir, 'studio.config.ps1'), '$LeakPatterns = @()\n', 'utf8');
  }
  // DECLARED AND TURNED OFF. Added because a mutation returned DELTA ZERO: loosening the match
  // from the literal $true to any word left every assertion green, since no fixture had ever
  // written anything but $true. A declaration that cannot be revoked is not a declaration, and
  // somebody who sets this to $false has said the opposite of opting in.
  if (opts.optedOut) {
    fs.writeFileSync(path.join(dir, 'studio.config.ps1'), '$PublishesReleasesPage = $false\n', 'utf8');
  }
  return dir;
}
function checkIn(dir) {
  const r = cp.spawnSync(process.execPath, [path.join(dir, 'tools', 'build-releases.js'), '--check'],
    { cwd: dir, encoding: 'utf8' });
  return { code: r.status, err: r.stderr || '', out: r.stdout || '' };
}

// The reader's own entry, added on top of the shipped changelog, against the shipped page.
const READER_ENTRY = ['# Changelog', '', '## 2026-09-11', '',
  '**What this gives you.** My own project shipped its first change.', ''].join('\n');

test('a tree that does not publish the page is advisory when the page disagrees', function () {
  const dir = readerTree({ changelog: TWO_GOOD, page: B.build(READER_ENTRY).html });
  const r = checkIn(dir);
  assert.strictEqual(r.code, 3, 'the reader state must be advisory, not a refusal. Got ' + r.code);
  assert.ok(/does not publish that page/.test(r.err), 'the reason must name why: ' + r.err);
});

/* RESTATED AFTER A MUTATION FALSIFIED IT. This first read "advisory must not read as a pass"
   and asserted only that stdout lacks "is current". Deleting the whole tree-identity guard left
   it GREEN, because the refusal branch prints nothing to stdout either -- so it was satisfied by
   the output of the case it exists to exclude and separated nothing. It now names the refusal
   wording the reader must never see, which is the exact string that comes back when the guard
   goes. Both directions are asserted so a pass cannot be mistaken for a refusal or the reverse. */
test('and the reader never sees the refusal wording', function () {
  const dir = readerTree({ changelog: TWO_GOOD, page: B.build(READER_ENTRY).html });
  const r = checkIn(dir);
  assert.ok(!/does not match the changelog/.test(r.err),
    'the reader got the refusal wording, which is the lockout this scope exists to remove');
  assert.ok(!/is current/.test(r.out), 'advisory must not read as a pass either');
});

/* THE OTHER DIRECTION, AND THE ONE THAT MATTERS MORE. A scope that quietly stops the check
   working here would be worse than the lockout it fixes, because nothing else watches the
   published page. Same fixture, one extra file. */
test('DRIFT STAYS RED in a tree that does publish the page', function () {
  const dir = readerTree({ changelog: TWO_GOOD, page: B.build(READER_ENTRY).html, publisher: true });
  const r = checkIn(dir);
  assert.strictEqual(r.code, 1, 'a publishing tree must still refuse on drift. Got ' + r.code);
  assert.ok(/does not match the changelog/.test(r.err), r.err);
});

test('a publishing tree whose page is current still passes', function () {
  const dir = readerTree({ changelog: TWO_GOOD, page: B.build(TWO_GOOD).html, publisher: true });
  assert.strictEqual(checkIn(dir).code, 0);
});

/* ABSENCE, which is the split that shipped last sitting and was asserted nowhere. Both were
   proved by hand on a copy and by no instrument, which is the defect this studio keeps finding
   in its own fixes rather than in its features. */
test('no page at all is advisory rather than red', function () {
  const dir = readerTree({ changelog: TWO_GOOD, publisher: true });
  const r = checkIn(dir);
  assert.strictEqual(r.code, 3, 'absence is not drift. Got ' + r.code);
  assert.ok(/no page at/.test(r.err), r.err);
});

test('a changelog with no dated section is advisory rather than red', function () {
  const dir = readerTree({ changelog: '# Changelog\n\nNothing released yet.\n', publisher: true });
  assert.strictEqual(checkIn(dir).code, 3);
});

/* ---------- the reader's changelog that does not BUILD, which is the ordinary case ----------

   THE GUARD ABOVE WAS THE RIGHT TEST IN THE WRONG PLACE, and every assertion above it passed
   because each one handed the fixture a changelog that parses. The reader state that actually
   happens does not parse. This project's own non-negotiable rule tells them to write a changelog
   entry before shipping anything; they write one in their own house style, with no
   "**What this gives you.**" marker, and build() throws before the tree-identity guard can run.
   Measured in a reader layout before the fix: node tools/run-checks.js --set session-start
   reported FAILED releases-page exit 1, 3 failed, exit 1. So the remedy printed at every session
   start told a stranger to rewrite their own changelog to this house's marker. */

const READER_OWN_STYLE = ['# Changelog', '', '## 2026-09-11', '',
  '- Added a thing.', '- Fixed another thing.', ''].join('\n');

test('a changelog that does not build this page is advisory in a tree that does not publish it', function () {
  const dir = readerTree({ changelog: READER_OWN_STYLE, page: '<html>ours</html>' });
  const r = checkIn(dir);
  assert.strictEqual(r.code, 3, 'the ordinary reader entry must be advisory, not a refusal. Got ' + r.code);
  assert.ok(/does not publish that page/.test(r.err), 'the reason must name whose tree it is: ' + r.err);
  assert.ok(!/^ERROR:/m.test(r.err), 'a reader must not be handed a build error for their own file: ' + r.err);
});

/* THE OTHER DIRECTION, AND IT IS THE REASON THE CHECK EXISTS. A scope that swallowed the build
   failure everywhere would hide a genuinely broken changelog in the one tree that publishes the
   page. Same input, one extra file. */
test('and the same changelog still REFUSES in a tree that does publish the page', function () {
  const dir = readerTree({ changelog: READER_OWN_STYLE, page: '<html>ours</html>', publisher: true });
  const r = checkIn(dir);
  assert.strictEqual(r.code, 1, 'the publisher must still be refused on a changelog that cannot build. Got ' + r.code);
  assert.ok(/not one release carries/.test(r.err), 'and must be told what is actually wrong: ' + r.err);
});

/* THE SCOPE IS --check AND NOT THE TOOL. A reader who RUNS the builder asked for a page, so the
   throw is the answer to their question and they get it in full. Widening the advisory to the
   write path would have them told nothing was wrong while nothing was written. */
test('a reader who RUNS the builder still gets the real error', function () {
  const dir = readerTree({ changelog: READER_OWN_STYLE });
  const r = cp.spawnSync(process.execPath, [path.join(dir, 'tools', 'build-releases.js')],
    { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(r.status, 1, 'someone who asked to build must be told it failed. Got ' + r.status);
  assert.ok(/not one release carries/.test(r.stderr || ''), r.stderr);
});

/* ---------- configured is not the same as publishing ----------

   FOUND BY THE PRODUCT GATE, one commit after the fix it reviews. The predicate asked whether
   studio.config.ps1 exists, and that file means the tool is CONFIGURED, not that this tree
   publishes our page. Measured one line apart in a reader tree: exit 3 with no config, exit 1
   with a single leak-pattern line in it. So the refusal the whole scope exists to remove came
   back for every reader who set the tool up, which is the documented way to use it. */

test('a reader who has CONFIGURED the tool is still not the publisher of this page', function () {
  const dir = readerTree({ changelog: READER_OWN_STYLE, page: '<html>ours</html>', configured: true });
  const r = checkIn(dir);
  assert.strictEqual(r.code, 3, 'a configured tool is not a declaration to publish. Got ' + r.code);
  assert.ok(/does not publish that page/.test(r.err), r.err);
});

test('and a configured reader is not refused on DRIFT either', function () {
  const dir = readerTree({ changelog: TWO_GOOD, page: B.build(READER_ENTRY).html, configured: true });
  assert.strictEqual(checkIn(dir).code, 3, 'both refusals take the same predicate, so both move together');
});

/* THE OPT-IN HAS TO BE REACHABLE, or this is a lockout wearing a different hat: someone who DOES
   publish their own page must be able to say so and get the check back. */
test('declaring the opt-in turns the check back on for whoever sets it', function () {
  const dir = readerTree({ changelog: READER_OWN_STYLE, page: '<html>mine</html>', publisher: true });
  assert.strictEqual(checkIn(dir).code, 1, 'an opted-in tree asked for this check and must get it');
});

test('the declaration set to $false is an opt OUT, not a word where a value should be', function () {
  const dir = readerTree({ changelog: READER_OWN_STYLE, page: '<html>ours</html>', optedOut: true });
  assert.strictEqual(checkIn(dir).code, 3,
    'turning the declaration off must not read as turning it on. Got ' + checkIn(dir).code);
});

/* ---------- summary ---------- */

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 76;
const ranBefore = pass + fail;
test('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  function () { assert.strictEqual(ranBefore, EXPECTED_ASSERTIONS - 1); });

process.stdout.write('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
