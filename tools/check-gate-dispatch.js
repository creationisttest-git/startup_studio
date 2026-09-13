#!/usr/bin/env node
/**
 * check-gate-dispatch.js -- did a review agent actually run in THIS session
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
 * SO THERE ARE FOUR ANSWERS AND NOT TWO, AND THE LAST TWO ARE THE ONES THAT KEEP IT HONEST.
 * Both kinds of review agent were started and the tree held: exit 0. No PRODUCT reviewer ran,
 * or the tree moved after the review: exit 1, and that refuses, because a positive finding of
 * nothing is a real finding. A product reviewer ran and no METHOD review did, with the tree
 * still holding: exit 4, advisory, because the method review reports and never blocks a
 * release; its findings go on a ticket instead. No transcript could be read: exit 3, advisory,
 * named out loud. Collapsing the
 * last two would mean a host that writes no transcript silently blocks every release, and
 * reading the first two as one would mean not being able to look counted as having looked.
 *
 * A REVIEWER IS TWO LISTS AND NOT ONE. PRODUCT_REVIEWERS read the WORK; METHOD_REVIEWERS read
 * the METHOD, meaning whether the studio's own process was followed and whether the replies the
 * founder was sent are the shape the studio publishes. A release needs ONE OF EACH, because as
 * one flat list a session that started only the doctor would clear a gate whose entire
 * question is whether anybody read the change. The page draws six Gate tiles and this is the six.
 *
 * AND THE METHOD HALF NEEDS THE PROMPT AS WELL AS THE NAME, because the doctor now has a
 * second job. See METHOD_REVIEW_MARKER below for why the marker sits on the review rather than
 * on the errand. There are three outcomes for that half and not two: no doctor at all, a
 * doctor started only for an errand, and a doctor asked for a method review.
 *
 * FOUR THINGS THE CODE BELOW DECIDES ONCE, AND WHY EACH IS ONE PLACE RATHER THAN TWO.
 * Which roles count as a review and in which of the two kinds, because the same question asked
 * twice is two answers that disagree eventually, and a review that quietly stops counting is a
 * silent miss. Which tool name starts an agent, because the host has used two across versions
 * and recognising only the current one turns a rename into a report that nobody has ever
 * reviewed anything. Which session is the current one, which is the most recently written,
 * because the host is still appending to it while this runs. And how a working directory
 * becomes a directory name, which is the undocumented part described above.
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
 *   node tools/check-gate-dispatch.js                 read this project's CURRENT session
 *   node tools/check-gate-dispatch.js --list          name every agent the session started
 *   options: --root <dir>  --home <dir>  --quiet
 *
 * AND A REVIEW IS EVIDENCE ABOUT ONE TREE. Both kinds having run says nothing about WHICH tree
 * they read, and a second writer in the same repository makes those two different questions. See
 * commitsSince below for the incident that forced it and for the two designs that could not be
 * built. That half refuses at exit 1 as well, because a review of the wrong tree and no review at
 * all leave a release equally unproved.
 *
 * Exit 0 one review of EACH KIND ran and no commit has landed since the first was dispatched;
 * 1 no product reviewer, or the tree moved under them; 4 no method review, advisory; 2 usage error; 3 unreadable, which now
 * also covers being unable to tell whether the tree moved.
 */

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

// Two lists, one of each required. See the header for why they cannot be one.
const PRODUCT_REVIEWERS = ['qa-tester', 'code-reviewer', 'security-reviewer', 'content-reviewer', 'mobile-qa']
const METHOD_REVIEWERS = ['doctor']
const REVIEW_ROLES = PRODUCT_REVIEWERS.concat(METHOD_REVIEWERS)

// ST-246. THE GATE DEMANDED A NAME AND NOTHING ANYWHERE PROVED THE NAME EXISTED. A product review
// renamed the single file METHOD_REVIEWERS points at and measured delta ZERO on every instrument
// in this repository. Live at the time, the studio's own install held studio-director.md and no
// doctor.md, so this tool printed "Start one of: doctor" to a machine that could not start one.
// An unperformable remedy is the S148/S177/S178 class, and the method half being advisory since
// f342f07 made the gate silent as well as dead: nothing distinguished "no doctor exists" from
// "nobody asked for one".
//
// THIS REPORTS AND NEVER REFUSES, AND THAT IS THE WHOLE DESIGN. base/agents is repo-internal, so a
// disagreement with it is a defect and the PowerShell suite refuses on it. This directory belongs
// to the USER: they may run the method with no roster, or with one they wrote. Refusing on a state
// a reader cannot be wrong about is the lockout class this project keeps shipping, so a roster
// that holds none of these names is CANNOT TELL and says nothing at all (S189).
//
// It reads the frontmatter name rather than the filename, because the frontmatter name is what a
// session can actually dispatch. A file renamed with its frontmatter left alone registers under
// the old name and would pass a filename check while staying unreachable.
function installedRoster (root, home) {
  // The project's own roster wins where it exists, because that is the one a session in that
  // project loads. The studio itself has none, which is why it falls through to the global one.
  const dirs = [path.join(root, '.claude', 'agents'), path.join(home, '.claude', 'agents')]
  for (const dir of dirs) {
    let files
    try { files = fs.readdirSync(dir).filter(f => /\.md$/i.test(f)) } catch (e) { continue }
    if (!files.length) continue
    const names = []
    for (const f of files) {
      let text
      try { text = fs.readFileSync(path.join(dir, f), 'utf8') } catch (e) { continue }
      const m = /^name:[ \t]*([a-z0-9-]+)[ \t]*$/m.exec(text)
      if (m) names.push(m[1])
    }
    return { dir: dir, names: names }
  }
  return { dir: null, names: [] }
}

const DISPATCH_TOOLS = ['Agent', 'Task']

// THE METHOD REVIEWER IS ALSO AN ERRAND RUNNER, AND ONE NAME CANNOT BE BOTH.
// Detection here is by agent NAME. That was sound while the method role was dispatched for
// exactly one purpose. The board's focus rule gives it a second job, reporting in-flight breaches,
// and the moment it has two, a session that started it only for the errand satisfies the method
// half of this gate without a method review having happened. That is S143's defect arriving from
// the other direction: not a list widened, but a name that stopped meaning one thing.
//
// SO A DOCTOR DISPATCH COUNTS AS A METHOD REVIEW ONLY WHEN ITS PROMPT SAYS SO. The marker is
// required on the REVIEW rather than on the errand, deliberately, because the two directions fail
// in opposite ways. Marking the errand fails OPEN: a forgotten marker on a WIP dispatch clears the
// gate, which is exactly the hole this is closing. Marking the review fails CLOSED: a forgotten
// marker refuses a release, and the reader clears it by putting three words in the prompt, which
// the refusal prints. S148 -- a red row a reader can clear with one documented command is not a
// lockout.
//
// WHAT THIS PROVES AND WHAT IT STILL DOES NOT. It proves the dispatch was FOR a method review
// rather than for an errand. It cannot prove the doctor reviewed anything, and never could:
// this check has only ever proved that agents were started. Declared intent is strictly more
// than a name, and strictly less than a verdict, and a reader who takes it for a verdict has
// over-read it: the gate stays green whatever the review comes back with.
//
// A SUBSTRING MATCH CANNOT TELL A MENTION FROM AN ASK, WHICH IS HOW THE FIRST VERSION OF THIS
// REOPENED THE HOLE IT CLOSED. Found by the method reviewer this was built for, against the
// exported pattern: "This is an errand, NOT a method review", "not for a method review" and "Do
// not do a method review" ALL counted as a method review. The more conscientious the author, the
// more likely they tripped it, because a careful errand prompt disclaims itself and the
// disclaimer cleared the gate.
//
// SO THE MARKER HAS TO BE THE ASK RATHER THAN A WORD IN THE TEXT. Two conditions, both cheap to
// read: it appears in the FIRST LINE, which is where a prompt says what it is for, and nothing
// negates it before it does. Both fail closed, and the refusal names both, so a genuine review
// worded around the rule is a red row cleared by rewording one line (S148) rather than a lockout.
const METHOD_REVIEW_MARKER = /method review/i
// Deliberately a short list of plain negators rather than a grammar. It only has to read the text
// standing BEFORE the marker on ONE line, and over-matching costs a clearable refusal while
// under-matching costs the gate.
const NEGATED_BEFORE = /\b(not|no|never|n't|instead|rather|without|skip)\b/i

function asksForMethodReview (prompt) {
  if (typeof prompt !== 'string' || !prompt) return false
  const firstLine = prompt.split(/\r?\n/)[0]
  const m = firstLine.match(METHOD_REVIEW_MARKER)
  if (!m) return false
  return !NEGATED_BEFORE.test(firstLine.slice(0, m.index))
}

// A REVIEW IS ONLY EVIDENCE ABOUT THE TREE IT READ, AND NOTHING USED TO CHECK WHICH TREE THAT WAS.
// This check proved two reviewers were STARTED and said nothing about when. Measured live on
// 2026-09-10: two gates were dispatched at 07:52 against HEAD 7cdaeb9, a SECOND CLAUDE SESSION
// committed 2533fdd into the same repository at 07:59:23 while both were still reading, and the
// release was then one command away from publishing a tree neither reviewer had seen. Four files
// moved, two of them the source and the tests of a release-set instrument, and one of them
// CHANGELOG.md, which the publish reads. Nothing anywhere reported it. It was found by a human
// reading git log by hand, which is the definition of a control that does not exist.
//
// WHY THE WINDOW STARTS AT DISPATCH AND ENDS NOW, RATHER THAN WHEN THE REVIEWER FINISHED. The
// tighter window is the honest one and it cannot be built: a background agent's tool_result lands
// 55 milliseconds after the dispatch, carrying the LAUNCH acknowledgement, and its completion
// arrives by a route the transcript does not record in any form this can read. Measured before
// this was written rather than assumed. So the end of the window is the moment this runs.
//
// THAT MAKES THE RULE STRICTER THAN "NOBODY WROTE DURING THE REVIEW", AND THE STRICTER RULE IS THE
// ONE WORTH HAVING: the reviewers who certify a release must have been dispatched after the last
// commit. A session that commits and then releases on a review older than the commit has reviewed
// something else. It fails CLOSED, and the remedy is one line the refusal prints: dispatch them
// again. S148, a red row a reader clears with a documented command is not a lockout.
//
// IT DELIBERATELY DOES NOT ASK WHOSE COMMIT IT IS, AND THAT IS NOT LAZINESS. The obvious design
// reads the Claude-Session trailer and forgives the session's own commits. It cannot be built
// either: the trailer is "session_01QG..." and the id this check can read from the transcript is
// a UUID, "3c6aaa81-...". They are different identifier spaces with no mapping on this machine,
// verified rather than assumed. Two further facts killed it even if they had matched. One id was
// found spanning 80 commits across four days, so it is not a per-sitting identifier and cannot
// separate a concurrent write from yesterday's sitting; and 76 of 377 commits carry no trailer at
// all, so absence would have to mean guilt. Attribution is the wrong question anyway: committing
// during your own review is the same defect as somebody else doing it.
function commitsSince (root, iso) {
  const r = spawnSync('git', ['-C', root, 'log', '--since=' + iso, '--format=%h|%cI|%s'],
    { encoding: 'utf8', windowsHide: true })
  if (r.error || r.status !== 0) return { why: 'git could not be read here: ' + ((r.error && r.error.message) || String(r.stderr || '').trim() || 'exit ' + r.status) }
  const out = String(r.stdout || '').trim()
  // NO EARLY RETURN FOR EMPTY OUTPUT, DELIBERATELY. There was one, and it made the guard below it
  // unreachable: an empty string never got as far as the field check, so the coverage tool
  // reported BOTH lines silent, one because it was redundant and the other because the redundant
  // one shadowed it. Splitting an empty string yields a single empty field, which the length test
  // discards, so the two lines were doing one job and only one of them needed to exist. Removing
  // this made the other load bearing: delete the length test now and an empty window produces one
  // commit with no hash, which refuses a release that nothing was wrong with.
  const commits = []
  for (const line of out.split(/\r?\n/)) {
    const bits = line.split('|')
    if (bits.length < 2) continue
    commits.push({ hash: bits[0], at: bits[1], subject: bits.slice(2).join('|') })
  }
  return { commits: commits }
}

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

/**
 * WHICH SESSION IS THIS, ASKED RATHER THAN GUESSED.
 *
 * Ranking by modification time, which is what this used to do, takes the newest of every
 * transcript in the project directory, and this machine holds 54 of them. Those are not all this session's history: they include
 * PEER SESSIONS working in the same repository. A peer appending while the check runs is then
 * selected in preference to the session being measured, and the check reports somebody else's
 * conduct as this one's. That is not hypothetical here -- a peer session has committed into
 * this repository in four of the last four sittings.
 *
 * THE HOST ALREADY KNOWS THE ANSWER. CLAUDE_CODE_SESSION_ID is set in this environment and is
 * EXACTLY the transcript basename, verified by listing the file it names.
 *
 * AND THERE IS NO FALLBACK TO THE NEWEST FILE, DELIBERATELY, because that IS the defect. A check
 * that cannot identify its own session says CANNOT TELL, which is exit 3 and carries advisory:
 * [3] on all three rows that call it, so it degrades to an advisory row rather than to a
 * refusal a reader cannot clear (S133, S151, S177). Handing back a verdict about an unknown
 * agent would be worse than handing back nothing, because it reads like an answer.
 */
function sessionTranscript (files, env) {
  const id = String(((env || process.env).CLAUDE_CODE_SESSION_ID) || '')
  if (!id) {
    return { why: 'CLAUDE_CODE_SESSION_ID is not set, so which of these ' + files.length
      + ' transcript(s) belongs to this session cannot be established. It is deliberately NOT '
      + 'guessed from the newest file: the newest is whichever session wrote last, which during '
      + 'a review, or beside a peer session working in the same repository, is not this one.' }
  }
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    return { why: 'CLAUDE_CODE_SESSION_ID is set to something that is not a session id, so no '
      + 'transcript can be named from it safely.' }
  }
  const want = id + '.jsonl'
  for (const f of files) {
    if (path.basename(f) === want) return { file: f }
  }
  return { why: 'CLAUDE_CODE_SESSION_ID names session ' + id + ', and no transcript called '
    + want + ' is in this project directory. This session is being measured somewhere its '
    + 'transcript is not, so no verdict is offered rather than one about another session.' }
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
      const prompt = block.input && block.input.prompt
      if (typeof role === 'string' && role) {
        found.push({ role: role, at: rec.timestamp || '', prompt: typeof prompt === 'string' ? prompt : '' })
      }
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

  // ST-246. CARRIED, NEVER RETURNED ON, AND PRINTED HERE SO IT SURVIVES EVERY EXIT BELOW. A
  // reviewer proved that returning early from this function skips the guards under it, which is
  // how a product review with a later commit once reached a green gate (S192). It is also the
  // most useful line to print on the refusal paths: a session told NO REVIEW RAN needs to know
  // first whether the reviewer it was about to start exists at all.
  let rosterAdvisory = 0
  const roster = installedRoster(root, home)
  const absentRoles = roster.names.length
    ? REVIEW_ROLES.filter(n => roster.names.indexOf(n) === -1)
    : []
  // Some but not all. A roster holding NONE of these names is somebody else's roster, or none at
  // all, and this tool has nothing to say about it.
  if (absentRoles.length && absentRoles.length < REVIEW_ROLES.length) {
    process.stdout.write('  THE INSTALLED ROSTER CANNOT DISPATCH ' + absentRoles.length +
      ' REVIEWER(S) THIS GATE DEMANDS: ' + absentRoles.join(', ') + '.\n')
    process.stdout.write('  Installed at: ' + roster.dir + '\n')
    process.stdout.write('  So any remedy below naming one of those is unperformable, and a\n')
    process.stdout.write('  release can never satisfy that half however many times it is run.\n')
    process.stdout.write('  Run studio.ps1 -Sync to install what base/agents defines.\n')
    // 4, advisory. The install is the user's own directory and this tool does not get to refuse
    // over its contents. base/agents is where a disagreement is a defect, and the suite refuses
    // on that one.
    rosterAdvisory = 4
  }

  const t = transcriptsFor(root, home)
  if (t.why) {
    // It prints where it looked, because the derivation is the thing most likely to be wrong
    // and a reader cannot check it without the path.
    process.stdout.write('  CANNOT TELL. ' + t.why + '.\n')
    process.stdout.write('  Looked in: ' + t.dir + '\n')
    return 3
  }

  const pick = sessionTranscript(t.files)
  if (pick.why) {
    process.stdout.write('  CANNOT TELL. ' + pick.why + '\n')
    process.stdout.write('  Looked in: ' + t.dir + '\n')
    return 3
  }
  const file = pick.file

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
    for (const k of Object.keys(all).sort()) {
      // A COUNT ALONE STOPPED BEING AN ANSWER THE MOMENT THE NAME HAD TWO JOBS. A bare count against
      // the method role reads as a review and may be an errand, and this is the one command a person
      // runs to find out what a session started. So that role is broken down and the other five are
      // not, because for them the name is still the whole answer.
      const qualifies = METHOD_REVIEWERS.indexOf(k) !== -1
        ? r.found.filter(d => d.role === k && asksForMethodReview(d.prompt)).length
        : null
      say('  ' + String(all[k]).padStart(4) + '  ' + k +
        (qualifies === null ? '' : '   (' + qualifies + ' asked for a method review, ' +
          (all[k] - qualifies) + ' errand)'))
    }
  }

  if (!reviews.length) {
    process.stdout.write('  NO REVIEW RAN in this session. ' + r.found.length + ' agent(s) started, none of them a reviewer.\n')
    process.stdout.write('  A reviewer is one of: ' + REVIEW_ROLES.join(', ') + '.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    return 1
  }

  const product = reviews.filter(d => PRODUCT_REVIEWERS.indexOf(d.role) !== -1)
  // Named the method role AND asked it for a method review. See METHOD_REVIEW_MARKER.
  const methodDispatched = reviews.filter(d => METHOD_REVIEWERS.indexOf(d.role) !== -1)
  const method = methodDispatched.filter(d => asksForMethodReview(d.prompt))

  if (!product.length) {
    process.stdout.write('  NO PRODUCT REVIEW RAN in this session. Started: ' + names + '.\n')
    process.stdout.write('  The METHOD was reviewed and the WORK was not. Start one of: ' + PRODUCT_REVIEWERS.join(', ') + '.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    return 1
  }

  // TWO DIFFERENT MISSES, TWO DIFFERENT MESSAGES. Telling someone to start a doctor they can
  // see they already started sends them looking for a defect in the tool. The errand case is the
  // one this split exists for and it names its own remedy.
  // Carried to the end rather than returned on, so the TREE half below still runs. A reviewer
  // found that returning here skipped it, which meant a product review with a commit landing
  // after it reached a GREEN gate. 4 is what the runner reads as advisory.
  let methodAdvisory = 0
  if (!method.length && methodDispatched.length) {
    process.stdout.write('  NO METHOD REVIEW RAN in this session, though ' + METHOD_REVIEWERS.join('/') +
      ' was started ' + methodDispatched.length + ' time(s).\n')
    process.stdout.write('  Every one of those was an ERRAND: no prompt asked for a method review, so none of\n')
    process.stdout.write('  them counts as one. Dispatching the doctor to report a breach is not a review of\n')
    process.stdout.write('  the method, and one name cannot stand for both.\n')
    process.stdout.write('  Open the FIRST LINE of that prompt with what you are asking for: "method review".\n')
    process.stdout.write('  Mentioning it further down, or after a "not", is how an errand disclaiming\n')
    process.stdout.write('  itself used to clear this gate. The ask has to BE the first line.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    // 4, not 1, and carried rather than returned: the method review reports and never blocks a
    // release, and the finding goes on a ticket. The PRODUCT half above still refuses at 1,
    // and the TREE half below still has to be asked before this can be answered.
    methodAdvisory = 4
  } else if (!method.length) {
    process.stdout.write('  NO METHOD REVIEW RAN in this session. Started: ' + names + '.\n')
    process.stdout.write('  The WORK was reviewed and the METHOD was not. Start one of: ' + METHOD_REVIEWERS.join(', ') +
      ', and open its prompt with "method review".\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    // 4, not 1, and carried rather than returned. See the sibling above.
    methodAdvisory = 4
  }

  // THE TREE HALF. Both kinds of reviewer were started; the question left is whether what they
  // read is still what is about to ship. See commitsSince for why the window is what it is.
  // A STAMP THAT CANNOT BE PARSED IS NOT A STAMP, AND TREATING IT AS ONE WAS A GREEN RELEASE GATE
  // OVER A WINDOW NOBODY LOOKED AT. The first version filtered on the field being truthy, so a
  // malformed timestamp went straight into git log --since, which ACCEPTS anything it cannot read
  // and quietly treats it as now. Measured: a dispatch stamped "not-a-date" with a real commit
  // after it returned exit 0, printing that no commit had landed. The unreadable case is the same
  // state as the absent one and now takes the same branch.
  const usable = d => !!d.at && Number.isFinite(Date.parse(d.at))
  const productStamped = product.filter(usable)
  const methodStamped = method.filter(usable)
  // With the method half advisory, the PRODUCT reviewer is what certifies the tree on its own,
  // so an absent method stamp must not turn the tree question into a cannot-tell.
  if (!productStamped.length || (!methodAdvisory && !methodStamped.length)) {
    say('  ' + reviews.length + ' review agent(s) started in this session: ' + names)
    process.stdout.write('  CANNOT TELL whether the tree moved under them: no dispatch of each kind\n')
    process.stdout.write('  carries a timestamp that can be read as a date.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    return 3
  }
  // THE WINDOW STARTS AT THE LATEST OF EACH KIND, NOT THE EARLIEST OF ALL, AND THE FIRST VERSION
  // OF THIS WAS A LOCKOUT WITH A REMEDY THAT DID NOT WORK. It took the earliest qualifying dispatch
  // in the session. A transcript is append-only, so that moment is fixed as soon as the first
  // reviewer starts, and re-dispatching, which is the remedy this very check prints, adds a later
  // entry and cannot move it. So a session that reviewed, committed a fix and reviewed again stayed
  // red for the rest of its life with nothing it could do. Proved by a reviewer who performed the
  // printed remedy and watched the refusal stand.
  //
  // A release needs ONE OF EACH KIND, so the pair that certifies it is the LATEST product reviewer
  // and the LATEST method reviewer, and the window opens at the earlier of those two: both of them
  // have to have started after the last commit. Re-dispatching now moves the window, which is what
  // makes the remedy true. Sorted numerically through Date.parse rather than as strings, because
  // two stamps in different formats compare as text in an order that has nothing to do with time.
  const latestOf = list => list.map(d => Date.parse(d.at)).sort((a, b) => a - b).pop()
  const opensAt = methodAdvisory
    ? latestOf(productStamped)
    : Math.min(latestOf(productStamped), latestOf(methodStamped))
  const earliest = new Date(opensAt).toISOString()
  const since = commitsSince(root, earliest)
  if (since.why) {
    say('  ' + reviews.length + ' review agent(s) started in this session: ' + names)
    process.stdout.write('  CANNOT TELL whether the tree moved under them. ' + since.why + '.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    return 3
  }
  if (since.commits.length) {
    process.stdout.write('  THE TREE MOVED AFTER THE REVIEW STARTED. ' + since.commits.length +
      ' commit(s) landed since the latest qualifying reviewer was dispatched at ' + earliest + '.\n')
    for (const c of since.commits) {
      process.stdout.write('    ' + c.hash + '  ' + c.at + '  ' + c.subject + '\n')
    }
    process.stdout.write('  Whoever made them, the reviewers read a tree that is not the one about to ship,\n')
    process.stdout.write('  so their verdicts are evidence about something else. This is not an accusation:\n')
    process.stdout.write('  a session committing its own work after dispatching its reviewers lands here too.\n')
    process.stdout.write('  Dispatch the reviewers again, after the last commit, and run this again.\n')
    process.stdout.write('  Session: ' + path.basename(file) + '\n')
    return 1
  }

  say('  ' + reviews.length + ' review agent(s) started in this session: ' + names)
  say('  No commit has landed since the first was dispatched at ' + earliest + '.')
  say('  It proves they were started, never that they passed. Session: ' + path.basename(file))
  // 0 clean, or 4 when the tree held but no method review ran. The tree half has been asked
  // either way, which is the whole point of carrying the miss down here.
  // Either miss is advisory and both have already printed. || rather than a sum, because the
  // runner reads a code and not a tally, and 4 is the one code it treats as a notice.
  return methodAdvisory || rosterAdvisory
}

if (require.main === module) process.exit(main(process.argv.slice(2)))

module.exports = { main, projectDirName, sessionTranscript, REVIEW_ROLES, PRODUCT_REVIEWERS, METHOD_REVIEWERS, DISPATCH_TOOLS, dispatchesIn, METHOD_REVIEW_MARKER, asksForMethodReview, commitsSince }
