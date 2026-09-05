#!/usr/bin/env node
'use strict';
/*
 * Every assertion here has been watched failing, by breaking the checker and confirming this
 * suite goes red. A check nobody has seen fail is indistinguishable from one that always passes.
 *
 * Each assertion is also written so it can fail ALONE. S59: an assertion that can only go red
 * when the one above it does is a count, not a check. That is why nearly every case below
 * builds its own fixture rather than reusing one and varying a field.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TOOL = path.join(__dirname, 'check-session-brief.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const NL = String.fromCharCode(10);

let n = 0;

// A whole throwaway project: a WARM_START.md, optionally a studio.ps1 and a board. Built fresh
// per case so one fixture cannot mask another's failure.
function project (opts) {
  const dir = path.join(os.tmpdir(), 'studio-brief-' + process.pid + '-' + (n++));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'WARM_START.md'), opts.warm, 'utf8');
  if (opts.findings !== undefined) {
    let body = 'function Get-ProjectBrief ([string]$ProjectPath) {\n';
    for (let i = 0; i < opts.findings; i++) body += '  $findings += @{ Rule = ' + "'r" + i + "'" + ' }\n';
    body += '}\nfunction Something-Else {\n  $x = @{ Rule = ' + "'not counted'" + ' }\n}\n';
    fs.writeFileSync(path.join(dir, 'studio.ps1'), body, 'utf8');
  }
  if (opts.tickets) {
    const td = path.join(dir, '.board', 'tickets');
    fs.mkdirSync(td, { recursive: true });
    opts.tickets.forEach(function (t, i) {
      fs.writeFileSync(path.join(td, 'T' + i + '.json'), JSON.stringify(t), 'utf8');
    });
  }
  return dir;
}

// Returns { code, out }. The tool exits 1 on a finding, so a throw is the normal path.
function run (dir, extra) {
  // Point the tool at the FIXTURE's studio.ps1 when there is one. The tool defaults to its own
  // directory, which is the real studio.ps1, so without this every budget case would silently
  // measure the live tool instead of the fixture it just built.
  let args = [TOOL, path.join(dir, 'WARM_START.md')];
  if (fs.existsSync(path.join(dir, 'studio.ps1'))) args.push('--studio', path.join(dir, 'studio.ps1'));
  args = args.concat(extra || []);
  try {
    const out = execFileSync('node', args, { stdio: ['pipe','pipe','pipe'] }).toString();
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() };
  }
}

// A brief of `lines` content lines, naming whatever refs are given.
function warm (opts) {
  const briefBody = opts.brief !== undefined ? opts.brief
    : ['We are building the thing.', 'It matters because of the reason.'].join('\n');
  const out = ['# WARM_START.md', ''];
  if (opts.noBriefSection !== true) {
    out.push('## Founder brief', '');
    if (opts.briefFence === false) {
      out.push(briefBody, '');
    } else {
      out.push('```', briefBody, '```', '');
    }
  }
  out.push('## Current state', 'Words that are not the brief.', '');
  if (opts.prompt !== undefined) {
    out.push('## Prompt to resume this session', '', '```', opts.prompt, '```', '');
  }
  return out.join('\n');
}

// --- the healthy shape passes ----------------------------------------------------------------
{
  const d = project({ warm: warm({ prompt: 'You are the session. Here is the manual.' }), findings: 3 });
  const r = run(d);
  ok('a short distinct brief with a derived budget is clean', r.code === 0);
  ok('a clean run says the brief section exists', /ok\s+a founder brief section exists/.test(r.out));
}

// --- no founder brief at all -------------------------------------------------------------------
{
  const r = run(project({ warm: warm({ noBriefSection: true }), findings: 3 }));
  // EXIT 3, NOT 1. Shipped as 1 and wired into /wind-down as a blocker, it locked out six of
  // seven projects, none of which had ever had the section it demands. A project opts in by
  // writing a brief once; until then it is told and never blocked.
  ok('a document with no founder brief is advisory, not blocking', r.code === 3);
  ok('and says the hook has nothing founder-facing to say', /nothing founder-facing/.test(r.out));
  ok('and says plainly that it is not blocking', /NOT BLOCKING/.test(r.out));
}

// --- the section exists but carries no fence ---------------------------------------------------
{
  const r = run(project({ warm: warm({ briefFence: false }), findings: 3 }));
  ok('a brief written as prose rather than a fence fails', r.code === 1);
  ok('and says prose is not findable', /not findable/.test(r.out));
}

// --- an empty fence ----------------------------------------------------------------------------
{
  const r = run(project({ warm: warm({ brief: '' }), findings: 3 }));
  ok('an empty founder brief fails', r.code === 1);
  ok('and says the fenced block is empty', /fenced block is empty/.test(r.out));
}

// --- CAP ONE: the brief has its own flat cap ------------------------------------------------
// Flat, and deliberately not shared with the findings budget. The brief is what the founder reads
// every day and the part with nothing else stopping it growing, so no arithmetic elsewhere can
// quietly relax it.
{
  const twelve = []; for (let i = 0; i < 12; i++) twelve.push('line ' + i);
  const r = run(project({ warm: warm({ brief: twelve.join(NL) }), findings: 3 }));
  ok('a brief exactly at the 12-line cap passes', r.code === 0);
}
{
  const thirteen = []; for (let i = 0; i < 13; i++) thirteen.push('line ' + i);
  const r = run(project({ warm: warm({ brief: thirteen.join(NL) }), findings: 3 }));
  ok('a brief one line over the 12-line cap fails', r.code === 1);
  ok('and says it is capped on its own rather than sharing', /capped on its own/.test(r.out));
}

// --- CAP TWO: the whole emitted message, worst case ---------------------------------------------
// 3 preamble + brief + 2 lines per finding + 1 rebuild, against 25. This is the half that was
// missing entirely: the brief was capped and nothing added up what the hook actually emits.
{
  const twelve = []; for (let i = 0; i < 12; i++) twelve.push('line ' + i);
  const r = run(project({ warm: warm({ brief: twelve.join(NL) }), findings: 3 }));
  ok('a full brief with three findings fits 25', r.code === 0);
  ok('and shows the arithmetic rather than just refusing', /worst case 22 of 25/.test(r.out));
}
{
  const twelve = []; for (let i = 0; i < 12; i++) twelve.push('line ' + i);
  const r = run(project({ warm: warm({ brief: twelve.join(NL) }), findings: 4 }));
  ok('a fourth finding still fits under the combined cap', r.code === 0);
}
{
  // THE DERIVATION EARNING ITS KEEP. A fifth finding pushes the worst case to 26 and this goes red
  // WITHOUT anyone touching the cap or the brief. That is the whole reason the count is read out of
  // studio.ps1 rather than written here.
  const twelve = []; for (let i = 0; i < 12; i++) twelve.push('line ' + i);
  const r = run(project({ warm: warm({ brief: twelve.join(NL) }), findings: 5 }));
  ok('a fifth finding breaks the combined cap without the brief changing', r.code === 1);
  ok('and names the worst case it computed', /worst case 26 lines against a cap of 25/.test(r.out));
  ok('and says the count came from Get-ProjectBrief', /derived from Get-ProjectBrief/.test(r.out));
}
{
  // Only findings INSIDE Get-ProjectBrief count. The fixture puts one in Something-Else, so a
  // fixture written with 5 has 5 inside and would fail; this one has 4 inside plus the stray.
  const twelve = []; for (let i = 0; i < 12; i++) twelve.push('line ' + i);
  const r = run(project({ warm: warm({ brief: twelve.join(NL) }), findings: 4 }));
  ok('a Rule outside Get-ProjectBrief is not counted against the budget', r.code === 0);
}

// --- the fallback says it is a fallback ----------------------------------------------------------
{
  const gone = path.join(os.tmpdir(), 'studio-brief-no-such-studio-' + process.pid + '.ps1');
  const r = run(project({ warm: warm({}) }), ['--studio', gone]);
  ok('an unreachable studio.ps1 does not crash the check', r.code === 0);
  ok('and the assumed budget says it was ASSUMED rather than measured', /ASSUMED rather than measured/.test(r.out));
}

// --- the default studio path is the TOOL's own directory, not the document's --------------------
// It defaulted to the project being checked, so only the studio ever found a studio.ps1 and every
// other project silently took the assumed budget while being told the file was "not readable" --
// which was false, it was never going to be there. A fallback that misreports why it fired is
// worse than no fallback. This fixture writes NO studio.ps1, so a correct default finds the real
// one and derives; a regression reports ASSUMED.
{
  const r = run(project({ warm: warm({}) }));
  ok('with no --studio it finds the tool own studio.ps1 and derives', /derived from Get-ProjectBrief/.test(r.out));
  ok('and does not claim the budget was assumed', !/ASSUMED rather than measured/.test(r.out));
}

// --- the section boundary, which is the control the whole extraction turns on --------------------
// The hook originally searched for a fence to END OF FILE, so a brief heading followed by PROSE
// picked up the NEXT section's fence. That fence is the resume prompt, so the hook handed over the
// session manual labelled FOUNDER BRIEF: the exact defect this ticket exists to fix, returning
// through its own new code path. Nothing guarded the equivalent bound in this checker either.
{
  const r = run(project({
    warm: warm({ briefFence: false, prompt: 'You are the session. Here is the whole manual.' }),
    findings: 3
  }));
  ok('a prose brief does not reach past its section for the prompt fence', r.code === 1);
  ok('and reports no fenced block rather than extracting the prompt', /no fenced block/.test(r.out));
  ok('and does not silently hand over the manual', !/whole manual/.test(r.out));
}

// --- the audience split, which is what the ticket turns on -----------------------------------------
{
  const same = 'You are the session. Here is the manual.';
  const r = run(project({ warm: warm({ brief: same, prompt: same }), findings: 3 }));
  ok('a brief identical to the resume prompt fails', r.code === 1);
  ok('and states the rule it broke', /never be the same string/.test(r.out));
}
{
  const r = run(project({
    warm: warm({ brief: 'You are the session.', prompt: 'You are the session. And then a great deal more.' }),
    findings: 3
  }));
  ok('a brief that is only the head of the prompt fails', r.code === 1);
  ok('and calls it session text with a haircut', /haircut/.test(r.out));
}
{
  const r = run(project({
    warm: warm({ brief: 'We are fixing the session-start message.', prompt: 'You are the session. Here is the manual.' }),
    findings: 3
  }));
  ok('a genuinely distinct brief passes the audience split', r.code === 0);
  ok('and says the two texts are distinct', /ok\s+the founder brief is not the resume prompt/.test(r.out));
}

// --- width, which a line cap alone does not give you -------------------------------------------------
{
  // Two lines, well inside the line budget, and 400 characters each. The exact case content-lead
  // named: passes a line count and wraps to ninety on a terminal.
  const wide = ['x'.repeat(400), 'y'.repeat(400)].join('\n');
  const r = run(project({ warm: warm({ brief: wide }), findings: 3 }));
  ok('a brief inside the line budget but 400 chars wide fails', r.code === 1);
  ok('and says a line cap with no width cap is not a cap', /not a cap/.test(r.out));
}
{
  const r = run(project({ warm: warm({ brief: 'x'.repeat(100) }), findings: 3 }));
  ok('a line exactly at the width cap passes', r.code === 0);
}
{
  const r = run(project({ warm: warm({ brief: 'x'.repeat(101) }), findings: 3 }));
  ok('a line one character over the width cap fails', r.code === 1);
}

// --- the standing content rule -------------------------------------------------------------------
{
  const r = run(project({ warm: warm({ brief: 'We are working on the thing — and it matters.' }), findings: 3 }));
  ok('an em-dash in the founder brief fails', r.code === 1);
  ok('and calls it a hard content failure', /hard content failure/.test(r.out));
}

// --- the board, direction one: large work in progress must be named ----------------------------------
{
  const r = run(project({
    warm: warm({ brief: 'We are working on something vague.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large' }]
  }));
  ok('a brief that does not name the large in-progress ticket fails', r.code === 1);
  ok('and names the ticket it is missing', /does not name ST-062/.test(r.out));
}
{
  const r = run(project({
    warm: warm({ brief: 'We are working on ST-062, the process gate.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large' }]
  }));
  ok('a brief naming the large in-progress ticket passes', r.code === 0);
}
{
  const r = run(project({
    warm: warm({ brief: 'We are working on ST-062 only.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large' },
              { ref: 'ST-088', status: 'in_progress', size: 'large' }]
  }));
  ok('a brief naming one of two large in-progress tickets still fails', r.code === 1);
  ok('and names only the one that is missing', /does not name ST-088/.test(r.out) && !/does not name ST-062/.test(r.out));
}
{
  // The exemption, and it is deliberate. The argument for it: small tickets churn,
  // and a brief that must list every small item in flight is a second board rather than a brief.
  const r = run(project({
    warm: warm({ brief: 'We are working on ST-062.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large' },
              { ref: 'ST-091', status: 'in_progress', size: 'small' }]
  }));
  ok('a small ticket in progress need not be named', r.code === 0);
}
{
  const r = run(project({
    warm: warm({ brief: 'Nothing much in flight.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'backlog', size: 'large' }, { ref: 'ST-070', status: 'done', size: 'large' }]
  }));
  ok('tickets that are not in progress are not required in the brief', r.code === 0);
}
{
  const r = run(project({
    warm: warm({ brief: 'Nothing much in flight.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large', deleted: true }]
  }));
  ok('a soft-deleted ticket is not required in the brief', r.code === 0);
}

// --- the board, direction two: a named ticket must actually be live -----------------------------------
{
  const r = run(project({
    warm: warm({ brief: 'We are working on ST-062, and ST-070 is where the value is.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large' },
              { ref: 'ST-070', status: 'done', size: 'large' }]
  }));
  ok('a brief naming a ticket the board says is done fails', r.code === 1);
  ok('and says the brief describes work that is not happening', /work that is not happening/.test(r.out));
}
{
  const r = run(project({
    warm: warm({ brief: 'We are working on ST-062, and ST-026 is awaiting your sign-off.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'in_progress', size: 'large' },
              { ref: 'ST-026', status: 'uat', size: 'large' }]
  }));
  ok('a brief may name a ticket awaiting sign-off', r.code === 0);
}

// --- no vacuity guard here, deliberately ----------------------------------------------------------
// One was written and its mutation went GREEN: it cannot fail unless direction one already has.
// The reasoning is recorded in the checker itself. S59.
{
  const r = run(project({
    warm: warm({ brief: 'Nothing is in flight and the board is quiet.' }),
    findings: 3,
    tickets: [{ ref: 'ST-062', status: 'backlog', size: 'large' }]
  }));
  ok('a brief naming no ticket passes when nothing large is in progress', r.code === 0);
}
{
  const r = run(project({ warm: warm({ brief: 'No board anywhere near this one.' }), findings: 3 }));
  ok('a project with no board skips the comparison rather than failing', r.code === 0);
  ok('and says there was no board to compare against', /no board here/.test(r.out));
}

// --- usage and read errors are exit 2, distinct from a finding ---------------------------------------
{
  const args = [TOOL, path.join(os.tmpdir(), 'studio-brief-missing-' + process.pid + '.md')];
  let r;
  try { execFileSync('node', args, { stdio: ['pipe','pipe','pipe'] }); r = { code: 0, out: '' }; }
  catch (e) { r = { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
  ok('an unreadable file is exit 2, not a silent pass', r.code === 2);
  ok('and says which file it could not read', /cannot read/.test(r.out));
}
{
  let r;
  try { execFileSync('node', [TOOL], { stdio: ['pipe','pipe','pipe'] }); r = { code: 0, out: '' }; }
  catch (e) { r = { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }; }
  ok('no argument at all is exit 2 with usage', r.code === 2 && /usage:/.test(r.out));
}

// --- a rule ends the section, not only a heading -----------------------------------------------
// A LATER MAJOR, and it is the SECOND time the 42-line paste came back through the code that
// removed it. The first fix bounded the section at the next heading and stopped there. Markdown
// also ends a section with a horizontal rule or a setext underline, and WARM_START.md puts a
// '---' immediately after the founder brief, so this is the real document's shape rather than a
// contrived one. Asserted on the REASON it fails, not just the exit code: with the bug present
// the run also exits 1, but for having handed over the prompt rather than for finding no fence.
// NO HEADING BETWEEN THE RULE AND THE FENCE, and that is the whole design of these fixtures.
// Written with a '## Prompt to resume this session' in between, both assertions passed with the
// rule bound DELETED, because the old heading-only bound stopped at that heading anyway. They
// were measuring the heading bound and reporting it as the rule bound. Caught by mutation before
// they shipped, which is the only reason anyone knows: a fixture that cannot distinguish the two
// implementations is a count, not a check (S59).
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '',
               'Somebody wrote this as prose instead of a fenced block.', '', '---', '', '```',
               'You are the session. NAME YOUR ROLES. Here is the whole manual.', '```', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a horizontal rule ends the brief section', r.code === 1);
  ok('and it fails for having no fence, not by handing the later block over', /not findable/.test(r.out));
}
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '',
               'Prose again, ended by a line of equals signs this time.', '', '===', '', '```',
               'You are the session. Here is the whole manual.', '```', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a line of three equals signs ends the brief section too', r.code === 1 && /not findable/.test(r.out));
}
// A REAL SETEXT UNDERLINE, WHICH THE FIXTURE ABOVE IS NOT, and that mislabelling was round
// three's major. An underline sits DIRECTLY under its paragraph with no blank line, and
// CommonMark allows ANY length from one character, so '--' and '=' are underlines that the
// three-or-more rule pattern cannot see. Measured before the fix: the live hook returned the
// NEXT section's fenced block for exactly this document. The assertion above was named for this
// case and, with a blank line in it, was only ever exercising the rule branch.
[['--', 'two dashes'], ['-', 'a single dash'], ['==', 'two equals signs']].forEach(function (pair) {
  const doc = ['# WARM_START.md', '', '## Founder brief', '',
               'Prose, not a fence.', '',
               'Prompt to resume this session', pair[0], '', '```',
               'MANUAL LEAK MARKER, name your roles and count them.', '```', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a setext underline of ' + pair[1] + ' ends the brief section',
     r.code === 1 && /not findable/.test(r.out));
});
// The other side of the same rule: a short run of dashes that is NOT under a paragraph is not an
// underline, so it must not end anything. Without this, widening the bound to one character
// would quietly start cutting sections at any stray dash.
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '', '```',
               'A brief that happens to contain a dash line.', '-', 'Still the brief.', '```', '',
               '## Current state', 'x', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a lone dash inside the brief fence is content, not an underline', r.code === 0);
}
// And the clause that makes an underline an underline: it must sit DIRECTLY under a non-blank
// line. Without that requirement, widening the bound to a single character would cut the section
// at any stray dash sitting on its own, and the brief below it would vanish. Asserted separately
// because the fixture above is guarded by the fence rule instead and would stay green.
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '',
               'Prose here, then a stray dash on its own after a blank line.', '', '-', '',
               '```', 'The brief.', '```', '', '## Current state', 'x', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a dash after a blank line is not an underline, so the brief below it is still found',
     r.code === 0);
}

// --- a language tag on the fence is read, not called missing ------------------------------------
// The hook accepts anything after the backticks; this file accepted lowercase letters only. So a
// fence tagged 'TEXT2' was read perfectly at session start and reported here as "the section has
// no fenced block", which is a wind-down blocker giving a reason that is plainly false about the
// document in front of it. A check that refuses for the wrong reason sends its reader to fix
// something that is not broken.
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '', '```TEXT2',
               'Tagged fence, and the hook reads it fine.', '```', '',
               '## Current state', 'x', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a fence with an uppercase or digit language tag is read rather than called missing',
     r.code === 0);
}

// --- nothing to compare against is reported as not proved, never as a pass ----------------------
// This is the check the whole ticket turns on, and when it found no resume prompt it printed a
// green line. A guard that reports ok having measured nothing is indistinguishable from one that
// verified something, and that is precisely how an incomplete section bound stayed silent: the
// leak was into a section whose heading this tool did not recognise, so the one check that exists
// to catch it had nothing to act on and said ok anyway.
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '', '```', 'The brief.', '```', '',
               '## Current state', 'There is no resume prompt anywhere in this document.', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a document with no resume prompt reports n/a rather than ok',
     /n\/a\s+the founder brief is not the resume prompt/.test(r.out));
  ok('and says in words that it is not a pass', /NOT PROVED/.test(r.out));
  ok('and it still does not fail the document, which has done nothing wrong', r.code === 0);
}
// The guard on the OBVIOUS WRONG FIX. Truncating the text at the first rule would cut a brief
// that legitimately contains a '---' off mid-fence, leaving it unterminated and the brief
// unfindable, which fails as SILENCE rather than as an error. A fence that has opened wins.
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '', '```',
               'Two things this week.', '---', 'And the second thing.', '```', '',
               '## Current state', 'Not the brief.', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a rule INSIDE the brief fence is content, not the end of the section', r.code === 0);
}

// --- the checker and the hook accept the same headings ------------------------------------------
// They diverged: this file blessed any level including zero hashes, the hook required exactly
// '##'. So a '### Founder brief' passed the wind-down and emitted nothing at session start, and
// the check said healthy while the founder saw silence.
{
  const doc = ['# WARM_START.md', '', '### Founder brief', '', '```',
               'Deeper heading, same job.', '```', '', '## Current state', 'x', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a deeper heading level is accepted, matching what the hook now reads', r.code === 0);
}
{
  const doc = ['# WARM_START.md', '', 'Founder brief', '', '```',
               'Unhashed, so the hook cannot see it.', '```', '', '## Current state', 'x', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('an unhashed brief line is not taken as the heading, because the hook cannot read one',
     r.code === 3);
}
// A DRIFT NOTICE, NOT A CONTROL, and it is labelled that way because the next reader will
// otherwise trust the wrong one. Measured at the round-three gate, both directions: comment the
// rule-bound line OUT of Get-FounderBrief and these stay green, because the regex text is still
// in the file; rewrite the same regex equivalently by reordering the alternation and these go RED
// on a correct implementation. It proves the file CONTAINS a string, never that the string is in
// force. THE REAL GUARD IS IN tests/studio-self.tests.ps1, which runs the hook and reads what it
// emits: under the same commenting-out it fails ALONE with 'a horizontal rule ends the brief
// section as surely as a heading does'. Kept anyway, because a silent rewrite of the other
// instrument is worth being told about. S61: say what a check cannot see, at the check.
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'studio.ps1'), 'utf8');
  ok('studio.ps1 still carries Get-FounderBrief', src.indexOf('function Get-FounderBrief') !== -1);
  ok('drift notice: the hook matches the same heading levels this file does',
     src.indexOf('^#{1,6}\\s+[^\\r\\n]*founder brief') !== -1);
  ok('drift notice: the hook is no longer pinned to exactly two hashes',
     src.indexOf('^##\\s+[^\\r\\n]*founder brief') === -1);
  ok('drift notice: the hook ends a section on a rule as well as a heading',
     src.indexOf('^\\s{0,3}(-{3,}|\\*{3,}|_{3,}|={3,})\\s*$') !== -1);
  ok('drift notice: the hook also ends a section on a setext underline',
     src.indexOf('^\\s{0,3}(=+|-+)\\s*$') !== -1);
}

// --- a real resume heading wins over a prose line that looks like one ----------------------------
// Measured across the 8 real WARM_START.md files before choosing this shape: 7 carry a hashed
// resume heading, and one carries ONLY the unhashed prose form with no hashed equivalent
// anywhere in the file. So requiring a hash would have silently stopped finding one document's
// prompt, which is exactly the hazard raised from the other direction. Hashed first,
// loose as a fallback: the 7 get the protection and the 1 keeps working.
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '', '```', 'The brief.', '```', '',
               '## Current state',
               'resume prompt handling changed today, which is why this line exists.', '',
               '## Prompt to resume this session', '', '```', 'THE REAL MANUAL.', '```', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('a prose line starting "resume prompt" does not hijack the real heading',
     /distinct text/.test(r.out));
}
{
  const doc = ['# WARM_START.md', '', '## Founder brief', '', '```', 'The brief.', '```', '',
               '## Current state', 'x', '',
               'Prompt to resume this session', '', '```', 'THE REAL MANUAL.', '```', ''].join('\n');
  const r = run(project({ warm: doc, findings: 3 }));
  ok('an unhashed resume heading is still found, which is the one real document that needs it',
     /distinct text/.test(r.out));
}

// --- the wind-down skill must honour the exit codes this tool returns ----------------------------
// THE OTHER ROUND-TWO MAJOR. Exit 3 only prevents a lockout if the CALLER honours it, and the
// only caller is prose in a skill file. Replacing the four-line table with "any non-zero exit
// blocks the commit" -- verbatim the round-one defect that failed six of seven projects -- left
// the whole suite green. The checker's own `return 3` was guarded; the half that caused the
// outage was not. SKILL.md installs globally and publishes, so that regression would have been
// machine-wide and silent. S75: when you remove a behaviour, assert its absence at the new path.
{
  const SKILL = path.join(__dirname, '..', 'base', 'skills', 'wind-down', 'SKILL.md');
  ok('the wind-down skill ships beside this checker', fs.existsSync(SKILL));
  const skill = fs.existsSync(SKILL) ? fs.readFileSync(SKILL, 'utf8') : '';
  const skillLines = skill.split(NL);
  function codeLine (n) {
    const re = new RegExp('^\\s*[-*]\\s*`' + n + '`');
    const hit = skillLines.filter(function (l) { return re.test(l); });
    return hit.length ? hit[0] : '';
  }
  ok('the skill documents exit 1 as blocking the commit',
     /block/i.test(codeLine(1)) && !/not\s+block/i.test(codeLine(1)));
  ok('the skill documents exit 3 as NOT blocking the commit', /not\s+block/i.test(codeLine(3)));
  ok('the skill documents exit 2 as a read failure rather than a pass',
     codeLine(2).length > 0 && !/pass/i.test(codeLine(2).replace(/as a pass/i, '')));
  // THE TABLE CAN BE LEFT INTACT AND CONTRADICTED BY A SENTENCE UNDERNEATH IT, which is how the
  // the lockout instruction got back in past the first version of this guard: all four
  // bullets untouched, plus "In practice, treat every non-clean exit as a blocker and do not
  // commit until it is 0." The suite stayed green. So this looks for the SHAPE of a generalising
  // blocker rule rather than one literal phrase.
  //
  // S61, said out loud at the check: A PROSE CONTRACT CANNOT BE FULLY PATTERN-MATCHED. A
  // sufficiently different wording still gets through, and no list of patterns fixes that. What
  // this catches is the family of restatements that have actually been written here twice. The
  // durable guard is that the skill and the tool are read together, in both directions, below.
  const GENERALISING_BLOCKER = [
    /any\s+non-?zero/i,
    /every\s+non-?zero/i,
    /non-?clean/i,
    /(any|every|all)[^.\n]{0,60}exit[^.\n]{0,60}block/i,
    /block[^.\n]{0,60}(any|every|all)[^.\n]{0,60}exit/i,
    /do not commit until it is 0/i
  ];
  const offending = GENERALISING_BLOCKER.filter(function (re) { return re.test(skill); });
  ok('the skill never generalises every non-zero exit into a blocker', offending.length === 0);
  // Both directions, so neither side can drift alone: every code the checker can return is
  // documented, and every code the skill documents is one the checker can actually return.
  const toolSrc = fs.readFileSync(TOOL, 'utf8');
  const returned = {};
  (toolSrc.match(/return\s+[0-3];/g) || []).forEach(function (r) {
    returned[r.replace(/[^0-9]/g, '')] = true;
  });
  ['1', '2', '3'].forEach(function (c) {
    ok('exit ' + c + ' is both returned by this tool and documented by the skill',
       returned[c] === true && codeLine(c).length > 0);
  });
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
const EXPECTED_ASSERTIONS = 86;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
