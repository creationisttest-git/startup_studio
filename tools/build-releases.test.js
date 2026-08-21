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

test('the sixth nav entry is Releases and it is the current page', function () {
  const html = B.build(TWO_GOOD).html;
  const links = html.match(/<a href="\/[a-z-]*"[^>]*><span class="n">\d\d<\/span>[^<]*<\/a>/g);
  assert.strictEqual(links.length, 6, links.join('\n'));
  assert.ok(links[5].indexOf('06') !== -1 && links[5].indexOf('Releases') !== -1, links[5]);
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

/* ---------- summary ---------- */

process.stdout.write('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
