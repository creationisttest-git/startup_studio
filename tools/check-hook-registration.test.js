'use strict';
/*
 * Every refusal here has been watched firing. This check exists because a hook sat on an event
 * that discarded its output for two weeks while every other check stayed green, so the one thing
 * it must do is REFUSE a wrong wiring, and a refusal nobody has seen cannot be told apart from a
 * check that always passes.
 *
 * The other half matters just as much and is easier to get wrong: it must NOT refuse an install
 * that has simply registered nothing. That is the normal state of a fresh copy, and a check that
 * fails everyone who has not opted in is one this repository has shipped before and had to undo.
 * So the absent, unregistered and foreign-hook cases are asserted as passes, deliberately.
 *
 * EVERY WIRING IS BUILT TWICE, IN BOTH FORMS A COMMAND HOOK CAN TAKE, and that is not thoroughness
 * for its own sake. The arguments array is optional; omit it and the whole command line is one
 * string. An earlier version of the check recognised only the array form, so the very defect it
 * was built to catch passed it with a clean exit when written the other way, and rewriting all six
 * hooks as strings turned a fully wired machine into one reported as having nothing registered.
 * A fixture set that only ever builds one form cannot see that, so this one builds both and asserts
 * the verdict is the same.
 *
 * Every rule the check holds gets a fixture, and the number of rules is pinned. Two rules once had
 * neither: deleting them left this suite green while the live check quietly stopped watching two
 * of the six hooks.
 *
 * Fixtures are unique per run and removed at the end, because stale ones accumulate here until a
 * long run is killed for memory and reads as a code failure to whoever debugs it next.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
/* ST-281: fixture roots come from ONE place that makes them unique and removes them at exit. */
const { fixtureRoot } = require('./tmp-fixtures.js');

const CHECK = path.join(__dirname, 'check-hook-registration.js');
const STUDIO = path.resolve(__dirname, '..');
const GUARD = path.join(STUDIO, 'tools', 'session-guard.js');
const BUDGET = path.join(STUDIO, 'tools', 'session-budget.js');
const TOOL = path.join(STUDIO, 'studio.ps1');
const TAB = String.fromCharCode(9);

let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

const RUN = Date.now() + '-' + process.pid;
const DIR = path.join(fixtureRoot('hook-registration'), 'tree');
if (fs.existsSync(DIR)) throw new Error('fixture already exists, refusing to reuse it: ' + DIR);
fs.mkdirSync(DIR, { recursive: true });

let seq = 0;
function settings (hooks) {
  const f = path.join(DIR, 'settings-' + (seq++) + '.json');
  fs.writeFileSync(f, JSON.stringify({ hooks: hooks }, null, 2));
  return f;
}

function run (file, extra) {
  const args = [CHECK].concat(file ? ['--settings', file] : []).concat(extra || []);
  try {
    return { code: 0, out: execFileSync('node', args, { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '').toString() };
  }
}

// The two forms a command hook can take. Every fixture below is built through one of these.
const exec = (cmd, args) => ({ type: 'command', command: cmd, args: args });
const shell = cmd => ({ type: 'command', command: cmd });
const q = p => '"' + p + '"';

const guardExec = ev => [{ hooks: [exec('node', [GUARD, '--event', ev])] }];
const guardShell = ev => [{ hooks: [shell('node ' + q(GUARD) + ' --event ' + ev)] }];
const recallExec = m => [{ matcher: m, hooks: [exec('powershell', ['-NoProfile', '-File', TOOL, '-Recall'])] }];
const recallShell = m => [{ matcher: m, hooks: [shell('powershell -NoProfile -File ' + q(TOOL) + ' -Recall')] }];

function allSix (form) {
  const g = form === 'shell' ? guardShell : guardExec;
  const r = form === 'shell' ? recallShell : recallExec;
  const autoload = form === 'shell'
    ? shell('powershell -NoProfile -File ' + q(TOOL) + ' -Autoload')
    : exec('powershell', ['-NoProfile', '-File', TOOL, '-Autoload']);
  const budget = form === 'shell' ? shell('node ' + q(BUDGET)) : exec('node', [BUDGET]);
  return {
    SessionStart: [{ hooks: [autoload] }].concat(r('compact')),
    PreCompact: g('precompact'),
    Stop: g('stop'),
    SessionEnd: g('sessionend'),
    PreToolUse: [{ hooks: [budget] }]
  };
}

{
  const r = run(path.join(DIR, 'no-such-file.json'));
  ok('a settings file NAMED on the command line and not there is an error about that file',
    r.code === 2);
  // The control for the line above, and the reason it is not simply a clean case turned into a
  // failure: an absent DEFAULT is still not a failure, because a host that registers nothing is a
  // real and clean answer. Proved by pointing the home directory at an empty one.
  const home = fixtureRoot('hook-registration-home');
  let d;
  try {
    d = { code: 0, out: execFileSync('node', [CHECK],
      { encoding: 'utf8', env: Object.assign({}, process.env, { USERPROFILE: home, HOME: home }) }) };
  } catch (e) { d = { code: e.status, out: (e.stdout || '').toString() }; }
  ok('while the DEFAULT settings file being absent is NOT a failure', d.code === 0);
  ok('and it says so out loud rather than saying nothing at all',
    /no hooks are registered here/.test(d.out));
  ok('and it says so rather than printing nothing', /no settings file/.test(r.out));
}

{
  const r = run(settings({ SessionStart: [{ hooks: [exec('node', ['/somewhere/else/theirs.js'])] }] }));
  ok('an install whose hooks are all somebody else’s is NOT a failure', r.code === 0);
  ok('and it says it recognised none of ours', /registers no hook/.test(r.out));
}

{
  const r = run(settings({}));
  ok('settings with no hooks at all is NOT a failure', r.code === 0);
}

for (const form of ['exec', 'shell']) {
  const r = run(settings(allSix(form)));
  ok('a fully and correctly wired install passes, in ' + form + ' form', r.code === 0);
  ok('and it names each hook and the event it is on, in ' + form + ' form',
     /recall .*SessionStart/.test(r.out));
  ok('EVERY ONE OF THE SIX IS RECOGNISED IN ' + form.toUpperCase() + ' FORM. Recognising some '
   + 'forms and not others is how a fully wired machine was reported as having nothing wired',
     /6 studio hook\(s\) registered, 0 wrongly wired/.test(r.out));
}

for (const form of ['exec', 'shell']) {
  const wrong = form === 'shell' ? recallShell('') : recallExec('');
  const r = run(settings({ PreCompact: wrong }));
  ok('THE EXACT DEFECT THIS CHECK WAS BUILT FROM IS REFUSED IN ' + form.toUpperCase() + ' FORM: '
   + 'the recall hook back on the event that discards what it returns', r.code === 1);
  ok('and the refusal names the event it is on and the event it must be on, in ' + form + ' form',
     /registered on PreCompact and must be on SessionStart/.test(r.out));
  ok('and it gives the reason, so the fix does not require reading the check, in ' + form + ' form',
     /adds that to context/.test(r.out));
}

{
  ok('a compaction guard wired to the turn ending is refused',
     run(settings({ Stop: guardExec('precompact') })).code === 1);
  ok('a turn guard wired to compaction is refused',
     run(settings({ PreCompact: guardExec('stop') })).code === 1);
  ok('a session-end recorder wired to compaction is refused',
     run(settings({ PreCompact: guardExec('sessionend') })).code === 1);
}

{
  const r = run(settings({ PreCompact: [{ hooks: [exec('powershell',
    ['-NoProfile', '-File', TOOL, '-Autoload'])] }] }));
  ok('THE ROSTER HOOK HAS A FIXTURE OF ITS OWN AND IS REFUSED ON THE WRONG EVENT. Two of the six '
   + 'rules once had none, so deleting either left this suite green while the live check stopped '
   + 'watching them', r.code === 1);
  ok('and the refusal names it', /autoload is registered on PreCompact/.test(r.out));
}

{
  const r = run(settings({ Stop: [{ hooks: [exec('node', [BUDGET])] }] }));
  ok('THE BUDGET HOOK HAS A FIXTURE OF ITS OWN AND IS REFUSED ON THE WRONG EVENT', r.code === 1);
  ok('and the refusal names it', /budget is registered on Stop/.test(r.out));
}

{
  const r = run(settings({ SessionStart: recallExec('startup') }));
  ok('A MATCHER THAT EXCLUDES THE ONE TRIGGER A HOOK EXISTS FOR IS REFUSED. The right event with '
   + 'the wrong matcher fires never and logs nothing, which is the same silence as the wrong '
   + 'event and one field further from anybody looking', r.code === 1);
  ok('and the refusal quotes the matcher and names the trigger it fails to cover',
     /matcher "startup", which does not cover compact/.test(r.out));
  ok('and it gives the reason', /after a compaction/.test(r.out));
}

{
  ok('the same hook with the matcher it needs passes',
     run(settings({ SessionStart: recallExec('compact') })).code !== 1);
  ok('AN EMPTY MATCHER COVERS EVERY TRIGGER, so an install that narrowed nothing is not refused',
     run(settings({ SessionStart: recallExec('') })).code !== 1);
  ok('and an alternation carrying the trigger among others passes',
     run(settings({ SessionStart: recallExec('startup|compact') })).code !== 1);
}

{
  const r = run(settings({ PreCompact: [{ matcher: 'manual', hooks: [exec('node',
    [GUARD, '--event', 'precompact'])] }] }));
  ok('A COMPACTION GUARD NARROWED TO THE COMPACTIONS A PERSON ASKED FOR IS REFUSED. The one that '
   + 'arrives unasked is the one that lands in the window this guards', r.code === 1);
  ok('and the refusal names the trigger it no longer covers', /does not cover auto/.test(r.out));
}

{
  const r = run(settings({ SessionEnd: [{ matcher: 'clear', hooks: [exec('node',
    [GUARD, '--event', 'sessionend'])] }] }));
  ok('A SESSION-END RECORDER THAT ONLY RECORDS ONE KIND OF ENDING IS REFUSED. It is the only '
   + 'trace a skipped wind-down leaves, and a partial record reads as a complete one', r.code === 1);
  ok('and the refusal names an ending it would miss', /does not cover logout/.test(r.out));
}

{
  const r = run(settings({ PreCompact: guardExec('precompact'), Stop: guardExec('stop') }));
  ok('A HOOK OF OURS REGISTERED NOWHERE IS NAMED. Refusing everyone who has not opted in is the '
   + 'trap this repository has already had to undo, but staying silent means a registration that '
   + 'was LOST is indistinguishable from one that was never wanted', /registered nowhere/.test(r.out));
  ok('and the ones that are absent are listed by name', /autoload/.test(r.out) && /budget/.test(r.out));
  ok('AND IT IS NOT REFUSED. Naming is not refusing, so exit 3 says advisory rather than 1, which '
   + 'is what lets the runner print a row for it without any gate treating it as a failure',
     r.code === 3);
  const quiet = run(settings({ PreCompact: guardExec('precompact'), Stop: guardExec('stop') }), ['--quiet']);
  ok('AND IT IS NAMED EVEN UNDER --quiet, which is the flag every caller actually uses. A notice '
   + 'only visible when nobody is looking is not a notice', /registered nowhere/.test(quiet.out));
  ok('while an install carrying all six says nothing about anything missing',
     !/registered nowhere/.test(run(settings(allSix('exec'))).out));
}

{
  const gone = path.join(STUDIO, 'tools', 'moved-away', 'session-guard.js');
  const r = run(settings({ PreCompact: [{ hooks: [exec('node', [gone, '--event', 'precompact'])] }] }));
  ok('a registered path that does not resolve is refused', r.code === 1);
  ok('and the refusal quotes the path', /does not exist/.test(r.out));
}

{
  const gone = path.join(STUDIO, 'tools', 'moved-away', 'session-guard.js');
  const r = run(settings({ PreCompact: [{ hooks: [shell('node ' + q(gone) + ' --event precompact')] }] }));
  ok('AND THE SAME PATH IS FOUND INSIDE A SINGLE COMMAND STRING AND REFUSED THERE TOO. Splitting '
   + 'that string back into words is what makes a quoted path with a space in it survive', r.code === 1);
  ok('and the refusal quotes it', /does not exist/.test(r.out));
}

{
  const broken = path.join(STUDIO, 'tools') + TAB + 'session-guard.js';
  const r = run(settings({ PreCompact: [{ hooks: [exec('node', [broken, '--event', 'precompact'])] }] }));
  ok('AN ARGUMENT CARRYING A CONTROL BYTE IS REFUSED. That is what a path looks like after a '
   + 'shell has eaten its separators, and it renders correctly in a terminal while being wrong '
   + 'on disk, so the eye is no help at all', r.code === 1);
  ok('AND IT IS REFUSED FOR THAT REASON, NOT MERELY BECAUSE THE MANGLED PATH ALSO FAILS TO '
   + 'RESOLVE. Reading only the exit code here let the control-byte scan be disabled entirely '
   + 'with this block still green, because the same fixture trips two rules at once',
     /control byte/.test(r.out));
}

{
  const r = run(settings({ PreCompact: [{ hooks: [shell('node' + TAB + ' ' + q(GUARD) +
    ' --event precompact')] }] }));
  ok('A CONTROL BYTE IN A SINGLE COMMAND STRING IS REFUSED, AND THIS ONE CAN FAIL FOR NO OTHER '
   + 'REASON: the path in it resolves and the wiring is correct, so the scan is the only thing '
   + 'that can object. Looking for the byte in the words rather than in the raw field would eat '
   + 'the evidence, because splitting on whitespace consumes a tab', r.code === 1);
  ok('and it is refused for that reason', /control byte/.test(r.out));
}

{
  const f = path.join(DIR, 'broken.json');
  fs.writeFileSync(f, '{ this is not settings');
  const r = run(f);
  ok('settings that cannot be parsed are refused rather than read as empty', r.code === 1);
}

{
  const good = settings(allSix('exec'));
  ok('--quiet stays silent when there is nothing wrong and nothing absent',
     run(good, ['--quiet']).out.trim() === '');
  const bad = settings({ Stop: guardExec('precompact') });
  ok('AND --quiet STILL SPEAKS WHEN THERE IS. A refusal nobody can see under the flag the '
   + 'callers actually use is the same as no refusal',
     run(bad, ['--quiet']).out.trim() !== '' && run(bad, ['--quiet']).code === 1);
}

{
  const r = run(null, ['--rules']);
  const names = r.out.split(/\r?\n/).filter(l => l.trim());
  ok('THE CHECK REPORTS HOW MANY RULES IT HOLDS, AND THE NUMBER IS PINNED HERE. Deleting a rule '
   + 'removes a hook from watch, and without this the deletion is silent',
     /^6 rule\(s\)$/m.test(r.out) && names.length === 7);
  ok('and it names each rule with the event it holds it to',
     /recall +SessionStart/.test(r.out) && /budget +PreToolUse/.test(r.out));
}

/* One case per reading the runtime gives a matcher. Reading them all as one anchored pattern
   accepted a matcher that never fires and refused two ordinary forms that do. */
{
  const r = run(settings({ SessionStart: recallExec('COMPACT') }));
  ok('A LETTERS-ONLY MATCHER IS AN EXACT STRING AND CASE MATTERS, so one differing only in case '
   + 'never fires and is refused. Accepting it is the same silence this check exists to break, '
   + 'one field further along', r.code === 1);
  ok('and the refusal quotes it', /matcher "COMPACT"/.test(r.out));
  ok('A COMMA-SEPARATED LIST IS A LIST, not a single exact string. Refusing it is a lockout on an '
   + 'install that works', run(settings({ SessionStart: recallExec('startup, compact') })).code !== 1);
  ok('and so is a list separated by bars',
     run(settings({ SessionStart: recallExec('startup|compact') })).code !== 1);
  ok('ANYTHING ELSE IS A PATTERN TESTED UNANCHORED, so one matching anywhere in the trigger fires '
   + 'and must not be refused', run(settings({ SessionStart: recallExec('.') })).code !== 1);
  ok('while a pattern that cannot be compiled is treated as firing on nothing, because a matcher '
   + 'nobody can evaluate cannot be relied on',
     run(settings({ SessionStart: recallExec('(') })).code === 1);
}

/* Each of these makes the guard print usage and exit without doing anything. */
{
  const forms = {
    'no mode at all': [{ hooks: [exec('node', [GUARD])] }],
    'a mode joined by an equals sign': [{ hooks: [exec('node', [GUARD, '--event=precompact'])] }],
    'the same in one command string': [{ hooks: [shell('node ' + q(GUARD) + ' --event=precompact')] }],
    'a mode this tool does not handle': [{ hooks: [exec('node', [GUARD, '--event', 'precompaction'])] }]
  };
  for (const what of Object.keys(forms)) {
    const r = run(settings({ PreCompact: forms[what] }));
    ok('A HOOK OF OURS THAT CANNOT WORK IS REFUSED, here with ' + what + '. It fires, does '
     + 'nothing, and used to leave the install reading as one with no hooks registered at all',
       r.code === 1);
    ok('and the refusal says what it wanted instead, for ' + what,
       /two separate words/.test(r.out));
  }
}

/* Everything the looser test claims, it also refuses, so what it does NOT claim is the assertion
   that matters. These are all legitimate, and this file publishes: an installed copy refusing a
   newer studio's own registration is the shape this repository has already had to undo. */
{
  const other = ['-Doctor', '-Status', '-Sync', '-Brief'];
  for (const flag of other) {
    ok('THE STUDIO TOOL WIRED TO ' + flag + ' IS NOT CLAIMED AND NOT REFUSED. It is not one of '
     + 'these hooks, and a future one this version has never heard of looks exactly the same',
       run(settings({ SessionStart: [{ hooks: [exec('powershell',
         ['-NoProfile', '-File', TOOL, flag])] }] })).code === 0);
  }
  ok('A DIRECTORY CARRYING THE GUARD NAME IS NOT CLAIMED EITHER, because the test is that a path '
   + 'ENDS with the filename rather than that the line mentions it',
     run(settings({ PreCompact: [{ hooks: [exec('node',
       ['D:' + path.sep + 'session-guard.js.backup' + path.sep + 'run.js'])] }] })).code === 0);
  ok('and neither is a command that merely names it in an argument',
     run(settings({ PreCompact: [{ hooks: [exec('node',
       ['wrap.js', '--wraps', 'session-guard.js'])] }] })).code === 0);
}

/* Narrowing the looser test to a path with a separator in it lost two shapes that are dead in
   exactly the way it exists to catch. The bare form has to be positional rather than allowed
   anywhere, or the wrapper case above comes back. */
{
  const dead = {
    'a bare filename with no directory': ['session-guard.js'],
    'a bare filename with the mode joined by an equals sign': ['session-guard.js', '--event=precompact']
  };
  for (const what of Object.keys(dead)) {
    ok('A DEAD GUARD REGISTERED WITH ' + what.toUpperCase() + ' IS REFUSED. It reads as an install '
     + 'with nothing registered at all, which is silent under the flag the callers use',
       run(settings({ PreCompact: [{ hooks: [exec('node', dead[what])] }] })).code === 1);
  }
  const spaced = path.join(STUDIO, 'tools', 'session-guard.js') + ' ';
  ok('AND SO IS ONE WHOSE QUOTED PATH CARRIES A TRAILING SPACE, which slipped past an anchor tied '
   + 'to the end of the token', run(settings({ PreCompact: [{ hooks: [exec('node', [spaced])] }] })).code === 1);
  ok('WHILE THE WRAPPER THAT ONLY NAMES IT IN A LATER ARGUMENT IS STILL NOT CLAIMED, which is what '
   + 'makes the bare form positional rather than allowed anywhere on the line',
     run(settings({ PreCompact: [{ hooks: [exec('node', ['wrap.js', '--wraps', 'session-guard.js'])] }] })).code === 0);
  ok('AND THAT HOLDS WHEN THE WRAPPER PASSES AN ABSOLUTE PATH TO OUR GUARD, which the assertion '
   + 'above never exercised: it only ever named the bare form, so it stayed green while a wrapper '
   + 'handing over a full path was claimed and refused. An assertion narrower than its name is the '
   + 'defect this ticket family keeps producing',
     run(settings({ PreCompact: [{ hooks: [exec('node', ['wrap.js', '--wraps', GUARD])] }] })).code === 0);
  ok('AND A DIFFERENT FILE WHOSE NAME MERELY ENDS WITH OURS IS NOT CLAIMED. A prefix inside the '
   + 'last segment is somebody else’s file, and refusing it is a refusal of an install that works',
     run(settings({ PreCompact: [{ hooks: [exec('node',
       ['D:' + path.sep + 'my-session-guard.js', '--event', 'precompact'])] }] })).code === 0);
}

/* A NAME MUST START AT A SEPARATOR AND MUST NOT BE CONTINUED, AND MORE THAN A SPACE OR A SLASH CAN
   START IT. Testing only the front left a prefix test behind, so a backup kept beside the real file
   was read as the real file; and a name after an equals sign or written drive-relative was read as
   nothing at all, which is the silent pass this check exists to end rather than to produce.

   ALL THREE NAMES ARE EXERCISED, AND THE FIRST VERSION OF THIS BLOCK EXERCISED ONE, while the
   change beneath it covered three: stripping the end test from the other two left this suite fully
   green with a backup file claimed and refused. */
{
  const cases = [
    { what: 'the studio tool', wrong: 'PreCompact', cmd: 'powershell',
      live: 'studio.ps1', backup: 'studio.ps1.bak',
      plain: p => ['-NoProfile', '-File', p, '-Recall'],
      equals: p => ['-NoProfile', '-File=' + p, '-Recall'] },
    { what: 'the session guard', wrong: 'Stop', cmd: 'node',
      live: 'session-guard.js', backup: 'session-guard.js.bak',
      plain: p => [p, '--event', 'precompact'],
      equals: p => ['--file=' + p, '--event', 'precompact'] },
    { what: 'the budget guard', wrong: 'Stop', cmd: 'node',
      live: 'session-budget.js', backup: 'session-budget.js.old',
      plain: p => [p], equals: p => ['--file=' + p] }
  ];
  for (const c of cases) {
    const on = args => { const h = {}; h[c.wrong] = [{ hooks: [exec(c.cmd, args)] }]; return settings(h); };
    ok('A BACKUP OF ' + c.what.toUpperCase() + ' IS NOT CLAIMED AS THE FILE ITSELF. The name ends '
     + 'where ' + c.backup + ' does not, so reading it as ours refuses somebody for keeping a copy '
     + 'beside the real one',
       run(on(c.plain('D:' + path.sep + c.backup))).code === 0);
    /* The verdict is not enough on its own. The looser test claims the guard too, so an exit of one
       proves only that SOMETHING objected: stripping the drive letter from the rule left this green
       because the fallback caught the same fixture and refused it for a different reason. So the
       REASON is asserted, and a rule that stops recognising the file now reddens instead of being
       covered by the layer beneath it. */
    const wrongEvent = r => r.code === 1 && /must be on/.test(r.out);
    ok('WHILE ' + c.what.toUpperCase() + ' NAMED AFTER AN EQUALS SIGN IS RECOGNISED BY ITS RULE, AND '
     + 'SO REFUSED FOR BEING ON THE WRONG EVENT. An equals sign separates a switch from its value '
     + 'and is no part of the path, so a hook written that way was reported as an install '
     + 'registering nothing at all',
       wrongEvent(run(on(c.equals(c.live)))));
    ok('AND SO IS ' + c.what.toUpperCase() + ' WRITTEN DRIVE-RELATIVE. A colon ends the drive '
     + 'letter and the path starts straight after it, so C:' + c.live + ' names our file with no '
     + 'directory, and it read as nothing at all',
       wrongEvent(run(on(c.plain('C:' + c.live)))));
  }
  ok('AND THE LOOSER TEST READS A DRIVE-RELATIVE PATH THE WAY THE RULES DO. It kept its own copy '
   + 'of what may introduce a filename, so a guard registered as C:session-guard.js with no mode '
   + 'fired, did nothing, and was reported as an install with no hook registered at all: the very '
   + 'silence the rules had just been taught to break',
     run(settings({ PreCompact: [{ hooks: [exec('node', ['C:session-guard.js'])] }] })).code === 1);
}

/* A switch given as :$false turns itself off, so the hook fires and does nothing, which is the
   whole class the looser test exists for. */
{
  for (const flag of ['-Recall:$false', '-Autoload:$false']) {
    const r = run(settings({ SessionStart: [{ matcher: 'compact', hooks: [exec('powershell',
      ['-NoProfile', '-File', TOOL, flag])] }] }));
    ok('A SWITCH WRITTEN AS ' + flag + ' IS REFUSED, not read as wired. Widening the pattern to '
     + 'accept the colon form so a working install was not refused let the off form in with it',
       r.code === 1);
    ok('and the refusal says what it wants instead, for ' + flag,
       /switched on/.test(r.out));
  }
  ok('WHILE THE ON FORM, WHICH IS ORDINARY SYNTAX FOR THIS SHELL, IS STILL ACCEPTED',
     run(settings({ SessionStart: [{ matcher: 'compact', hooks: [exec('powershell',
       ['-NoProfile', '-File', TOOL, '-Recall:$true'])] }] })).code !== 1);
}

/* A notice printed after a refusal and returned around is a notice nobody sees, which is the same
   loss as one printed under a flag nobody uses. */
{
  const r = run(settings({ PreCompact: guardExec('precompact'), Stop: [{ hooks: [exec('node', [BUDGET])] }] }));
  ok('A REFUSAL DOES NOT SWALLOW THE NOTICE. The moment anything is wrong is the moment somebody '
   + 'is reading the output, so that is the worst time to stop saying what is missing',
     r.code === 1 && /registered nowhere/.test(r.out));
  ok('and both are present, the notice and the refusal',
     /note {2}/.test(r.out) && /FAIL {2}budget is registered on Stop/.test(r.out));
}

/* The documented ways to write a portable registration, none of which this check can resolve as
   literal text, and all of which work. */
{
  const portable = {
    'a project-directory placeholder': '$CLAUDE_PROJECT_DIR/studio.ps1',
    'a plugin-root placeholder': '${CLAUDE_PLUGIN_ROOT}/studio.ps1',
    'a home path': '~/AI Projects/_STUDIO/studio.ps1',
    'a relative path': 'nowhere-near-here/studio.ps1'
  };
  for (const what of Object.keys(portable)) {
    const r = run(settings({ SessionStart: [{ matcher: 'compact', hooks: [exec('powershell',
      ['-NoProfile', '-File', portable[what], '-Recall'])] }] }));
    ok('AN INSTALL WRITTEN WITH ' + what.toUpperCase() + ' IS NOT REFUSED. It is exactly what the '
     + 'documentation recommends, and refusing it locks out a working machine', r.code !== 1);
    ok('and it is reported rather than passed over in silence, for ' + what,
       /note {2}/.test(r.out));
  }
  const absolutePlaceholder = 'C:' + path.sep + 'Users' + path.sep + '%USERNAME%' + path.sep +
                              'studio.ps1';
  const r = run(settings({ SessionStart: [{ matcher: 'compact', hooks: [exec('powershell',
    ['-NoProfile', '-File', absolutePlaceholder, '-Recall'])] }] }));
  ok('AND A PATH THAT IS ABSOLUTE AND STILL CARRIES A PLACEHOLDER IS NOT REFUSED EITHER. This is '
   + 'the one that proves the substitution test is doing work of its own: every other portable '
   + 'form is also a relative path, so removing that test alone changes none of them and the '
   + 'assertions above stay green while the check has quietly lost a branch', r.code !== 1);
  ok('and it says the runtime fills it in rather than calling it relative',
     /fills in when the hook fires/.test(r.out));

  const gone = path.join(STUDIO, 'tools', 'moved-away', 'session-guard.js');
  ok('WHILE AN ABSOLUTE PATH THAT IS SIMPLY MISSING IS STILL REFUSED, which is the case the check '
   + 'can actually answer',
     run(settings({ PreCompact: [{ hooks: [exec('node', [gone, '--event', 'precompact'])] }] })).code === 1);
}

/* An empty arguments array is still truthy, which had the path check inspecting a whole command
   line, finding no filename in it, and passing a moved path. */
{
  const gone = path.join(STUDIO, 'tools', 'moved-away', 'session-guard.js');
  const line = 'node ' + q(gone) + ' --event precompact';
  ok('A MOVED PATH IS REFUSED WHEN THE ARGUMENTS ARRAY IS PRESENT BUT EMPTY, because the command '
   + 'line is then the single string form however the array is written',
     run(settings({ PreCompact: [{ hooks: [{ type: 'command', command: line, args: [] }] }] })).code === 1);
  ok('and when the arguments are a bare string rather than an array',
     run(settings({ PreCompact: [{ hooks: [{ type: 'command', command: 'node',
       args: q(gone) + ' --event precompact' }] }] })).code === 1);
  ok('WHILE A PATH CONTAINING A SPACE, PASSED AS ONE ARGUMENT, IS NOT SPLIT AND NOT REFUSED. '
   + 'Splitting it would report the tail of every such path as a relative one on a machine where '
   + 'everything resolves', run(settings({ PreCompact: guardExec('precompact') })).code !== 1);
}

{
  const r = run(settings({ SessionStart: [{ matcher: 'compact' + TAB, hooks: [exec('powershell',
    ['-NoProfile', '-File', TOOL, '-Recall'])] }] }));
  ok('A CONTROL BYTE IN THE MATCHER IS REFUSED TOO. It is invisible on the screen, and it moves '
   + 'the matcher off the exact-string reading onto the pattern one, where it fires on nothing',
     r.code === 1);
  ok('and it is named as a control byte rather than only as a matcher that misses',
     /control byte/.test(r.out));
}

{
  const src = fs.readFileSync(CHECK, 'utf8');
  let ctrl = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if ((c < 32 || c === 127) && c !== 10 && c !== 13 && c !== 9) ctrl++;
  }
  ok('THE CHECK FOR CONTROL BYTES CONTAINS NONE ITSELF. Its first version carried the range as '
   + 'raw bytes, so the instrument was an instance of the fault it looks for', ctrl === 0);
}

try { fs.rmSync(DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); }
catch (e) { /* best effort */ }

/* Pinned so a deleted block shrinks the count instead of passing in silence. Read from a run of
   this file rather than typed beside it. Mutation: delete any assertion above and this goes red
   on its own. */
/* A NAMED settings file and the DEFAULT one are different questions. While they shared an answer,
   --settings --quiet ate the flag as the path, failed to open it, and reported no hooks registered
   at exit 0 while printing nothing at all: a clean verdict about a file nobody opened. Measured on
   a copy carrying studio.ps1, because without it twelve unrelated path assertions are already red
   and a mutation cannot be read against that: restore the one-line settingsPath and the suite goes
   from 119 passed 0 failed to 114 passed 5 failed. The five are these two and the three about a
   named missing file; the DEFAULT-absent control stays green, which is what says this is a
   distinction being drawn rather than a clean case turned into a failure. */
{
  const a = run(null, ['--settings', '--quiet']);
  ok('--settings with nothing after it is a usage error and not a clean install', a.code === 2);
  ok('and it says which flag wanted a value', /--settings needs a value/.test(a.out));
  const missing = path.join(os.tmpdir(), 'hook-registration-absent-' + process.pid + '.json');
  const b = run(missing);
  ok('a settings file NAMED on the command line and not there is an error about that file, '
   + 'because only the DEFAULT being absent means this host registers nothing', b.code === 2);
  ok('and it says the path was named rather than reporting an empty install',
    /named on the command line/.test(b.out));
}

const EXPECTED_ASSERTIONS = 119;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
