#!/usr/bin/env node
/**
 * check-gate-dispatch.js -- did a review agent actually run in the most recently written session
 * for this project, or is the release being made on nobody having looked?
 *
 * WHY THIS EXISTS. Every review in this studio is carried out by a separate agent that some
 * session has to choose to start. Nothing recorded whether one ever did, so a release could be
 * made with no review of any kind and no surface anywhere would say so. Measured before this
 * was written, across every release this repository has actually made: 21 releases, 4 of them
 * with no review agent started at any point in the session that shipped. Two of those four
 * predate the vendor setting that was blamed for it, so this is an old hole rather than a new
 * one, and a rule asking people to remember does not close it.
 *
 * WHAT IT PROVES, AND IT IS LESS THAN A READER WILL ASSUME. It proves a review agent was
 * STARTED in this session. It does not prove the agent read the change, and it does not prove
 * it returned a pass: a session can start a reviewer, be told the work is broken, and release
 * anyway with this check green. Nothing on this machine can observe that, and a check claiming
 * otherwise would be worse than no check. It is also scoped to ONE session, the most recently
 * written of this project's transcripts, which is the session running this only because the host
 * is still appending to it as this reads. A release driven from some older session in the same
 * project is not what this looks at, and none of it says anything about the history of the tree.
 *
 * WHERE THE EVIDENCE COMES FROM, AND THE PART THAT WILL BREAK. The coding agent writes each
 * session to a file of JSON lines, one per message, under a per-project directory beneath the
 * user's home. That directory's name is derived from the working directory by replacing every
 * character that is not a letter or a digit with a hyphen. THAT DERIVATION IS UNDOCUMENTED. It
 * was verified against every project directory present on the machine it was written on, and it
 * is one silent rename away from being wrong. When it is wrong, or when the host writes no
 * transcript at all, this check reports that it cannot see and does NOT refuse, because a gate
 * refusing on something a legitimate install can never satisfy locks that install out for good.
 *
 * SO THERE ARE THREE ANSWERS AND NOT TWO, AND THE THIRD IS THE ONE THAT KEEPS IT HONEST.
 * A review agent was started: exit 0. A transcript was found and read and holds no review
 * agent at all: exit 1, and that refuses, because a positive finding of nothing is a real
 * finding. No transcript could be read: exit 3, advisory, named out loud. Collapsing the last
 * two would mean a host that writes no transcript silently blocks every release, and reading
 * the first two as one would mean not being able to look counted as having looked.
 *
 * FOUR THINGS THE CODE BELOW DECIDES ONCE, AND WHY EACH IS ONE PLACE RATHER THAN TWO.
 * Which roles count as a review, because the same question asked twice is two answers that
 * disagree eventually, and a review that quietly stops counting is a silent miss. Which tool
 * name starts an agent, because the host has used two across versions and recognising only the
 * current one turns a rename into a report that nobody has ever reviewed anything. Which
 * session is the current one, which is the most recently written, because the host is still
 * appending to it while this runs. And how a working directory becomes a directory name, which
 * is the undocumented part described above.
 *
 * A TRANSCRIPT IS READ WHILE IT IS BEING WRITTEN, so the last line can be half a line. An
 * unparseable line is skipped rather than fatal: the alternative is a check that refuses a
 * release because the host happened to be mid-write.
 *
 * A FLAG WITH NOTHING AFTER IT IS A USAGE ERROR AND NOT A DEFAULT. A command ending in --root
 * used to fall back to the working directory, so it answered a question about somewhere the
 * person who typed it had not asked about, and printed a verdict that looked like an answer.
 * A flag whose value is the next flag is refused the same way and for the same reason.
 *
 *   node tools/check-gate-dispatch.js                 read this project's newest session
 *   node tools/check-gate-dispatch.js --list          name every agent the session started
 *   options: --root <dir>  --home <dir>  --quiet
 *
 * Exit 0 a review ran, 1 none did, 2 on a usage error, 3 nothing could be read.
 */

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const REVIEW_ROLES = ['qa-tester', 'code-reviewer', 'security-reviewer', 'content-reviewer', 'mobile-qa']

const DISPATCH_TOOLS = ['Agent', 'Task']

// Returned rather than thrown, so every exit code stays in one function. See the header.
const NEEDS_VALUE = { needsValue: true }

function flagOf (argv, name, fallback) {
  const i = argv.indexOf('--' + name)
  if (i === -1) return fallback
  const v = argv[i + 1]
  if (v === undefined || v.slice(0, 2) === '--') return NEEDS_VALUE
  return v
}

// The undocumented part, in one place so there is one thing to fix when it changes.
function projectDirName (root) {
  return path.resolve(root).replace(/[^A-Za-z0-9]/g, '-')
}

function transcriptsFor (root, home) {
  const dir = path.join(home, '.claude', 'projects', projectDirName(root))
  if (!fs.existsSync(dir)) return { dir: dir, why: 'no transcript directory for this project' }
  let names
  try { names = fs.readdirSync(dir) } catch (e) { return { dir: dir, why: 'the transcript directory could not be read: ' + e.message } }
  const files = names.filter(n => n.endsWith('.jsonl')).map(n => path.join(dir, n))
  if (!files.length) return { dir: dir, why: 'the transcript directory holds no session' }
  return { dir: dir, files: files }
}

function newest (files) {
  let best = null
  let bestAt = -1
  for (const f of files) {
    let at
    try { at = fs.statSync(f).mtimeMs } catch (e) { continue }
    if (at > bestAt) { bestAt = at; best = f }
  }
  return best
}

function dispatchesIn (file) {
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (e) { return { why: 'the session could not be read: ' + e.message } }
  const found = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.indexOf('subagent_type') === -1) continue
    let rec
    try { rec = JSON.parse(line) } catch (e) { continue }
    const content = rec && rec.message && rec.message.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue
      if (DISPATCH_TOOLS.indexOf(block.name) === -1) continue
      const role = block.input && block.input.subagent_type
      if (typeof role === 'string' && role) found.push({ role: role, at: rec.timestamp || '' })
    }
  }
  return { found: found }
}

function main (argv) {
  const quiet = argv.indexOf('--quiet') !== -1
  const list = argv.indexOf('--list') !== -1
  const rootArg = flagOf(argv, 'root', process.cwd())
  const homeArg = flagOf(argv, 'home', os.homedir())
  const say = line => { if (!quiet) process.stdout.write(line + '\n') }

  for (const bad of [['root', rootArg], ['home', homeArg]]) {
    if (bad[1] === NEEDS_VALUE) {
      process.stderr.write('check-gate-dispatch: --' + bad[0] + ' needs a directory after it\n')
      return 2
    }
  }

  const root = path.resolve(rootArg)
  const home = path.resolve(homeArg)

  if (!fs.existsSync(root)) {
    process.stderr.write('check-gate-dispatch: no such directory: ' + root + '\n')
    return 2
  }

  const t = transcriptsFor(root, home)
  if (t.why) {
    // It prints where it looked, because the derivation is the thing most likely to be wrong
    // and a reader cannot check it without the path.
    process.stdout.write('  CANNOT TELL. ' + t.why + '.\n')
    process.stdout.write('  Looked in: ' + t.dir + '\n')
    return 3
  }

  const file = newest(t.files)
  if (!file) {
    process.stdout.write('  CANNOT TELL. no session in ' + t.dir + ' could be stat-ed.\n')
    return 3
  }

  const r = dispatchesIn(file)
  if (r.why) {
    process.stdout.write('  CANNOT TELL. ' + r.why + '\n')
    return 3
  }

  const reviews = r.found.filter(d => REVIEW_ROLES.indexOf(d.role) !== -1)
  const seen = {}
  for (const d of reviews) seen[d.role] = (seen[d.role] || 0) + 1
  const names = Object.keys(seen).sort().map(k => k + ' ' + seen[k]).join(', ')

  if (list) {
    const all = {}
    for (const d of r.found) all[d.role] = (all[d.role] || 0) + 1
    for (const k of Object.keys(all).sort()) say('  ' + String(all[k]).padStart(4) + '  ' + k)
  }

  if (!reviews.length) {
    process.stdout.write('  NO REVIEW RAN in this session. ' + r.found.length + ' agent(s) started, none of them a reviewer.\n')
    process.stdout.write('  A reviewer is one of: ' + REVIEW_ROLES.join(', ') + '.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    return 1
  }

  say('  ' + reviews.length + ' review agent(s) started in this session: ' + names)
  say('  It proves they were started, never that they passed. Session: ' + path.basename(file))
  return 0
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { main, projectDirName, REVIEW_ROLES, DISPATCH_TOOLS, dispatchesIn }
