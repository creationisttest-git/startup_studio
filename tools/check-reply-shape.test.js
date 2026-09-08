#!/usr/bin/env node
/**
 * check-reply-shape.test.js -- fixtures for the reply-shape check.
 *
 * WHAT THIS SUITE IS FOR, BEYOND THE OBVIOUS. The thing most likely to be wrong about a check
 * like this is not a branch. It is the CLAIM that it measures shape rather than length, because
 * that claim is the whole reason the rule allowed an instrument at all: the rule it enforces
 * forbids a length cap in its own text. So the two assertions that matter most here are the pair
 * that take ONE body of text, render it as prose and as bullets, and require the first to refuse
 * and the second to pass. If those ever agree, the tool has become a word counter and must be
 * deleted rather than tuned.
 *
 * THE PRODUCTION CALL PATH IS FIXTURED ON PURPOSE. A previous check in this repository was
 * proved by tests that always passed both --root and --home while every real caller passed only
 * --root, so its home fallback ran in production and in no test at all; mutating it turned that
 * gate advisory while the suite stayed green. Two assertions here spawn the tool the way a
 * caller actually does, one with --home omitted and the environment pointed at the fixture home,
 * one with --root omitted and the working directory set.
 *
 * THE ORDERING FIXTURE OPPOSES EVERY INCIDENTAL ORDER IT HAS, not just the one that has already
 * caused an incident. Three sessions are named so the newest sorts in the MIDDLE alphabetically,
 * and the newest is also WRITTEN second rather than last, so first-listed, last-listed, name
 * order and creation order are each wrong in a different direction.
 *
 * THE CONTENT GUARD IS PROVED WITH AN INPUT THE CODE CANNOT SURVIVE WITHOUT IT. A string is
 * iterable, so a string fixture walks character by character and every character is discarded by
 * the block-type test, leaving the assertion green with the guard gone. The object fixture is
 * the one that proves the guard; the string fixture is kept because it is a shape a real
 * transcript holds.
 *
 * WHY THE ONE IN-PROCESS CALL IS WRAPPED IN A CATCH, WHICH IS A MEASUREMENT AND NOT CAUTION.
 * Calling main in process means any mutation that makes it throw kills this whole suite rather
 * than reddening one assertion, and a suite that dies reports no count at all. Measured on this
 * file: an unguarded call turned 37 lines from covered into unmeasurable in a single run,
 * because the coverage tool cannot tell a dead suite from a line nothing depends on. Catching
 * turns that back into an ordinary red assertion. Everything else here SPAWNS the tool, for the
 * same reason.
 *
 * WHICH LINES OF THE TOOL THIS SUITE ACTUALLY PROVES IS NOT WRITTEN DOWN HERE. That claim was
 * hand-written for a sibling check and falsified by three consecutive review rounds. It is
 * derived instead, by tools/check-mutation-coverage.js, which deletes each line and reports what
 * nothing depends on. Run it rather than trusting a paragraph.
 */
'use strict'

const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const TOOL = path.join(__dirname, 'check-reply-shape.js')
const { projectDirName } = require('./check-gate-dispatch.js')
const { shapeOf, main } = require('./check-reply-shape.js')

const EXPECTED_ASSERTIONS = 62

let pass = 0
let fail = 0
function ok (name, cond) { if (cond) { pass++ } else { fail++; console.log('FAIL  ' + name) } }

const junk = []
let n = 0

function world () {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'reply-shape-' + process.pid + '-' + (n++) + '-'))
  junk.push(d)
  const home = path.join(d, 'home')
  const root = path.join(d, 'work')
  fs.mkdirSync(root, { recursive: true })
  return { dir: d, home: home, root: root }
}

function transcriptDir (w) {
  const p = path.join(w.home, '.claude', 'projects', projectDirName(w.root))
  fs.mkdirSync(p, { recursive: true })
  return p
}

function reply (text) {
  return JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: text }] } })
}

function session (w, name, lines) {
  const p = path.join(transcriptDir(w), name)
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8')
  return p
}

function run (args, env) {
  const opts = { stdio: ['pipe', 'pipe', 'pipe'] }
  if (env) opts.env = env
  if (env && env.__cwd) { opts.cwd = env.__cwd; delete env.__cwd }
  try {
    const out = execFileSync(process.execPath, [TOOL].concat(args), opts).toString()
    return { code: 0, out: out }
  } catch (e) {
    return { code: e.status, out: ((e.stdout || '') + (e.stderr || '')).toString() }
  }
}

function at (w, args) { return run(['--root', w.root, '--home', w.home].concat(args || [])) }

// One body of text, rendered two ways. This pair is the tool's central claim and nothing else
// in this file matters as much: same words, same count, opposite verdicts.
const BODY = ('The release gate refuses when no reviewer ran in the session that shipped, which '
  + 'is a positive finding of nothing rather than a failure to look, and the difference between '
  + 'those two matters because one refuses a release and the other is advisory, so collapsing '
  + 'them would mean a host that writes no transcript silently blocks every release forever and '
  + 'nobody would be able to tell which of the two had happened from the exit code alone at all, '
  + 'which is the reason the third code exists and the reason it is named out loud wherever it '
  + 'is printed rather than being folded quietly into the refusal beside it for tidiness.')
  .split(/\s+/).filter(Boolean)
const asProse = BODY.join(' ')
const asBullets = BODY.map((wd, i) => (i % 8 === 0 ? '\n- ' + wd : wd)).join(' ').trim()

// --- the central pair -------------------------------------------------------------------
{
  const w = world()
  session(w, 's1.jsonl', [reply(asProse)])
  const r = at(w, [])
  ok('a single prose block past the limit refuses', r.code === 1)
  ok('and the refusal names the word count on its own line, anchored so the summary cannot satisfy it', /^ {2}\d+ words: /m.test(r.out))
}
{
  const w = world()
  session(w, 's1.jsonl', [reply(asBullets)])
  const r = at(w, [])
  ok('THE SAME WORDS in point form pass, so this is shape and not length', r.code === 0)
}
{
  const w = world()
  const long = []
  for (let i = 0; i < 200; i++) long.push('- line ' + i + ' of a very long but correctly shaped reply')
  session(w, 's1.jsonl', [reply(long.join('\n'))])
  const r = at(w, [])
  ok('a two hundred line bulleted reply passes, because there is no length cap', r.code === 0)
}

// --- preamble ---------------------------------------------------------------------------
{
  const w = world()
  session(w, 's1.jsonl', [reply('Great question! The answer is 12.')])
  const r = at(w, [])
  ok('a reply opening with cheerleading refuses', r.code === 1)
  ok('and it is reported as preamble rather than as prose', /preamble:/.test(r.out))
}
{
  const w = world()
  session(w, 's1.jsonl', [reply('**Sure, I can do that.** Then the numbers.')])
  const r = at(w, [])
  ok('preamble is seen through leading bold and heading marks', r.code === 1)
}
{
  const w = world()
  session(w, 's1.jsonl', [reply('547 passed, 0 failed. The gate is green.')])
  const r = at(w, [])
  ok('a reply that opens with the answer is not preamble', r.code === 0)
}
{
  const openers = ['Certainly, here we go.', 'Let me check that for you.', 'To summarise, it is done.',
    "You're absolutely right about that.", 'I apologise for the confusion.', "Here's a summary of the run."]
  ok('every throat-clearing shape in the list is detected', openers.every(o => shapeOf(o).throat === true))
  ok('a plain sentence is not detected as throat-clearing', shapeOf('The suite is red on one line.').throat === false)
}

// --- what counts as point form ------------------------------------------------------------
{
  ok('a dash bullet counts as point form', shapeOf('- one two three').pointWords === 4 && shapeOf('- one two three').proseWords === 0)
  ok('a numbered item counts as point form', shapeOf('1. one two three').pointWords === 4)
  ok('a heading counts as point form', shapeOf('## one two three').pointWords === 4)
  ok('a table row counts as point form', shapeOf('| one | two |').pointWords === 5)
  ok('a quote counts as point form', shapeOf('> one two three').pointWords === 4)
  ok('a plain line counts as prose', shapeOf('one two three').proseWords === 3)
}
{
  const fenced = '```\n' + asProse + '\n```\nDone.'
  ok('fenced code is counted in neither direction', shapeOf(fenced).proseWords === 1)
  ok('and a pasted tool output therefore cannot refuse a reply', shapeOf(fenced).biggestProseBlock === 1)
}
{
  // ST-171 m4. The fence flag was toggled and never reconciled at the end of the text, so an ODD
  // number of fence lines left it open and everything after the last fence scored zero. A reply
  // is a fragment of a stream and an unterminated fence is ordinary, so the densest paragraph in
  // a reply could be hidden by one stray line above it. Mutation: delete the unterminated test in
  // the toggle and the FIRST assertion here goes red, measured at 61 passed 1 failed. The second
  // stays green and is meant to: it is the CONTROL, and a control that reddens with the thing it
  // controls for is not a control. Without it the first is indistinguishable from a change that
  // simply stopped reading fences at all.
  const open = 'Here is the output:\n```\nnot counted at all\n\n' + asProse
  ok('an unterminated fence does not hide the rest of the reply',
    shapeOf(open).biggestProseBlock === shapeOf(asProse).biggestProseBlock)
  ok('and the properly closed pair still hides what it should, so the fix did not simply stop '
    + 'reading fences', shapeOf('```\n' + asProse + '\n```').biggestProseBlock === 0)
}
{
  ok('a blank line breaks a prose block rather than continuing it',
    shapeOf('one two three\n\nfour five') .biggestProseBlock === 3)
  ok('a bullet between two paragraphs breaks the block too',
    shapeOf('one two three\n- a\nfour five').biggestProseBlock === 3)
}

// --- what is and is not a reply --------------------------------------------------------
{
  const w = world()
  const toolUse = JSON.stringify({ message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: asProse } }] } })
  session(w, 's1.jsonl', [toolUse])
  const r = at(w, [])
  ok('a tool call is not a reply, because the founder never sees it', r.code === 3)
}
{
  const w = world()
  const user = JSON.stringify({ message: { role: 'user', content: [{ type: 'text', text: asProse }] } })
  session(w, 's1.jsonl', [user])
  const r = at(w, [])
  ok('what the founder wrote is not scored as a reply', r.code === 3)
  ok('and the reason given is that the session holds no reply yet',
    /holds no reply to the founder yet/.test(r.out))
}
{
  const w = world()
  const obj = JSON.stringify({ message: { role: 'assistant', content: { type: 'text', text: asProse } } })
  session(w, 's1.jsonl', [obj, reply('- fine')])
  const r = at(w, [])
  ok('content that is an OBJECT cannot be iterated and is discarded by the guard', r.code === 0)
}
{
  const w = world()
  const str = JSON.stringify({ message: { role: 'assistant', content: asProse } })
  session(w, 's1.jsonl', [str, reply('- fine')])
  const r = at(w, [])
  ok('content that is a bare string is discarded too, a shape the corpus really holds', r.code === 0)
}
{
  const w = world()
  session(w, 's1.jsonl', ['not json at all', '', reply('- fine')])
  const r = at(w, [])
  ok('an unparseable line is skipped and the reply after it is still read', r.code === 0)
}

// --- newest session, opposed in every incidental order -----------------------------------
{
  const w = world()
  transcriptDir(w)
  session(w, 'a-oldest.jsonl', [reply(asProse)])
  const mid = session(w, 'm-newest.jsonl', [reply('- clean')])
  session(w, 'z-middle.jsonl', [reply(asProse)])
  const now = Date.now()
  fs.utimesSync(path.join(transcriptDir(w), 'a-oldest.jsonl'), new Date(now - 30000), new Date(now - 30000))
  fs.utimesSync(path.join(transcriptDir(w), 'z-middle.jsonl'), new Date(now - 20000), new Date(now - 20000))
  fs.utimesSync(mid, new Date(now), new Date(now))
  const r = at(w, [])
  ok('the newest session is chosen by modification time, not by name or by write order', r.code === 0)
  const all = at(w, ['--all'])
  ok('and --all reads every session rather than only the newest', all.code === 1)
}

// --- cannot tell, which must never refuse ------------------------------------------------
{
  const w = world()
  const r = at(w, [])
  ok('no transcript directory is CANNOT TELL and exits 3, never 1', r.code === 3 && /CANNOT TELL/.test(r.out))
}
{
  const w = world()
  transcriptDir(w)
  const r = at(w, [])
  ok('a transcript directory holding no session is CANNOT TELL', r.code === 3)
}
{
  const w = world()
  const p = path.join(w.home, '.claude', 'projects')
  fs.mkdirSync(p, { recursive: true })
  fs.writeFileSync(path.join(p, projectDirName(w.root)), 'a file where the directory belongs', 'utf8')
  const r = at(w, [])
  ok('a FILE where the transcript directory belongs exits 3 and not 1', r.code === 3)
}
{
  const w = world()
  fs.mkdirSync(path.join(transcriptDir(w), 's1.jsonl'), { recursive: true })
  const r = at(w, [])
  ok('a DIRECTORY named like a session exits 3 and not 1', r.code === 3)
  ok('and the reason names the session that could not be read, not a missing directory',
    /s1\.jsonl: the session could not be read/.test(r.out))
}

// --- usage, and the production call path -------------------------------------------------
{
  ok('--root with nothing after it is a usage error naming the flag',
    run(['--root']).code === 2 && /--root needs a value/.test(run(['--root']).out))
  ok('a flag that would swallow the next flag is a usage error too', run(['--root', '--quiet']).code === 2)
  ok('--max-prose that is not a whole number is a usage error', run(['--max-prose', 'lots']).code === 2)
}
{
  const w = world()
  session(w, 's1.jsonl', [reply(asProse)])
  ok('--max-prose is honoured, so the limit is not welded in', at(w, ['--max-prose', '500']).code === 0)
}
{
  const w = world()
  session(w, 's1.jsonl', [reply(asProse)])
  const env = Object.assign({}, process.env, { USERPROFILE: w.home, HOME: w.home })
  const r = run(['--root', w.root], env)
  ok('THE PRODUCTION PATH: --home omitted falls back to the home directory and still refuses', r.code === 1)
}
{
  const w = world()
  session(w, 's1.jsonl', [reply(asProse)])
  const env = Object.assign({}, process.env, { __cwd: w.root })
  const r = run(['--home', w.home], env)
  ok('--root omitted falls back to the working directory and still refuses', r.code === 1)
}
{
  const w = world()
  session(w, 's1.jsonl', [reply('- clean')])
  ok('--quiet says nothing at all on a pass', at(w, ['--quiet']).out === '')
}
{
  const w = world()
  session(w, 's1.jsonl', [reply(asProse)])
  const r = at(w, ['--quiet'])
  ok('--quiet still speaks when it REFUSES, because a silent refusal is unactionable', /FAIL/.test(r.out))
}

// --- the REASON, not the verdict -----------------------------------------------------------
// Every branch below already had an assertion on its exit code and every one of them was
// reported SILENT by the derived coverage tool, because two different faults reach the same
// code by different routes. What separates them is the sentence printed, so that is what is
// asserted here. This block exists because the tool found the hole, not because anyone saw it.
{
  const w = world()
  const r = at(w, [])
  ok('a missing transcript directory says WHICH directory it looked for', /no transcript directory for this project/.test(r.out))
}
{
  const w = world()
  transcriptDir(w)
  const r = at(w, [])
  ok('an empty transcript directory says the directory holds no session', /holds no session/.test(r.out))
}
{
  const w = world()
  session(w, 's1.jsonl', [reply('- clean')])
  const r = at(w, [])
  ok('the summary names how many replies across how many sessions', /1 repl\(ies\) across 1 session\(s\)/.test(r.out))
  ok('the summary names the largest prose block and the limit it is held to', /largest prose block: \d+ word\(s\), against a limit of 80/.test(r.out))
  ok('the summary names how many are past the limit and how many are preamble', /0 past the limit, 0 opening with preamble/.test(r.out))
  ok('a clean run says so in words and not only by exiting zero', /OK {2}every reply is point form/.test(r.out))
}
{
  ok('the usage error for a bad limit says what a good one looks like',
    /whole number of words/.test(run(['--max-prose', 'lots']).out))
}
{
  const w = world()
  session(w, 's1.jsonl', [reply(asProse)])
  const r = at(w, ['--report'])
  ok('--report lists each reply that is past the limit', /OVER {2}\d+ words/.test(r.out))
}
{
  const w = world()
  session(w, 's1.jsonl', [reply('Great question! Here it is.')])
  const r = at(w, ['--report'])
  ok('--report lists each reply that opens with preamble', /PREAMBLE {2}Great question/.test(r.out))
}
{
  const w = world()
  session(w, 'a.jsonl', [reply('- clean')])
  fs.mkdirSync(path.join(transcriptDir(w), 'b.jsonl'), { recursive: true })
  const r = at(w, ['--all'])
  ok('a session that cannot be read is noted rather than silently dropped', /note {2}b\.jsonl/.test(r.out))
}

// --- guards proved by an input the code cannot survive without them --------------------------
{
  const w = world()
  const u = JSON.stringify({ message: { role: 'user', content: [{ type: 'text', text: 'the assistant wrote ' + asProse }] } })
  session(w, 's1.jsonl', [u, reply('- fine')])
  const r = at(w, [])
  ok('a FOUNDER message that mentions the assistant is still not scored as a reply', r.code === 0)
}
{
  const w = world()
  const tr = JSON.stringify({ message: { role: 'assistant', content: [{ type: 'tool_result', text: asProse }] } })
  session(w, 's1.jsonl', [tr, reply('- fine')])
  const r = at(w, [])
  ok('a non-text block carrying a text field is discarded by the block-type test', r.code === 0)
}
{
  const w = world()
  const bad = JSON.stringify({ message: { role: 'assistant', content: [{ type: 'text', text: 42 }] } })
  session(w, 's1.jsonl', [bad, reply('- fine')])
  const r = at(w, [])
  ok('a text block whose text is not a string is discarded rather than crashing the run', r.code === 0)
}
{
  const w = world()
  const empty = JSON.stringify({ message: { role: 'assistant', content: [{ type: 'text', text: '   ' }] } })
  session(w, 's1.jsonl', [empty, reply('- fine')])
  const r = at(w, [])
  ok('a text block that is only whitespace is not counted as a reply', r.code === 0)
}
{
  const w = world()
  session(w, 's1.jsonl', ['null', reply('- fine')])
  const r = at(w, [])
  ok('a bare null line is skipped and the reply after it is still read', r.code === 0)
}

// The dangling-entry race, which is what a session removed between the listing and the
// measurement leaves behind. A junction needs no privilege here; a plain symlink does and fails
// with WinError 1314, which is why the fallback is tried and the outcome is asserted rather than
// the case being skipped when neither works.
{
  const w = world()
  const dir = transcriptDir(w)
  const link = path.join(dir, 'gone.jsonl')
  let made = false
  const target = path.join(w.dir, 'no-such-target')
  try { fs.symlinkSync(target, link, 'junction'); made = true } catch (e) { /* fall through */ }
  if (!made) { try { fs.symlinkSync(target, link); made = true } catch (e) { /* neither works here */ } }
  ok('a dangling transcript entry can be produced on this machine, by junction or by symlink', made)
  const r = at(w, [])
  ok('and a directory where every entry is dangling is CANNOT TELL, never a refusal', r.code === 3)
  ok('and it says no session could be measured, not that the directory was missing',
    /no session in the transcript directory could be measured/.test(r.out))
}

{
  const w = world()
  session(w, 's1.jsonl', [reply('- clean')])
  let returned = null
  try { returned = main(['--root', w.root, '--home', w.home, '--quiet']) } catch (e) { returned = 'threw: ' + e.message }
  ok('main RETURNS zero to a caller, which is what makes its final return testable at all',
    returned === 0)
}

for (const d of junk) { try { fs.rmSync(d, { recursive: true, force: true }) } catch (e) { /* a temp dir */ } }

const total = pass + fail
if (total !== EXPECTED_ASSERTIONS) {
  console.log('FAIL  the suite ran ' + total + ' assertion(s) and expects ' + EXPECTED_ASSERTIONS)
  fail++
}
console.log(pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
