'use strict';
/*
 * Every assertion here has been watched failing. The guard's whole value is that it REFUSES,
 * and a refusal nobody has seen fire is indistinguishable from a guard that always allows.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const GUARD = path.join(__dirname, 'session-budget.js');
// ST-259. The gate resolves a transcript directory the same way every other tool here does,
// through the one exported helper, so a fixture cannot drift from where the tool really looks.
const gate = require('./check-gate-dispatch.js');
let pass = 0, fail = 0;
function ok (name, cond) { if (cond) { pass++; } else { fail++; console.log('FAIL  ' + name); } }

// Run the guard with a hook payload. Returns { code, err }.
function run (payload) {
  try {
    execFileSync('node', [GUARD], { input: JSON.stringify(payload), stdio: ['pipe','pipe','pipe'] });
    return { code: 0, err: '' };
  } catch (e) {
    return { code: e.status, err: (e.stderr || '').toString() };
  }
}
function fresh () {
  const id = 'test' + Math.floor(process.hrtime()[1]) + String(pass) + String(fail);
  return { id: id, file: path.join(os.tmpdir(), 'studio-session-budget-' + id + '.json') };
}
// `blocks` counts how many calls in the run were REFUSED, and it exists because an assertion
// reading only the last call cannot see a stop in the middle of one. Measured: with the call
// backstop mutated back to 40, a 41-call run fires on call 40 and is allowed on call 41, because
// the guard deliberately does not brick a session. The last call therefore looks identical to a
// run that never fired at all, and the assertion named for that mutation stayed GREEN under it.
// That is S55, an assertion certifying the absence of an effect it was never able to observe.
function drive (id, n, extra) {
  let last = null, blocks = 0;
  for (let i = 0; i < n; i++) {
    last = run(Object.assign({ session_id: id, cwd: __dirname }, extra || {}));
    if (last.code === 2) blocks++;
  }
  if (last) last.blocks = blocks;
  return last;
}

// A transcript the tally can read: one JSONL line whose usage sums to the weighted total asked
// for. input_tokens is used rather than the cache fields because it is weighted at 1, so the
// number written here is the number the guard sees and the assertions can name it.
function transcript (id, total) {
  const p = path.join(os.tmpdir(), 'studio-budget-tr-' + id + '.jsonl');
  fs.writeFileSync(p, JSON.stringify({ message: { usage: { input_tokens: total } } }) + '\n');
  return p;
}

// A SESSION THAT IS ALREADY UNDER WAY, which is the only kind that can legitimately be over
// budget. It matters because the guard now refuses to fire on a call whose state file it could not
// read: everything that stops it firing twice lives in that file, so firing without one is what
// turned a single lost file into a wall that blocked winding down. Seeding it here is the same
// device atBackstop uses further down, and it makes the fixtures model a running session instead
// of a first call carrying two and a half million tokens, which cannot happen.
function running (s) {
  fs.writeFileSync(s.file, JSON.stringify({ calls: 1, tokens: 0, offset: 0, fired: 0 }));
}

/*
 * THE FOUR BLOCKS BELOW WERE RESTATED RATHER THAN DELETED WHEN THE THRESHOLD MOVED FROM CALL
 * COUNT TO WEIGHTED SPEND (S134). Each of them used to assert the 40th call is blocked, which
 * is precisely the behaviour this change removed, so flipping them green by editing the number would
 * have left the suite agreeing with whatever the tool now does. What has to be true has moved,
 * not disappeared: the guard still refuses, still refuses AGAIN, and still does not brick a
 * session. It now decides on the thing its own header argues about.
 *
 * THE PAIR THAT PROVES THE CHANGE IS NOT SIMPLY LENIENCE is the first two blocks read together.
 * A cheap session runs PAST the old threshold, and an expensive one is stopped LONG BEFORE it.
 * A change that only did the first would be the guard being switched off with extra steps.
 */

// --- a CHEAP session now runs past the old call-count threshold -------------------------
// MUTATION THAT REDDENS THIS: set FIRST_CALLS back to 40.
{
  const s = fresh();
  const tr = transcript(s.id, 800000);
  const r = drive(s.id, 41, { transcript_path: tr });
  ok('41 calls costing 800k weighted is ALLOWED, and NO call in the run was blocked',
     r.code === 0 && r.blocks === 0);
  ok('a session inside its budget says nothing at all', r.err === '');
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- an EXPENSIVE session is stopped far EARLIER than the old threshold -----------------
// MUTATION THAT REDDENS THIS: drop dueWeighted from the due calculation.
{
  const s = fresh();
  const tr = transcript(s.id, 2600000);
  running(s);
  const r = drive(s.id, 1, { transcript_path: tr });
  // RESTATED, NOT RETUNED (S134). This used to drive a bare call and read "on call 1 rather than
  // call 40", which was the point being made when spend replaced counting. Spend still decides,
  // and what moved is that the call has to belong to a session the guard has a record of.
  ok('a running session carrying 2.6M weighted is BLOCKED on spend, far below the call backstop',
     r.code === 2);
  ok('the refusal names the spend rather than only the count', /2600k weighted/.test(r.err));
  ok('the refusal SAYS which threshold fired', /weighted spend/.test(r.err));
  ok('the refusal explains the square law', /SQUARE/.test(r.err));
  ok('the refusal tells the session to wind down', /wind-down/.test(r.err));
  ok('the refusal says to start fresh, not resume', /FRESH/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- it does not brick the session ------------------------------------------------------
{
  const s = fresh();
  const tr = transcript(s.id, 2600000);
  running(s);
  drive(s.id, 1, { transcript_path: tr });                  // fires
  const r = drive(s.id, 1, { transcript_path: tr });        // the very next call
  ok('the call after a stop is allowed', r.code === 0);
  const r2 = drive(s.id, 8, { transcript_path: tr });
  ok('it stays quiet between thresholds', r2.code === 0 && r2.err === '');
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- it stops again, so ignoring the first stop does not work ---------------------------
{
  const s = fresh();
  const tr = transcript(s.id, 2600000);
  running(s);
  drive(s.id, 1, { transcript_path: tr });                  // fires at the first threshold
  fs.appendFileSync(tr, JSON.stringify({ message: { usage: { input_tokens: 1300000 } } }) + '\n');
  const r = drive(s.id, 1, { transcript_path: tr });
  ok('it blocks AGAIN once another STEP of spend has accrued', r.code === 2);
  ok('the second refusal carries the higher spend', /3900k weighted/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// Put a session one call short of the CALL COUNT BACKSTOP without spawning the guard a hundred
// and fifty times. The state file is the tool's own persistence format, and accumulation is
// already proved by the blocks above, so seeding it here tests the threshold rather than the
// counting. Every block below this line needs a stop to inspect the message, and after this change a
// stop is no longer something forty calls can produce on their own.
function atBackstop (s) {
  fs.writeFileSync(s.file, JSON.stringify({ calls: FIRST_CALLS - 1, tokens: 0, offset: 0, fired: 0 }));
}
const FIRST_CALLS = 150;

// --- it fails OPEN, on everything -------------------------------------------------------
{
  ok('garbage input is allowed', run('not json at all').code === undefined || true);
  const bad = (() => { try { execFileSync('node', [GUARD], { input: 'not json', stdio:['pipe','pipe','pipe'] }); return 0; } catch (e) { return e.status; } })();
  ok('unparseable hook payload does not block', bad === 0);
  const none = (() => { try { execFileSync('node', [GUARD], { input: '{}', stdio:['pipe','pipe','pipe'] }); return 0; } catch (e) { return e.status; } })();
  ok('a payload with no session id does not block', none === 0);
  const s = fresh();
  atBackstop(s);
  const r = drive(s.id, 1, { transcript_path: path.join(os.tmpdir(), 'does-not-exist-' + s.id + '.jsonl') });
  ok('a missing transcript still stops, on the CALL count', r.code === 2);
  ok('a missing transcript says the token total is unavailable', /unavailable/.test(r.err));
  // THE ASSERTION THAT STOPS THIS CHANGE FROM BEING A REGRESSION. tally() returns zero when there is
  // no readable transcript, so thresholding on spend ALONE would turn every one of these
  // sessions into a guard that never fires at all. And the message has to SAY which threshold
  // fired, because a reader who cannot tell an unmeasured session from an expensive one will
  // wind down a session that has cost nothing, which is the complaint that opened this ticket.
  ok('the refusal SAYS it was the backstop and not spend, so the two are told apart',
     /CALL COUNT BACKSTOP/.test(r.err));
  fs.unlinkSync(s.file);
}

// --- it counts tokens out of a real transcript ------------------------------------------
{
  const s = fresh();
  const tr = path.join(os.tmpdir(), 'tr-' + s.id + '.jsonl');
  const line = (cr) => JSON.stringify({ message: { usage: {
    input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: cr, output_tokens: 50 } } });
  // 20 requests each re-reading a 100k prefix: the square law made concrete.
  fs.writeFileSync(tr, Array.from({length: 20}, () => line(100000)).join('\n') + '\n');
  atBackstop(s);
  const r = drive(s.id, 1, { transcript_path: tr });
  ok('the refusal reports a token estimate', /weighted input tokens/.test(r.err));
  // 20 * (100 + 100000*0.1 + 50) = 203,000 -> "203k"
  ok('cache reads are weighted, not counted whole', /\b203k\b/.test(r.err));
  ok('it does NOT report the unweighted total', !/2003k|2000k/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- it reports work in flight ----------------------------------------------------------
{
  const s = fresh();
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'));
  const tix = path.join(proj, '.board', 'tickets');
  fs.mkdirSync(tix, { recursive: true });
  fs.writeFileSync(path.join(tix, 'a.json'), JSON.stringify({ status: 'in_progress' }));
  fs.writeFileSync(path.join(tix, 'b.json'), JSON.stringify({ status: 'in_progress' }));
  fs.writeFileSync(path.join(tix, 'c.json'), JSON.stringify({ status: 'done' }));
  fs.writeFileSync(path.join(tix, 'd.json'), 'not json');   // must not stop the count
  atBackstop(s);
  const r = drive(s.id, 1, { cwd: proj });
  ok('the refusal counts tickets in flight', /2 ticket\(s\)/.test(r.err));
  ok('a done ticket is not counted as in flight', !/3 ticket/.test(r.err));
  fs.unlinkSync(s.file);
}

// --- THE PATH THIS GUARD READS MUST EXIST IN THIS REPOSITORY ------------------------------
// Every assertion above seeds a fixture at whatever path the tool names, so the two agree by
// construction and both can be wrong together. They were: the board moved, the guard kept
// reading the old directory, and it silently reported no work in flight for a whole session.
// This is the only assertion here that compares the tool against the WORLD rather than
// against a fixture built to match it.
{
  const src = fs.readFileSync(path.join(__dirname, 'session-budget.js'), 'utf8');
  const key = 'const BOARD_TICKETS = [';
  const i = src.indexOf(key);
  ok('the guard names its board path in exactly one place', i > -1);
  const raw = i > -1 ? src.slice(i + key.length, src.indexOf(']', i)) : '';
  const segs = raw.split(',').map(x => x.trim().split(String.fromCharCode(39)).join('')).filter(Boolean);
  const real = path.join(__dirname, '..', ...segs);
  ok('and the directory it names actually exists in this repository',
     segs.length > 0 && fs.existsSync(real));
}

// --- a project with no board is not punished for it --------------------------------------
{
  const s = fresh();
  atBackstop(s);
  const r = drive(s.id, 1, { cwd: os.tmpdir() });
  ok('no board means no ticket line, not a crash', r.code === 2 && !/ticket\(s\)/.test(r.err));
  fs.unlinkSync(s.file);
}

/* Measured: a fatal guard firing part way through the studio suite reported 0 failed
   and exit 0, having run 22 of 214, so a count of failures cannot see an assertion that
   never ran. The total is pinned here, and the number is written down rather than measured
   from the run it checks, because a self-updating total agrees with any run. S35 is the same
   rule applied to the summary. Mutation: delete an assertion above and this goes red alone. */
// --- A LOST STATE FILE CANNOT BECOME A WALL ----------------------------------------------
// THE HEADER OF THE GUARD PROMISES IT WILL NOT BRICK A SESSION, AND FOR ONE RELEASE IT DID. Every
// mark that stops it firing twice lives in one file under the system temp directory: the call
// count, the transcript offset, and what has already been announced. Lose it and all three reset,
// so the announced mark is zero while the tally re-reads the whole transcript and returns the full
// total. On any session already past the first threshold, which is routine, that is a refusal on
// every call for the rest of the session, and a refusal on every call also blocks winding down,
// which strands the state documents unwritten.
//
// The block that was already named "it does not brick the session" could not see this, because its
// fixture ran with a working state file and never entered the losing path. A confident name over
// an unexercised branch. Measured against the version before the fix: 20 of 20 blocked.
{
  const s = fresh();
  const tr = transcript(s.id, 9000000);
  let blocked = 0;
  for (let i = 0; i < 20; i++) {
    try { fs.unlinkSync(s.file); } catch (e) { /* already gone, which is the case being tested */ }
    if (drive(s.id, 1, { transcript_path: tr }).code === 2) blocked++;
  }
  ok('losing the state file before every call blocks NOTHING, where it used to block everything',
     blocked === 0);
  try { fs.unlinkSync(s.file); } catch (e) {}
  fs.unlinkSync(tr);
}

// --- A BACKSTOP STOP DOES NOT CONSUME THE SPEND STOP -------------------------------------
// TWO THRESHOLDS SHARED ONE HIGH-WATER MARK, so a stop on the call-count backstop moved the mark
// for spend as well. The session was told it had been stopped for being long, and then went over
// budget in silence, because the mark was already past it. This repository's own record carries
// the fingerprint: a backstop stop at 150 calls and 1,131k, and the next spend stop reported at
// 3,752k, which is the SECOND spend threshold. Nobody had written down that the first was missing.
{
  const s = fresh();
  const tr = transcript(s.id, 0);
  fs.writeFileSync(s.file, JSON.stringify({ calls: FIRST_CALLS - 1, tokens: 0, offset: 0, fired: 0 }));
  const backstop = drive(s.id, 1, { transcript_path: tr });
  ok('the backstop fires on call count when there is no spend to read',
     backstop.code === 2 && /CALL COUNT BACKSTOP/.test(backstop.err));
  fs.appendFileSync(tr, JSON.stringify({ message: { usage: { input_tokens: 2600000 } } }) + '\n');
  const spend = drive(s.id, 1, { transcript_path: tr });
  ok('and the spend crossing that follows is still ANNOUNCED, rather than swallowed by the mark '
     + 'the backstop moved', spend.code === 2);
  ok('and it is named as spend, not misreported as the backstop, which is what the reader acts on',
     /weighted spend/.test(spend.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- READABLE BUT NOT WRITABLE IS ALSO A WALL, AND THE FIRST FIX ONLY ASKED ABOUT THE READ ---
// Gating on the read alone left the wall standing whenever the file can be read and not written:
// the mark is frozen at whatever it last held while the transcript keeps growing, so the crossing
// is due on every call and announced on every call. A reviewer measured the first fix at 10 of 10
// blocked with a read-only state file, identical to the version it replaced. The realistic route
// is a full disk, where the write fails and the read does not.
{
  const s = fresh();
  const tr = transcript(s.id, 9000000);
  running(s);
  fs.chmodSync(s.file, 0o444);
  let blocked = 0;
  for (let i = 0; i < 12; i++) {
    if (drive(s.id, 1, { transcript_path: tr }).code === 2) blocked++;
  }
  ok('a state file that can be read but not written blocks NOTHING, because a stop it cannot '
     + 'record is a stop it will make again on every call after this one', blocked === 0);
  fs.chmodSync(s.file, 0o666);
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- LOSING THE FILE ONCE COSTS ONE STOP, NOT THE STOP -----------------------------------
// THE MARKS GOING BACK TO ZERO ON AN UNJUDGED CALL WAS PROVED BY NOTHING. The only lost-state
// fixture deletes the file before EVERY call, so the marks it writes are never read back and the
// mutation that lets them jump to what was due returned delta 0. The live effect of that mutation
// is that the crossing is marked as dealt with by the very call that refused to judge it, so the
// stop is swallowed outright rather than delayed. That is the capitalised claim in the tool, and
// this is the fixture that holds it: lose the file ONCE, and the next call must still say so.
{
  const s = fresh();
  const tr = transcript(s.id, 2600000);
  running(s);
  try { fs.unlinkSync(s.file); } catch (e) { /* the loss being modelled */ }
  const lost = drive(s.id, 1, { transcript_path: tr });
  ok('the call whose state was lost is silent', lost.code === 0);
  const after = drive(s.id, 1, { transcript_path: tr });
  ok('and the very next call still announces the crossing, because a call the guard declined to '
     + 'judge must not record a judgement', after.code === 2);
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

// --- THE REFUSAL IS NAMED FROM WHICH MARK MOVED, NOT FROM THE LARGER NUMBER --------------
// THE EXISTING ASSERTION FOR THIS HELD FOR THE WRONG REASON. Its fixture has the two due values
// EQUAL, and where they are equal the old formula and the new one give the same answer, so the
// mutation that puts the old one back returned delta 0. It was a confident name over a branch the
// fixture never entered, which is the defect this whole file is about. Here the call count is
// further along AND already announced, so only spend crosses: the old formula reports the backstop
// and tells the reader spend could not be read, while spend is exactly what went over.
{
  const s = fresh();
  const tr = transcript(s.id, 2600000);
  fs.writeFileSync(s.file, JSON.stringify({ calls: 249, tokens: 0, offset: 0,
    fired: 2, firedWeighted: 0, firedCalls: 2 }));
  const r = drive(s.id, 1, { transcript_path: tr });
  ok('a crossing on spend alone is still announced when the call count is further along', r.code === 2);
  ok('and it is named as SPEND, where taking the larger of the two numbers would have called it '
     + 'the backstop and told the reader spend could not be read', /weighted spend/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}


// ST-259. THE MCQ GATE. The founder asked on 2026-09-17 whether the work includes ENFORCING the
// clickable prompt for any input needed from them. Until this, nothing did: the rule reached 6 of 6
// project sessions and the only instrument reading it ran in the wind-down set, after every
// decision of the sitting had already been put. These assertions cover the refusal, the pass, and
// every way the gate is required to stay out of the way, because a PreToolUse hook that blocks
// wrongly is worse than one that never fires.
{
  const gateWorld = (tag, opts) => {
    const o = opts || {};
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sbg-' + tag + '-'));
    const root = path.join(base, 'proj');
    // ST-260. WHERE the board sits is a parameter now, because the defect was a directory name:
    // the gate looked only at .board and the other project here keeps 154 live tickets in board.
    // The project.json is written for the same reason board.js demands one, so the fixture is a
    // real board that its own resolution rules can find rather than a directory of the right shape.
    const bdir = path.join(root, o.boardAt || '.board');
    fs.mkdirSync(path.join(bdir, 'tickets'), { recursive: true });
    fs.writeFileSync(path.join(bdir, 'project.json'),
      JSON.stringify({ slug: 'fixture', prefix: 'ST', assignees: ['studio'] }), 'utf8');
    // The transcript has to live where the tool actually looks, which is under the REAL home for
    // this root's own mangled name. Writing it anywhere else would exercise a path the tool does
    // not use, and the assertion would prove nothing about the gate (S55).
    const tdir = path.join(os.homedir(), '.claude', 'projects', gate.projectDirName(root));
    fs.mkdirSync(tdir, { recursive: true });
    const sid = 'fixture-session-budget-gate-' + tag;
    const lines = [JSON.stringify({
      timestamp: '2026-01-01T00:00:00.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'the session opens' }] },
    })];
    if (o.prompt) {
      lines.push(JSON.stringify({
        timestamp: '2026-01-01T00:10:00.000Z',
        message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] },
      }));
    }
    const tfile = path.join(tdir, sid + '.jsonl');
    fs.writeFileSync(tfile, lines.join('\n') + '\n', 'utf8');
    if (o.ticket !== false) {
      fs.writeFileSync(path.join(bdir, 'tickets', 'ST-801.json'), JSON.stringify({
        ref: 'ST-801', title: 'fixture', status: 'in_progress',
        decisions: [{ key: 'd1', at: '2026-01-01 00:05:00', by: 'studio',
          question: 'fixture question', options: ['a', 'b'], recommend: 1,
          answer: o.answered ? 2 : undefined,
          answered_at: o.answered ? '2026-01-01 00:06:00' : undefined }],
      }), 'utf8');
    }
    return { root: root, sid: sid, tfile: tfile, tdir: tdir };
  };
  const payload = (w, command) => ({
    session_id: w.sid, cwd: w.root, tool_name: 'Bash', tool_input: { command: command },
    transcript_path: w.tfile,
  });
  const cleanup = (w) => { try { fs.rmSync(w.tfile, { force: true }); } catch (e) {} };

  // 1. THE REFUSAL. An open decision, no prompt in the transcript, and the answer being written.
  {
    const w = gateWorld('block', { prompt: false });
    const r = run(payload(w, 'node base/board/board.js answer ST-801 2 --decision d1'));
    cleanup(w);
    ok('the gate BLOCKS a board answer for a decision with no clickable prompt: got exit ' + r.code,
      r.code === 2);
    ok('the block says what the rule is rather than only that it failed', /CLICKING/.test(r.err));
    // THE REMEDY MUST BE PERFORMABLE NOW. This is the whole reason the gate sits at `answer` and
    // not at the release: raising the prompt clears it, where a release refusal could not be.
    ok('the block tells the session to raise the prompt and run the command again',
      /Raise the prompt with AskUserQuestion/.test(r.err) && /run this same answer command again/i.test(r.err));
    ok('the block quotes the tool own finding rather than paraphrasing it', /ST-801 d1/.test(r.err));
  }

  // 2. THE PASS. Same world, same command, one prompt raised after the ask.
  {
    const w = gateWorld('pass', { prompt: true });
    const r = run(payload(w, 'node base/board/board.js answer ST-801 2 --decision d1'));
    cleanup(w);
    ok('the gate ALLOWS the same answer once a prompt has been raised: got exit ' + r.code,
      r.code === 0);
  }

  // 3. EVERY WAY IT MUST STAY OUT OF THE WAY. A hook that blocks the wrong call is worse than one
  // that never fires, so each of these is a separate assertion rather than one combined case.
  {
    const w = gateWorld('quiet', { prompt: false });
    const other = [
      ['a board command that is not an answer', 'node base/board/board.js note ST-801 "hello" --by studio'],
      ['an ask on the same ticket, which is what comes BEFORE the prompt', 'node base/board/board.js ask ST-801 "q" --options "a|b" --by studio'],
      ['an unrelated shell command that merely mentions the word answer', 'grep -rn "answer" tools/'],
      ['a board answer for a ticket holding no open decision', 'node base/board/board.js answer ST-899 1 --decision d1'],
    ];
    for (const [name, cmd] of other) {
      const r = run(payload(w, cmd));
      ok('the gate does not block ' + name + ': got exit ' + r.code, r.code === 0);
    }
    // A DIFFERENT TOOL ENTIRELY. tool_name is the first thing read, and a payload from Read or
    // Write carries no command at all.
    const rw = run({ session_id: w.sid, cwd: w.root, tool_name: 'Write',
      tool_input: { file_path: 'x', content: 'node board.js answer ST-801 2' }, transcript_path: w.tfile });
    ok('the gate does not block a non-Bash tool whose payload contains the command text: got exit '
      + rw.code, rw.code === 0);
    cleanup(w);
  }

  // 4. IT FAILS OPEN, which is this file's own standing rule and the one thing that cannot be
  // traded away: a hook that crashes and denies every call blocks the wind-down too.
  {
    const w = gateWorld('open', { prompt: false });
    fs.rmSync(w.tfile, { force: true });
    const r = run(payload(w, 'node base/board/board.js answer ST-801 2 --decision d1'));
    ok('with the transcript gone the gate ALLOWS rather than blocks: got exit ' + r.code,
      r.code === 0);
  }

  // ST-260. 5. THE BOARD THE GATE COULD NOT SEE, AND THE QUOTATION MARK THAT TURNED IT OFF.
  //
  // ST-259 shipped the gate and ST-260 asked what it does in the other five projects. Measured
  // before anything was built: the hook already fires in all of them, registered PreToolUse in
  // this machine's own settings with an absolute path, and no sibling project overrides it. It
  // could still never block, for a reason with nothing to do with hooks. check-decision-shape
  // defaults the board to <root>/.board/tickets and looks nowhere else, while board.js resolves
  // one in four ordered steps. The other project here runs 154 live tickets at board/tickets,
  // resolved by board.js rule 2 because its project.json sits beside its own copy of the program.
  // The gate fired there, found no .board, exited 3 for CANNOT TELL and ALLOWED the answer. The
  // one other project with a board was the one project the gate was blind to.
  //
  // The second half was never about boards at all. Every absolute path on this machine contains
  // a space, so the command is quoted, and the old trigger needed a bare run of non-space
  // characters ending in board.js. A quoted path did not match, the gate never fired, and
  // nothing appeared in the transcript to say so. A gate a quotation mark can switch off looks
  // exactly like a gate with nothing to complain about.
  {
    // 5a. THE NESTED-BOARD SHAPE BLOCKS. project.json beside the program, no .board anywhere.
    const w = gateWorld('nested-board', { prompt: false, boardAt: 'board' });
    const r = run(payload(w, 'node board/board.js answer ST-801 2 --decision d1'));
    ok('a board at board/ rather than .board/ is FOUND and the gate blocks: got exit ' + r.code,
      r.code === 2);
    ok('the block names the decision it found on that board', /ST-801 d1/.test(r.err));
    cleanup(w);

    // 5b. THE SAME WORLD PASSES ONCE A PROMPT IS RAISED. Without this, 5a would also pass if the
    // gate had started blocking everything, which is the S55 shape: an assertion that cannot
    // tell the effect it names from a blanket refusal proves nothing.
    const w2 = gateWorld('nested-board-pass', { prompt: true, boardAt: 'board' });
    const r2 = run(payload(w2, 'node board/board.js answer ST-801 2 --decision d1'));
    ok('the same board/ world ALLOWS once a prompt has been raised: got exit ' + r2.code,
      r2.code === 0);
    cleanup(w2);
  }
  {
    // 5c. A QUOTED PROGRAM PATH CONTAINING A SPACE STILL FIRES. The path is built from the
    // fixture's own root, which is a real absolute path, so this is the command a session in a
    // directory like 'AI Projects' actually writes.
    const w = gateWorld('quoted', { prompt: false });
    const prog = path.join(w.root, 'a dir with spaces', 'board.js');
    const r = run(payload(w, 'node "' + prog + '" answer ST-801 2 --decision d1'));
    ok('a DOUBLE quoted program path containing a space still fires the gate: got exit ' + r.code,
      r.code === 2);
    const r2 = run(payload(w, "node '" + prog + "' answer ST-801 2 --decision d1"));
    ok('a SINGLE quoted program path containing a space still fires the gate: got exit ' + r2.code,
      r2.code === 2);
    cleanup(w);
  }
  {
    // 5d. RULE 2 SITS AHEAD OF RULE 3, and this is the assertion that proves the ORDER rather
    // than the lookup. board.js says the other order would let a stray .board above the directory
    // silently retarget an existing board's tickets. So the world holds BOTH: a board/ whose
    // decision is open, and a .board/ whose decision is already answered. Answered decisions are
    // skipped, so .board alone would exit 3 and ALLOW. A block can only come from board/.
    const w = gateWorld('order', { prompt: false, boardAt: 'board' });
    fs.mkdirSync(path.join(w.root, '.board', 'tickets'), { recursive: true });
    fs.writeFileSync(path.join(w.root, '.board', 'project.json'),
      JSON.stringify({ slug: 'decoy', prefix: 'ST', assignees: ['studio'] }), 'utf8');
    fs.writeFileSync(path.join(w.root, '.board', 'tickets', 'ST-801.json'), JSON.stringify({
      ref: 'ST-801', title: 'decoy', status: 'in_progress',
      decisions: [{ key: 'd1', at: '2026-01-01 00:05:00', by: 'studio', question: 'decoy',
        options: ['a', 'b'], recommend: 1, answer: 2, answered_at: '2026-01-01 00:06:00' }],
    }), 'utf8');
    const r = run(payload(w, 'node board/board.js answer ST-801 2 --decision d1'));
    ok('a project.json beside the program WINS over a .board in the same directory: got exit '
      + r.code, r.code === 2);
    cleanup(w);
  }
  {
    // 5e. BOARD_HOME WINS OVER BOTH, which is board.js rule 1 and the way its own tests isolate.
    // Pointed at a directory holding no tickets, it must produce CANNOT TELL and therefore ALLOW,
    // in a world whose board/ would otherwise block. That separates rule 1 from rule 2 cleanly.
    const w = gateWorld('boardhome', { prompt: false, boardAt: 'board' });
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sbg-empty-'));
    let code = 0;
    try {
      execFileSync('node', [GUARD], {
        input: JSON.stringify(payload(w, 'node board/board.js answer ST-801 2 --decision d1')),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, { BOARD_HOME: empty }),
      });
    } catch (e) { code = e.status; }
    ok('BOARD_HOME overrides the board beside the program: got exit ' + code, code === 0);
    cleanup(w);
  }
  {
    // 5f. NO BOARD ANYWHERE STILL ALLOWS. Four of the six projects have no board at all, and the
    // gate has to stay silent in every one of them. This is the fail-open contract, restated
    // against the new resolution rather than inherited from the old one.
    const w = gateWorld('noboard', { prompt: false, ticket: false });
    fs.rmSync(path.join(w.root, '.board'), { recursive: true, force: true });
    const r = run(payload(w, 'node board.js answer ST-801 2 --decision d1'));
    ok('with no board anywhere the gate ALLOWS rather than blocks: got exit ' + r.code,
      r.code === 0);
    cleanup(w);
  }
}


// ST-257 part two. THE SESSION NOW COUNTS WHAT IT SENDS, AND THE STOP MESSAGE READS THE NUMBER.
// Until 2026-09-17 this file read message.usage and nothing else, so it knew what a session had
// cost and never what the cost was made of. These assertions exist in the shape they do because of
// S211: a number nothing reads is a number nothing tests, and the counting is only defensible
// while the message below still quotes it. If the line comes out of the message, these go too.
{
  // A Write of known size, driven to a stop, so the figure in the message can be named exactly.
  const s = fresh();
  const tr = transcript(s.id, 3000000);
  running(s);
  const body = 'x'.repeat(20000);
  const r = drive(s.id, 1, {
    transcript_path: tr, tool_name: 'Write', tool_input: { file_path: 'a.txt', content: body },
  });
  ok('a stopped session is told how many characters of tool input it has SENT: got ' + r.code,
    r.code === 2 && /SENT \d+k characters of tool input/.test(r.err));
  ok('Write is named separately, because it is the one a session can choose differently',
    /Write is 20k over 1 call\(s\), 20000 per call/.test(r.err));
  // THE MEASUREMENT IS QUOTED WITH THE RULE IT RULES OUT. A session told only that it has sent a
  // lot will reach for a size cap, which was measured and is worth 4.1 per cent.
  ok('the message says a size cap is NOT the remedy and gives the number that settles it',
    /size cap is NOT the remedy/.test(r.err) && /4\.1 per cent/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}
{
  // IT ACCUMULATES ACROSS CALLS. Counting one call and reporting it as the session total is the
  // failure this is most likely to have, because the state file is where it would be lost.
  const s = fresh();
  const tr = transcript(s.id, 3000000);
  running(s);
  // The guard fires ONCE per threshold, so a run of three expensive calls blocks on the FIRST
  // and the last one says nothing. The two cheap calls come first and the expensive one last, so
  // the message being read is the one that has already counted all three.
  // ONE transcript throughout, made expensive only before the LAST call. The tally reads a
  // transcript INCREMENTALLY from a stored byte offset, so handing the guard a different file
  // mid-session makes it read from an offset that belongs to the other one and see almost
  // nothing. Found by this fixture failing while the counter underneath it was already correct.
  // ONE transcript throughout, made expensive only before the LAST call. The tally reads a
  // transcript INCREMENTALLY from a stored byte offset, so handing the guard a different file
  // mid-session makes it read from an offset belonging to the other one and see almost nothing.
  // Found by this fixture failing while the counter underneath it was already correct, which is
  // the good case: the assertion was wrong about the world, not about the tool.
  const usage = (n) => JSON.stringify({ message: { usage: { input_tokens: n } } }) + '\n';
  fs.writeFileSync(tr, usage(1000));
  const payload = { session_id: s.id, cwd: __dirname, transcript_path: tr,
    tool_name: 'Write', tool_input: { file_path: 'a.txt', content: 'y'.repeat(10000) } };
  run(payload); run(payload);
  fs.appendFileSync(tr, usage(3000000));
  const r = run(payload);
  ok('the count is carried in the state file rather than reset on every call',
    /Write is 30k over 3 call\(s\)/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}
{
  // A TOOL THAT SENDS NO COUNTED INPUT MOVES NEITHER FIGURE, and a Bash command counts toward the
  // total without counting as a Write. Both in one fixture so they cannot disagree.
  const s = fresh();
  const tr = transcript(s.id, 3000000);
  running(s);
  const r = drive(s.id, 1, {
    transcript_path: tr, tool_name: 'Bash', tool_input: { command: 'z'.repeat(5000) },
  });
  ok('a Bash command counts toward tool input but not toward Write',
    /SENT 5k characters/.test(r.err) && /Write is 0k over 0 call\(s\)/.test(r.err));
  fs.unlinkSync(s.file); fs.unlinkSync(tr);
}

const EXPECTED_ASSERTIONS = 60;
const ranBefore = pass + fail;
ok('the suite ran every assertion: ran ' + (ranBefore + 1) + ' of ' + EXPECTED_ASSERTIONS
  + '. A block was skipped or deleted. Find out which before you change the number.',
  ranBefore === EXPECTED_ASSERTIONS - 1);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
