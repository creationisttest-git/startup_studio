#!/usr/bin/env node
/**
 * check-comment-shape.js -- counts the comment lines in published code that speak to the
 * session that wrote them rather than to a stranger holding only the code, and holds every
 * published file to a committed baseline that only moves down.
 *
 * Why this exists. A comment that names a ticket, a role on the roster or a gate round is a
 * note from one working session to the next. To anyone who has cloned the repository it is a
 * reference into a record they do not have. The rule is that a comment in published code says
 * WHY, to a stranger holding only the code, and that provenance goes on the ticket instead.
 * A rule about comments cannot be enforced by a review that reads the diff, because the
 * absence of a comment fails no test and the presence of a bad one fails none either. So the
 * count is taken by this tool, recorded in a baseline that is committed beside it, and the
 * release refuses when the count rises.
 *
 * Why a count of a SHAPE and not a ratio alone. A flat comment ratio is met cheapest by
 * deleting the longest comments, and in this repository the longest comments are the ones
 * that say what a check cannot see and which experiment proved it. Those are controls. This
 * tool exempts them by shape, so the number it holds cannot be improved by deleting one.
 *
 *   node tools/check-comment-shape.js                        check the tree against the baseline
 *   node tools/check-comment-shape.js --report               per-file table; needs no baseline
 *   node tools/check-comment-shape.js --list                 every named line, with file and line
 *   node tools/check-comment-shape.js --write-baseline       measure and record
 *   node tools/check-comment-shape.js --write-baseline --allow-rise "<reason>"
 *   options: --root <dir>  --baseline <file>  --tree <path> (repeatable)  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage or read error.
 *
 * WHAT IS A COMMENT LINE. A line whose first non-blank characters open a comment, or a line
 * inside a block comment that opened that way. JavaScript (// and slash-star), PowerShell
 * (# and angle-hash) and SQL (-- and slash-star) are read. A comment that trails code on the
 * same line is a code line to this tool; see the limits below.
 *
 * WHAT IS EXEMPT, BY SHAPE AND NEVER BY A HAND-KEPT LIST.
 *   The file-top header: every comment line before the first line of code. A shebang and a
 *   'use strict' directive are neither. The header is the front page a reader opens first and
 *   it is expected to describe the whole file.
 *   A control line: any comment line that cites a standing decision by its S-number, states
 *   a measurement (a number with its unit, or the word "measured"), or describes a mutation
 *   (the word, a suite going red or staying green, a check proved both ways or failing alone).
 *   Such a line is the evidence beside a check and is never counted as named, whatever else
 *   it says.
 *
 * WHAT IS NAMED. A comment line, outside the header and not a control, that carries a ticket
 * reference (two to four capitals, a hyphen, up to four digits, with encoding and standards
 * prefixes such as UTF- and ISO- excluded), the name of a role on the roster (read from the
 * agents directory beside this tool, so the list is the roster and not a copy of it, matched
 * in any case and with a space accepted for the hyphen), or a gate-round phrase ("round
 * two", "third round", "gate round").
 *
 * WHAT THE BASELINE HOLDS, PER PUBLISHED CODE FILE, AND HOW THE CHECK READS IT.
 *   named     the count of named lines.
 *   ratio     counted comment lines as a percentage of non-blank lines, where counted means
 *             comment lines that are neither header nor control.
 *   controls  the count of control lines.
 * Each is held EXACT: the check requires the measured value to equal the record. A move the
 * wrong way (named or ratio up, controls down) is refused. A move the right way is refused
 * too, with the instruction to record it, so the record is never slack and a value loosened
 * by hand shows up as slack the tree does not have. A file not yet in the record is held at
 * or under the cap for new files with no named line at all. The baseline is written only by
 * --write-baseline. The first write records what is there, because the ratchet has to start
 * from a true measurement. Every later write refuses to record a move the wrong way unless
 * --allow-rise carries a reason; the reason is then recorded in the baseline file itself, so
 * every override is counted in the same committed record the check reads. Deleting the file
 * to start again is visible in that file's history.
 *
 * WHAT THIS SCAN CANNOT SEE, said here rather than left for somebody to discover: a file whose
 * extension is not a known code language, anything under a directory beginning with a dot, and
 * anything under node_modules. Those are skipped by shape and are not reported. A path named as
 * published and NOT FOUND is different: it is printed whatever the verbosity and counted in the
 * summary, because it means the ratchet read nothing for a file somebody believes it holds.
 *
 * WHICH FILES. Every path the program publishes or distributes: the PUBLISHED_TREES literal
 * and the "from" entries of the PUBLIC_MANIFEST literal inside studio.ps1, both read from the
 * program rather than kept here, plus studio.ps1 itself. Each literal must be assigned exactly
 * once and be made of string literals and nothing else; an append or a variable is refused,
 * because what is read here must be what is in force. When a path is absent under its source
 * name, the name without the base prefix and then the manifest's exported name are tried, so
 * the same tool runs in a public clone. base\governance is distributed to every project rather
 * than published, and is read for that reason. Only .js, .mjs, .cjs, .ps1, .psm1 and .sql
 * files are read, and a directory whose name begins with a dot is skipped.
 *
 * WHAT THIS CANNOT SEE, stated here rather than discovered later. A comment trailing code on
 * the same line is not read. A ticket reference written in lower case, or a role named by a
 * description rather than its roster name, is not a match. A control is recognised by
 * keyword, so a line can be made exempt by writing a number beside it; the gate that reviews
 * the change is expected to read it. Markdown, HTML and CSS are not code to this tool.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var CODE_LANG = { '.js': 'c', '.mjs': 'c', '.cjs': 'c', '.ps1': 'ps', '.psm1': 'ps', '.sql': 'sql' };
var NEW_FILE_CAP = 5;

var TICKET = /\b(?!UTF-|ISO-|RFC-|SHA-|CVE-|AES-|HTTP-|TLS-|ECMA-)[A-Z]{2,4}-\d{1,4}\b(?!\.\d)/;
var ROUND = /\bround[- ](?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b|\b(?:first|second|third|fourth|fifth|sixth)[- ]round\b|\bgate round/i;
var S_NUMBER = /\bS\d{1,3}\b/;
var WORD_NUMBER = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|hundred)';
var UNIT = '(?:per cent|percent|%|passed|failed|lines?|files?|characters?|chars?|bytes?|columns?|assertions?|tickets?|roles?|projects?|entries|trees?|days?|seconds?|minutes?|hours?|ms|k|px|calls?|tokens?|times|sessions?|hits?|occurrences?|paths?|words?|switches|commands?|pages?|agents?|fields?|sections?|blocks?|rows?|statuses|refusals?|mutations?|incidents?|copies|surfaces|checks?|patterns?|majors?|findings?|attempts?|rounds?)';
var MEASURE = new RegExp('\\bmeasured\\b|\\b(?:\\d[\\d,.]*|' + WORD_NUMBER + ')\\s*(?:' + UNIT + '\\b|of\\s+(?:\\d|' + WORD_NUMBER + '\\b))', 'i');
var MUTATION = /\bmutat(?:ion|ions|ed|e|es|ing)\b|\bwatched\b[^.]{0,20}\bfail|\b(?:goes|went|turns?|turned|stays?|stayed|left|leaves|was|remains?)\b[^.]{0,30}\b(?:red|green)\b|\bfail(?:s|ed)? alone\b|\bboth ways\b/i;

function stripBom (text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function readText (file) {
  return stripBom(fs.readFileSync(file, 'utf8'));
}

function isDirective (t) {
  return t === "'use strict';" || t === '"use strict";' || t === "'use strict'" || t === '"use strict"';
}

function classify (text, lang) {
  var lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  var open = lang === 'ps' ? '<#' : '/*';
  var close = lang === 'ps' ? '#>' : '*/';
  var marker = lang === 'ps' ? '#' : (lang === 'sql' ? '--' : '//');
  var out = [];
  var inBlock = false;
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i];
    var t = raw.trim();
    if (inBlock) {
      out.push({ kind: 'comment', text: raw });
      if (t.indexOf(close) !== -1) inBlock = false;
      continue;
    }
    if (t === '') { out.push({ kind: 'blank', text: raw }); continue; }
    if (i === 0 && t.slice(0, 2) === '#!') { out.push({ kind: 'shebang', text: raw }); continue; }
    if (isDirective(t)) { out.push({ kind: 'directive', text: raw }); continue; }
    if (t.slice(0, open.length) === open) {
      out.push({ kind: 'comment', text: raw });
      if (t.indexOf(close, open.length) === -1) inBlock = true;
      continue;
    }
    if (t.slice(0, marker.length) === marker) { out.push({ kind: 'comment', text: raw }); continue; }
    out.push({ kind: 'code', text: raw });
  }
  return out;
}

function isControl (text) {
  return S_NUMBER.test(text) || MEASURE.test(text) || MUTATION.test(text);
}

function namedBy (text, roleRe) {
  var why = [];
  if (TICKET.test(text)) why.push('ticket');
  if (roleRe && roleRe.test(text)) why.push('role');
  if (ROUND.test(text)) why.push('round');
  return why;
}

function measureText (text, lang, roleRe) {
  var lines = classify(text, lang);
  var firstCode = -1;
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].kind === 'code') { firstCode = i; break; }
  }
  var m = { nonblank: 0, comment: 0, header: 0, controls: 0, named: 0, named_in_controls: 0, lines: [] };
  for (var j = 0; j < lines.length; j++) {
    var l = lines[j];
    if (l.kind === 'blank') continue;
    m.nonblank++;
    if (l.kind !== 'comment') continue;
    m.comment++;
    var inHeader = firstCode === -1 || j < firstCode;
    if (inHeader) { m.header++; continue; }
    var control = isControl(l.text);
    if (control) m.controls++;
    var why = namedBy(l.text, roleRe);
    if (why.length === 0) continue;
    if (control) {
      m.named_in_controls++;
      m.lines.push({ line: j + 1, text: l.text.trim(), why: why, control: true });
    } else {
      m.named++;
      m.lines.push({ line: j + 1, text: l.text.trim(), why: why, control: false });
    }
  }
  var counted = m.comment - m.header - m.controls;
  m.ratio = m.nonblank ? round1(counted * 100 / m.nonblank) : 0;
  m.ratio_all = m.nonblank ? round1(m.comment * 100 / m.nonblank) : 0;
  return m;
}

function round1 (x) { return Math.round(x * 10) / 10; }

function localDate () {
  var d = new Date();
  var mm = String(d.getMonth() + 1), dd = String(d.getDate());
  return d.getFullYear() + '-' + (mm.length < 2 ? '0' : '') + mm + '-' + (dd.length < 2 ? '0' : '') + dd;
}

function readRoster (root) {
  var dirs = [path.join(root, 'base', 'agents'), path.join(root, 'agents')];
  for (var i = 0; i < dirs.length; i++) {
    if (!fs.existsSync(dirs[i])) continue;
    var names = fs.readdirSync(dirs[i]).filter(function (f) { return /\.md$/i.test(f); })
      .map(function (f) { return f.replace(/\.md$/i, ''); });
    if (names.length) return { dir: dirs[i], names: names };
  }
  return { dir: null, names: [] };
}

function roleRegex (names) {
  if (!names.length) return null;
  var esc = names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[- ]'); });
  return new RegExp('\\b(?:' + esc.join('|') + ')\\b', 'i');
}

function extractLiteral (text, name) {
  var appends = text.match(new RegExp('\\$' + name + '\\s*\\+=', 'g')) || [];
  if (appends.length) throw new Error(name + ' is appended to in studio.ps1, so the list in force is not the literal.');
  var assigns = text.match(new RegExp('\\$' + name + '\\s*=(?!=)', 'g')) || [];
  if (assigns.length === 0) return null;
  if (assigns.length !== 1) throw new Error('found ' + assigns.length + ' assignments to ' + name + ' in studio.ps1; the list can be read only when there is exactly one.');
  var open = text.match(new RegExp('\\$' + name + '\\s*=\\s*@\\('));
  if (!open) throw new Error('the ' + name + ' assignment in studio.ps1 is not a bare array literal.');
  var i = open.index + open[0].length;
  var depth = 1, inStr = false, inComment = false, body = '', bare = '';
  for (; i < text.length; i++) {
    var c = text.charAt(i);
    if (inComment) { if (c === '\n') inComment = false; body += c; continue; }
    if (inStr) { body += c; if (c === "'") inStr = false; continue; }
    if (c === "'") { inStr = true; body += c; continue; }
    if (c === '#') { inComment = true; body += c; continue; }
    if (c === '(') depth++;
    if (c === ')') { depth--; if (depth === 0) break; }
    body += c; bare += c;
  }
  if (depth !== 0) throw new Error('the ' + name + ' literal in studio.ps1 never closes.');
  var rest = text.slice(i + 1).split(/\r?\n/)[0].trim();
  if (/[$+]/.test(bare) || (rest && rest.charAt(0) !== '#')) throw new Error('the ' + name + ' literal carries a variable or an operator, so what is read here is not what is in force.');
  return body;
}

function quoted (body) {
  var out = [];
  var re = /'([^']+)'/g;
  var mm;
  while ((mm = re.exec(body)) !== null) out.push(mm[1]);
  return out;
}

function readPublishedPaths (root) {
  var script = path.join(root, 'studio.ps1');
  if (!fs.existsSync(script)) throw new Error('no studio.ps1 at ' + root + ', so the published trees cannot be read. Pass --tree.');
  var text = readText(script);
  var treesBody = extractLiteral(text, 'PUBLISHED_TREES');
  if (treesBody === null) throw new Error('studio.ps1 assigns no PUBLISHED_TREES, so the published trees cannot be read. Pass --tree.');
  var entries = quoted(treesBody).map(function (t) { return { from: t, to: null }; });
  var manifestBody = extractLiteral(text, 'PUBLIC_MANIFEST');
  var manifest = 0;
  if (manifestBody !== null) {
    var re = /from\s*=\s*'([^']+)'\s*;\s*to\s*=\s*'([^']+)'/g;
    var mm;
    while ((mm = re.exec(manifestBody)) !== null) { entries.push({ from: mm[1], to: mm[2] }); manifest++; }
  }
  entries.push({ from: 'studio.ps1', to: 'studio.ps1' });
  return { entries: entries, manifest: manifest, hasManifest: manifestBody !== null };
}

function resolveEntry (root, entry) {
  var candidates = [entry.from];
  var rel = entry.from.replace(/\\/g, '/');
  if (rel.slice(0, 5) === 'base/') candidates.push(rel.slice(5));
  if (entry.to) candidates.push(entry.to);
  for (var i = 0; i < candidates.length; i++) {
    var r = candidates[i].replace(/\\/g, '/');
    var full = path.join(root, r);
    if (fs.existsSync(full)) return { rel: r, full: full };
  }
  return null;
}

function walk (dir, out) {
  fs.readdirSync(dir).forEach(function (name) {
    if (name === 'node_modules' || name.charAt(0) === '.') return;
    var full = path.join(dir, name);
    var st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (CODE_LANG[path.extname(name).toLowerCase()]) out.push(full);
  });
}

function collectFiles (root, entries) {
  var files = [];
  var absent = [];
  entries.forEach(function (e) {
    var r = resolveEntry(root, e);
    if (!r) { absent.push(e.from); return; }
    if (fs.statSync(r.full).isDirectory()) walk(r.full, files);
    else if (CODE_LANG[path.extname(r.full).toLowerCase()]) files.push(r.full);
  });
  var seen = {};
  var rel = files.map(function (f) { return path.relative(root, f).replace(/\\/g, '/'); })
    .filter(function (r) { if (seen[r]) return false; seen[r] = true; return true; })
    .sort();
  return { files: rel, absent: absent };
}

function measureTree (root, entries) {
  var roster = readRoster(root);
  var roleRe = roleRegex(roster.names);
  var found = collectFiles(root, entries);
  var result = { root: root, roster: roster, absent: found.absent, files: {} };
  found.files.forEach(function (rel) {
    var lang = CODE_LANG[path.extname(rel).toLowerCase()];
    result.files[rel] = measureText(readText(path.join(root, rel)), lang, roleRe);
  });
  return result;
}

function totals (measured) {
  var t = { files: 0, nonblank: 0, comment: 0, header: 0, controls: 0, named: 0, named_in_controls: 0 };
  Object.keys(measured.files).forEach(function (f) {
    var m = measured.files[f];
    t.files++; t.nonblank += m.nonblank; t.comment += m.comment; t.header += m.header;
    t.controls += m.controls; t.named += m.named; t.named_in_controls += m.named_in_controls;
  });
  var counted = t.comment - t.header - t.controls;
  t.ratio = t.nonblank ? round1(counted * 100 / t.nonblank) : 0;
  t.ratio_all = t.nonblank ? round1(t.comment * 100 / t.nonblank) : 0;
  return t;
}

function readBaseline (file) {
  if (!fs.existsSync(file)) return null;
  var b = JSON.parse(readText(file));
  if (!b || typeof b !== 'object' || !b.files || typeof b.files !== 'object') throw new Error('the baseline at ' + file + ' has no files object.');
  return b;
}

function compareFile (rel, m, b) {
  var problems = [];
  var advisories = [];
  if (!b) {
    if (m.named > 0) problems.push('new file with ' + m.named + ' named line(s); a file not yet in the baseline must have none');
    if (m.ratio > NEW_FILE_CAP) problems.push('new file at ' + m.ratio + ' per cent counted comment; the cap for a file not yet in the baseline is ' + NEW_FILE_CAP);
    if (!problems.length) advisories.push('not yet in the baseline; run --write-baseline to hold it at ' + m.ratio + ' per cent and ' + m.named + ' named');
    return { problems: problems, advisories: advisories };
  }
  /* Measured: m.named > undefined and m.named < undefined are both false, so a record with the
     key DELETED passed every comparison below. Mutation: drop this loop and the suite goes red.
     S94, one level down: a ratchet record is held exact, and a record holding nothing is slack. */
  var required = ['named', 'ratio', 'controls'];
  for (var q = 0; q < required.length; q++) {
    var key = required[q];
    if (typeof b[key] !== 'number' || isNaN(b[key])) {
      problems.push('the record holds no numeric ' + key + ', so nothing holds this file;'
        + ' restore the baseline from git rather than rewriting it');
    }
  }
  if (problems.length) return { problems: problems, advisories: advisories };

  var record = '; record it with --write-baseline so the record holds at ';
  if (m.named > b.named) problems.push('named lines rose from ' + b.named + ' to ' + m.named);
  else if (m.named < b.named) problems.push('named lines fell from ' + b.named + ' to ' + m.named + record + m.named);
  if (m.ratio > b.ratio) problems.push('counted comment ratio rose from ' + b.ratio + ' to ' + m.ratio + ' per cent');
  else if (m.ratio < b.ratio) problems.push('counted comment ratio fell from ' + b.ratio + ' to ' + m.ratio + ' per cent' + record + m.ratio);
  if (m.controls < b.controls) problems.push('control lines fell from ' + b.controls + ' to ' + m.controls);
  else if (m.controls > b.controls) problems.push('control lines rose from ' + b.controls + ' to ' + m.controls + record + m.controls);
  return { problems: problems, advisories: advisories };
}

function check (root, baselineFile, entries, quiet) {
  var baseline = readBaseline(baselineFile);
  if (!baseline) {
    console.log('FAIL  no baseline at ' + baselineFile + '  --  the ratchet has nothing to hold to. Run --write-baseline and commit the file.');
    return 1;
  }
  var measured = measureTree(root, entries);
  var failures = 0;
  Object.keys(measured.files).forEach(function (rel) {
    var r = compareFile(rel, measured.files[rel], baseline.files[rel]);
    if (r.problems.length) { failures++; console.log('FAIL  ' + rel + '  --  ' + r.problems.join('; ')); }
    else if (r.advisories.length) console.log('note  ' + rel + '  --  ' + r.advisories.join('; '));
    else if (!quiet) console.log('ok    ' + rel);
  });
  Object.keys(baseline.files).forEach(function (rel) {
    if (!measured.files[rel]) console.log('note  ' + rel + '  --  in the baseline and not on disk; --write-baseline drops it');
  });
  if (!measured.roster.names.length) console.log('n/a   roster  --  no agents directory under ' + root + ', so role names were NOT PROVED absent');
  /* Measured: this printed only when NOT quiet and -Release runs it quiet, so a path named as
     published and never found was dropped in silence. S86. It now prints ALWAYS and is counted.
     Measured again: making it REFUSE instead turned nine assertions red, because -Release
     -WhatIf stages a partial tree. S74: a check must not fire on a population that never opted in. */
  measured.absent.forEach(function (a) {
    console.log('note  path ' + a + '  --  named as published and NOT FOUND, so nothing was read for it');
  });
  var t = totals(measured);
  console.log((failures ? 'FAIL  ' : 'ok    ') + t.files + ' file(s), ' + t.named + ' named line(s), '
    + t.named_in_controls + ' more inside controls, ' + t.controls + ' control line(s), counted ratio '
    + t.ratio + ' per cent, all comment ' + t.ratio_all + ' per cent'
    + (measured.absent.length ? ', ' + measured.absent.length + ' published path(s) not found' : '')
    + (failures ? '  --  ' + failures + ' file(s) refused. Provenance goes on the ticket; the comment says why.' : ''));
  return failures ? 1 : 0;
}

function report (root, paths) {
  var measured = measureTree(root, paths.entries);
  var rows = [['file', 'nonblank', 'comment', 'header', 'controls', 'named', '+in ctl', 'ratio', 'all']];
  Object.keys(measured.files).forEach(function (rel) {
    var m = measured.files[rel];
    rows.push([rel, m.nonblank, m.comment, m.header, m.controls, m.named, m.named_in_controls, m.ratio, m.ratio_all]);
  });
  var t = totals(measured);
  rows.push(['TOTAL ' + t.files + ' files', t.nonblank, t.comment, t.header, t.controls, t.named, t.named_in_controls, t.ratio, t.ratio_all]);
  var widths = rows[0].map(function (_, c) { return Math.max.apply(null, rows.map(function (r) { return String(r[c]).length; })); });
  rows.forEach(function (r) {
    console.log(r.map(function (v, c) { return c === 0 ? String(v) + spaces(widths[c] - String(v).length) : spaces(widths[c] - String(v).length) + String(v); }).join('  '));
  });
  console.log('roster: ' + (measured.roster.dir ? measured.roster.names.length + ' role(s) from ' + measured.roster.dir : 'none found'));
  console.log('manifest: ' + (paths.hasManifest ? paths.manifest + ' entr(ies) read from PUBLIC_MANIFEST' : 'no PUBLIC_MANIFEST read'));
  measured.absent.forEach(function (tr) { console.log('absent path: ' + tr); });
  return 0;
}

function spaces (n) { var s = ''; while (n-- > 0) s += ' '; return s; }

function list (root, entries) {
  var measured = measureTree(root, entries);
  var n = 0;
  Object.keys(measured.files).forEach(function (rel) {
    measured.files[rel].lines.forEach(function (l) {
      n++;
      console.log((l.control ? 'ctl   ' : 'named ') + rel + ':' + l.line + '  [' + l.why.join(',') + ']  ' + l.text);
    });
  });
  var t = totals(measured);
  console.log(t.named + ' named line(s), ' + t.named_in_controls + ' inside controls, ' + n + ' listed');
  return 0;
}

function writeBaseline (root, baselineFile, entries, allowRise) {
  var previous = readBaseline(baselineFile);
  var measured = measureTree(root, entries);
  var rises = [];
  var hollow = [];
  Object.keys(measured.files).forEach(function (rel) {
    var m = measured.files[rel];
    if (!previous) return;
    var b = previous.files[rel];
    /* Measured: the reading half refused a hollow record and this half did not, so deleting one
       key and running --write-baseline re-recorded a ratio of 16.2 with no rise reported. S94.
       Mutation C turns this red. Checked before rises and NOT waivable by --allow-rise. */
    if (b) {
      var gone = ['named', 'ratio', 'controls'].filter(function (k) {
        return typeof b[k] !== 'number' || isNaN(b[k]);
      });
      if (gone.length) { hollow.push({ file: rel, fields: gone.join(', ') }); return; }
    }
    if (!b) {
      if (m.named > 0) rises.push({ file: rel, field: 'named', from: 0, to: m.named });
      if (m.ratio > NEW_FILE_CAP) rises.push({ file: rel, field: 'ratio', from: NEW_FILE_CAP, to: m.ratio });
      return;
    }
    if (m.named > b.named) rises.push({ file: rel, field: 'named', from: b.named, to: m.named });
    if (m.ratio > b.ratio) rises.push({ file: rel, field: 'ratio', from: b.ratio, to: m.ratio });
    if (m.controls < b.controls) rises.push({ file: rel, field: 'controls', from: b.controls, to: m.controls });
  });
  if (hollow.length) {
    hollow.forEach(function (h) {
      console.log('FAIL  ' + h.file + '  --  the record holds no numeric ' + h.fields
        + '; restore the baseline from git rather than rewriting it');
    });
    console.log('FAIL  nothing written. A record that holds nothing cannot be compared, so'
      + ' rewriting it would lock in whatever happens to be measured today.');
    return 1;
  }
  if (rises.length && !allowRise) {
    rises.forEach(function (r) { console.log('FAIL  ' + r.file + '  --  ' + r.field + ' would move the wrong way, ' + r.from + ' -> ' + r.to); });
    console.log('FAIL  nothing written. The baseline only moves down. To record a rise deliberately, pass --allow-rise "<reason>"; the reason is kept in the baseline.');
    return 1;
  }
  var today = localDate();
  var overrides = (previous && Array.isArray(previous.overrides)) ? previous.overrides.slice() : [];
  rises.forEach(function (r) { overrides.push({ date: today, file: r.file, field: r.field, from: r.from, to: r.to, reason: allowRise }); });
  var files = {};
  Object.keys(measured.files).sort().forEach(function (rel) {
    var m = measured.files[rel];
    files[rel] = { nonblank: m.nonblank, comment: m.comment, header: m.header, controls: m.controls, named: m.named, ratio: m.ratio, ratio_all: m.ratio_all };
  });
  var out = {
    what: 'Per published code file: named comment lines, counted comment ratio and control lines, as tools/check-comment-shape.js defines them. Written only by that tool. The check refuses when any value differs from this record: the wrong way outright, the right way until this record is rewritten, so the record is never slack.',
    written: today,
    new_file_cap: NEW_FILE_CAP,
    overrides: overrides,
    files: files
  };
  fs.writeFileSync(baselineFile, JSON.stringify(out, null, 2) + '\n', 'utf8');
  var t = totals(measured);
  console.log('ok    wrote ' + baselineFile + ': ' + t.files + ' file(s), ' + t.named + ' named line(s), '
    + t.controls + ' control line(s), counted ratio ' + t.ratio + ' per cent'
    + (rises.length ? ', ' + rises.length + ' rise(s) recorded with the reason given' : ''));
  return 0;
}

function parseArgs (argv) {
  var o = { mode: 'check', trees: null, quiet: false, allowRise: null, root: null, baseline: null };
  function value (i, flag) {
    var v = argv[i];
    if (!v || v.slice(0, 2) === '--') throw new Error(flag + ' needs a value, and a switch is not one');
    return v;
  }
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--report') o.mode = 'report';
    else if (a === '--list') o.mode = 'list';
    else if (a === '--write-baseline') o.mode = 'write';
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--allow-rise') o.allowRise = value(++i, a);
    else if (a === '--root') o.root = value(++i, a);
    else if (a === '--baseline') o.baseline = value(++i, a);
    else if (a === '--tree') (o.trees = o.trees || []).push(value(++i, a));
    else throw new Error('unknown argument ' + a);
  }
  return o;
}

function main (argv) {
  var o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    console.error('usage: node tools/check-comment-shape.js [--report|--list|--write-baseline [--allow-rise "<reason>"]] [--root <dir>] [--baseline <file>] [--tree <path>]... [--quiet]');
    console.error(e.message);
    return 2;
  }
  var root = path.resolve(o.root || path.join(__dirname, '..'));
  var baselineFile = path.resolve(o.baseline || path.join(root, 'tools', 'comment-shape-baseline.json'));
  try {
    var paths = o.trees
      ? { entries: o.trees.map(function (t) { return { from: t, to: null }; }), manifest: 0, hasManifest: false }
      : readPublishedPaths(root);
    if (o.mode === 'report') return report(root, paths);
    if (o.mode === 'list') return list(root, paths.entries);
    if (o.mode === 'write') return writeBaseline(root, baselineFile, paths.entries, o.allowRise);
    return check(root, baselineFile, paths.entries, o.quiet);
  } catch (e) {
    console.error('cannot measure ' + root + ': ' + e.message);
    return 2;
  }
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = {
  classify: classify, measureText: measureText, isControl: isControl, namedBy: namedBy,
  extractLiteral: extractLiteral, readPublishedPaths: readPublishedPaths, measureTree: measureTree,
  compareFile: compareFile, check: check, writeBaseline: writeBaseline, roleRegex: roleRegex,
  NEW_FILE_CAP: NEW_FILE_CAP
};
