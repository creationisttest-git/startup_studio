#!/usr/bin/env node
/**
 * run-checks.js -- runs the studio's own instruments, records what each one actually
 * returned, and gives a gate something to refuse on that nobody had to summarise.
 *
 * WHY THIS EXISTS. The checks in this repository are good, and they ran when somebody
 * remembered. Nothing recorded whether they had run at all, so a release could be made on a
 * tree nobody had measured and no surface anywhere would say so. The answer to that is not
 * another reminder. It is a file naming which instrument ran, what it returned and against
 * which tree, committed beside the work, with the release refusing while that file says a
 * check was skipped or failed.
 *
 * THE RECORD IS WRITTEN BY THE TOOLS AND NEVER BY A READER OF THEM. Every row here carries
 * the exit code of a real process. Anyone asked to run the checks and write down how they
 * went produces a summary of a run, which is a description of evidence rather than evidence,
 * and the difference only shows up on the day the summary is wrong. So this runner spawns
 * each instrument, keeps its exit code, and writes that down. It has no opinion.
 *
 * WHY EVERY ROW NAMES A TREE. A green row written five sessions ago looks exactly like a
 * green row written a minute ago, and reading the first as permission is how a check turns
 * into decoration. Each row carries a fingerprint of the tree it measured: the commit, plus
 * everything that is not committed. A gate compares that against the tree in front of it and
 * reports NOT PROVED when they differ. Stale is a refusal and never a pass.
 *
 * WHAT HAPPENS WHEN THIS FILE IS CORRUPT, AND WHY IT IS THE OPPOSITE OF THE DECISIONS LEDGER
 * BESIDE IT. That ledger holds rare permanent records and dies loudly on a bad file, which is
 * right for a decision nobody can reconstruct. This file is rewritten every session, so one
 * bad merge dying the same way would take down every command that reads it rather than one
 * gate. Corrupt or unreadable here reports UNKNOWN and refuses the GATE, never the program,
 * and the fix is to run the checks again.
 *
 * ABSENT IS NOT CLEAN. An install that does not carry an instrument has not passed it. The
 * public export does not carry the test suite, so on a stranger's copy that row reads absent
 * and the summary says so out loud rather than reporting a clean bill of health over a
 * partial install. It does not refuse, because a gate refusing on something a legitimate
 * install can never satisfy locks that install out for good, and a check of this kind in this
 * repository once refused six of seven projects on its first run. It is counted and named
 * instead, so a reader can tell what was measured from what was not.
 *
 * NOT EVERY INSTRUMENT CAN PRODUCE A FACT. The health report writes nothing, always exits
 * zero and prints several hundred lines of prose that nothing parses, so its exit code
 * carries no information about what it found. It is run, and recorded as unproved with that
 * reason attached, rather than counted as a pass it never earned or quietly dropped from the
 * list. A hole that is named can be filled; a hole that is papered over cannot.
 *
 * WHERE THE INSTRUMENTS ARE. The export flattens the board directory and leaves the test
 * suite behind, so a path that is correct in the source tree is wrong in the copy people
 * actually install. Every instrument is looked for in both shapes and a miss is recorded as
 * absent rather than raised as an error.
 *
 * EVERY REFUSAL NAMES THE FAULT AND THE EXACT COMMAND THAT CLEARS IT. A refusal a reader
 * cannot act on trains its reader to override it, which is the failure mode of every advisory
 * control here. So each row keeps the command line it was run as: the gate prints that to see
 * the fault, and prints the runner command to clear the row.
 *
 *   node tools/run-checks.js                        run the session-start set
 *   node tools/run-checks.js --set release          run the release set
 *   node tools/run-checks.js --set wind-down        run the document checks
 *   node tools/run-checks.js --set all              run every set
 *   node tools/run-checks.js --gate release         read the record back and decide
 *   node tools/run-checks.js --show                 print the record as it stands
 *   options: --root <dir>  --ledger <file>  --quiet
 *
 * Exit 0 clean, 1 refused, 2 on a usage or read error.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

const SETS = ['session-start', 'wind-down', 'release']
const LEDGER_VERSION = 1
const WALK_CAP = 20000

function say (quiet, line) { if (!quiet) process.stdout.write(line + '\n') }

function flagOf (argv, name, fallback) {
  const i = argv.indexOf('--' + name)
  if (i === -1 || i === argv.length - 1) return fallback
  return argv[i + 1]
}

function has (argv, name) { return argv.indexOf('--' + name) !== -1 }

// ------------------------------------------------------------------ tree state

function git (root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.error || r.status !== 0) return null
  return r.stdout
}

function walkFingerprint (root, ignoreRel) {
  const skip = new Set(['.git', 'node_modules', '.public', '.archive'])
  const h = crypto.createHash('sha256')
  let seen = 0
  let truncated = false
  const stack = ['']
  const rows = []
  while (stack.length) {
    const rel = stack.pop()
    let entries
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }) } catch (e) { continue }
    for (const e of entries) {
      if (skip.has(e.name)) continue
      const child = rel ? rel + '/' + e.name : e.name
      if (e.isDirectory()) { stack.push(child); continue }
      if (!e.isFile()) continue
      if (child === ignoreRel) continue
      if (seen >= WALK_CAP) { truncated = true; continue }
      seen++
      let st
      try { st = fs.statSync(path.join(root, child)) } catch (e2) { continue }
      rows.push(child + ':' + st.size + ':' + Math.round(st.mtimeMs))
    }
  }
  rows.sort()
  for (const r of rows) h.update(r + '\n')
  return { by: 'walk', hash: h.digest('hex').slice(0, 16), head: null, truncated: truncated }
}

// The commit alone is not the tree: almost every check here runs against work that is not
// committed yet, which is precisely the state a release is made from.
//
// The record itself is excluded, and leaving it in was a self-invalidating loop rather than a
// nicety. Writing the rows changes the tree, so every row would have been recorded against a
// tree that had stopped existing by the time the write finished, and the gate would have said
// NOT PROVED on a run that had just completed cleanly.
function treeState (root, ignoreRel) {
  const skip = ignoreRel ? [':(exclude)' + ignoreRel] : []
  const head = git(root, ['rev-parse', 'HEAD'])
  if (head === null) return walkFingerprint(root, ignoreRel)
  const porcelain = git(root, ['status', '--porcelain', '--'].concat(skip)) || ''
  const diff = git(root, ['diff', 'HEAD', '--'].concat(skip)) || ''
  const others = (git(root, ['ls-files', '-o', '--exclude-standard', '--'].concat(skip)) || '')
    .split('\n').map(s => s.trim()).filter(Boolean).sort()
  const h = crypto.createHash('sha256')
  h.update(head.trim() + '\n')
  h.update(porcelain + '\n')
  h.update(diff + '\n')
  for (const f of others) {
    h.update(f + '\n')
    try { h.update(fs.readFileSync(path.join(root, f))) } catch (e) { h.update('<unreadable>\n') }
  }
  return { by: 'git', hash: h.digest('hex').slice(0, 16), head: head.trim(), truncated: false }
}

function treeKey (t) { return t.by + ':' + t.hash }

function relOf (root, file) { return path.relative(root, file).split(path.sep).join('/') }

// ------------------------------------------------------------------ the instruments

function findFirst (root, candidates) {
  for (const c of candidates) {
    const p = path.join(root, c.split('/').join(path.sep))
    if (fs.existsSync(p)) return { rel: c, abs: p }
  }
  return null
}

function definitions (root) {
  const warm = 'WARM_START.md'
  return [
    {
      name: 'board-audit',
      sets: ['session-start', 'release'],
      where: ['base/board/board.js', 'board/board.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, 'audit'] }),
      about: 'every live ticket has an owner, a decision answered and no loose end'
    },
    {
      name: 'board-doctor',
      sets: ['session-start', 'release'],
      where: ['base/board/board.js', 'board/board.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, 'doctor'] }),
      about: 'no ticket file is corrupt, duplicated or disagreeing with its own name'
    },
    {
      name: 'comment-shape',
      sets: ['session-start', 'release'],
      where: ['tools/check-comment-shape.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--quiet'] }),
      about: 'no comment in published code speaks to the session that wrote it'
    },
    {
      name: 'roster-count',
      sets: ['session-start', 'release'],
      where: ['tools/check-roster-count.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--quiet'] }),
      about: 'every published page states the number of roles the roster actually holds'
    },
    {
      name: 'releases-page',
      sets: ['release'],
      where: ['tools/build-releases.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--check'] }),
      about: 'the published releases page matches the changelog it is generated from'
    },
    {
      name: 'resume-pointer',
      sets: ['wind-down'],
      where: [warm],
      needs: ['tools/check-resume-pointer.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, f.abs, '--quiet'] }),
      about: 'the resume prompt aims at the current state block and not a superseded one'
    },
    {
      name: 'session-brief',
      sets: ['wind-down'],
      where: [warm],
      needs: ['tools/check-session-brief.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, f.abs, '--quiet'] }),
      advisory: [3],
      about: 'the founder brief still fits what a founder will actually read'
    },
    {
      name: 'context-budget',
      sets: ['wind-down'],
      where: ['CLAUDE.md'],
      needs: ['tools/check-context-budget.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, root, '--quiet'] }),
      about: 'this project is not paying for its whole history on every request'
    },
    {
      name: 'suite',
      sets: ['release'],
      where: ['tests/studio-self.tests.ps1'],
      build: f => ({ exe: 'powershell', args: ['-NoProfile', '-File', f.abs], env: { STUDIO_SAFE: '1' } }),
      about: 'the whole studio suite, which is the four-minute one'
    },
    {
      name: 'health-report',
      sets: ['session-start', 'release'],
      where: ['studio.ps1'],
      build: f => ({ exe: 'powershell', args: ['-NoProfile', '-File', f.abs, '-Doctor'], env: { STUDIO_SAFE: '1' } }),
      // Measured: it exits 0 on a tree with drift and on a tree without, so the code carries
      // nothing a gate could read. Recorded as unproved rather than as a pass.
      unproved: 'it always exits zero and writes nothing a gate can read',
      about: 'drift across every connected project, reported as prose for a person'
    }
  ]
}

function shortCmd (root, exe, args) {
  const name = exe === process.execPath ? 'node' : exe
  const parts = args.map(a => {
    const s = String(a)
    if (!s.startsWith(root)) return s
    const rel = path.relative(root, s) || '.'
    return rel.split(path.sep).join('/')
  })
  return [name].concat(parts).join(' ')
}

function runOne (root, def) {
  const found = findFirst(root, def.where)
  const tool = def.needs ? findFirst(root, def.needs) : null
  if (!found || (def.needs && !tool)) {
    const missing = !found ? def.where[0] : def.needs[0]
    return { status: 'absent', exit: null, cmd: null, ms: 0, why: missing + ' is not in this install' }
  }
  const spec = def.build(found, tool)
  const started = Date.now()
  const r = spawnSync(spec.exe, spec.args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: Object.assign({}, process.env, spec.env || {})
  })
  const ms = Date.now() - started
  const cmd = shortCmd(root, spec.exe, spec.args)
  if (r.error) return { status: 'absent', exit: null, cmd: cmd, ms: ms, why: 'could not be run: ' + r.error.message }
  const code = r.status === null ? -1 : r.status
  const tail = ((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 400)
  if (def.unproved) return { status: 'unproved', exit: code, cmd: cmd, ms: ms, why: def.unproved, tail: tail }
  if (def.advisory && def.advisory.indexOf(code) !== -1)
    return { status: 'advisory', exit: code, cmd: cmd, ms: ms, why: 'exit ' + code + ' is advisory for this check', tail: tail }
  return { status: code === 0 ? 'ok' : 'failed', exit: code, cmd: cmd, ms: ms, tail: tail }
}

// ------------------------------------------------------------------ the ledger

function ledgerPath (root, override) {
  if (override) return path.resolve(override)
  const home = process.env.BOARD_HOME
  if (home) return path.join(path.resolve(home), 'checks.json')
  return path.join(root, '.board', 'checks.json')
}

function readLedger (file) {
  if (!fs.existsSync(file)) return { state: 'absent', data: null }
  let raw
  try { raw = fs.readFileSync(file, 'utf8') } catch (e) { return { state: 'unreadable', data: null, why: e.message } }
  let parsed
  try { parsed = JSON.parse(raw.replace(/^﻿/, '')) } catch (e) { return { state: 'corrupt', data: null, why: e.message } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.checks || typeof parsed.checks !== 'object' || Array.isArray(parsed.checks))
    return { state: 'corrupt', data: null, why: 'no checks object' }
  return { state: 'ok', data: parsed }
}

// Rewritten every session, so the rows are keyed by check name and the newest wins. An
// append-only history in the same file would conflict on every push and grow without bound;
// git already holds the history of this file.
function writeLedger (file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8' })
}

function stamp () {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
}

// ------------------------------------------------------------------ run

function doRun (root, file, setName, quiet) {
  const defs = definitions(root).filter(d => setName === 'all' || d.sets.indexOf(setName) !== -1)
  if (!defs.length) { process.stderr.write('run-checks: no checks in set ' + setName + '\n'); return 2 }

  const rel = relOf(root, file)
  const before = treeState(root, rel)
  const existing = readLedger(file)
  const data = existing.state === 'ok'
    ? existing.data
    : { version: LEDGER_VERSION, checks: {} }
  data.version = LEDGER_VERSION

  say(quiet, '')
  say(quiet, 'CHECKS  set ' + setName + '  tree ' + treeKey(before))

  let failed = 0
  let absent = 0
  for (const def of defs) {
    const r = runOne(root, def)
    // A check that REFUSED on this tree and has since lost its instrument keeps the refusal.
    // Measured: with the record red, renaming check-comment-shape.js took the gate from exit 1
    // to exit 0 reporting 3 passed, 0 to fix, 2 absent. Absent must never be reachable as a way
    // of clearing a failure that was already recorded against the tree in front of the gate.
    const prior = data.checks[def.name]
    // The tree is deliberately NOT compared here. Removing the instrument IS a change to the
    // tree, so a same-tree condition could never fire and the laundering would survive the fix.
    if (r.status === 'absent' && prior && prior.status === 'failed') {
      r.status = 'failed'
      r.exit = prior.exit
      r.cmd = prior.cmd
      r.why = 'it refused on this tree and its instrument has since been removed: ' + (r.why || '')
      r.tail = prior.tail
    }
    data.checks[def.name] = {
      status: r.status,
      exit: r.exit,
      cmd: r.cmd,
      ms: r.ms,
      at: stamp(),
      tree: treeKey(before),
      head: before.head,
      set: def.sets.slice(),
      about: def.about,
      why: r.why || '',
      tail: r.tail || ''
    }
    if (r.status === 'failed') failed++
    if (r.status === 'absent') absent++
    const detail = r.status === 'absent' ? r.why
      : r.status === 'unproved' ? r.why
        : r.status === 'advisory' ? r.why
          : 'exit ' + r.exit + ', ' + r.ms + 'ms'
    say(quiet, '  ' + r.status.toUpperCase().padEnd(9) + def.name.padEnd(16) + detail)
  }

  // The tree is re-read after the run. Anything written while an instrument was reading it
  // makes every row above a measurement of a tree that no longer exists.
  const after = treeState(root, rel)
  if (treeKey(after) !== treeKey(before)) {
    for (const def of defs) data.checks[def.name].tree = 'moved-during-run'
    say(quiet, '')
    say(quiet, '  THE TREE CHANGED WHILE THE CHECKS WERE RUNNING. Every row is recorded against a tree')
    say(quiet, '  that no longer exists and every gate will refuse until they are run again on a still tree.')
  }

  writeLedger(file, data)
  say(quiet, '')
  say(quiet, '  ' + defs.length + ' check(s), ' + failed + ' failed, ' + absent + ' absent, recorded in ' + rel)
  say(quiet, '')
  return failed ? 1 : 0
}

// ------------------------------------------------------------------ gate

function doGate (root, file, setName, quiet) {
  const led = readLedger(file)
  const rel = relOf(root, file)
  const clear = 'node tools/run-checks.js --set ' + setName

  if (led.state !== 'ok') {
    const what = led.state === 'absent'
      ? rel + ' does not exist, so no check has been recorded'
      : rel + ' is ' + led.state + ' (' + (led.why || '') + ')'
    process.stdout.write('  NOT PROVED. ' + what + '.\n')
    process.stdout.write('  Run: ' + clear + '\n')
    return 1
  }

  const defs = definitions(root).filter(d => setName === 'all' || d.sets.indexOf(setName) !== -1)
  const now = treeKey(treeState(root, rel))
  const problems = []
  let ok = 0
  let absent = 0
  let unproved = 0

  for (const def of defs) {
    const row = led.data.checks[def.name]
    if (!row) { problems.push([def.name, 'has never been recorded', clear]); continue }
    if (row.tree !== now) {
      problems.push([def.name, 'was recorded against a different tree (' + row.tree + ', now ' + now + ')', clear])
      continue
    }
    if (row.status === 'failed') {
      problems.push([def.name, 'failed with exit ' + row.exit + (row.tail ? ': ' + row.tail : ''),
        (row.cmd || clear) + '   then: ' + clear])
      continue
    }
    if (row.status === 'absent') { absent++; continue }
    if (row.status === 'unproved') { unproved++; continue }
    // ONLY 'ok' passes, and the branch used to fall through to a pass for anything it did not
    // recognise. Measured on a fixture whose instrument really exited 1: a status misspelt as
    // "faled", a status field deleted, and a row cut down to nothing but its tree all read as
    // 4 passed, 0 to fix, exit 0. A record that can be loosened by hand is not a record.
    if (row.status !== 'ok') {
      problems.push([def.name, 'has status "' + String(row.status) + '", which is not a result this ' +
        'gate recognises. The row is malformed or was edited by hand.', clear])
      continue
    }
    ok++
  }

  const counted = defs.length
  say(quiet, '  ' + counted + ' check(s) in set ' + setName + ': ' + ok + ' passed, ' +
    problems.length + ' to fix, ' + absent + ' absent from this install, ' + unproved + ' not machine-readable')

  for (const [name, why, cmd] of problems) {
    process.stdout.write('  NOT PROVED  ' + name + ': ' + why + '\n')
    process.stdout.write('              run: ' + cmd + '\n')
  }
  if (absent || unproved) {
    for (const def of defs) {
      const row = led.data.checks[def.name]
      if (row && (row.status === 'absent' || row.status === 'unproved'))
        say(quiet, '  ' + row.status.toUpperCase() + '  ' + def.name + ': ' + row.why)
    }
  }
  return problems.length ? 1 : 0
}

function doShow (root, file) {
  const led = readLedger(file)
  const rel = relOf(root, file)
  if (led.state !== 'ok') {
    process.stdout.write(rel + ': ' + led.state + (led.why ? ' (' + led.why + ')' : '') + '\n')
    return 1
  }
  const now = treeKey(treeState(root, rel))
  process.stdout.write('\n' + rel + '   tree now ' + now + '\n')
  const names = Object.keys(led.data.checks).sort()
  for (const n of names) {
    const r = led.data.checks[n]
    const fresh = r.tree === now ? '' : '  STALE'
    process.stdout.write('  ' + String(r.status).toUpperCase().padEnd(9) + n.padEnd(16) +
      (r.at || '') + '  ' + (r.ms || 0) + 'ms' + fresh + '\n')
  }
  process.stdout.write('\n')
  return 0
}

// ------------------------------------------------------------------ main

function main (argv) {
  const root = path.resolve(flagOf(argv, 'root', path.join(__dirname, '..')))
  if (!fs.existsSync(root)) { process.stderr.write('run-checks: no such directory: ' + root + '\n'); return 2 }
  const file = ledgerPath(root, flagOf(argv, 'ledger', null))
  const quiet = has(argv, 'quiet')

  if (has(argv, 'show')) return doShow(root, file)

  const gate = flagOf(argv, 'gate', null)
  if (gate !== null) {
    if (gate !== 'all' && SETS.indexOf(gate) === -1) {
      process.stderr.write('run-checks: --gate must be one of: ' + SETS.concat('all').join(', ') + '\n')
      return 2
    }
    return doGate(root, file, gate, quiet)
  }

  const set = flagOf(argv, 'set', 'session-start')
  if (set !== 'all' && SETS.indexOf(set) === -1) {
    process.stderr.write('run-checks: --set must be one of: ' + SETS.concat('all').join(', ') + '\n')
    return 2
  }
  return doRun(root, file, set, quiet)
}

module.exports = { main, treeState, treeKey, readLedger, definitions, runOne }

if (require.main === module) process.exit(main(process.argv.slice(2)))
