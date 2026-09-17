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

// 'deep' is the set nothing gates on. A check lives here when it has earned its keep as a
// diagnostic but has not earned a place in the path between writing code and testing it.
const SETS = ['session-start', 'wind-down', 'release', 'deep']
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
// committed yet, which is precisely the state a release is made from. So this reads the CONTENT
// of the working tree and never the commit that content happens to be sitting on.
//
// That is a self-invalidating loop with two halves, and only one of them used to be closed. The
// record file is excluded, because writing the rows would otherwise move the tree the rows were
// just recorded against. The other half is HEAD. Hashing the commit meant the ACT OF COMMITTING
// invalidated the record, and -Release commits and pushes the work before it publishes, so the
// publish read back a record it had broken one step earlier and refused with every row NOT
// PROVED. Committing changes which commit the bytes sit on. It does not change the bytes.
//
// The cost, stated rather than discovered: two different commits carrying identical content now
// share a fingerprint. They also carry identical code, so a result measured on one is evidence
// about the other, which is the only question this hash is asked.
function treeState (root, ignoreRel) {
  const skip = ignoreRel ? [':(exclude)' + ignoreRel] : []
  const head = git(root, ['rev-parse', 'HEAD'])
  if (head === null) return walkFingerprint(root, ignoreRel)
  // -z, because git quotes any path it considers unusual, and a quoted path fails to open and
  // would drop that file out of the fingerprint without a word.
  const files = (git(root, ['ls-files', '-z', '-c', '-o', '--exclude-standard', '--'].concat(skip)) || '')
    .split('\0').map(s => s.trim()).filter(Boolean).sort()
  const h = crypto.createHash('sha256')
  for (const f of files) {
    let buf
    // Tracked but no longer on disk. It is absent both before and after the commit that records
    // the deletion, so skipping it is what keeps the two states equal.
    try { buf = fs.readFileSync(path.join(root, f)) } catch (e) { continue }
    h.update(f + '\n')
    h.update(buf)
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
      // Out of session-start: it exits 1 in a tree that has never run init, so a fresh clone of
      // the published export reported it red before the reader touched anything.
      sets: ['release'],
      where: ['base/board/board.js', 'board/board.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, 'doctor'] }),
      about: 'no ticket file is corrupt, duplicated or disagreeing with its own name'
    },
    {
      name: 'comment-shape',
      // Refused ONCE across 79 committed ledger versions, and that refusal was this repository
      // raising its own baseline with its own new comments. It polices comments about tickets,
      // which no reader of the published tool ever reads, and it sat in front of every release.
      sets: ['deep'],
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
      name: 'published-counts',
      sets: ['session-start', 'release'],
      where: ['tools/check-published-counts.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--quiet'] }),
      // Exit 3 is a tree holding neither board.js nor reference.html, which is not a studio
      // install at all. Without this the check is red for good on a layout it has no standing to
      // refuse on, which is the lockout this repository has now shipped three times (S133, S151).
      advisory: [3],
      about: 'the in-flight ceiling and the glossary size on the published pages are the numbers those things actually are'
    },
    {
      name: 'hook-wiring',
      // Never refused across 76 committed ledger versions.
      sets: ['deep'],
      where: ['tools/check-hook-registration.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--quiet'] }),
      advisory: [3],
      about: 'every session hook sits on an event that can actually deliver what it returns'
    },
    {
      name: 'gate-dispatch',
      sets: ['release'],
      where: ['tools/check-gate-dispatch.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--quiet'] }),
      // Exit 3 is no readable transcript, which a legitimate install can never clear. Exit 1 is a
      // transcript read and holding no PRODUCT reviewer, which is a finding and refuses.
      // Exit 4 is a transcript holding a product reviewer but no method review. That is now
      // advisory by the founder's instruction: the method gate reports, it does not block a
      // release. Its findings reach a ticket instead. Keep all three apart.
      advisory: [3, 4],
      about: 'a review agent was started in the session that is about to release'
    },
    {
      name: 'mutation-coverage',
      // Thirty minutes per run, in the path between a built change and a testable one. A slow
      // check belongs on a schedule, not a gate, and that part still holds.
      //
      // WHAT DID NOT HOLD IS THE REST OF THIS COMMENT, AND IT IS CORRECTED RATHER THAN TIDIED
      // (S198). It used to argue the findings are never urgent because the two open at the time
      // were fragments of a diagnostic message. There are SEVEN now. It went from two to seven
      // over five days with nothing reporting it, because 'deep' is a set no gate triggers, so a
      // baseline only this check reads was watched only by a check nobody ran, and the comment
      // saying not to worry was the reason nobody looked. ST-263.
      sets: ['deep'],
      where: ['tools/check-mutation-coverage.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--quiet'] }),
      // Minutes, not milliseconds: one full suite run per line. Hence release and not session start.
      about: 'every line of the release gate is one an assertion depends on, or is accepted with a reason'
    },
    {
      name: 'mutation-stale',
      // The cheap half of the question above, in a set that actually runs. It does not derive
      // anything: it reads the stamp the derivation recorded and compares it to the pair on disk,
      // in milliseconds. It cannot say WHICH line went silent and does not pretend to. It says
      // the answer you are holding was computed about a file that has since changed, which is the
      // fact that was missing for five days while every other instrument reported clean.
      sets: ['session-start', 'wind-down'],
      where: ['tools/check-mutation-coverage.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--stale-only', '--quiet'] }),
      // Exit 3 is a baseline carrying no stamp, which is CANNOT TELL and not a pass. Advisory,
      // because a reader who has never run the derivation is not a reader in breach (S202), and
      // the tool says in words that it is not a pass so the distinction cannot be read as clean.
      advisory: [3],
      about: 'the coverage baseline is still about the file it describes'
    },
    {
      name: 'decision-keys',
      // Never refused across 58 committed ledger versions.
      sets: ['deep'],
      where: ['tools/check-decision-keys.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root, '--quiet'] }),
      advisory: [3],
      about: 'no decision key names two different decisions'
    },
    {
      name: 'governance-core',
      sets: ['session-start', 'release'],
      where: ['tools/check-governance-core.js'],
      // Two roots. --gov is in this repository; --root is the directory HOLDING it, because reach
      // is a property of the other projects and not of this one.
      build: f => ({ exe: process.execPath, args: [f.abs, '--gov', path.join(root, 'base', 'governance'),
        '--root', path.dirname(root), '--quiet'] }),
      // Exit 3 is no governance directory at all, which is every copy installed from the public
      // export, because the governance text deliberately does not publish. Without this the check
      // is red on every reader's machine for good and no reader can ever clear it.
      advisory: [3],
      about: 'no rule was retired by the governance split, and every project holding the core imports it'
    },
    {
      name: 'doc-shape',
      // Polices the shape of state documents. Every refusal it has recorded was this project
      // failing to keep its own paperwork small, which is a symptom rather than a control.
      sets: ['deep'],
      where: ['tools/check-document-shape.js'],
      // Run on the directory HOLDING this one, the same reach argument governance-core makes:
      // a document with no shape is a property of the other projects, and this repository is the
      // one place it has never been true.
      //
      // --governed-only IS LOAD BEARING AND IS NOT TIDINESS. The directory holding this one is
      // our projects folder and is the READER'S OWN WORK on every copy installed from the public
      // export. Measured without the flag, on a parent holding one unrelated project: exit 1,
      // "FAIL some-unrelated-app/CLAUDE.md: has markdown headings", in the session-start set, on
      // a document we did not write and cannot fix. The flag scopes the walk to projects that
      // load studio governance. Asserted in run-checks.test.js on the argv this line builds,
      // because the wiring was where the defect lived both times (ST-187).
      build: f => ({ exe: process.execPath,
        args: [f.abs, path.dirname(root), '--quiet', '--governed-only'] }),
      // Exit 3 is no studio-governed project beside this install, which is the ordinary state of
      // a fresh one. Without this the check is red on every reader's machine for good, and unlike
      // board-audit there is no documented command that clears it (S148).
      advisory: [3],
      about: 'every document a session loads has a shape an instrument can actually read'
    },
    {
      name: 'releases-page',
      // SESSION-START AS WELL AS RELEASE, AND THE RELEASE SET ALONE IS WHAT MADE IT WORSE THAN
      // USELESS. Every wind-down writes a release note into the changelog and does not rebuild the
      // page, so the page goes stale at the exact commit that makes it stale, and the only set that
      // would notice does not run again until somebody publishes. It has already cost a run: the
      // page was found drifted at HEAD, confirmed by running the suite against a clean archive of
      // HEAD rather than assumed, and that failure took the whole PowerShell run down with it.
      // The check compares two files already in the tree, wants no network and no git, and costs
      // about fifty milliseconds, so nothing was being bought by leaving it out.
      sets: ['release', 'session-start'],
      where: ['tools/build-releases.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--check'] }),
      // Exit 3 is a tree with no page or no dated changelog to hold it to, which is the ordinary
      // state of someone running the method without publishing the website. Every neighbouring
      // check carries the same escape for the same reason, and this one did not until it was
      // moved into the set a reader runs first.
      advisory: [3],
      about: 'the published releases page matches the changelog it is generated from'
    },
    {
      name: 'changelog-leak',
      // WIND-DOWN, AND DELIBERATELY NOT THE WHOLE SCAN AND NOT EVERY SET. The authoritative leak
      // scan reads the entire publish manifest, lives in the PowerShell suite and at the publish,
      // and stays exactly where it is. What moves here is one file, because the schedule is the
      // defect: a changelog entry is WRITTEN at the wind-down by the session most likely to be
      // quoting another project by name, and nothing read it until somebody ran a five-minute
      // suite or attempted a publish. That window is a whole sitting and it has now closed on a
      // real name three times. ST-208 is the warning against the wider fix: moving a slow, broadly
      // scoped check into the set every reader runs is how a lockout ships.
      sets: ['wind-down', 'release'],
      where: ['tools/check-changelog-leak.js'],
      build: f => ({ exe: process.execPath, args: [f.abs, '--root', root] }),
      // Exit 3 is the ordinary reader: the rules live in studio.config.ps1, which is the private
      // half of the publisher and is absent from the publish manifest on purpose, so a copy of the
      // export has no rules to apply. It says it cannot tell rather than reporting clean over an
      // empty list, and it never refuses for want of a file it was never given.
      advisory: [3],
      about: 'CHANGELOG.md names no private project, checked when the entry is written rather than at the publish'
    },
    {
      name: 'resume-pointer',
      // Never refused across 69 committed ledger versions.
      sets: ['deep'],
      where: [warm],
      needs: ['tools/check-resume-pointer.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, f.abs, '--quiet'] }),
      about: 'the resume prompt aims at the current state block and not a superseded one'
    },
    {
      name: 'session-brief',
      // Never refused across 69 committed ledger versions.
      sets: ['deep'],
      where: [warm],
      needs: ['tools/check-session-brief.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, f.abs, '--quiet'] }),
      advisory: [3],
      about: 'the founder brief still fits what a founder will actually read'
    },
    {
      name: 'reply-shape',
      // ST-219 d1 SPLIT THIS IN TWO, AND THE TWO ROWS ARE THE WHOLE POINT. This one keeps the
      // ABSOLUTE count and stays in the wind-down, where the number is READ into the compliance
      // table: a slip a session recovered from still happened and the record must not lose it.
      // `reply-shape-recent` below is the windowed twin. They are separate NAMES rather than one
      // name with different arguments, because the gate keys the ledger on the name, so a
      // windowed pass would otherwise overwrite the absolute row and the record would be gone
      // through the very change meant to preserve it.
      //
      // CORRECTED 2026-09-17, ST-259. This used to read "the release runs reply-shape-recent
      // below instead", and that stopped being true at f342f07, where ST-237 moved six checks
      // out of the gating sets. NEITHER brevity check gates a release now. That is a decision
      // and not a defect, taken on a measurement: the windowed one blocked four of five
      // releases over a banned character no customer reads. The comment is corrected rather
      // than deleted because the founder's own top-two measures are these two rows, and a
      // reader who believes one of them gates a release will not go looking for what does.
      sets: ['wind-down'],
      // ANCHORED ON THE TOOL, NOT ON CLAUDE.md, BECAUSE CLAUDE.md DOES NOT PUBLISH. This check
      // reads the session TRANSCRIPTS and nothing in the repository, so CLAUDE.md was never the
      // artefact it is about; it was a stand-in, and it is not in PUBLIC_MANIFEST, so on every
      // installed copy the row read ABSENT and the check never ran. Three published surfaces
      // said a verbose session refuses its own release and it could not, for any reader (S133).
      where: ['tools/check-reply-shape.js'],
      needs: ['tools/check-reply-shape.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, '--root', root, '--quiet'] }),
      advisory: [3],
      about: 'the replies this session actually sent are point form and lead with the answer'
    },
    {
      name: 'decision-shape',
      // THE FOUNDER'S SECOND TOP-TWO MEASURE, AND UNTIL 2026-09-13 NOTHING ANYWHERE COUNTED IT.
      // They said the projects "don't give me mcq prompts to respond via click inputs". A grep
      // that day for AskUserQuestion across every markdown file under the venture root found it in
      // NO governance file and NO instrument, while the rule that did exist told every reader to
      // write "numbered options, so the reply can be a single character", which describes a list
      // typed into a reply rather than a prompt. A rule can reach 17 roles and 11 of 11 project
      // sessions and still be invisible, because nothing ever read the surface it governs. That is
      // the asymmetry worth keeping: brevity has had an instrument for weeks and this had none.
      sets: ['wind-down'],
      // ANCHORED ON THE TOOL, for the same reason reply-shape is. This reads the session transcript
      // and the board, and neither is a repository artefact, so anchoring the row on anything in
      // the tree would make it read ABSENT on every installed copy and the check would never run.
      where: ['tools/check-decision-shape.js'],
      needs: ['tools/check-decision-shape.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, '--root', root, '--quiet'] }),
      // 3 IS CANNOT TELL AND IT COVERS THE HONEST CASES: no transcript, no board, or no decision
      // put to the founder in this session. A sitting that needed no decision is not a sitting in
      // breach, and a project with no board cannot be measured at all, so it reports rather than
      // refuses (S202). The refusal at 1 is reserved for the unambiguous case: the board holds a
      // decision put inside this session and no prompt was raised in that decision's own window.
      advisory: [3],
      about: 'every decision put to the CEO this session reached them as a clickable prompt'
    },
    {
      name: 'reply-shape-recent',
      // Refused a release over a single banned character in the session own replies, and by
      // this project record it blocked four of the last five releases. Nothing a customer
      // reads was ever at stake. The absolute count stays recorded at the wind-down.
      sets: ['deep'],
      // WHY THIS ASKS A NARROWER QUESTION THAN THE WIND-DOWN ROW ABOVE. Read the sets line: it
      // is `deep`, so it gates nothing. It was written for the release and ST-237 moved it out
      // at f342f07 for the reason the first paragraph gives. The narrowing below is still the
      // right design and is kept for whenever it gates again. This check reads a
      // transcript, and a sent reply cannot be unsent, so under the absolute rule one slip in the
      // first minute condemned every reply after it however clean. That blocked FOUR of the last
      // five releases. Measured before this was built: across 50 stored sittings, 43 of 50 would
      // still have breached inside their first five replies, so moving the release to the front
      // of a sitting was worth two sittings in fifty and was NOT built. What the numbers did
      // support is that a session which STOPS can recover: the eleventh sitting held 45
      // consecutive clean replies after its slip and still could not publish.
      //
      // TWENTY IS THE NUMBER AND IT IS A JUDGEMENT, NOT A DERIVATION. Long enough that a session
      // cannot slip and immediately publish, short enough to be reachable in one sitting; the
      // median sitting here writes 55 replies. Said plainly rather than dressed up as a finding.
      // The wind-down row above still counts every slip, so nothing is hidden by this passing.
      where: ['tools/check-reply-shape.js'],
      needs: ['tools/check-reply-shape.js'],
      build: (f, t) => ({ exe: process.execPath, args: [t.abs, '--root', root, '--recent', '20', '--quiet'] }),
      advisory: [3],
      about: 'the session has stopped breaching reply shape, judged on its last twenty replies'
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
      // Never refused across 79 committed ledger versions, and it cannot: it always exits zero.
      // It was 3,351ms of the 4,065ms the session-start set took, for a row no gate can read.
      sets: ['deep'],
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
    return { status: 'advisory', exit: code, cmd: cmd, ms: ms, tail: tail,
      why: tail || ('exit ' + code + ' is advisory for this check') }
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
    say(quiet, '  ' + r.status.toUpperCase().padEnd(9) + def.name.padEnd(17) + detail)
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

// A row is advisory only when its own definition says that exit code is advisory, because the
// word alone is otherwise a way through this gate for EVERY check: writing it into the record by
// hand waved past a check carrying a real refusal, which is the misspelt-status door below opened
// with a correctly spelt word. Asked in one place so the count and the listing cannot disagree.
function allowedAdvisory (def, row) {
  return row.status === 'advisory' && !!def.advisory && def.advisory.indexOf(row.exit) !== -1
}

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
  let advisory = 0
  const listed = []

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
    if (row.status === 'absent') { absent++; listed.push([def, row]); continue }
    if (row.status === 'unproved') { unproved++; listed.push([def, row]); continue }
    // Something to say and nothing to refuse. Reaching the catch-all below, it refused a release
    // and blamed a record nobody had touched.
    if (allowedAdvisory(def, row)) { advisory++; listed.push([def, row]); continue }
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
    problems.length + ' to fix, ' + absent + ' absent from this install, ' + unproved +
    ' not machine-readable, ' + advisory + ' advisory')

  for (const [name, why, cmd] of problems) {
    process.stdout.write('  NOT PROVED  ' + name + ': ' + why + '\n')
    process.stdout.write('              run: ' + cmd + '\n')
  }
  // Listed from what the loop above actually counted, never worked out a second time here.
  // Deciding twice let a row refused as recorded against a different tree be labelled advisory in
  // the same output, which leaves a reader two verdicts and no way to tell which one the gate
  // acted on.
  for (const [d, row] of listed) {
    say(quiet, '  ' + row.status.toUpperCase() + '  ' + d.name + ': ' + row.why)
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
    process.stdout.write('  ' + String(r.status).toUpperCase().padEnd(9) + n.padEnd(17) +
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

  // A FLAG WITH NO VALUE USED TO CHOOSE THE DEFAULT SILENTLY, AND FOR --gate THAT MEANT RUNNING.
  // flagOf returns its fallback when the flag is last on the line, so `--gate` alone read as no
  // gate at all: the program fell through, RAN the session-start set, OVERWROTE the ledger it was
  // being asked to read back, and returned 0. Someone gating a release got a green zero from a run
  // that gated nothing, and the ledger row proving the old state was gone. `--set` alone is the
  // same shape one command over: you name a set, get a different one, and nothing says so.
  // Present-but-empty is a usage error. It is never a default, because the default is what the
  // reader was trying not to get by typing the flag.
  for (const name of ['gate', 'set']) {
    if (has(argv, name) && flagOf(argv, name, null) === null) {
      process.stderr.write('run-checks: --' + name + ' needs a value: ' +
        SETS.concat(name === 'gate' ? ['all'] : []).join(', ') + '\n')
      return 2
    }
  }

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
