#!/usr/bin/env node
/**
 * check-session-brief.js -- holds the session-start message to what a founder can read.
 *
 * Why this exists. The SessionStart hook read the whole resume prompt out loud. Measured on
 * 2026-08-30 that was 74 lines and 754 words; measured on 2026-08-31, after one wind-down, it
 * was 96 lines and 977 words. It grew 22 lines in a day. The CEO's words on ST-069: "warm start
 * does not really help me as it just gives me this massive verbose message, but I only care
 * about what."
 *
 * The cause is structural rather than careless. Every wind-down has a reason to ADD to the
 * handover and none has a reason to CUT, so any cap written as a style note loses to that
 * gradient every session. It only holds as a check, which is the same argument
 * check-resume-pointer.js was built on and for the same document. It refuses the commit once
 * a project HAS a brief, and never before then, for the reason recorded at the check itself.
 *
 * The rule it enforces, ruled by the CEO on ST-069:
 *   FOUNDER-FACING AND SESSION-FACING TEXT MUST NEVER BE THE SAME STRING.
 * The founder gets a short brief: what we are working on, why it matters, what done looks like,
 * and what is needed from them. The session gets the operating manual, delivered by the
 * CLAUDE.md import that already loads WARM_START.md on every request. Two audiences, two
 * strings, two delivery routes. The hook carries only the first.
 *
 *   node tools/check-session-brief.js <path-to-WARM_START.md>
 *   node tools/check-session-brief.js <path> --studio <path-to-studio.ps1>
 *   node tools/check-session-brief.js <path> --board <dir-holding-.board>
 *   node tools/check-session-brief.js <path> --quiet      only print failures
 *
 * Exit 0 clean, 1 on a failure, 2 on a usage or read error, 3 when this project has no
 * founder brief at all. THREE IS NOT A FAILURE: it means the project has not opted in, and
 * /wind-down reports it without blocking the commit. See the comment at the check itself.
 *
 * What it checks, each with a test in check-session-brief.test.js:
 *   - a founder brief section exists at all
 *   - that section carries a fenced block, because a hand-off written as prose is not findable
 *     and whatever text sits nearby gets handed over instead. That failure has happened here.
 *   - the brief is not empty
 *   - TWO CAPS, ruled by the CEO on 2026-08-31. The brief fits 12 lines on its own, and the
 *     whole emitted message fits 25 in the worst case. The brief is capped separately because it
 *     is read every session and has nothing else stopping it growing; the remainder belongs to
 *     findings, which are bounded because each one stops firing once it is fixed.
 *   - the combined figure is DERIVED from studio.ps1 rather than hardcoded, so a finding added to
 *     Get-ProjectBrief tightens the worst case instead of quietly breaking the cap. A fifth
 *     finding turns it red with a full brief and nobody touching either number. Note what that
 *     does and does not promise: it reads the COUNT of findings and never their LENGTHS.
 *   - the brief is not the resume prompt, nor the head of it. This is the audience split
 *     asserted directly, and it is the assertion the whole ticket turns on.
 *   - the brief tracks the board in BOTH directions (S39): it names every LARGE ticket in
 *     progress, and every ticket it names is actually live. Small tickets are exempt from the
 *     first direction on purpose, because they churn and a brief listing them all is a second
 *     board. There is NO vacuity guard; one was written and deleted, and the reasoning is at
 *     the site where it would have gone.
 *
 *   - no line is wider than MAX_WIDTH. content-lead's finding on ST-069, and it is right: a line
 *     cap without a width cap is not a cap, because twelve 400-character lines wrap to ninety on
 *     a terminal and that is the exact defect being fixed. Same shape as S48.
 *   - the brief carries no em-dash, which is the standing content rule
 *
 * WHAT THIS CANNOT SEE, stated here rather than left for someone to discover (S61):
 *   - It derives the worst-case finding count by pattern-matching the body of Get-ProjectBrief
 *     in studio.ps1. A finding added by some other mechanism, or built in a loop rather than
 *     written out as a literal, is invisible to it.
 *   - It proves the brief NAMES the right tickets. It CANNOT prove that what the brief says
 *     ABOUT them is true. A brief naming ST-062 and describing it completely wrongly passes
 *     every check in this file. That gap is a human read at wind-down, and saying so here is
 *     what stops this check reading as complete.
 *   - It does not check the numbers in the brief's prose against the board. A sentence saying
 *     "eight large items are waiting" goes stale silently. Parsing it would couple this check
 *     to one exact phrase of copy, which breaks the moment the copy is rewritten and then
 *     passes vacuously, so it is deliberately left out rather than built badly. Carried on the
 *     ticket instead.
 */
'use strict';

var fs = require('fs');
var path = require('path');

// THE TWO CAPS, ruled by the CEO on 2026-08-31. The whole session-start message fits in 25 lines,
// and the BRIEF ITSELF fits in 12.
//
// It supersedes a flat 15, which was not wrong so much as set against the wrong population: the 15
// was measured on a message that was 96 lines of RESUME PROMPT and ZERO findings, so the worst
// case with findings firing was never in view. Measured worst case is about 20 lines.
//
// WHY IT IS SPLIT RATHER THAN FLAT, which is the whole point. A cap is not a target but it becomes
// one, and this file exists because the message grew 22 lines in a single day on the argument that
// there was room. A flat 25 leaves twelve empty lines and "we are still under the cap" is an
// argument for filling them. So the spare capacity is FENCED. The brief gets 12, because it is
// what the founder reads every single day and it is the part with nothing to stop it growing. The
// remainder belongs to findings, which are naturally bounded: there are only three, and each one
// disappears the moment the thing it reports is fixed. The drift has nowhere to go.
var COMBINED_CAP = 25;
var BRIEF_CAP = 12;

// The label and the blank line above the brief.
var PREAMBLE_LINES = 3;

// A finding is one sentence of Rule, What and Fix. Measured at 175 and 193 characters, so each
// wraps to two lines at MAX_WIDTH. ASSUMED rather than derived, and said so: this reads the COUNT
// of findings out of studio.ps1 and never their LENGTHS, so a finding written longer than two
// wrapped lines is invisible to the arithmetic below.
var FINDING_LINES = 2;

// Invoke-Autoload contributes at most one line, the "Studio agents rebuilt for X" sentence.
var REBUILD_LINES = 1;

// Used only when studio.ps1 cannot be read. Stated rather than silent, because a fallback that
// looks like a measurement is the defect this whole file exists to stop.
var ASSUMED_FINDINGS = 3;

// A line cap alone is not a cap. Twelve 400-character lines pass a line count and wrap to ninety
// on a terminal, which is the defect this file exists to fix, one level down.
var MAX_WIDTH = 100;

var NEWLINE_SPLIT = new RegExp(String.fromCharCode(13)+"?"+String.fromCharCode(10));

// MIRRORS Get-FounderBrief IN studio.ps1 AND THAT IS THE POINT, not a coincidence to be tidied
// away. This matcher used to accept any heading level, zero hashes included, and three headings
// the hook has never recognised ("session brief", "brief for the founder"). So this file could
// pass a document the hook then read as having no brief at all: the check said healthy and the
// founder saw nothing. A checker that blesses input its consumer cannot read is worse than no
// checker. Measured before narrowing: 3 of 3 real briefs use "## Founder brief", so nothing in
// the population loses its brief to this.
var BRIEF_HEADING = /^#{1,6}\s+[^\n]*founder brief/i;

// THE RESUME MATCHER STAYS PERMISSIVE, and this asymmetry is measured rather than sloppy.
// Requiring a hash here would be correct for 7 of the 8 real documents and would SILENTLY stop
// finding the eighth, whose resume heading is genuinely unhashed prose with no hashed equivalent
// anywhere in the file. That is the hazard ST-105 raised from the other direction. So: prefer a
// hashed heading when one exists, which is what gives every other project the protection, and
// fall back to the loose form only when there is no hashed heading to find.
var RESUME_HEADING_HASHED = /^#{1,6}\s+[^\n]*(prompt to resume|resume prompt|prompt to restart|prompt for a fresh session)/i;
var RESUME_HEADING = /^\s*#{0,6}\s*(prompt to resume|resume prompt|prompt to restart|prompt for a fresh session)/i;

var HEADING = /^#{1,6}\s+\S/;
// A heading is not the only thing that ends a section. Markdown ends one with a horizontal rule
// or a setext underline too, and WARM_START.md puts a '---' directly after the founder brief.
// Omitting this let the 42-line resume-prompt paste return through the fix that removed it.
var RULE = /^\s{0,3}(-{3,}|\*{3,}|_{3,}|={3,})\s*$/;

// A SETEXT UNDERLINE IS NOT A RULE, AND IT IS SHORTER THAN ONE. CommonMark allows an underline of
// ANY length from a single character, so '-' and '==' under a paragraph both end that paragraph's
// section while matching nothing in RULE, which needs three. Round two widened the bound to rules
// and the round-two report CLAIMED setext was covered; it was not, and a section titled by a
// two-dash underline still handed the next block to the founder labelled FOUNDER BRIEF. Measured
// at the round-three gate, which is the third round in which this bound was incomplete while the
// record said it was complete.
//
// It only counts DIRECTLY under a non-blank line. That is what makes it an underline rather than
// a short run of dashes in the middle of prose, and it is why the walk has to carry the previous
// line rather than testing each line alone.
var SETEXT = /^\s{0,3}(=+|-+)\s*$/;

var FENCE = /^\s{0,3}```/;
var TICKET = /\b([A-Z][A-Z0-9]*-\d+)\b/g;

function readText (file) {
  var text = fs.readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text;
}

// A section runs from its heading to the next markdown heading, or to end of file. Not to end
// of file unconditionally: this document carries sections after both blocks we care about, and
// sweeping those in makes the brief look enormous and the comparison below meaningless.
function findSection (lines, matcher) {
  var start = -1;
  for (var i = 0; i < lines.length; i++) {
    if (matcher.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  // A fence that has OPENED wins over a bound, so a rule INSIDE a block is content rather than
  // the end of the section. Truncating at the first rule instead would cut a legitimate brief
  // that contains a '---' line off mid-fence, leaving it unterminated and the brief unfindable,
  // which fails as silence rather than as an error. Same walk as Get-FounderBrief, deliberately.
  var end = lines.length;
  var inFence = false;
  for (var j = start + 1; j < lines.length; j++) {
    if (FENCE.test(lines[j])) { inFence = !inFence; continue; }
    if (inFence) continue;
    var prev = lines[j - 1];
    var underline = SETEXT.test(lines[j]) && prev !== undefined && prev.trim() !== '';
    if (HEADING.test(lines[j]) || RULE.test(lines[j]) || underline) { end = j; break; }
  }
  return { start: start, end: end, lines: lines.slice(start, end) };
}

// The first fenced block inside a section, BOUNDED TO THAT SECTION. The bound is the point:
// the hook originally searched to end of file, so a brief heading followed by prose picked up
// the resume prompt's fence and handed 42 lines of session manual over labelled FOUNDER
// BRIEF. This comment used to claim it was the same extraction the hook used, and that claim
// was false when written -- the hook was unbounded. Both are bounded now. What still differs:
// this matches a heading at any level and the hook requires '##', so a brief under '###'
// is visible here and invisible to the hook.
function firstFence (section) {
  if (!section) return null;
  var body = section.lines.join('\n');
  // ANY language tag, not lowercase letters only. Get-FounderBrief accepts whatever follows the
  // backticks, so a fence tagged 'JSON' or 'text2' was read perfectly by the hook and reported
  // here as "the section has no fenced block" -- a wind-down blocker giving a reason that was
  // plainly false about the document in front of it. A check that refuses for the wrong reason
  // sends its reader to fix something that is not broken.
  var m = /```[^\n]*\r?\n([\s\S]*?)```/.exec(body);
  if (!m) return null;
  return m[1].replace(/\s+$/, '');
}

// Read the worst case out of studio.ps1 rather than trusting a number written here. Counts the
// finding literals inside Get-ProjectBrief only, so findings defined elsewhere in the file do
// not inflate it.
function findingBudget (studioPath) {
  if (!studioPath || !fs.existsSync(studioPath)) {
    return { count: ASSUMED_FINDINGS, derived: false };
  }
  var text;
  try { text = readText(studioPath); } catch (e) { return { count: ASSUMED_FINDINGS, derived: false }; }
  var at = text.indexOf('function Get-ProjectBrief');
  if (at === -1) return { count: ASSUMED_FINDINGS, derived: false };
  // The function ends at the next top-level "function " declaration.
  var after = text.slice(at + 1);
  var next = after.indexOf('\nfunction ');
  var body = next === -1 ? after : after.slice(0, next);
  var n = (body.match(/Rule\s*=/g) || []).length;
  if (!n) return { count: ASSUMED_FINDINGS, derived: false };
  return { count: n, derived: true };
}

// The board's live work. Returns null when there is no board here, which is a skip rather than a
// failure: not every project runs one.
//
// Two sets, because the comparison runs in BOTH directions (S39) and they are not the same set.
//   required -- LARGE tickets in progress. The brief MUST name these. Small tickets are exempt
//               deliberately: they churn, and a brief that has to list every small item in
//               flight is a second board rather than a brief.
//   live     -- anything in progress or awaiting sign-off, which is what a ref in the brief is
//               ALLOWED to be. Naming a done or unstarted ticket means the brief is describing
//               work that is not happening.
function boardWork (boardDir) {
  var dir = path.join(boardDir, '.board', 'tickets');
  if (!fs.existsSync(dir)) return null;
  var required = [], live = [];
  var files = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); });
  for (var i = 0; i < files.length; i++) {
    var t;
    try { t = JSON.parse(readText(path.join(dir, files[i]))); } catch (e) { continue; }
    if (!t || t.deleted || !t.ref) continue;
    if (t.status === 'in_progress' || t.status === 'uat' || t.status === 'uat_complete') {
      live.push(t.ref);
      if (t.status === 'in_progress' && t.size === 'large') required.push(t.ref);
    }
  }
  return { required: required.sort(), live: live.sort() };
}

function normalise (s) {
  return String(s).replace(/\s+/g, ' ').trim().toLowerCase();
}

function main (argv) {
  var args = argv.slice(2);
  var quiet = args.indexOf('--quiet') !== -1;
  var positional = [];
  var studioPath = null;
  var boardDir = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--quiet') continue;
    if (args[i] === '--studio') { studioPath = args[++i]; continue; }
    if (args[i] === '--board') { boardDir = args[++i]; continue; }
    positional.push(args[i]);
  }
  var file = positional[0];
  if (!file) {
    process.stderr.write('usage: check-session-brief.js <path-to-WARM_START.md> [--studio <studio.ps1>] [--board <dir>] [--quiet]\n');
    return 2;
  }
  var text;
  try { text = readText(file); } catch (e) {
    process.stderr.write('cannot read ' + file + ': ' + e.message + '\n');
    return 2;
  }

  var projectDir = path.dirname(path.resolve(file));
  // Beside THIS TOOL, not beside the document being checked. Defaulting to the project's own
  // directory meant only the studio ever found a studio.ps1, so every other project silently took
  // the assumed budget while being told studio.ps1 was "not readable" -- which was not true, it was
  // never going to be there. A fallback that misreports why it fired is worse than no fallback.
  if (!studioPath) studioPath = path.join(__dirname, '..', 'studio.ps1');
  if (!boardDir) boardDir = projectDir;

  var lines = text.split(/\r?\n/);
  var results = [];
  function ok (what, detail) { results.push({ ok: true, what: what, detail: detail }); }
  function bad (what, detail) { results.push({ ok: false, what: what, detail: detail }); }
  // A THIRD STATE, because "I had nothing to compare against" is not the same answer as "I
  // compared them and they differ", and printing both as ok made them indistinguishable. That is
  // how the section-bound defect could be SILENT: a document whose later section the resume
  // matcher does not recognise produced a green line from the one check that exists to catch
  // exactly that leak. It does not become a failure, because there is genuinely nothing wrong
  // with a document that has no resume prompt. It stops claiming to have proved something.
  function unproved (what, detail) { results.push({ ok: true, unproved: true, what: what, detail: detail }); }

  var briefSection = findSection(lines, BRIEF_HEADING);
  if (!briefSection) {
    // EXIT 3, NOT 1, and the distinction is a migration path rather than a nicety. This check
    // shipped as an unconditional blocker wired into /wind-down, and was live machine-wide within
    // the hour. Measured at the gate: SIX OF SEVEN projects failed it, none of which had ever had
    // the section it demands, so the next wind-down in any of them would have hit a wall it could
    // not pass. The wind-down skill's own rule, twenty-six lines below where this was wired in,
    // says a guard that refuses the commit leaves the state documents unwritten and costs more
    // than the bloat it prevents. A project opts in by writing a brief once; until then it is told
    // loudly and never locked out.
    bad('a founder brief section exists',
        'no heading matching "Founder brief" in ' + path.basename(file) +
        '. The hook has nothing founder-facing to say, so it will say nothing, and this project ' +
        'has no founder-facing channel at all. Write one. NOT BLOCKING: this project has never ' +
        'had a brief, so the commit goes through.');
    report(results, quiet);
    return 3;
  }
  ok('a founder brief section exists', 'line ' + (briefSection.start + 1));

  var brief = firstFence(briefSection);
  if (brief === null) {
    bad('the founder brief carries a fenced block',
        'the section at line ' + (briefSection.start + 1) + ' has no fenced block. ' +
        'The hook extracts the first fence; prose is not findable and the wrong text gets handed over.');
    report(results, quiet);
    return 1;
  }
  ok('the founder brief carries a fenced block', 'extracted');

  if (!brief.trim()) {
    bad('the founder brief is not empty', 'the fenced block is empty');
    report(results, quiet);
    return 1;
  }
  ok('the founder brief is not empty', brief.split(/\r?\n/).length + ' line(s)');

  // CAP ONE: the brief itself, flat. This is the part the founder reads every day and the part
  // with nothing else stopping it growing, so it gets a number of its own that no arithmetic
  // elsewhere can quietly relax.
  var budget = findingBudget(studioPath);
  var briefLines = brief.split(NEWLINE_SPLIT).length;
  var how = budget.derived
    ? ('derived from Get-ProjectBrief in ' + path.basename(studioPath) + ': ' + budget.count + ' finding(s)')
    : ('studio.ps1 not readable, so ' + ASSUMED_FINDINGS + ' finding(s) ASSUMED rather than measured');
  if (briefLines > BRIEF_CAP) {
    bad('the founder brief fits its ' + BRIEF_CAP + '-line cap',
        briefLines + ' lines against a cap of ' + BRIEF_CAP +
        '. This is the text read at every session start, so it is capped on its own rather than ' +
        'sharing a budget it could grow into.');
  } else {
    ok('the founder brief fits its ' + BRIEF_CAP + '-line cap', briefLines + ' of ' + BRIEF_CAP);
  }

  // CAP TWO: the whole message, worst case, with every finding firing. This is the half that was
  // missing entirely: the brief was capped and nothing ever added up what the hook actually emits.
  var worst = PREAMBLE_LINES + briefLines + (budget.count * FINDING_LINES) + REBUILD_LINES;
  if (worst > COMBINED_CAP) {
    bad('the whole session-start message fits the ' + COMBINED_CAP + '-line cap',
        'worst case ' + worst + ' lines against a cap of ' + COMBINED_CAP + ': ' + PREAMBLE_LINES +
        ' preamble, ' + briefLines + ' brief, ' + budget.count + ' finding(s) at ' + FINDING_LINES +
        ' wrapped lines each, ' + REBUILD_LINES + ' rebuild. ' + how);
  } else {
    ok('the whole session-start message fits the ' + COMBINED_CAP + '-line cap',
       'worst case ' + worst + ' of ' + COMBINED_CAP + '. ' + how);
  }

  // The audience split. This is the assertion the ticket turns on.
  // Hashed heading first, loose form only as a fallback. See RESUME_HEADING_HASHED above: this
  // is what stops a wrapped prose line beginning "resume prompt" from being taken as the section
  // in the 7 documents that do have a real heading, without losing the 1 that does not.
  var resumeSection = findSection(lines, RESUME_HEADING_HASHED) || findSection(lines, RESUME_HEADING);
  var prompt = firstFence(resumeSection);
  if (prompt === null) {
    unproved('the founder brief is not the resume prompt',
             'NOT PROVED: no resume prompt found in this document, so there was nothing to compare ' +
             'the brief against. This is not a pass. If this document does have a resume prompt, ' +
             'its heading is not one this check recognises, and the brief may be reaching into it.');
  } else {
    var b = normalise(brief);
    var p = normalise(prompt);
    if (b === p) {
      bad('the founder brief is not the resume prompt',
          'they are the same text. Founder-facing and session-facing text must never be the same string.');
    } else if (p.indexOf(b) === 0) {
      bad('the founder brief is not the resume prompt',
          'the brief is the opening of the resume prompt, so it is session text with a haircut ' +
          'rather than something written for the founder.');
    } else {
      ok('the founder brief is not the resume prompt', 'distinct text');
    }
  }

  // Width. A cap on lines with no cap on width is not a cap.
  var wide = brief.split(/\r?\n/).filter(function (l) { return l.length > MAX_WIDTH; });
  if (wide.length) {
    bad('no line in the founder brief is wider than ' + MAX_WIDTH,
        wide.length + ' line(s) over, longest ' + Math.max.apply(null, wide.map(function (l) { return l.length; })) +
        '. A line cap with no width cap is not a cap: long lines wrap and the brief is long again.');
  } else {
    ok('no line in the founder brief is wider than ' + MAX_WIDTH,
       'longest ' + Math.max.apply(null, brief.split(/\r?\n/).map(function (l) { return l.length; })));
  }

  // The standing content rule.
  if (brief.indexOf('—') !== -1) {
    bad('the founder brief carries no em-dash', 'found one, which is a hard content failure here');
  } else {
    ok('the founder brief carries no em-dash', 'none');
  }

  // Staleness, caught by comparison rather than trusted, and run in BOTH directions.
  var work = boardWork(boardDir);
  var named = {};
  var m;
  TICKET.lastIndex = 0;
  while ((m = TICKET.exec(brief)) !== null) named[m[1]] = true;
  var namedRefs = Object.keys(named).sort();

  if (work === null) {
    ok('the founder brief tracks the board', 'no board here, so nothing to compare against');
  } else {
    var missing = work.required.filter(function (r) { return !named[r]; });
    if (missing.length) {
      bad('the founder brief names the large work in progress',
          'the board has ' + work.required.join(', ') + ' large and in progress, and the brief does not name ' +
          missing.join(', ') + '. A hand-written brief that does not track the board goes stale, ' +
          'and a stale brief is worse than none.');
    } else if (work.required.length) {
      ok('the founder brief names the large work in progress', work.required.join(', '));
    } else {
      ok('the founder brief names the large work in progress', 'no large ticket in progress');
    }

    // The other direction. A ref in the brief that the board says is finished or unstarted means
    // the brief is describing work that is not happening.
    var liveSet = {};
    work.live.forEach(function (r) { liveSet[r] = true; });
    var notLive = namedRefs.filter(function (r) { return !liveSet[r]; });
    if (notLive.length) {
      bad('every ticket the founder brief names is actually live',
          'the brief names ' + notLive.join(', ') + ', which the board does not have in progress ' +
          'or awaiting sign-off. The brief is describing work that is not happening.');
    } else {
      ok('every ticket the founder brief names is actually live', namedRefs.length ? namedRefs.join(', ') : 'names none');
    }

    // THE VACUITY GUARD THAT IS NOT HERE, and the reasoning is kept because it will be asked for
    // again. content-lead required one on ST-069: "two empty sets satisfy both directions, so if
    // any large ticket is in progress at least one ref must appear". It was written, and the
    // mutation proving it went GREEN.
    //
    // It cannot fail alone. If required is non-empty and the brief names nothing, then `missing`
    // IS `required` and direction one has already failed. The only case the guard could own is
    // both sets empty, which is a brief correctly saying nothing about work that does not exist.
    // So it added no discrimination and inflated the count by one. S59, and the same call ST-087
    // made: an assertion that cannot fail independently is a count, not a check. Deleted rather
    // than shipped as proof.
  }

  report(results, quiet);
  return results.some(function (r) { return !r.ok; }) ? 1 : 0;
}

function report (results, quiet) {
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    if (r.ok && quiet && !r.unproved) continue;
    // 'n/a' rather than 'ok' for a check that had nothing to act on. A guard that reports green
    // having measured nothing reads exactly like one that verified something, and this file has
    // already been bitten by that: it is why an incomplete section bound could pass silently.
    var mark = r.unproved ? 'n/a   ' : (r.ok ? 'ok    ' : 'FAIL  ');
    process.stdout.write(mark + r.what + '  --  ' + r.detail + '\n');
  }
}

if (require.main === module) process.exit(main(process.argv));

module.exports = { main: main, findSection: findSection, firstFence: firstFence, findingBudget: findingBudget, boardWork: boardWork, COMBINED_CAP: COMBINED_CAP, BRIEF_CAP: BRIEF_CAP, MAX_WIDTH: MAX_WIDTH };
