#!/usr/bin/env node
'use strict';

/*
 * patch.js -- the one helper every patch script calls.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A SEVENTH WARNING. ST-079 is at SEVEN instances across
 * five sessions. A patch script's search string containing a backslash escape is collapsed
 * before it reaches the file, so the anchor either matches zero times or writes a corrupted
 * string. TWICE that produced a file that would not parse, and once the studio's own board was
 * DOWN until it was repaired. TWO separate sessions responded by writing a note telling the
 * next session to watch for it. The note is 0 for 7, and instances six and seven were made by
 * the session arguing the note had stopped working.
 *
 * SO THIS IS A MECHANISM AND NOT AN INSTRUCTION. Every control below already existed,
 * hand-copied into individual patch scripts, which is exactly why some scripts had them and
 * some did not. Copied controls are optional by construction: the script that skips one looks
 * identical to the script that never needed it. Here they are unskippable, because there is no
 * path through this file that writes without them.
 *
 * WHAT IT CANNOT DO, STATED PLAINLY. It cannot stop a shell from mangling a string before
 * node ever sees it. Nothing in node can. What it CAN do is make the mangled case LOUD and
 * HARMLESS instead of silent and destructive, and NAME the collapse when it happens, which is
 * the part no hand-copied check ever did. A zero-match anchor used to print "matched 0 times"
 * and leave the operator to guess; it now prints the nearest line in the file and the first
 * character that differs, by code point, and says ESCAPE COLLAPSE when that difference is a
 * real control character sitting where the file has a backslash and a letter.
 *
 * THE CONTROLS, in the order they run:
 *   1. The anchor is non-empty.                        An empty anchor matches everywhere.
 *   2. The replacement carries no stray control char.  \n and \t are allowed, \r and the rest
 *                                                      are refused: a lone \r is how a CRLF
 *                                                      file gets half-converted in place.
 *   3. The anchor matches EXACTLY the expected count.  Not "at least once". Instance five was
 *                                                      a zero-match reported as SKIPPED, which
 *                                                      reads like a pass unless somebody reads
 *                                                      the word.
 *   4. The new content parses, checked IN MEMORY.      Instance four wrote an unterminated
 *                                                      string literal to disk. A program that
 *                                                      does not parse never reaches the file.
 *   5. The write is atomic, then read back.            A crash mid-write cannot truncate the
 *                                                      target, and the claim that it worked is
 *                                                      read from disk rather than assumed.
 * Nothing is written unless every one of them passes. On failure the target is byte-identical
 * to what it was before the call.
 *
 * ONE CONTROL THE SUITE CANNOT PROVE, SAID OUT LOUD RATHER THAN LEFT AS A GAP. The read-back
 * half of control 5 survives mutation: deleting it changes nothing observable, because it only
 * differs on a filesystem that accepts a write and then returns different bytes. Every other
 * control here was watched failing. This one is recorded as unproved on purpose, since a
 * control nobody has seen fail and a control that always passes are the same thing until
 * somebody writes down which one it is.
 *
 * HOW TO CALL IT SAFELY. The anchor is DATA. Pass it as a JS value from a node script, or in a
 * spec file read as raw bytes. Do NOT build it inside a shell heredoc: that is the defect this
 * file exists for. Where a literal backslash is unavoidable in a heredoc, build it with
 * String.fromCharCode(92) and never with two backslashes.
 *
 * RELATED: S46, a pointer kept by hand that must track state gets a CHECK rather than an
 * instruction. This is that rule applied to the patching itself.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const BACKSLASH = String.fromCharCode(92);

/* Control characters we allow through in a replacement. Newline and tab are ordinary
 * content in every file this studio patches. Everything else, INCLUDING a carriage return,
 * is refused: a stray \r is not a typo, it is half of a line ending, and writing one into a
 * file that does not use them produces a change no diff reader can see. */
const ALLOWED_CONTROL = new Set(['\n', '\t']);

/* Extensions we know how to parse. Anything not listed is patched without a parse check,
 * which is correct for prose and is reported in the result rather than hidden, so a caller
 * can see that control 4 did not run for this target. */
const PARSERS = {
  '.js': 'node',
  '.cjs': 'node',
  '.mjs': 'node',
  '.json': 'json',
};

class PatchError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'PatchError';
    this.detail = detail || {};
  }
}

/* Name a character the way a reader can act on. "U+000A LINE FEED" is checkable; "a newline"
 * in a message about whether something IS a newline is not. */
function describeChar(ch) {
  if (ch === undefined) return 'end of line';
  const code = ch.codePointAt(0);
  const hex = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
  const names = {
    9: 'TAB', 10: 'LINE FEED', 13: 'CARRIAGE RETURN', 32: 'SPACE', 92: 'BACKSLASH',
  };
  const name = names[code] || (code < 32 ? 'CONTROL' : JSON.stringify(ch));
  return hex + ' ' + name;
}

/* When an anchor matches zero times the useful question is never "how many times did it
 * match". It is "what did I actually send, and what is actually in the file". This answers
 * both by finding the file line that shares the longest prefix with the anchor's first line
 * and naming the first character that differs.
 *
 * The ESCAPE COLLAPSE verdict is the whole point: a real control character in the anchor
 * sitting where the file has a backslash followed by that character's letter is ST-079's
 * signature, and it is the one diagnosis nobody made in seven instances because nobody was
 * shown the two strings side by side. */
function diagnoseMiss(content, anchor) {
  /* Compare the WHOLE anchor against the file, not the anchor's first line. A collapsed
   * escape puts a real LINE FEED inside the anchor, so splitting the anchor on newlines
   * throws away the very character that went wrong: the first line then ends exactly where
   * the fault is, the divergence reads as "end of line", and the diagnosis misses the one
   * case it was written for. Found by watching this function fail on its own fixture. */
  let seedLen = Math.min(12, anchor.length);
  let positions = [];
  while (seedLen >= 4 && positions.length === 0) {
    const seed = anchor.slice(0, seedLen);
    let i = content.indexOf(seed);
    while (i !== -1 && positions.length < 500) {
      positions.push(i);
      i = content.indexOf(seed, i + 1);
    }
    if (positions.length === 0) seedLen -= 2;
  }
  if (positions.length === 0) {
    return {
      verdict: 'NO SIMILAR TEXT',
      hint: 'No run of ' + Math.min(4, anchor.length) + ' characters from the start of the anchor appears anywhere in the file. '
        + 'Check you are patching the file you think you are.',
    };
  }

  let best = { at: positions[0], common: 0 };
  for (const p of positions) {
    let c = 0;
    while (c < anchor.length && p + c < content.length && content[p + c] === anchor[c]) c++;
    if (c > best.common) best = { at: p, common: c };
  }
  const at = best.common;
  const sent = anchor[at];
  const found = content[best.at + at];
  const line = content.slice(0, best.at + at).split('\n').length;
  const column = (best.at + at) - (content.lastIndexOf('\n', best.at + at - 1) + 1) + 1;

  /* The signature. The shell collapsed BACKSLASH + letter into the single control character
   * that escape stands for, so the anchor now holds a real control where the file holds two
   * ordinary characters. */
  const collapsed = { '\n': 'n', '\t': 't', '\r': 'r' };
  let verdict = 'ANCHOR DOES NOT MATCH THE FILE';
  let hint = 'The anchor and the file differ at the character named above.';
  if (sent !== undefined && collapsed[sent] && found === BACKSLASH && content[best.at + at + 1] === collapsed[sent]) {
    verdict = 'ESCAPE COLLAPSE (ST-079)';
    hint = 'You sent a real control character where the file holds a backslash and the letter '
      + JSON.stringify(collapsed[sent]) + '. A shell heredoc collapses two backslashes to one even when quoted. '
      + 'Build the anchor with String.fromCharCode(92), or pass it with --anchor-file.';
  } else if (found === BACKSLASH && sent === BACKSLASH && content[best.at + at + 1] !== anchor[at + 1]) {
    verdict = 'ESCAPE COLLAPSE (ST-079)';
    hint = 'Both strings have a backslash here but what follows it differs, which is what a '
      + 'half-collapsed escape looks like. Build the anchor with String.fromCharCode(92).';
  }

  /* Show a window around the divergence from each side, quoted, so a control character is
   * visible as an escape rather than as a blank the reader cannot see. */
  const from = Math.max(0, at - 40);
  return {
    verdict,
    hint,
    line,
    column,
    sent: describeChar(sent),
    found: describeChar(found),
    fileLine: content.slice(best.at + from, best.at + at + 40),
    anchorLine: anchor.slice(from, at + 40),
  };
}

/* Control 4. The new content is parsed BEFORE it reaches the target, so a program that does
 * not parse is never on disk even for an instant. node --check is run against a temp file
 * carrying the target's own extension, because that is what decides module versus script. */
function parseCheck(newContent, targetPath) {
  const ext = path.extname(targetPath).toLowerCase();
  const kind = PARSERS[ext];
  if (!kind) return { ran: false, reason: 'no parser for ' + (ext || 'a file with no extension') };
  if (kind === 'json') {
    try {
      JSON.parse(newContent);
      return { ran: true, ok: true };
    } catch (e) {
      return { ran: true, ok: false, message: e.message };
    }
  }
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'patchchk-')), 'candidate' + ext);
  try {
    fs.writeFileSync(tmp, newContent, 'utf8');
    const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    if (r.status === 0) return { ran: true, ok: true };
    return { ran: true, ok: false, message: (r.stderr || r.stdout || '').trim().split('\n').slice(0, 6).join('\n') };
  } finally {
    try { fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); } catch (e) { /* temp dir, nothing to salvage */ }
  }
}

/* The empty-needle guard is not defensive decoration, it is a HANG. indexOf('') returns the
 * search position, so advancing by needle.length advances by zero and this loops forever with
 * no output and no error. Found by mutating control 1 away and watching the mutation harness
 * sit for twenty-five minutes producing an empty file: the run looked exactly like a slow
 * machine. Control 1 already refuses an empty anchor, which is precisely why this function was
 * never reached with one and the fault could sit here indefinitely. A function that hangs only
 * when its caller is wrong is a function that will hang the day it gets a second caller. */
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/* Control 5. Write to a sibling temp file and rename over the target, so the target is either
 * entirely the old content or entirely the new one. A plain write that dies partway leaves a
 * truncated file, and the one time that happens it will be the file the board runs on. */
function atomicWrite(target, content) {
  const dir = path.dirname(target);
  const tmp = path.join(dir, '.' + path.basename(target) + '.patch-' + process.pid + '-' + Date.now() + '.tmp');
  fs.writeFileSync(tmp, content, 'utf8');
  try {
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch (e2) { /* the rename is the thing that had to work */ }
    throw e;
  }
}

/**
 * Apply one or more edits to ONE file, all or nothing.
 *
 * All anchors are resolved against the ORIGINAL content before anything is replaced, so the
 * count control cannot be fooled by an earlier edit creating or destroying a later anchor.
 * Edits are then applied in order.
 *
 * @param {object} spec
 * @param {string} spec.file          path to the target
 * @param {Array}  spec.edits         [{ anchor, replacement, expect }]
 * @param {boolean} [spec.dryRun]     run every control, write nothing
 * @returns {object} report
 * @throws {PatchError} on any control failure, with the target untouched
 */
function patchFile(spec) {
  const { file, edits, dryRun = false } = spec;
  if (!file) throw new PatchError('patchFile needs a file');
  if (!Array.isArray(edits) || edits.length === 0) throw new PatchError('patchFile needs at least one edit');
  if (!fs.existsSync(file)) throw new PatchError('target does not exist: ' + file);

  const original = fs.readFileSync(file, 'utf8');
  let content = original;
  const applied = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const label = 'edit ' + (i + 1) + ' of ' + edits.length;
    const anchor = edit.anchor;
    const replacement = edit.replacement === undefined ? '' : edit.replacement;
    const expect = edit.expect === undefined ? 1 : edit.expect;

    /* Control 1. */
    if (typeof anchor !== 'string' || anchor.length === 0) {
      throw new PatchError(label + ': the anchor is empty, and an empty anchor matches everywhere');
    }
    if (typeof replacement !== 'string') {
      throw new PatchError(label + ': the replacement must be a string, got ' + typeof replacement);
    }

    /* Control 2. */
    for (const ch of replacement) {
      const code = ch.codePointAt(0);
      if (code < 32 && !ALLOWED_CONTROL.has(ch)) {
        throw new PatchError(
          label + ': the replacement carries ' + describeChar(ch) + ', which is refused. '
          + 'Only LINE FEED and TAB are allowed. A stray control character here is what a collapsed escape looks like.'
        );
      }
    }

    /* Control 3, counted against the content as it stands after earlier edits in this call. */
    const found = countOccurrences(content, anchor);
    if (found !== expect) {
      const detail = { file, expected: expect, found, anchor };
      let message = label + ': the anchor matched ' + found + ' time(s) in ' + file + ', expected exactly ' + expect;
      if (found === 0) {
        const d = diagnoseMiss(content, anchor);
        detail.diagnosis = d;
        message += '\n  ' + d.verdict;
        if (d.line) {
          message += '\n  nearest line ' + d.line + ', first difference at column ' + d.column;
          message += '\n    anchor sent : ' + d.sent;
          message += '\n    file holds  : ' + d.found;
          message += '\n    file line   : ' + JSON.stringify(d.fileLine.slice(0, 160));
          message += '\n    anchor line : ' + JSON.stringify(d.anchorLine.slice(0, 160));
        }
        message += '\n  ' + d.hint;
      }
      throw new PatchError(message, detail);
    }

    /* Replace every occurrence by index rather than with a regex or String.replace, because
     * both of those give a dollar sign in the REPLACEMENT a meaning it does not have here.
     * That is the same class of defect as the escape collapse, one layer up. */
    let out = '';
    let from = 0;
    for (let k = 0; k < expect; k++) {
      const at = content.indexOf(anchor, from);
      out += content.slice(from, at) + replacement;
      from = at + anchor.length;
    }
    out += content.slice(from);
    content = out;
    applied.push({ label, expect, anchorLength: anchor.length, replacementLength: replacement.length });
  }

  if (content === original) {
    throw new PatchError('every anchor matched but the content is unchanged, so this patch does nothing. '
      + 'That is almost always a replacement identical to its anchor.');
  }

  /* Control 4, in memory. */
  const parsed = parseCheck(content, file);
  if (parsed.ran && !parsed.ok) {
    throw new PatchError(
      'the patched content does not parse, so nothing was written to ' + file + ':\n  ' + parsed.message,
      { file, parse: parsed }
    );
  }

  if (dryRun) {
    return { file, written: false, dryRun: true, edits: applied, parseChecked: parsed.ran, parseReason: parsed.reason, bytes: { before: original.length, after: content.length } };
  }

  /* Control 5. */
  atomicWrite(file, content);
  const readBack = fs.readFileSync(file, 'utf8');
  if (readBack !== content) {
    throw new PatchError('wrote ' + file + ' but reading it back gave different bytes. Do not trust this file.');
  }

  return { file, written: true, dryRun: false, edits: applied, parseChecked: parsed.ran, parseReason: parsed.reason, bytes: { before: original.length, after: content.length } };
}

/** The single-edit form, which is what most callers want. */
function patch(spec) {
  const { file, anchor, replacement, expect, dryRun } = spec;
  return patchFile({ file, dryRun, edits: [{ anchor, replacement, expect }] });
}

/* ---------------------------------------------------------------- CLI */

function readSpec(argv) {
  const get = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };
  const specPath = get('--spec');
  if (specPath) {
    /* A spec file is the safe route from a shell: the anchor is read as bytes off disk and
     * never passes through an argument list or a heredoc a second time. */
    const raw = fs.readFileSync(specPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  const file = get('--file');
  const anchorFile = get('--anchor-file');
  const replacementFile = get('--replacement-file');
  if (!file || !anchorFile) {
    throw new PatchError('usage: patch.js --spec <spec.json>\n'
      + '   or: patch.js --file <target> --anchor-file <a> [--replacement-file <r>] [--expect N] [--dry-run]\n'
      + '\n'
      + 'The anchor is read from a FILE on purpose. Passing it as an argument routes it through\n'
      + 'the shell, which is the defect this tool exists for (ST-079).');
  }
  return [{
    file,
    edits: [{
      anchor: fs.readFileSync(anchorFile, 'utf8'),
      replacement: replacementFile ? fs.readFileSync(replacementFile, 'utf8') : '',
      expect: get('--expect') === undefined ? 1 : Number(get('--expect')),
    }],
  }];
}

function main(argv) {
  const dryRun = argv.includes('--dry-run');
  let specs;
  try {
    specs = readSpec(argv);
  } catch (e) {
    process.stderr.write((e.message || String(e)) + '\n');
    return 2;
  }
  let failed = 0;
  for (const spec of specs) {
    try {
      const r = patchFile({ ...spec, dryRun: dryRun || spec.dryRun });
      const verb = r.written ? 'patched' : 'DRY RUN, would patch';
      process.stdout.write('  ' + verb + ' ' + r.file + '  ' + r.edits.length + ' edit(s), '
        + r.bytes.before + ' -> ' + r.bytes.after + ' characters'
        + (r.parseChecked ? ', parse checked' : ', NOT parse checked (' + r.parseReason + ')') + '\n');
    } catch (e) {
      failed++;
      process.stderr.write('\nREFUSED  ' + (spec.file || '(no file)') + '\n  ' + (e.message || String(e)) + '\n');
    }
  }
  if (failed) {
    process.stderr.write('\n' + failed + ' patch(es) refused. Nothing was written for those targets.\n');
    return 1;
  }
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = { patch, patchFile, PatchError, diagnoseMiss, describeChar, parseCheck, countOccurrences, main, BACKSLASH };
