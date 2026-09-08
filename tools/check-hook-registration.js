#!/usr/bin/env node
'use strict';
/*
 * Holds the studio's session hooks to the events that can actually deliver them.
 *
 * WHY THIS EXISTS, and it is the defect it was built out of. One of these hooks spent two weeks
 * registered on an event that DISCARDS what it returns. It ran on schedule, it wrote a line to the
 * log saying ok on every one of nine firings, and it delivered nothing, because the log records
 * THAT a hook ran and never whether anything arrived. Nothing in this repository could see it: the
 * registration lives in the agent's own settings file, outside the tree, and no check read that
 * file. So the payload could be pinned by a test and the WIRING could be moved back the next day
 * with every check still green.
 *
 * WHAT MAKES A WIRING WRONG, and it is not a matter of taste. Each event honours a specific set of
 * output fields and ignores the rest. A hook returning context for the session is inert unless it
 * sits on an event that adds context to the session. A hook that refuses is inert unless it sits
 * on an event that can be refused. Each rule below names the event a given entry point must be on
 * and why, so a reader can check the reasoning rather than trust the list.
 *
 * THE EVENT IS ONLY HALF OF IT. A group also carries a MATCHER, which narrows the firing to some
 * of that event's triggers, and an entry on the right event with the wrong matcher never fires at
 * all. The hook that started all this is the example: it exists to run after a compaction, so on a
 * session-start event narrowed to startup it would be correctly wired, correctly logged and just
 * as inert as it was on the wrong event. So a rule may also name the triggers its matcher must
 * still cover.
 *
 * A MATCHER IS NOT A REGULAR EXPRESSION, WHICH IS WHERE THE FIRST VERSION OF THAT CHECK WENT WRONG
 * IN BOTH DIRECTIONS AT ONCE. The runtime reads it three ways, and only the third is a pattern.
 * Empty, absent or a single star matches everything. A value made only of letters, digits,
 * underscore, hyphen, spaces, commas and vertical bars is an EXACT STRING, or a list of exact
 * strings separated by either of those two, with surrounding spaces ignored: exact, so case
 * matters. Anything else is a regular expression, tested UNANCHORED, so it succeeds on a match
 * anywhere in the value. Reading every matcher as an anchored, case-insensitive pattern accepted
 * one that never fires, which is the exact fault the check was added to catch, and refused two
 * ordinary forms that fire perfectly well, which locks somebody out of a check that runs at every
 * session start.
 *
 * FORM IS NOT MEANING, AND READING IT AS MEANING IS HOW THIS CHECK ONCE PASSED THE VERY DEFECT IT
 * IS NAMED FOR. A command hook may carry its arguments as an array, or omit the array and put the
 * whole command line in one string; the runtime accepts both and they do the same thing. An
 * earlier version matched per argument, with each filename anchored to the end of one, so a hook
 * written as a single string satisfied no rule, was recognised as none of ours, and reported as a
 * clean install with nothing wired. Recognition is now done against the command and the arguments
 * JOINED, unanchored, so the form makes no difference. An EMPTY arguments array counts as the
 * single-string form, because an empty array is still a truthy value and reading it as the other
 * form left the path checks below inspecting a whole command line and finding no filename in it.
 *
 * RECOGNISING A HOOK BY ITS FILE AND ITS MODE MEANS A TYPO IN THE MODE MAKES IT INVISIBLE. A guard
 * registered with no mode, with a mode this tool does not handle, or with the mode joined to its
 * flag by an equals sign, does nothing at all when it fires, and being unrecognised it used to
 * leave the install reading as one with no hooks registered. So there is a second, looser way to
 * be recognised, which exists only to say that something of ours cannot work.
 *
 * THAT LOOSER TEST CLAIMS AS LITTLE AS IT CAN, because everything it claims it also REFUSES. The
 * first version tested each filename against the whole command line, which claimed anything that
 * so much as mentioned one: this tool's other switches, a wrapper naming it in an argument, a
 * directory with the name in it, and any future hook of ours that this version has not heard of.
 * Refusing those locks somebody out for using the studio in a way we did not predict, and since
 * this file publishes, an older installed copy would refuse a newer studio's own registration. So
 * the guard is claimed only when a real path ENDS with its filename, and this tool only when the
 * line carries one of the two switches that make it a hook at all. A switch written as :$false
 * turns itself off, so it is claimed and refused rather than read as wired.
 *
 * A control byte is looked for in the RAW fields rather than in the split words, because a tab
 * inside a path is exactly what a path built through a shell string looks like after the shell has
 * eaten its separators, and splitting on whitespace first would consume the evidence. It is
 * detected by CODE POINT rather than by a range typed into a pattern, because typing the range put
 * two control bytes into the file whose job is to find them.
 *
 * A PATH IS ONLY REFUSED WHEN IT COULD HAVE BEEN CHECKED. The documented, recommended way to write
 * a portable registration is with a placeholder the runtime substitutes at fire time, and a home
 * or relative path resolves against something this check cannot see. Testing those as literal text
 * refuses installs that work, which is the trap this repository has already had to undo once. They
 * are reported and allowed; only an absolute path that is missing is refused.
 *
 * WHAT IT WILL NOT DO. It will not refuse an install that has simply not registered these hooks.
 * That is the normal state of a fresh copy and of anyone who registered nothing, and a check that
 * fails everyone who has not opted in teaches its reader to ignore it. A missing settings file, or
 * one carrying no hook of ours, is reported as nothing to say and exits zero.
 *
 * BUT A PARTIAL INSTALL IS NOT THE SAME THING AS AN EMPTY ONE, and telling them apart is the only
 * way a LOST registration is ever noticed. Somebody who registered none of this has opted out;
 * somebody carrying five of the six had six once. So when at least one is recognised, the ones
 * that are absent are NAMED, out loud, whether or not the caller asked for quiet.
 *
 * THREE EXIT CODES, BECAUSE TWO WERE NOT ENOUGH TO SAY THIS. Zero is nothing to report. One is a
 * refusal. THREE is advisory: something worth a reader's attention that must not stop anybody,
 * which is what every notice here is. The runner that invokes this quietly prints a row for an
 * advisory result and prints nothing extra for a clean one, so a notice returned as zero was
 * written into the record and shown to nobody.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const STUDIO = path.resolve(__dirname, '..');

// WHAT MAY INTRODUCE A FILENAME, DECIDED ONCE: the start of the line, a path separator, whitespace,
// a quote, an equals sign ending a switch, or a colon ending a drive letter. Decided twice, the
// drive letter reached the rules and not the fallback below, so -File=x and C:x were read by one
// and silently missed by the other.
const OPENS = String.raw`(^|[\\/\s"'=:])`;

// AND WHAT MAY NOT CONTINUE IT. Matching a name anywhere in the line read somebody else's
// my-session-guard.js as ours; testing only the front left studio.ps1.bak read as the tool itself.
// THIS IS NOT A BOUNDARY, and calling it one would claim more than the code does: a segment that
// carries more after a space or a comma, "studio.ps1 copy.ps1", is STILL claimed, and everything
// claimed here is also REFUSED. That is not one noisy line. This check sits in the release set, so
// somebody else's backup wired as a hook blocks their release. It is still the right way round,
// because an allowed list of trailing characters makes a legitimate install INVISIBLE the first
// time somebody writes an unpredicted form, and invisible is the failure this check exists to end.
const CONTINUES = String.raw`(?![A-Za-z0-9._~\\/-])`;

const SEGMENT = {
  studio: new RegExp(OPENS + String.raw`studio\.ps1` + CONTINUES, 'i'),
  guard: new RegExp(OPENS + String.raw`session-guard\.js` + CONTINUES, 'i'),
  budget: new RegExp(OPENS + String.raw`session-budget\.js` + CONTINUES, 'i')
};

// The same opening for a single TOKEN rather than a whole line, which can end where a line cannot.
const GUARD_TOKEN = new RegExp(OPENS + String.raw`session-guard\.js$`, 'i');

// A rule: how to recognise one hook from its whole command line, the event and matcher triggers it
// must be on, and the reasons, which are printed with any refusal.
const RULES = [
  { name: 'recall',
    match: t => SEGMENT.studio.test(t) && /(^|[\s"'])-Recall(:\$true)?([\s"']|$)/i.test(t),
    event: 'SessionStart',
    covers: ['compact'],
    why: 'it returns context for the session, and only a session-start event adds that to context',
    whyCovers: 'it exists to put the standing rules back after a compaction, and a session-start '
             + 'matcher that excludes compact means it never runs at the one moment it is for' },
  { name: 'autoload',
    match: t => SEGMENT.studio.test(t) && /(^|[\s"'])-Autoload(:\$true)?([\s"']|$)/i.test(t),
    event: 'SessionStart',
    covers: ['startup'],
    why: 'it rebuilds the roster for the session that is starting',
    whyCovers: 'a session that starts cold is the case it is for, so a matcher excluding startup '
             + 'leaves the roster whatever the last run happened to leave behind' },
  { name: 'guard precompact',
    match: t => SEGMENT.guard.test(t) && /--event[\s"']+precompact([\s"']|$)/i.test(t),
    event: 'PreCompact',
    covers: ['auto'],
    why: 'it refuses a compaction, and no other event can be refused on its behalf',
    whyCovers: 'the compaction that arrives unasked is the one that lands in the window this '
             + 'guards, so a matcher narrowed to manual protects only the case a person chose' },
  { name: 'guard stop',
    match: t => SEGMENT.guard.test(t) && /--event[\s"']+stop([\s"']|$)/i.test(t),
    event: 'Stop',
    why: 'it refuses the turn ending, and reads a flag only that event supplies' },
  { name: 'guard sessionend',
    match: t => SEGMENT.guard.test(t) && /--event[\s"']+sessionend([\s"']|$)/i.test(t),
    event: 'SessionEnd',
    covers: ['clear', 'logout', 'prompt_input_exit', 'other', 'resume'],
    why: 'it records how a session ended, which only that event knows',
    whyCovers: 'it is the only trace a skipped wind-down leaves, and a session ends in several '
             + 'ways, so recording one of them is a record that reads as complete and is not' },
  { name: 'budget',
    match: t => SEGMENT.budget.test(t),
    event: 'PreToolUse',
    why: 'it blocks a tool call, and that is the only event in this runtime that can' }
];

// How to recognise an entry that IS ours and CANNOT WORK, which a rule cannot catch because a
// rule needs the mode as well as the file. This claims deliberately little. Testing a filename
// against the whole command line claimed anything that merely mentioned one, including this
// tool's other switches and a future hook of ours that this version has not heard of, and
// refusing those locks somebody out for using the studio in a way we did not predict. So the
// guard is claimed only when a real path ENDS with its filename, and the tool only when the line
// carries one of the two switches that make it a hook at all.
const OURS = [
  { name: 'session guard',
    // Only the FIRST script on the line, which is the one a runtime would execute, and only when
    // that filename is the whole last segment. Testing the whole line instead claimed a wrapper
    // that merely passed our guard as an argument, and allowing a prefix inside the segment
    // claimed somebody else's my-session-guard.js. Both were refusals of installs that work. The
    // opening comes from where the rules take it; a second copy here kept C:session-guard.js silent
    // after the rules had learnt to read it.
    claims: e => GUARD_TOKEN.test(firstScript(e.parts)),
    wants: 'a mode given as two separate words, --event followed by precompact, stop or '
         + 'sessionend; it reads no other form and does nothing at all when it fires without one' },
  { name: 'studio tool',
    claims: e => SEGMENT.studio.test(e.line) && /(^|[\s"'])-(Recall|Autoload)\b/i.test(e.line),
    wants: '-Recall or -Autoload, switched on; a switch given as :$false turns it off, so the '
         + 'hook fires and does nothing' }
];

// The first thing on a command line that looks like a script, which is the one a runtime would
// actually execute; anything named later is an argument to it.
function firstScript (parts) {
  for (const p of parts) {
    const t = String(p).trim();
    if (/\.(js|ps1)$/i.test(t)) return t.toLowerCase();
  }
  return '';
}

function hasControlByte (text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c === 127) return true;
  }
  return false;
}

// Splits a command line into the words a shell would see, so a quoted path containing a space
// stays one path. Backslashes are ordinary characters here, because on the platform this runs on
// they are what separates directories.
function words (text) {
  const out = [];
  let cur = '', quote = null, open = false;
  for (const ch of String(text)) {
    if (quote) {
      if (ch === quote) { quote = null; } else { cur += ch; }
    } else if (ch === '"' || ch === "'") {
      quote = ch; open = true;
    } else if (/\s/.test(ch)) {
      if (open || cur) { out.push(cur); cur = ''; open = false; }
    } else {
      cur += ch;
    }
  }
  if (open || cur) out.push(cur);
  return out;
}

// The runtime's own three readings of a matcher, in its order. Anything it cannot compile as a
// pattern is treated as firing on nothing, which is the safe reading: a matcher that cannot be
// evaluated cannot be relied on to fire.
function covers (matcher, trigger) {
  const m = String(matcher == null ? '' : matcher);
  if (m === '' || m === '*') return true;
  if (/^[A-Za-z0-9_\- ,|]+$/.test(m)) {
    return m.split(/[,|]/).map(s => s.trim()).filter(Boolean).indexOf(trigger) !== -1;
  }
  try { return new RegExp(m).test(trigger); } catch (e) { return false; }
}

const SUBSTITUTED = /[$%~]/;
const ABSOLUTE = /^([A-Za-z]:[\\/]|[\\/])/;

// A NAMED settings file and the DEFAULT one are different questions and cannot share an answer.
// The default being absent means this host registers nothing, which is true and clean. A named
// file being absent means the caller asked about something that is not there, and answering that
// with "no hooks are registered here" is a verdict about a file nobody opened. A flag with
// nothing after it, or one that would swallow the next flag as its value, is neither.
function settingsPath (argv) {
  const at = argv.indexOf('--settings');
  if (at === -1) return { file: path.join(os.homedir(), '.claude', 'settings.json'), named: false };
  const v = argv[at + 1];
  if (v === undefined || v.slice(0, 2) === '--') return { usage: '--settings needs a value after it' };
  return { file: v, named: true };
}

function walk (hooks) {
  const out = [];
  for (const event of Object.keys(hooks || {})) {
    for (const group of (hooks[event] || [])) {
      for (const h of (group.hooks || [])) {
        const cmd = String(h.command || '');
        const argv = (h.args === undefined || h.args === null) ? [] : [].concat(h.args).map(String);
        const raw = [cmd].concat(argv);
        const line = raw.join(' ');
        // An arguments ARRAY carries one path per element, so its elements are the paths and
        // splitting them would break any path containing a space. Anything else -- absent, empty,
        // or a bare string -- puts the whole command line in one field, so it is split instead.
        const asArray = Array.isArray(h.args) && argv.length > 0;
        out.push({ event: event, matcher: group.matcher || '', raw: raw, line: line,
                   parts: asArray ? argv.concat([cmd]) : words(line) });
      }
    }
  }
  return out;
}

function main () {
  const argv = process.argv.slice(2);
  const quiet = argv.includes('--quiet');
  const say = m => { if (!quiet) console.log(m); };

  if (argv.includes('--rules')) {
    for (const r of RULES) console.log(r.name.padEnd(18) + r.event);
    console.log(RULES.length + ' rule(s)');
    return 0;
  }

  const asked = settingsPath(argv);
  if (asked.usage) { console.log('FAIL  ' + asked.usage); return 2; }
  const file = asked.file;
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch (e) {
    if (asked.named) {
      console.log('FAIL  no settings file at ' + file + ', and that path was named on the command line');
      return 2;
    }
    say('none  no settings file at ' + file + ', so no hooks are registered here');
    return 0;
  }
  let cfg;
  try { cfg = JSON.parse(raw); }
  catch (e) {
    console.log('FAIL  ' + file + ' is not readable as settings: ' + e.message);
    return 1;
  }

  const entries = walk(cfg.hooks);
  const problems = [];
  const notices = [];
  const seen = {};
  let ours = 0;

  for (const e of entries) {
    const rule = RULES.find(r => r.match(e.line));
    const mine = rule ? null : OURS.find(o => o.claims(e));
    if (!rule && !mine) continue;
    ours++;
    // Everything below is done for a recognised hook AND for one of ours that cannot work, which
    // is why the name is taken first. Running the byte and path checks only for the recognised
    // ones left a broken registration examined less closely than a working one.
    const label = rule ? rule.name : mine.name;
    if (mine) {
      problems.push(label + ' is registered as ' + e.line.trim() + ', which cannot work: it wants ' +
                    mine.wants);
    }
    if (rule) {
      seen[rule.name] = true;
      if (e.event !== rule.event) {
        problems.push(rule.name + ' is registered on ' + e.event + ' and must be on ' +
                      rule.event + ', because ' + rule.why);
      }
      for (const trigger of (rule.covers || [])) {
        if (!covers(e.matcher, trigger)) {
          problems.push(rule.name + ' has matcher "' + e.matcher + '", which does not cover ' +
                        trigger + ', and ' + rule.whyCovers);
        }
      }
    }
    for (const field of e.raw.concat([String(e.matcher)])) {
      if (hasControlByte(field)) {
        problems.push(label + ' has a control byte inside its registration, which is what a ' +
                      'path looks like after a shell has eaten its separators');
      }
    }
    for (const a of e.parts) {
      if (!/\.(js|ps1)$/i.test(a)) continue;
      if (SUBSTITUTED.test(a)) {
        notices.push(label + ' points at ' + a + ', which the runtime fills in when the hook ' +
                     'fires, so whether it resolves cannot be answered from here');
      } else if (!ABSOLUTE.test(a)) {
        notices.push(label + ' points at ' + a + ', a relative path, which resolves against ' +
                     'wherever the session happens to be running rather than against this check');
      } else if (!fs.existsSync(a)) {
        problems.push(label + ' points at ' + a + ', which does not exist');
      }
    }
    if (rule) {
      say((e.event !== rule.event ? 'FAIL  ' : 'ok    ') +
          rule.name.padEnd(18) + e.event + (e.matcher ? ' [' + e.matcher + ']' : ''));
    }
  }

  if (!ours) {
    say('none  ' + file + ' registers no hook from ' + STUDIO);
    return 0;
  }
  const missing = RULES.filter(r => !seen[r.name]).map(r => r.name);
  if (missing.length) {
    notices.push(missing.length + ' hook(s) of ours are registered nowhere in ' + file + ': ' +
                 missing.join(', ') + '. A partial install may be deliberate, but something ' +
                 'carrying the rest of them once carried these.');
  }
  // Notices FIRST, and printed whether or not anything is being refused. Printing them after the
  // refusal and returning in between meant that the moment one thing was wrong, what was missing
  // stopped being reported at all -- which is the same information loss, one branch over, as a
  // notice nobody could see.
  for (const n of notices) console.log('note  ' + n);
  for (const p of problems) console.log('FAIL  ' + p);
  if (problems.length) {
    say('FAIL  ' + ours + ' studio hook(s) registered, ' + problems.length + ' wrongly wired');
    return 1;
  }
  say('ok    ' + ours + ' studio hook(s) registered, 0 wrongly wired');
  return notices.length ? 3 : 0;
}

// Guarded, because without it `require` of this file RAN the check and then called
// process.exit, so anything that loaded it to reach one function killed its own process. Every
// sibling in tools guards this; this one did not, and nothing could have noticed because nothing
// required it. The export is the other half: a guard with nothing exported leaves a file that can
// be loaded safely and still gives a caller nothing.
if (require.main === module) {
  let code = 1;
  try { code = main(); }
  catch (e) { console.log('FAIL  ' + e.message); code = 1; }
  process.exit(code);
}

module.exports = { main };
