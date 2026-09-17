#!/usr/bin/env node
/**
 * board.js -- the Roadmap Actions Kanban. A board that ENFORCES its rules rather than
 * describing them, kept in your own repository.
 *
 * WHAT IT IS. One JSON file per ticket, in a directory, in the repository you already have.
 * No database, no network, no credentials, no account to create. A project needs a git
 * repository and nothing else. Git is the durable store, so the board is versioned, diffable
 * and reviewable exactly like the work it tracks, and a ticket's history is a real history.
 *
 * WHAT MAKES IT DIFFERENT IS THAT THE RULES REFUSE. Only qa-tester moves a ticket to UAT, and
 * only with test notes written first. A ticket cannot be closed over a decision nobody
 * answered. A question put to the founder must carry numbered options, a recommendation naming
 * one of them, and an escape. Work in progress has a ceiling. Every one of those is a refusal in
 * this file rather than a paragraph somebody is trusted to remember, because a rule nobody can
 * break is the only kind that survives a bad afternoon.
 *
 * AND ONE RULE THAT IS NOT A REFUSAL HERE, WHICH THIS COMMENT USED TO CLAIM IT WAS. The decision
 * has to reach the founder through the host's interactive prompt, so they answer by CLICKING, and
 * this file cannot see a prompt: it reads its own JSON and never a session transcript. What
 * measures the click is tools/check-decision-shape.js in the studio repository, which does not
 * ship with this board. So the board records the SHAPE of a decision and enforces that; whether
 * the question was put by clicking is real, is the CEO's own top rule, and is measured somewhere
 * else. Listing it above sold a reader a guarantee they did not receive, which is worse than
 * omitting it, because the reader stops looking for the instrument. ST-254.
 *
 * ONE INITIATIVE AT A TIME, AND THE WORK IN FLIGHT BELONGS TO IT. A small can be put UNDER a
 * large, and that relation is enforced rather than described: one large in progress; while it is
 * in flight every small starting must belong to it; a large cannot be marked done while its work
 * is still open; and dropping an initiative moves it and everything under it out together, as one
 * command with a journal behind it.
 *
 * WHY A RELATION AND NOT A SMALLER NUMBER. The ceiling was a COUNT, and a count cannot tell a
 * small that FINISHES an initiative from one that STARTS a fourth. Measured before any of this was
 * built: 71 of 74 starts finished without being sent back, median 0.07 days in progress, and the
 * ceiling had been reached ONCE in the board's life -- so starting was never the defect. The board
 * still reached 90 backlog items, 73 of which named their initiative in prose that nothing could
 * read. Tightening the count would have changed none of that.
 *
 * SINGLE WRITER, DECLARED RATHER THAN ENFORCED. Ticket mutations happen on ONE branch. Two
 * branches can both compute the next ticket number, both write a different filename, and git
 * will merge them without a conflict, so the collision is silent. `doctor` detects a duplicate
 * after the fact; nothing here prevents one. If you ever need parallel writers, renumber the
 * collision and leave a forwarding record rather than reusing a number.
 *
 * A VISUAL VERSION on the web is a per-project decision a founder makes, not an upgrade and
 * not a better tier. The board in your repository is the one every project starts with.
 *
 *   node board.js init <slug> [--assignees a,b,c]
 *   node board.js add "<title>" --desc "..." [--size large|small] [--assignee X] [--under <ref>]
 *   node board.js under <ref> --under <ref>|none --by <role>
 *   node board.js evict <ref> --reason "..." --by <role>     drop an initiative and its work
 *   node board.js evict --rollback --by <role>               undo an eviction that did not finish
 *   node board.js list [column]              node board.js show <ref>
 *   node board.js move <ref> <column> --by <role> [--notes "..."]
 *   node board.js assign <ref> <name>|none --by <role>
 *   node board.js rank <ref> --top|--bottom|--before <ref>|--after <ref> --by <role>
 *   node board.js assess <ref> --verdict build|kill|park --measure "..." --by <role>
 *   node board.js note <ref> "<text>" --by <role>
 *   node board.js ask <ref> "<question>" --options "a|b|c" --recommend N --by <role>
 *   node board.js answer <ref> <n> [--decision <key>] [--note "..."]
 *   node board.js close <ref> --as done|parked|killed --reason "..." --by <role>
 *   node board.js reopen <ref> --reason "..." --by <role>   (parked/killed only)
 *   node board.js delete <ref> --by <role>   (soft, recoverable)
 *   node board.js restore <ref> --by <role>       node board.js deleted
 *   node board.js wip          node board.js audit          node board.js doctor
 */
'use strict';

const fs = require('fs');
const path = require('path');

// WHERE THE BOARD LIVES, and why this is no longer simply __dirname.
//
// This program used to root itself at its own directory, so the PROGRAM and a project's
// TICKETS were the same folder by construction. That is what blocked publishing it at all.
// An objection raised when this file was first assessed: promoting board.js turns the studio's own
// working queue into a published artefact, and with the publish step staging the whole tree, a project's
// private tickets are one command from a public export. No exclusion rule could fix it, because
// there was nothing to exclude -- publishing the program meant publishing the folder the
// tickets sat in.
//
// The order matters and each rule earns its place:
//   1. BOARD_HOME, explicit, always wins. A test points at a sandbox with it, which is stronger
//      isolation than copying the program somewhere and hoping it writes nowhere else.
//   2. A project.json sitting NEXT TO the program is a board from before this split. The
//      studio's own tickets are exactly that, so they keep working with no migration. A
//      published copy ships no project.json, so this rule is inert for every project.
//   3. A .board directory found by walking up from the working directory, the way git finds a
//      repository. This is what a project gets.
//   4. Otherwise .board in the working directory, so init creates the board in the PROJECT
//      rather than inside the installed program.
//
// Rule 2 sits deliberately ahead of rule 3. The other order would let a stray .board anywhere
// above this directory silently retarget an existing board's tickets, and silently retargeting
// a record is the failure this studio has written down more often than any other.
function resolveRoot() {
  if (process.env.BOARD_HOME) return path.resolve(process.env.BOARD_HOME);
  if (fs.existsSync(path.join(__dirname, 'project.json'))) return __dirname;
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, '.board', 'project.json'))) return path.join(dir, '.board');
    // THE WALK STOPS AT A REPOSITORY BOUNDARY. Without one it climbed to the filesystem
    // root, and a reviewer showed the consequence: board.test.js runs init with BOARD_HOME
    // deleted from inside a temp directory, so on a machine with a .board above that
    // directory a clean TEST RUN would resolve and write to a real board. A board belongs
    // to a repository, so that is where looking for one ends.
    if (fs.existsSync(path.join(dir, '.git'))) break;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return path.join(process.cwd(), '.board');
}

const ROOT = resolveRoot();
const TICKETS = path.join(ROOT, 'tickets');
const PROJECT = path.join(ROOT, 'project.json');

// The board's columns, in order. `parked` and `killed` are terminal alongside `done`, because
// S27 says everything started ends explicitly and "ended" is not a synonym for "finished".
const COLUMNS = ['backlog', 'todo', 'in_progress', 'uat', 'uat_complete', 'prod_ready', 'prod_deployed', 'done'];
const TERMINAL = ['done', 'parked', 'killed'];
// A front-door verdict. KILL is not a failure of the process, it is the process working.
const VERDICTS = ['build', 'kill', 'park'];

// S27's ceiling. Large is more than one session or more than one discipline.
//
// ONE LARGE, NOT TWO. The founder, in their own words: "2 large and 3 smalls is if they are
// all unrelated. we should work on only 1 large and all other tickest should be related to that
// large. assess that and finish that work and finish. no parallel work." The old pair was
// calibrated for work that has nothing to do with itself; once the smalls in flight must belong
// to the large in flight, two larges is two initiatives and that is the parallel work the rule
// forbids.
//
// THE SMALL CAP DID NOT MOVE, AND THAT IS DELIBERATE. Three was never the complaint and S164
// measured that starting was never the defect: 71 of 74 starts finished without being sent back,
// median 0.07 days in progress, and this ceiling had been reached ONCE in the board's life. What
// the CEO asked for is the RELATION and one large. Loosening the small cap because the smalls are
// now related, or tightening it because focus sounds like a smaller number, would both be changes
// nobody asked for, made on the same day the relation arrives, so neither could be attributed.
const CEILING = { large: 1, small: 3 };

// ---- the relation ------------------------------------------------------------------------
//
// WHY A FIELD AND NOT A CONVENTION. 73 of the 91 backlog tickets already name another ST- ref in
// their own description, and nothing can read a word of it. A relation written in prose is a
// relation no refusal can enforce and no audit can count, which is how the board came to hold 90
// backlog items with no way to tell a small that FINISHES an initiative from one that STARTS a
// fourth.
//
// NO MIGRATION. save() round-trips keys it does not know, so a ticket with no parent is a ticket
// whose parent is absent, and 195 existing tickets need nothing done to them.
function parentOf(t) { return (t && typeof t.parent === 'string' && t.parent) ? t.parent : null; }

function childrenOf(ref, all) {
  return (all || allTickets()).filter(x => parentOf(x) === ref);
}

// A cycle is unreachable through `add` alone -- a new ticket has no children yet -- and reachable
// the moment an EXISTING ticket can be re-parented. Guarding only self-parenting would catch the
// one-step case and let A -> B -> A through, and every walker on this board (children, eviction,
// the audit) would then run until the stack gave out. The seen-set is what makes the walk
// terminate, and it is asserted by a fixture rather than argued for here: S156 says an assertion
// that a process was not KILLED cannot tell a crash from a finding, because both exit 1.
function ancestorsOf(ref, all) {
  const byRef = {};
  for (const x of all) byRef[x.ref] = x;
  const chain = [];
  const seen = {};
  let cur = parentOf(byRef[ref]);
  while (cur && !seen[cur]) {
    seen[cur] = true;
    chain.push(cur);
    cur = parentOf(byRef[cur]);
  }
  return chain;
}

// THE RELATION IS TWO LEVELS AND STOPS THERE. A small belongs to a large; a large belongs to
// nothing. The CEO asked for one initiative with its work under it, not a tree, and a tree is the
// thing that would need a depth rule, a rollup rule and an eviction that recurses.
//
// AND THAT IS WHY THERE IS NO SEPARATE SELF-PARENT REFUSAL, WHICH THE TICKET ASKED FOR. Stated
// plainly rather than shipped as a line nothing can reach: a ticket has ONE size, only a small may
// carry a parent, and only a large may be one, so `--under` pointing at the ticket itself is
// already refused by whichever of those two fires first. A third refusal underneath them would be
// dead code with a confident comment beside it, which is precisely the defect S168 was written for
// last sitting. The BEHAVIOUR is asserted -- self-parenting is refused, and the fixture says so --
// while the SITE is not duplicated.
//
// THE CYCLE GUARD IS A DIFFERENT MATTER AND IS LOAD BEARING, because ancestorsOf walks what is on
// DISK rather than what these refusals let through. Ticket files are hand-edited, merged and
// corrupted here -- `doctor` exists for exactly that -- so a pair of files pointing at each other
// is a reachable state that no command surface owns. Without the seen-set that walk recurses until
// node throws, and node exits 1 on an uncaught throw while this tool exits 1 on a finding, so the
// crash would read as a refusal (S156). It is fixtured by writing the two files directly.
function requireParentable(t, parentRef, all) {
  if (t.size !== 'small')
    die('only a small ticket can be put under a large. ' + t.ref + ' is ' + t.size + '.\n' +
        '       An initiative does not belong to another initiative. If two larges are really one\n' +
        '       piece of work, they are one ticket; if they are not, they are two initiatives and\n' +
        '       ST-196 exists to stop both being in flight.');
  const p = all.filter(x => x.ref === String(parentRef).toUpperCase())[0];
  if (!p) die('no ticket ' + parentRef + ' to put ' + t.ref + ' under.');
  if (p.size !== 'large')
    die(p.ref + ' is small, so nothing can be put under it. --under names the LARGE this work\n' +
        '       belongs to. A small that needs smalls under it is a large that was sized wrong.');
  if (TERMINAL.includes(p.status))
    die(p.ref + ' is ' + p.status + ', so ' + t.ref + ' cannot be put under it.\n' +
        '       Work does not join an initiative that has already ended. Reopen ' + p.ref +
        ' deliberately, or\n       raise this against the initiative that is actually live.');
  return p;
}

// S69. A gate that cannot count its own overrules cannot tell working from ignored, and this one
// could not record a single one: the ceiling was a constant with no override path, so the only
// ways past it were to hand-edit a ticket file or to work off the board, neither of which leaves
// a trace. The ledger is COMMITTED beside the tickets because a machine-local file would be
// appended to by every session, conflict on every push, and differ on every machine.
const OVERRIDES = path.join(ROOT, 'overrides.json');

// ---- the journal, which is the only reason eviction can be called atomic --------------------
//
// EVICTING AN INITIATIVE TOUCHES MANY FILES AND THERE IS NO TRANSACTION HERE. A database gives
// all-or-nothing for free; a directory of JSON files gives nothing. Half an eviction is the worst
// state this board can be in: a large back in backlog with three of its smalls still in progress
// looks exactly like a board where somebody started unrelated work, and every refusal downstream
// would then be reasoning from it.
//
// SO THE INTENT IS WRITTEN DOWN BEFORE ANY TICKET MOVES. The journal holds each ref and the status
// it had, flushed to disk first. If a write then fails, the journal is what puts them back. If the
// process dies outright, the journal is still there, and the next command finds it -- which is the
// DETECTOR, and the reason this is one command rather than a sequence somebody is trusted to
// finish.
//
// WHAT IT DOES NOT CLAIM. This is not durability against a disk that lies about flushing, and it
// is not isolation: two evictions at once are not defended against, because there is one operator
// on this board and inventing a lock would be a control with nothing to point at. It is
// all-or-nothing against the failures that actually happen here -- a refusal part way through, a
// crash, a session killed mid-write.
const JOURNAL = path.join(ROOT, 'evict.journal.json');

function readJournal() {
  if (!fs.existsSync(JOURNAL)) return null;
  try { return JSON.parse(fs.readFileSync(JOURNAL, 'utf8')); }
  catch (e) {
    // ABSENT and CORRUPT are different answers, exactly as for the override ledger. A corrupt
    // journal read as absent would let the next command carry on over a half-evicted board.
    return { corrupt: e.message };
  }
}

// ABSENT and CORRUPT are different answers and must never be the same one. Swallowed, the parse
// error made a damaged ledger read as no history, so the refusal reported nothing had ever been
// waved through and the next override REPLACED the file. A record of overrides cannot survive that.
function readOverrides(gate) {
  if (!fs.existsSync(OVERRIDES)) return [];
  let all;
  try { all = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')); }
  catch (e) {
    die('the override ledger is unreadable: ' + OVERRIDES + '\n' +
        '       ' + e.message + '\n' +
        '       Refusing rather than treating it as empty. Reading it as empty would report no\n' +
        '       history and the next override would overwrite the file. Restore it from git.');
  }
  if (!Array.isArray(all))
    die('the override ledger is not a JSON array: ' + OVERRIDES + '\n' +
        '       Restore it from git rather than letting the next override replace it.');
  return gate ? all.filter(o => o && o.gate === gate) : all;
}

// S69's escalation, on the CEO's ruling that the unit is OVERRIDES and not sessions: this program
// has no session identity, and a proxy for one would be a different rule wearing the CEO's name.
// Three inside the window is habitual rather than exceptional. The window is a number to tune.
//
// It was written as "three of the LAST FIVE" and the qualifier was removed after a mutation
// replacing the last five with the whole ledger changed nothing at all. Entries are appended in
// time order, so any three inside the window are necessarily among the last five; the clause could
// only ever bite on out-of-order data, which made it a count rather than a check.
const ESCALATE = { after: 3, withinDays: 14 };

// Measured against the BOARD's clock rather than the wall clock, so a board driven by a supplied
// time behaves the same way. An unparseable stamp counts as RECENT on purpose: the permissive
// reading would let a damaged ledger quietly disarm the one control that reads it.
function daysBefore(stamp) {
  const then = Date.parse(String(stamp).replace(' ', 'T'));
  const ref = Date.parse(String(now()).replace(' ', 'T'));
  if (isNaN(then) || isNaN(ref)) return 0;
  return (ref - then) / 86400000;
}

function recordOverride(gate, ref, by, reason) {
  const all = readOverrides();
  all.push({ at: now(), gate: gate, ref: ref, by: by, reason: reason });
  writeJson(OVERRIDES, all);
}

// ---- plumbing ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const cmd = args[0];

function flag(name, dflt) {
  const i = args.indexOf('--' + name);
  if (i === -1) return dflt;
  const v = args[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
// Positionals are everything that is not a flag and not a flag's value.
function positionals() {
  const out = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { if (args[i + 1] && !args[i + 1].startsWith('--')) i++; continue; }
    out.push(args[i]);
  }
  return out;
}
const die = m => { console.error('board: ' + m); process.exit(1); };
const ok = m => { console.log(m); };

// ---- decision keys ----------------------------------------------------------------------
// A decision needs a name you can say out loud, or answering one is a guess.
//
// `answer` used to resolve to open[open.length - 1], the most recently asked open decision,
// with no way for the caller to name a different one. On 2026-08-26 three decisions were open
// on one ticket, the CEO answered the first, and the tool filed that answer against the third and
// carried the explanatory note across with it. The false entry happened to match the option
// that had been recommended, so the record read as agreement rather than as an error, and
// nothing in the tool flagged it. That is S52: a command that resolves an ambiguous target
// silently will eventually record the wrong answer.
//
// A key is the decision's 1-based position at the time it was asked, stored on the record so
// it can never shift underneath a question already put to the CEO. Decisions are append-only,
// so position is stable, which means a key can also be derived on read for decisions asked
// before this existed. No migration, and an old ticket answers the same way as a new one.
function decisionKey(t, i) {
  return t.decisions[i].key || ('d' + (i + 1));
}
function keyedDecisions(t) {
  return t.decisions.map((d, i) => ({ d: d, key: decisionKey(t, i) }));
}
function openDecisions(t) {
  return keyedDecisions(t).filter(x => x.d.answer === null);
}

// Timestamps come from the caller so a run is reproducible and a diff is reviewable.
// Falling back to the real clock is fine for interactive use.
const now = () => (process.env.BOARD_NOW || new Date().toISOString().slice(0, 19).replace('T', ' '));

function readProject() {
  if (!fs.existsSync(PROJECT)) die('no board here (looked in ' + ROOT + '). run: node board.js init <slug>');
  // project.json is the last file read with a bare parse, and a corrupt one failed exactly
  // the way a corrupt ticket did: a stack trace naming nothing. Same guard, same diagnosis.
  return readTicketFile(PROJECT);
}
function writeJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

// Everything on disk, deleted included. Numbering MUST come from this and not from the
// filtered view below.
//
// This board reused a number within its first hour: a ticket was soft-deleted, the next `add`
// took max(num) over the visible tickets only, got the same number back, and overwrote the
// deleted ticket's file. Soft delete is supposed to mean recoverable, and it destroyed the
// record instead, silently.
//
// The infuriating part: base/board/reference/tickets-schema.sql gets this right and says why
// in a comment -- "ticket numbers are never reused, because tickets_assign_num takes max(num)
// across the project and a hidden row still holds its number". The reasoning was written down,
// published, and reimplemented wrongly anyway by someone who had read it. A comment explaining
// a subtlety does not survive a reimplementation; only a test does.
// A BOARD MUST BE ABLE TO NAME ITS OWN BROKEN FILE. One unparseable ticket used to take down
// every command -- list, show, audit, wip -- with a raw SyntaxError and a node stack trace that
// named the offending TOKEN and never the FILE. On a board of seventy tickets that tells the
// operator a board exists somewhere and one of the files in it is broken, then leaves them to
// bisect by hand. The record is the whole point of the program, so the program's failure mode
// has to be a diagnosis rather than a crash.
//
// A conflict marker is called out by name because it is the likeliest cause by a distance: two
// agents on two branches both write ticket files, git merges both without complaint, and the
// marker lands inside the JSON. It also has a known fix, which a generic parse error does not.
//
// Measured before it was written, and one detail in the ticket did not survive: this failure
// exits 1, not 0. The claim that a total board outage reads to a script as success came from
// reading an exit code through a pipe, where the shell reports the last command in the pipeline
// rather than node. The defect is narrower than recorded and is still worth fixing.
function readTicketFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    const marker = raw.split('\n').findIndex(l => /^(<{7}|={7}|>{7})/.test(l));
    die('cannot read ' + path.basename(p) + '\n' +
        '       ' + p + '\n' +
        (marker >= 0
          ? '       It carries an unresolved git conflict marker at line ' + (marker + 1) + '.\n' +
            '       Resolve the merge in that file, then run: node board.js doctor'
          : '       It is not valid JSON: ' + e.message + '\n' +
            '       Fix or remove that file, then run: node board.js doctor'));
  }
}

function allOnDisk() {
  // An empty board and NO BOARD are different answers, and list, wip and audit gave the
  // same one for both: a healthy-looking empty board wherever resolution had landed. That
  // made a wrong resolved root invisible in the three most used commands, which is half of
  // what the resolution change set out to fix.
  if (!fs.existsSync(PROJECT)) {
    die('no board here (looked in ' + ROOT + '). Run: node board.js init <slug>');
  }
  if (!fs.existsSync(TICKETS)) return [];
  return fs.readdirSync(TICKETS).filter(f => f.endsWith('.json'))
    .map(f => readTicketFile(path.join(TICKETS, f)));
}

// ---- ordering -------------------------------------------------------------------------
// The web board carries a position column, double precision, not null, default 0, and it
// indexes each column by it (tickets-schema.sql:102 and :245). This board carried no such
// field and sorted a column by ticket NUMBER, so -- take the top ticket in To Do -- named
// the OLDEST item in the column rather than the most important one. A real instruction on
// one board and an accident on the other, with nothing comparing the two. S40 in program
// form, raised at the front door when this was assessed.
//
// A ticket with NO position sorts at its own NUMBER rather than at zero, and that single
// choice is what makes this migration-free. Every existing ticket keeps exactly the order it
// already had, and because the implied positions are all distinct there is always a gap
// between any two neighbours to insert into. Defaulting to zero would have collapsed the
// whole board into one tie, and rank --before could then only have been honoured by
// renumbering every ticket in the column.
function effPos(t) {
  return (typeof t.position === 'number' && isFinite(t.position)) ? t.position : t.num;
}
function allTickets() {
  return allOnDisk().filter(t => !t.deleted_at)
    .sort((a, b) => effPos(a) - effPos(b) || a.num - b.num);
}
function ticketPath(ref) { return path.join(TICKETS, ref + '.json'); }
function findTicket(ref) {
  const p = ticketPath(String(ref).toUpperCase());
  if (!fs.existsSync(p)) die('no ticket ' + ref);
  const t = readTicketFile(p);
  if (t.deleted_at) die(ref + ' is deleted');
  return t;
}
function save(t) { t.updated_at = now(); writeJson(ticketPath(t.ref), t); }

// Every state change appends to the ticket. The ticket is the record: a decision that lives
// in a chat transcript is a decision nobody can find in six weeks.
function log(t, who, what) {
  t.history = t.history || [];
  t.history.push({ at: now(), by: who, what: what });
}

function requireBy() {
  const by = flag('by');
  if (!by || by === true) die('--by <role> is required. An unattributed board change is not auditable.');
  return by;
}

// ---- commands ---------------------------------------------------------------------------
const commands = {};

commands.init = () => {
  const slug = positionals()[0] || die('init needs a slug');
  // INIT NEVER WALKS UP, and that is not a detail. resolveRoot climbs to find an EXISTING board,
  // which is correct for every other command and destructive here. a reviewer reproduced it at the
  // gate: running init from a subdirectory of a project resolved THAT project's board and rewrote
  // its identity in place while printing success -- slug, prefix and the S18 assignee list all
  // replaced, every existing ticket orphaned from its prefix, and the next add issuing a number
  // under the new one. That is the exact failure the comment on resolveRoot claims to prevent,
  // one variant over, and rule-2 precedence does not close it.
  //
  // So init resolves an EXPLICIT location only: BOARD_HOME when set, otherwise .board in the
  // working directory. A board is created where you are standing, never where you were found.
  const root = process.env.BOARD_HOME
    ? path.resolve(process.env.BOARD_HOME)
    : path.join(process.cwd(), '.board');
  const proj = path.join(root, 'project.json');

  // And it refuses rather than overwrites. Creating a board is not a command that should ever
  // silently replace a record, whatever directory it was pointed at.
  if (fs.existsSync(proj) && flag('force', false) !== true) {
    die('a board already exists at ' + root + '\n' +
        '       Refusing to overwrite it. Its slug, prefix and permitted assignees would be\n' +
        '       replaced, and every ticket already on it would be orphaned from its prefix.\n' +
        '       Pass --force if replacing that board is genuinely what you want.');
  }

  const a = flag('assignees', '');
  // S18: declaring nothing means no restriction. A fixed list made a real 333-ticket board
  // unmigratable, so the empty state must be the permissive one.
  const assignees = (a === true || !a) ? [] : String(a).split(',').map(s => s.trim()).filter(Boolean);
  fs.mkdirSync(path.join(root, 'tickets'), { recursive: true });
  writeJson(proj, { slug: slug, prefix: slug.slice(0, 2).toUpperCase(), assignees: assignees, created_at: now() });
  ok('board "' + slug + '" ready at ' + root + '. assignees: ' + (assignees.length ? assignees.join(', ') : '(unrestricted)'));
};

commands.add = () => {
  const p = readProject();
  const title = positionals()[0] || die('add needs a title');
  const desc = flag('desc', '');
  const size = flag('size', 'small');
  const assignee = flag('assignee', null);
  const under = flag('under', null);
  if (!['large', 'small'].includes(size)) die('--size must be large or small');
  if (desc === '' || desc === true) die('--desc is required. A title is a summary; work is picked from the description.');
  if (assignee && assignee !== true && p.assignees.length && !p.assignees.includes(assignee))
    die('"' + assignee + '" is not a permitted assignee. This board allows: ' + p.assignees.join(', '));

  const num = allOnDisk().reduce((m, t) => Math.max(m, t.num), 0) + 1;
  const ref = p.prefix + '-' + String(num).padStart(3, '0');
  // The database gets this free from a primary key. Here it has to be said out loud, and it
  // is the check that would have caught the reuse above rather than reasoning about it.
  if (fs.existsSync(ticketPath(ref)))
    die('refusing to write ' + ref + ': that file already exists. Numbering is broken -- ' +
        'a ticket would be destroyed. Nothing has been written.');
  const t = {
    ref: ref, num: num, project: p.slug, title: title, description: desc, size: size,
    status: 'backlog', assignee: (assignee && assignee !== true) ? assignee : null,
    parent: null,
    test_notes: null, decisions: [], history: [], created_at: now(), updated_at: now(), deleted_at: null,
  };
  // VALIDATED BEFORE THE FILE IS WRITTEN. A ticket created and then refused leaves a number burnt
  // and an orphan on disk, and the next `add` would carry on from the higher number as though
  // nothing happened.
  if (under && under !== true) {
    const parent = requireParentable(t, under, allTickets());
    t.parent = parent.ref;
  }
  log(t, flag('by', 'unattributed'), 'created in backlog' + (t.parent ? ' under ' + t.parent : ''));
  save(t);
  ok(ref + '  ' + title + '  [' + size + ']' + (t.parent ? '  under ' + t.parent : ''));
};

// THE FRONT DOOR, RECORDED. Large work is assessed before it starts: the team argues the idea,
// reaches a verdict, and names the one measure it is expected to move. This command does not
// RUN that assessment. It records the outcome, and the move to in_progress refuses without it,
// which is the only part a program can honestly enforce.
//
// Why a control rather than a paragraph. The process is already written down and being written
// down is exactly what has not worked: a session opens, the work is described, and building
// starts. Every rule on this board that now holds became a refusal at the point of action.
commands.assess = () => {
  const t = findTicket(positionals()[0]);
  const by = requireBy();
  const verdict = flag('verdict', '');
  const measure = flag('measure', '');
  if (!VERDICTS.includes(verdict))
    die('--verdict must be one of: ' + VERDICTS.join(', ') + '. A kill is a legitimate outcome ' +
        'and is the whole point of having a front door.');
  if (!measure || measure === true)
    die('--measure is required: what should this move, and what is that number today? An ' +
        'assessment with no measure is an opinion with a verdict attached to it.');
  t.assessment = { verdict: verdict, measure: measure, by: by, at: now() };
  log(t, by, 'assessed ' + verdict + ': ' + measure);
  save(t);
  ok(t.ref + '  assessed ' + verdict + '  by ' + by);
};

commands.move = () => {
  const pos = positionals();
  const t = findTicket(pos[0]);
  const to = pos[1] || die('move needs a target column');
  const by = requireBy();
  const notes = flag('notes', null);
  if (!COLUMNS.includes(to)) die('unknown column "' + to + '". columns: ' + COLUMNS.join(' '));
  if (TERMINAL.includes(t.status)) die(t.ref + ' is ' + t.status + '. Reopen it deliberately rather than moving it.');
  if (t.status === to) die(t.ref + ' is already in ' + to);

  // S3, the rule the whole board exists to hold: QA alone moves to UAT, and only with test
  // notes. The builder never certifies their own work. This is the one rule that cannot be
  // enforced by asking nicely, because the person breaking it is always in a hurry.
  if (to === 'uat') {
    if (by !== 'qa-tester') die('only qa-tester moves a ticket to UAT. "' + by + '" cannot certify this.\n' +
      '       The builder never self-certifies -- that is the entire point of the column.');
    if (!notes || notes === true) die('qa-tester must write test notes before UAT.\n' +
      '       Use --notes "what you tested, and what you saw". A move with no evidence is a claim.');
  }

  // S27's ceiling, enforced on the way in rather than reported after the fact.
  let pendingOverride = null;
  let pendingInitiative = null;
  if (to === 'in_progress') {
    const all = allTickets();
    const live = all.filter(x => x.status === 'in_progress' && x.ref !== t.ref);
    const n = live.filter(x => x.size === t.size).length;

    // THE FOUNDER'S RULE, AND IT RUNS BEFORE THE COUNT BECAUSE IT IS THE STRICTER TEST. A small may
    // start unparented ONLY while no large is in flight. Once a large IS in flight, every small
    // starting must belong to it, because a small that belongs to something else is the second
    // initiative the one-large ceiling exists to prevent -- and it would be invisible to a count,
    // which is exactly how the board came to hold 90 backlog items it could not group (S162).
    //
    // MEASURED BEFORE THE QUESTION WAS PUT, not after the rule was chosen: 57 small starts in this
    // board's life, 42 of them (74 per cent) with NO large in flight, including the last thirteen
    // in a row. So this refusal leaves three quarters of the work this studio has actually done
    // untouched, and fires on the 15 that are the break-context case the CEO named.
    //
    // THE ESCAPE IS THE ONE THAT ALREADY EXISTS. --override "<reason>" and the same hardening,
    // rather than a second escape with its own ledger, because two ways past one rule is a rule
    // with no count.
    // "EVERY SMALL MUST BE UNDER IT" MEANS UNDER THAT LARGE, NOT UNDER SOME LARGE. A small parented
    // to a different initiative is refused by the same rule and for the same reason as an
    // unparented one: it is the second initiative, and having a parent written on it does not make
    // it the work in flight. Reading d6 as "has a parent" would have let the whole backlog through
    // on a field nobody checked against anything.
    if (t.size === 'small') {
      const larges = live.filter(x => x.size === 'large' && x.ref !== parentOf(t));
      if (larges.length) {
        // ITS OWN FLAG, NOT THE CEILING'S. A single --override used to clear BOTH gates and burn
        // two ledger rows with the same reason and the same timestamp, so one decision advanced two
        // hardening counters and the operator was never shown the second refusal they were being
        // excused from. "Two ways past one rule is a rule with no count" was the argument for one
        // ledger; it says nothing about one way past two rules, which is the same defect mirrored.
        const why = flag('override-initiative', null);
        const prior = readOverrides('initiative');
        // ITS OWN LEDGER, NOT THE CEILING'S. The hardening counts overrides of ONE gate inside a
        // window, so pooling two gates would harden each of them on the other's history and the
        // count would stop meaning what its message says. Same shape, separate books.
        const habitual = prior.filter(o => daysBefore(o.at) <= ESCALATE.withinDays);
        if (habitual.length >= ESCALATE.after)
          die(t.ref + ' does not belong to the initiative in flight and this gate has HARDENED.\n' +
              '       ' + habitual.length + ' override(s) inside ' + ESCALATE.withinDays +
              ' days, so working outside the initiative is\n' +
              '       the habit rather than the exception, which is the point at which the count stops\n' +
              '       meaning anything. Most recent: ' + String(habitual[habitual.length - 1].at).slice(0, 10) +
              ', ' + habitual[habitual.length - 1].ref + ': ' + habitual[habitual.length - 1].reason + '\n' +
              '       No --override-initiative passes this one. Finish or evict ' + larges[0].ref + ' first.');
        if (!why || why === true || !String(why).trim()) {
          let msg = t.ref + ' ' + (parentOf(t) ? 'belongs to ' + parentOf(t) : 'belongs to no initiative') +
            ', and ' + larges.map(x => x.ref).join(', ') + ' is the one in flight.\n' +
            '       Work that does not belong to the initiative in flight is the second initiative,\n' +
            '       and finishing what we start is the whole rule. Put it under that large:\n' +
            '         node board.js under ' + t.ref + ' --under ' + larges[0].ref + ' --by <role>\n' +
            '       Or leave it in backlog until this one is finished, or evict the initiative.\n' +
            '       To override, say why: --override-initiative "<reason>". Required, and recorded.';
          if (prior.length) {
            const last = prior[prior.length - 1];
            msg += '\n       Overridden ' + prior.length + ' time(s) before, most recently ' +
                   String(last.at).slice(0, 10) + ': ' + last.reason;
          }
          die(msg);
        }
        // HELD, NOT WRITTEN YET, for S97's reason: the ledger records the act that succeeded rather
        // than the attempt. NOTHING BETWEEN HERE AND THE WRITE CAN CURRENTLY REFUSE THIS MOVE, and
        // that is said plainly because the first version of this comment claimed the front-door
        // check could, which is false: this branch only runs for a SMALL and that check only fires
        // for a LARGE. It is held anyway, so that a refusal added below cannot silently start
        // recording overrules of moves that never happened.
        pendingInitiative = { reason: String(why).trim(), larges: larges.map(x => x.ref), prior: prior.length };
      }
    }

    if (n >= CEILING[t.size]) {
      const why = flag('override', null);
      const prior = readOverrides('ceiling');
      // THE ESCALATION, AND IT REFUSES THE OVERRIDE ITSELF. A gate that can always be waved
      // through is a gate that eventually always is, which is what the budget guard became at
      // 0 for 36. The way out is deliberately NOT another override: finish or park something, or
      // let the entries age out of the window. It says both, because a refusal a reader cannot
      // clear is one they route around, and then the whole record stops meaning anything.
      const habitual = prior.filter(o => daysBefore(o.at) <= ESCALATE.withinDays);
      if (habitual.length >= ESCALATE.after) {
        die(t.size + ' work is at the ceiling and this gate has HARDENED. It will not take an override.\n' +
            '       ' + habitual.length + ' override(s) inside ' + ESCALATE.withinDays +
            ' days, so overriding is now the habit\n' +
            '       rather than the exception, which is the point at which the count stops meaning anything.\n' +
            '       Most recent: ' + String(habitual[habitual.length - 1].at).slice(0, 10) + ', ' +
            habitual[habitual.length - 1].ref + ': ' + habitual[habitual.length - 1].reason + '\n' +
            '       No --override passes this one. Finish or park something, or wait for the window.');
      }
      // Refuse ONCE, then take a reason. An override with no reason is refused as hard as none at
      // all: a reason nobody had to write is a box ticked, and the ledger would count clicks.
      if (!why || why === true || !String(why).trim()) {
        let msg = t.size + ' work in progress is already at the ceiling (' + n + '/' + CEILING[t.size] + ').\n' +
          '       In progress: ' + live.filter(x => x.size === t.size).map(x => x.ref).join(', ') + '\n' +
          '       Finish or park one before starting another. Four things at sixty per cent ship nothing.\n' +
          '       To override, say why: --override "<reason>". The reason is required and is recorded.';
        // The refusal reports its own history, so whoever decides sees how often this was waved
        // through before. Told at the moment of the decision, not in a report nobody opens.
        if (prior.length) {
          const last = prior[prior.length - 1];
          msg += '\n       Overridden ' + prior.length + ' time(s) before, most recently ' +
                 String(last.at).slice(0, 10) + ': ' + last.reason;
        }
        die(msg);
      }
      // HELD, NOT WRITTEN YET. S97: the ledger records the act that succeeded, never the attempt.
      // Written here it fired before the front door below, so an override on an unassessed ticket
      // left an entry with the ticket unmoved, and a count of attempts cannot carry escalation.
      pendingOverride = { reason: String(why).trim(), at: n, prior: prior.length };
    }
  }

  // THE FRONT DOOR IS A PRECONDITION, NOT A SUGGESTION. Large work cannot start until it has
  // been assessed and the verdict is on the ticket.
  //
  // Small work is exempt deliberately. A gate that fires on everything gets routed around, and
  // the cost of assessing a one-line fix is precisely what teaches people to skip the gate that
  // matters. The exemption is what keeps this one enforceable.
  if (to === 'in_progress' && t.size === 'large' && !t.assessment)
    die(t.ref + ' is large and has not been assessed. Run the front door, then record it: ' +
        'assess ' + t.ref + ' --verdict build|kill|park --measure "..." --by <role>');

  const from = t.status;
  t.status = to;
  if (notes && notes !== true) t.test_notes = notes;
  // Every refusal that could still fire has passed, so this describes a move that is happening.
  // BEFORE the save deliberately: a crash between them leaves an override with no move, which the
  // next refusal counts, rather than a move with no override, which is invisible and undercounts.
  if (pendingOverride) {
    recordOverride('ceiling', t.ref, by, pendingOverride.reason);
    log(t, by, 'CEILING OVERRIDDEN at ' + pendingOverride.at + '/' + CEILING[t.size] + ' ' +
        t.size + ': ' + pendingOverride.reason);
  }
  if (pendingInitiative) {
    recordOverride('initiative', t.ref, by, pendingInitiative.reason);
    log(t, by, 'INITIATIVE OVERRIDDEN, started outside ' + pendingInitiative.larges.join(', ') +
        ': ' + pendingInitiative.reason);
  }
  log(t, by, 'moved ' + from + ' -> ' + to + (notes && notes !== true ? ' | notes: ' + notes : ''));
  save(t);
  if (pendingOverride)
    console.log('  ceiling OVERRIDDEN, ' + (pendingOverride.prior + 1) + ' on record: ' + pendingOverride.reason);
  if (pendingInitiative)
    console.log('  initiative OVERRIDDEN, ' + (pendingInitiative.prior + 1) + ' on record: ' + pendingInitiative.reason);
  ok(t.ref + '  ' + from + ' -> ' + to + '  (' + by + ')');
};

// Added after the audit caught a ticket "assigned" in a note
// with the assignee field still null. Writing the assignment in prose and never recording it
// is the same failure the board exists to stop: the narrative and the data disagreed, and only
// the data is queryable. There was no way to assign an existing ticket at all.
// EVICTION IS ONE COMMAND OR IT IS NOTHING, which is what both leads said when they were asked.
// The founder's rule creates a state that did not exist before: an initiative in flight that the
// founder reprioritises away from. Today that is done by hand, ticket by ticket, and a hand that
// stops half way leaves a board nobody can reason about. "all tickets related to each large goes
// out including anything related in the smalls" is one act, so it is one command.
//
// IT HAPPENED FOR REAL BEFORE THE RULE EXISTED, which is why the shape is not guessed at: a large
// was in flight, the founder reprioritised to something unrelated, and there was no mechanism to
// move the initiative out and back. The board permitted it silently because the ceiling was a
// COUNT and one large plus one small is inside two and three.
//
// WHERE IT PUTS THEM AND WHY NOT `todo`. Backlog, because that is where unstarted work lives and
// an evicted initiative is unstarted work again. `todo` would say it is next, which is the one
// thing an eviction has just decided it is not.
commands.evict = () => {
  // THE RECOVERY PATH IS ROLLBACK AND NOT RESUME, ON PURPOSE. An interrupted eviction either
  // happened or it did not, and rollback is the answer that makes that sentence true. Resuming
  // would be a second code path reaching the same board state as `evict` run again, and the one
  // that runs about once a year is the one nobody has watched work.
  if (args.indexOf('--rollback') !== -1) {
    const j = readJournal();
    if (!j) die('there is no unfinished eviction here. ' + JOURNAL + ' does not exist.');
    if (j.corrupt)
      die('the eviction journal is unreadable: ' + JOURNAL + '\n' +
          '       ' + j.corrupt + '\n' +
          '       Refusing rather than treating it as absent, because absent means no eviction was\n' +
          '       ever running and this file says one was.\n' +
          '       THIS CANNOT BE RESTORED FROM GIT: the journal is written mid-command, removed on\n' +
          '       success, and never committed. It is also written by rename, so this program cannot\n' +
          '       produce a half-written one; something outside it did.\n' +
          '       DELETE THIS FILE FIRST, before anything else in this list. Every writing command\n' +
          '       refuses while it exists, `move` included, so the repair below cannot even start\n' +
          '       until it is gone. Then run `doctor`, read the history of each ticket under the\n' +
          '       initiative to see which moved, and put those back with `move`.');
    const by = requireBy();
    // A COMPLETED EVICTION IS NOT ROLLED BACK, IT IS TIDIED UP. The journal used to say "finished"
    // only by being absent, so an unlink that failed after a perfectly good eviction left this
    // command ready to undo the founder's own reprioritisation and report success for doing it.
    // The marker is what tells the two apart, and reversing work nobody asked to reverse is a worse
    // outcome than any lockout.
    if (j.state === 'committed') {
      fs.unlinkSync(JOURNAL);
      return ok('the eviction of ' + j.initiative + ' had already COMPLETED; nothing was reversed.\n' +
                '  Only the leftover journal was removed, so writes work again. To put that initiative\n' +
                '  back, move it and its work yourself -- an eviction that finished is a decision.');
    }
    const back = [], stuck = [];
    for (const rec of j.tickets) {
      // A journal naming a ticket that is no longer there used to throw ENOENT outside every try,
      // so the recovery path crashed with a raw stack, kept the journal, and repeated forever. This
      // program's own contract is that its failures are diagnoses rather than crashes.
      let x;
      try { x = readTicketFile(ticketPath(rec.ref)); } catch (e) { stuck.push(rec.ref); continue; }
      if (x.status === rec.was) continue;
      x.status = rec.was;
      log(x, by, 'eviction of ' + j.initiative + ' rolled back, returned to ' + rec.was);
      try { save(x); back.push(rec.ref); } catch (e) { stuck.push(rec.ref); }
    }
    if (stuck.length)
      die('the eviction of ' + j.initiative + ' could NOT be fully rolled back.\n' +
          '       Restored: ' + (back.length ? back.join(', ') : 'none') + '\n' +
          '       Could not be read or written: ' + stuck.join(', ') + '\n' +
          '       The journal is kept, so nothing may be written. Fix those files, then run this\n' +
          '       again; every ticket also carries the move in its own history.');
    fs.unlinkSync(JOURNAL);
    return ok('eviction of ' + j.initiative + ' rolled back. ' + back.length + ' of ' +
              j.tickets.length + ' ticket(s) restored' + (back.length ? ': ' + back.join(', ') :
              ' (the rest had not moved)'));
  }

  const t = findTicket(positionals()[0]);
  const by = requireBy();
  const reason = flag('reason', '');
  if (t.size !== 'large')
    die(t.ref + ' is small. Eviction moves an INITIATIVE and its work out together; a single small\n' +
        '       is a plain move: node board.js move ' + t.ref + ' backlog --by ' + by);
  if (t.status !== 'in_progress')
    die(t.ref + ' is ' + t.status + ', not in progress. There is nothing in flight to evict.');
  if (!reason || reason === true || !String(reason).trim())
    die('--reason is required. An initiative dropped with no reason is indistinguishable from one\n' +
        '       that was forgotten, and the next session cannot tell which.');

  const all = allTickets();
  // EVERY CHILD THAT HAS NOT ENDED, NOT ONLY THE ONES IN PROGRESS. Scoped to in_progress this
  // silently left a child sitting in uat or prod_ready, `audit` reported no loose ends because the
  // orphan rule only fires on a TERMINAL parent, and the published claim that an eviction moves
  // everything out together or does nothing at all was false on the SUCCESS path with no failure
  // involved. A ticket that is done, parked or killed has ended and there is nothing to withdraw.
  //
  // WHAT MOVING A UAT CHILD COSTS, said rather than glossed: it loses its place in the queue. Its
  // test notes and its whole history stay on the ticket, so the work is recoverable, and an
  // initiative that is being dropped is one whose work is stopping. Leaving it where it was would
  // mean a dropped initiative still had live work, which is the state this command exists to end.
  const kids = childrenOf(t.ref, all).filter(x => !TERMINAL.includes(x.status) && x.status !== 'backlog');
  const moving = [t].concat(kids);

  const entry = {
    started_at: now(), by: by, initiative: t.ref, reason: String(reason).trim(),
    tickets: moving.map(x => ({ ref: x.ref, was: x.status })),
  };
  // WRITTEN AND FLUSHED BEFORE THE FIRST TICKET MOVES. Every guarantee below rests on this line
  // happening first: a journal written afterwards records a state that has already been left.
  //
  // TEMP FILE AND RENAME, because a half-written journal is the one failure that has no remedy: it
  // locks every write, `--rollback` refuses to guess from it, and the message telling the reader to
  // restore it from git names a file that is never committed. A rename is atomic, so the journal is
  // either absent or whole and that branch stops being reachable from inside this program.
  writeJson(JOURNAL + '.tmp', entry);
  fs.renameSync(JOURNAL + '.tmp', JOURNAL);

  const done = [];
  try {
    for (const x of moving) {
      x.status = 'backlog';
      log(x, by, 'evicted from in_progress' + (x.ref === t.ref ? '' : ' with ' + t.ref) + ': ' + entry.reason);
      save(x);
      done.push(x.ref);
    }
  } catch (e) {
    // ROLLBACK, from the journal rather than from memory, because memory is the thing that just
    // failed. Restoring is a plain re-save of the recorded status: no ticket is deleted or created
    // by an eviction, so there is nothing to undo but a field.
    const stuck = [];
    for (const rec of entry.tickets) {
      if (done.indexOf(rec.ref) === -1) continue;
      try {
        const back = readTicketFile(ticketPath(rec.ref));
        back.status = rec.was;
        log(back, by, 'eviction of ' + t.ref + ' failed and was rolled back');
        save(back);
      } catch (e2) { stuck.push(rec.ref); }
    }
    // CONSISTENCY IS VERIFIED, NEVER ASSUMED, AND THE FILE THAT FAILED IS THE ONE TO LOOK AT.
    // The loop above skips any ticket not in `done`, which is exactly the ticket whose write just
    // failed -- and writeFileSync opens with O_TRUNC, so a failure AFTER the open leaves that file
    // truncated on disk. Declaring the board consistent while skipping it is the strongest claim
    // in this command made about the one file most likely to be damaged. So every ref in the
    // journal is read back and parsed before anything is declared, including the ones that never
    // moved.
    //
    // THIS GUARD IS UNPROVED BY THE SUITE AND THAT IS SAID HERE RATHER THAN LEFT TO BE FOUND.
    // Deleting it returns DELTA ZERO, measured, not assumed. The only fixture that can interrupt a
    // write on this platform is a read-only file, and chmod fails at OPEN, so it can never truncate
    // anything: the branch needs a disk that fills or a write that dies after the open, and neither
    // can be arranged here. It is kept rather than deleted because it is REACHABLE IN PRODUCTION,
    // which is what separates it from dead code -- S168 asks for a comment that matches the
    // measurement, not for the removal of everything a test cannot reach (S61).
    for (const rec of entry.tickets) {
      if (stuck.indexOf(rec.ref) !== -1) continue;
      try { readTicketFile(ticketPath(rec.ref)); } catch (e3) { stuck.push(rec.ref); }
    }
    // THE JOURNAL GOES ONLY IF THE ROLLBACK ACTUALLY FINISHED. Keeping it unconditionally would
    // lock every write on a board that is already consistent again, and a refusal that outlives
    // the fault is one people delete files to escape. Keeping it when a restore FAILED is the
    // whole point: that board really is part way through and nothing should be written to it.
    if (!stuck.length) fs.unlinkSync(JOURNAL);
    die('eviction of ' + t.ref + ' FAILED: ' + e.message + '\n' +
        '       ' + done.length + ' of ' + moving.length + ' had moved, and ' +
        (stuck.length ? stuck.length + ' ticket(s) are NOT sound: ' + stuck.join(', ') + '.\n' +
         '       Read those files before anything else; one of them may be half written.\n' +
         '       The journal is still there, so nothing may be written until `evict --rollback` runs.'
                      : 'every one of them was put back\n' +
         '       and every ticket in the journal reads back cleanly. Nothing was evicted.'));
  }
  // COMMITTED IS WRITTEN BEFORE THE JOURNAL IS REMOVED, AND THAT IS NOT BELT AND BRACES. Removal
  // was the only thing saying "finished", so an unlink that failed -- a lock, an indexer, a virus
  // scanner, any of which are ordinary on this platform -- left a COMPLETED eviction looking
  // exactly like an interrupted one. Every mutator would then refuse, and the single remedy the
  // refusal prints would faithfully undo work the founder had asked for, and report success.
  writeJson(JOURNAL + '.tmp', Object.assign({}, entry, { state: 'committed' }));
  fs.renameSync(JOURNAL + '.tmp', JOURNAL);
  fs.unlinkSync(JOURNAL);
  console.log('  ' + t.ref + ' evicted with ' + kids.length + ' ticket(s) under it: ' + entry.reason);
  ok(moving.map(x => x.ref).join(', ') + '  -> backlog');
};

// SET OR CLEAR THE RELATION ON A TICKET THAT ALREADY EXISTS, which is most of them: 195 tickets
// predate the field and 73 of the 91 backlog items name their initiative in PROSE that nothing can
// read. Without this the relation would only ever exist on work raised after today, so the rule
// would refuse every small on the board and have no way to satisfy itself.
commands.under = () => {
  const pos = positionals();
  const t = findTicket(pos[0]);
  const by = requireBy();
  const to = flag('under', null);
  const all = allTickets();

  if (to === 'none' || (pos[1] && String(pos[1]).toLowerCase() === 'none')) {
    if (!parentOf(t)) die(t.ref + ' is not under anything.');
    const was = parentOf(t);
    t.parent = null;
    log(t, by, 'removed from ' + was);
    save(t);
    return ok(t.ref + '  no longer under ' + was);
  }
  if (!to || to === true) die('under needs a target: --under <ref>, or --under none to clear it.');

  const parent = requireParentable(t, to, all);
  // The walk is guarded, so this cannot hang on a board whose files already disagree. It reads
  // what is on DISK, which is why it is asked even though the size rules above make a cycle
  // unreachable through this command: a hand-edited or badly merged pair of files is a real state
  // here, and the alternative to catching it is a stack overflow that exits 1 and reads as a
  // refusal (S156).
  // The self-parent half of this used to be `parent.ref === t.ref ||` and was DEAD, sitting under
  // a comment arguing at length that no such refusal had been written because it would be dead
  // code. requireParentable has already guaranteed a small child and a large parent, so the clause
  // could not hold. Deleted rather than documented, which is what S168 actually asks for.
  if (ancestorsOf(parent.ref, all).indexOf(t.ref) !== -1)
    die('that would make a loop: ' + t.ref + ' is already above ' + parent.ref + '.\n' +
        '       Run `doctor` -- if this board already holds a loop, the file pair is the fault.');

  const was = parentOf(t);
  t.parent = parent.ref;
  log(t, by, was ? 'moved from ' + was + ' to ' + parent.ref : 'put under ' + parent.ref);
  save(t);
  ok(t.ref + '  under ' + parent.ref + (was ? '  (was ' + was + ')' : ''));
};

commands.assign = () => {
  const p = readProject();
  const pos = positionals();
  const t = findTicket(pos[0]);
  const who = pos[1] || die('assign needs a name, or "none" to clear it');
  const by = requireBy();
  if (who === 'none') {
    log(t, by, 'unassigned'); t.assignee = null; save(t); return ok(t.ref + '  unassigned');
  }
  if (p.assignees.length && !p.assignees.includes(who))
    die('"' + who + '" is not a permitted assignee. This board allows: ' + p.assignees.join(', '));
  log(t, by, 'assigned to ' + who + (t.assignee ? ' (was ' + t.assignee + ')' : ''));
  t.assignee = who;
  save(t);
  ok(t.ref + '  @' + who);
};

commands.note = () => {
  const pos = positionals();
  const t = findTicket(pos[0]);
  const text = pos[1] || die('note needs text');
  log(t, requireBy(), text);
  save(t);
  ok(t.ref + '  note added');
};

// The backlog item raised 2026-08-17, and tightened 2026-09-13 on the CEO's own instruction: an
// agent asking the CEO for a decision must arrive through the host's interactive prompt, so they
// answer by CLICKING, carrying numbered options, a recommendation, an escape hatch, and the ticket
// number. A numbered list typed into a reply is the thing they objected to. The value is
// upstream of the founder's convenience -- an agent cannot write the options until it has
// actually thought the alternatives through, which is the work the open question was avoiding.
commands.ask = () => {
  const pos = positionals();
  const t = findTicket(pos[0]);
  const q = pos[1] || die('ask needs a question');
  const by = requireBy();
  const raw = flag('options', '');
  if (raw === true || !raw) die('--options "a|b|c" is required. An open question hands your analysis back to the CEO.');
  const opts = String(raw).split('|').map(s => s.trim()).filter(Boolean);
  if (opts.length < 2) die('give at least two options, or it is not a decision.');
  const rec = parseInt(flag('recommend', ''), 10);
  if (!rec || rec < 1 || rec > opts.length)
    die('--recommend <n> is required and must name one of your options.\n' +
        '       Without a recommendation the CEO is still doing the thinking, just from a shorter list.');
  // The escape is mandatory. A forced choice between options that are all wrong is worse than
  // the open question it replaced.
  //
  // But it is appended only if the caller did not already write one. The first agent to use
  // this supplied its own "Something else" and got a duplicate, then had to spend a note
  // explaining that options 4 and 5 were the same thing. A tool that silently doubles the
  // caller's last option teaches the caller to stop writing one, which is the wrong lesson:
  // the agent thinking to offer an escape is the behaviour worth keeping.
  if (!/^(something else|none of|neither|other\b|anything else)/i.test(opts[opts.length - 1]))
    opts.push('Something else (say what)');
  const d = { key: 'd' + (t.decisions.length + 1), at: now(), by: by, question: q, options: opts, recommend: rec, answer: null };
  t.decisions.push(d);
  log(t, by, 'asked the CEO: ' + q);
  save(t);
  console.log('\n' + t.ref + '  DECISION NEEDED  (' + by + ')');
  console.log(q + '\n');
  opts.forEach((o, i) => console.log('  ' + (i + 1) + '. ' + o + (i + 1 === rec ? '   <- recommended' : '')));
  // The key is printed even when this is the only open question. The old output printed an
  // identical instruction under every one, so a CEO looking at three of them was told the same
  // thing three times and had no way to reply to a specific one.
  console.log('\nReply with: node board.js answer ' + t.ref + ' <n> --decision ' + d.key + '\n');
};

commands.answer = () => {
  const pos = positionals();
  const t = findTicket(pos[0]);
  const n = parseInt(pos[1], 10);
  const open = openDecisions(t);
  if (!open.length) die(t.ref + ' has no open decision');
  const want = flag('decision', '');
  let hit;
  if (want && want !== true) {
    hit = keyedDecisions(t).find(x => x.key === want);
    if (!hit)
      die('no decision ' + want + ' on ' + t.ref + '. Open: ' + open.map(x => x.key).join(', '));
    // Answering twice is how a real ruling gets quietly overwritten by a later one. A change of
    // mind is a note, so the original and the reversal both stay readable.
    if (hit.d.answer !== null)
      die(want + ' on ' + t.ref + ' was already answered: ' + hit.d.options[hit.d.answer - 1] + '\n' +
          '       A decision is answered once. Record a change of mind as a note, so the reversal is visible.');
  } else if (open.length > 1) {
    // Refuse rather than guess. This is the entire defect: the old code picked one for you.
    die(t.ref + ' has ' + open.length + ' open decisions and you did not say which one.\n' +
        open.map(x => '       ' + x.key + '  ' + x.d.question).join('\n') + '\n' +
        '       Name one: node board.js answer ' + t.ref + ' <n> --decision <key>');
  } else {
    hit = open[0];
  }
  const d = hit.d;
  if (!n || n < 1 || n > d.options.length) die('pick 1..' + d.options.length);
  d.answer = n;
  d.answered_at = now();
  d.answer_note = (flag('note', '') === true) ? '' : flag('note', '');
  log(t, 'CEO', 'decided [' + hit.key + ']: ' + d.options[n - 1] + (d.answer_note ? ' | ' + d.answer_note : ''));
  save(t);
  ok(t.ref + '  ' + hit.key + '  decided: ' + d.options[n - 1]);
};

commands.close = () => {
  const t = findTicket(positionals()[0]);
  const as = flag('as', '');
  const reason = flag('reason', '');
  const by = requireBy();
  if (!TERMINAL.includes(as)) die('--as must be one of: ' + TERMINAL.join(', '));
  // Parked and killed need a reason; done does not, because the history already carries it.
  if (as !== 'done' && (!reason || reason === true))
    die('--reason is required to ' + as + ' a ticket. "' + as + '" with no reason is a loose end wearing a label.');
  const openD = openDecisions(t);
  if (openD.length) die(t.ref + ' has an unanswered decision. Answer it or the question evaporates:\n' +
      openD.map(x => '       [' + x.key + '] ' + x.d.question).join('\n'));

  // "A LARGE IS NOT FINISHED UNTIL EVERY TICKET RELATED TO IT IS CLOSED." The founder's own
  // words: "focus needs to be finishing what we start and closing all related tickets." Without
  // this the relation would be decoration: an initiative could be marked done with half its work
  // still open, and the smalls would fall back into the backlog they came from with nothing
  // pointing at them any more.
  //
  // DONE ONLY, AND THAT IS THE WHOLE POINT. Parking or killing an initiative is a decision that
  // its remaining work is not being done, which is a legitimate ending and is what `evict` is for
  // on a large in flight. Refusing every ending would leave an initiative that cannot be abandoned,
  // and a rule with no way out is a rule that gets routed around.
  if (as === 'done' && t.size === 'large') {
    const openKids = childrenOf(t.ref, allTickets()).filter(x => !TERMINAL.includes(x.status));
    if (openKids.length)
      die(t.ref + ' has ' + openKids.length + ' ticket(s) still open under it:\n' +
          openKids.map(x => '       ' + x.ref + '  ' + x.status + '  ' + x.title).join('\n') + '\n' +
          '       An initiative is finished when its work is finished. Close them, or close this\n' +
          '       one as parked or killed with a reason, which says the rest is not being done.');
  }
  t.status = as;
  log(t, by, as + (reason && reason !== true ? ': ' + reason : ''));
  save(t);
  ok(t.ref + '  ' + as);
};

// Soft delete only. S19: the hard delete is revoked at the database on the real board, so it
// is not offered here either. A flag the application is merely trusted to honour is not a
// control -- but here there is no data API behind it, so the honest equivalent is to have no
// hard delete in the tool at all.
commands.delete = () => {
  const t = findTicket(positionals()[0]);
  t.deleted_at = now();
  log(t, requireBy(), 'deleted (soft)');
  writeJson(ticketPath(t.ref), t);
  ok(t.ref + '  deleted (recoverable: the file is still there)');
};

// Soft delete is only meaningful if there is a way back. The real board has `restore` and this
// did not, which was discovered the way these things always are: a real ticket was deleted as
// collateral during a test of something else, and the tool had no answer.
commands.restore = () => {
  const ref = String(positionals()[0] || die('restore needs a ticket ref')).toUpperCase();
  const p = ticketPath(ref);
  if (!fs.existsSync(p)) die('no ticket ' + ref);
  const t = readTicketFile(p);
  if (!t.deleted_at) die(ref + ' is not deleted');
  log(t, requireBy(), 'restored (was deleted ' + t.deleted_at + ')');
  t.deleted_at = null;
  writeJson(p, t);
  ok(ref + '  restored to ' + t.status);
};

commands.deleted = () => {
  const gone = allOnDisk().filter(t => t.deleted_at).sort((a, b) => a.num - b.num);
  if (!gone.length) return ok('(nothing deleted)');
  for (const t of gone) console.log('  ' + t.ref + '  ' + t.title + '   deleted ' + t.deleted_at);
};

// Parked and killed are terminal, and `move` refuses them on purpose so a finished ticket is
// not quietly resurrected. But PARK was designed as a legitimate ending with a reason attached,
// which means it is the one terminal state that must have a way back: the thing that would
// change the answer happens, and the work starts. Without this the only route was to raise a
// duplicate, which loses the history that made parking the right call.
//
// Found the same way as `restore`: by the tool refusing something legitimate and there being no
// verb for it. A rule that blocks a real workflow gets worked around, and a workaround is a rule
// nobody is following.
commands.reopen = () => {
  const t = findTicket(positionals()[0]);
  const by = requireBy();
  const reason = flag('reason', '');
  if (!TERMINAL.includes(t.status)) die(t.ref + ' is not closed; it is in ' + t.status);
  if (t.status === 'done') die(t.ref + ' is done. Reopening finished work hides that it shipped; raise a new ticket that references it.');
  if (!reason || reason === true) die('--reason is required. Parking recorded what would change the answer; reopening records that it did.');
  const was = t.status;
  t.status = 'todo';
  log(t, by, 'reopened from ' + was + ': ' + reason);
  save(t);
  ok(t.ref + '  ' + was + ' -> todo  (' + reason + ')');
};

// Ranking writes exactly ONE ticket file. Taking the midpoint of two neighbours is the whole
// reason the field is a float and not an integer index: renumbering a column to make room
// would rewrite every ticket in it and turn one reprioritisation into a diff nobody reviews.
commands.rank = () => {
  const t = findTicket(positionals()[0]);
  const by = requireBy();
  const before = flag('before');
  const after = flag('after');
  const top = flag('top');
  const bottom = flag('bottom');
  const given = [before, after, top, bottom].filter(x => x !== undefined);
  if (given.length !== 1)
    die('rank needs exactly one of --top, --bottom, --before <ref> or --after <ref>. ' +
        'Ranking against nothing is not an order.');
  if (before === true || after === true)
    die('--before and --after need a ticket ref to rank against.');

  // Rank is per COLUMN, because a column is the only place an order means anything: the
  // question it answers is which ticket in THIS column comes next.
  const column = allTickets().filter(x => x.status === t.status && x.ref !== t.ref);
  const neighbour = ref => {
    const n = allTickets().find(x => x.ref === String(ref).toUpperCase());
    if (!n) die('no ticket ' + ref);
    if (n.ref === t.ref) die('a ticket cannot be ranked against itself.');
    if (n.status !== t.status)
      die(n.ref + ' is in ' + n.status + ' and ' + t.ref + ' is in ' + t.status +
          '. Rank orders a ticket within its own column. Move it first.');
    return n;
  };

  let pos;
  if (top !== undefined) {
    pos = column.length ? effPos(column[0]) - 1 : effPos(t);
  } else if (bottom !== undefined) {
    pos = column.length ? effPos(column[column.length - 1]) + 1 : effPos(t);
  } else {
    const n = neighbour(before !== undefined ? before : after);
    const idx = column.findIndex(x => x.ref === n.ref);
    if (before !== undefined) {
      const prev = column[idx - 1];
      pos = prev ? (effPos(prev) + effPos(n)) / 2 : effPos(n) - 1;
    } else {
      const next = column[idx + 1];
      pos = next ? (effPos(n) + effPos(next)) / 2 : effPos(n) + 1;
    }
  }
  // A position that is not a finite number sorts unpredictably and cannot be diagnosed by
  // reading the ticket file, so it is refused rather than written.
  if (typeof pos !== 'number' || !isFinite(pos))
    die('refusing to write a position that is not a finite number. Nothing has been written.');

  t.position = pos;
  log(t, by, 'ranked in ' + t.status);
  save(t);
  const order = allTickets().filter(x => x.status === t.status).map(x => x.ref);
  ok(t.ref + '  ranked in ' + t.status);
  console.log('  ' + order.join('  '));
};

commands.list = () => {
  const want = positionals()[0];
  const ts = allTickets().filter(t => !want || t.status === want);
  if (!ts.length) return ok('(nothing' + (want ? ' in ' + want : '') + ')');
  const cols = want ? [want] : COLUMNS.concat(TERMINAL.filter(x => x !== 'done'));
  for (const c of cols) {
    const inCol = ts.filter(t => t.status === c);
    if (!inCol.length) continue;
    console.log('\n' + c.toUpperCase().replace('_', ' '));
    for (const t of inCol) {
      const d = t.decisions.filter(x => x.answer === null).length;
      console.log('  ' + t.ref + '  ' + (t.size === 'large' ? '[L]' : '[s]') + ' ' + t.title +
        (t.assignee ? '  @' + t.assignee : '') + (d ? '  ** ' + d + ' DECISION WAITING **' : ''));
    }
  }
  console.log('');
};

commands.show = () => {
  const t = findTicket(positionals()[0]);
  console.log('\n' + t.ref + '  ' + t.title + '   [' + t.size + ']  ' + t.status +
              (t.assignee ? '  @' + t.assignee : '') +
              (typeof t.position === 'number' ? '  rank ' + t.position : ''));
  console.log('\n' + t.description + '\n');
  if (t.test_notes) console.log('TEST NOTES (qa-tester)\n  ' + t.test_notes + '\n');
  if (t.decisions.length) {
    console.log('DECISIONS');
    for (const x of keyedDecisions(t)) {
      const d = x.d;
      console.log('  Q [' + x.key + '] (' + d.by + '): ' + d.question);
      d.options.forEach((o, i) => console.log('     ' + (i + 1) + '. ' + o + (i + 1 === d.recommend ? '  <- recommended' : '')));
      console.log('  A: ' + (d.answer ? d.options[d.answer - 1] + (d.answer_note ? '  | ' + d.answer_note : '') : '** UNANSWERED **'));
    }
    console.log('');
  }
  console.log('HISTORY');
  for (const h of t.history) console.log('  ' + h.at + '  ' + h.by.padEnd(18) + h.what);
  console.log('');
};

commands.wip = () => {
  const all = allTickets();
  const live = all.filter(t => t.status === 'in_progress');
  const L = live.filter(t => t.size === 'large'), S = live.filter(t => t.size === 'small');
  console.log('\nIN PROGRESS   large ' + L.length + '/' + CEILING.large + '   small ' + S.length + '/' + CEILING.small);
  // THE RELATION IS SHOWN WHERE THE COUNT IS SHOWN, or it is a field only refusals can see. The
  // whole complaint behind this rule was that the board could not tell a small that FINISHES an
  // initiative from one that STARTS a fourth, and a reader who has to run `show` on each ticket to
  // find out is in the same position.
  for (const t of live) {
    const p = parentOf(t);
    console.log('  ' + t.ref + '  ' + (t.size === 'large' ? '[L]' : '[s]') + ' ' + t.title +
      // A SMALL UNDER THE WRONG LARGE IS THE CASE `move` REFUSES, and printing only the name of
      // the initiative it belongs to made it read as compliant to the one role told to read this
      // and name breaches.
      (t.size === 'small' && L.length && !L.some(x => x.ref === p)
        ? (p ? '   under ' + p + '   ** WRONG INITIATIVE **' : '   ** NO INITIATIVE **')
        : (p ? '   under ' + p : '')));
    if (t.size === 'large') {
      const kids = childrenOf(t.ref, all);
      const open = kids.filter(x => !TERMINAL.includes(x.status)).length;
      console.log('        ' + kids.length + ' under it, ' + open + ' still open' +
        (open ? '' : '  -- this initiative can be closed'));
    }
  }
  if (L.length >= CEILING.large) console.log('\n  At the large ceiling. Say so out loud with the count before taking anything else on.');
  console.log('');
};

// The loose-ends check S27 asks for, as a command rather than a memory.
commands.audit = () => {
  const ts = allTickets();
  const problems = [];
  for (const t of ts) {
    const open = openDecisions(t);
    // Every open decision, named. The old line reported a count and then quoted only the first,
    // so a ticket with three open questions showed one and the other two were invisible.
    if (open.length) problems.push(t.ref + ': ' + open.length + ' unanswered decision' +
      open.map(x => '\n         [' + x.key + '] ' + x.d.question).join(''));
    if (t.status === 'uat' && !t.test_notes) problems.push(t.ref + ': in UAT with no test notes');
    if (t.status === 'in_progress' && !t.assignee) problems.push(t.ref + ': in progress with nobody on it');
  }
  const live = ts.filter(t => t.status === 'in_progress');
  const L = live.filter(t => t.size === 'large'), S = live.filter(t => t.size === 'small');
  if (L.length > CEILING.large) problems.push('large WIP over ceiling: ' + L.length + '/' + CEILING.large);
  if (S.length > CEILING.small) problems.push('small WIP over ceiling: ' + S.length + '/' + CEILING.small);

  // THE REFUSALS GUARD THE WAY IN; THIS IS THE ONLY THING THAT SEES A BOARD THAT DRIFTED. A ticket
  // moved by a hand edit, an override taken on purpose, or an initiative closed while its work was
  // still in flight all leave a board that no refusal will ever be asked about again. An audit that
  // could only count is what let 90 backlog items pile up ungrouped.
  for (const t of S) {
    const p = parentOf(t);
    const off = L.filter(x => x.ref !== p);
    if (off.length)
      problems.push(t.ref + ': in progress ' + (p ? 'under ' + p : 'with no initiative') +
        ' while ' + off.map(x => x.ref).join(', ') + ' is the initiative in flight');
  }
  for (const t of ts) {
    const p = parentOf(t);
    if (!p) continue;
    const owner = ts.filter(x => x.ref === p)[0];
    // A parent that is not on the board is worse than no parent: every rollup silently drops the
    // ticket and the audit is the only place it can surface.
    if (!owner) { problems.push(t.ref + ': under ' + p + ', which is not on this board'); continue; }
    if (owner.size !== 'large') problems.push(t.ref + ': under ' + p + ', which is not a large');
    if (TERMINAL.includes(owner.status) && !TERMINAL.includes(t.status))
      problems.push(t.ref + ': ' + t.status + ' under ' + p + ', which is already ' + owner.status);
  }
  // The loop the seen-set in ancestorsOf survives, reported rather than merely survived, because a
  // walk that terminates quietly on a broken board leaves the board broken.
  for (const t of ts) {
    if (!parentOf(t)) continue;
    if (ancestorsOf(t.ref, ts).indexOf(t.ref) !== -1)
      problems.push(t.ref + ': is its own ancestor -- the parent chain is a loop');
  }

  console.log('\nAUDIT  ' + ts.length + ' live tickets');
  if (!problems.length) { console.log('  no loose ends\n'); process.exit(0); }
  for (const p of problems) console.log('  GAP  ' + p);
  console.log('');
  process.exit(1);
};

// DOCTOR REPORTS EVERY FAULT AT ONCE. A board that can only report its first fault makes
// recovery serial: fix one file, run again, discover the next, and a merge that broke six files
// takes six rounds to find. These four faults are the ones that have actually happened here or
// that the Postgres schema this board was lifted from guards against explicitly.
commands.doctor = () => {
  const problems = [];
  // An empty board and no board at all are different answers. doctor used to give the same one
  // for both, and so did list, wip and audit, which is half of what the resolution change set out to fix.
  if (!fs.existsSync(PROJECT)) {
    console.log('\nDOCTOR  no board resolved at ' + ROOT);
    console.log('  FAULT  there is no project.json here, so this is not a board.');
    console.log('         Run: node board.js init <slug>\n');
    process.exit(1);
  }
  // project.json was the one file doctor could not see, while a corrupt project.json is exactly
  // what produces the diagnosis that sends you here. A command that names another command as the
  // way to investigate must be able to see the fault that named it.
  const files = fs.existsSync(TICKETS) ? fs.readdirSync(TICKETS).filter(f => f.endsWith('.json')) : [];
  const byNum = {};

  // The override ledger was the one file doctor could not see, exactly where project.json was
  // before the comment above. A record of gates waved through is the last thing to rot unwatched.
  const ledger = fs.existsSync(OVERRIDES) ? [{ f: 'overrides.json', p: OVERRIDES }] : [];

  // AN UNFINISHED EVICTION IS A FAULT AND THIS IS WHERE A READER FINDS OUT WHAT TO DO ABOUT IT.
  // Every writing command already refuses on it, but a refusal reaches whoever happened to run a
  // command; doctor is the one place someone looks when the board is behaving oddly, and the
  // remedy has to be printed where they are looking rather than where they were stopped.
  const journal = readJournal();
  if (journal) {
    problems.push(journal.corrupt
      ? 'evict.journal.json: an eviction did not finish AND the journal is unreadable (' +
        journal.corrupt + '). It CANNOT be restored from git: it is written mid-command, removed ' +
        'on success, never committed, and .gitignore excludes it. DELETE THE FILE FIRST, because ' +
        'every writing command refuses while it exists and `evict --rollback` refuses on an ' +
        'unreadable one, so nothing can be put back until it is gone. Then read the history of ' +
        'each ticket under the initiative to see which moved, and put those back with `move`.'
      : 'evict.journal.json: the eviction of ' + journal.initiative + ' did not finish (' +
        journal.tickets.length + ' ticket(s), started ' + String(journal.started_at).slice(0, 19) +
        '). Nothing may be written until it is resolved: node board.js evict --rollback --by <role>');
  }

  for (const entry of [{ f: 'project.json', p: PROJECT }].concat(ledger, files.map(f => ({ f: f, p: path.join(TICKETS, f) })))) {
    const f = entry.f;
    const raw = fs.readFileSync(entry.p, 'utf8');
    const marker = raw.split('\n').findIndex(l => /^(<{7}|={7}|>{7})/.test(l));
    if (marker >= 0) { problems.push(f + ': unresolved git conflict marker at line ' + (marker + 1)); continue; }
    let t;
    try { t = JSON.parse(raw); } catch (e) { problems.push(f + ': not valid JSON (' + e.message + ')'); continue; }
    if (f === 'project.json') continue;
    if (f === 'overrides.json') {
      if (!Array.isArray(t)) { problems.push(f + ': the override ledger is not a JSON array'); continue; }
      // An entry with no reason is what the gate refuses at write time, so one on disk arrived
      // another way, and a ledger of gates passed for no reason is a count with nothing behind it.
      t.forEach((o, i) => {
        if (!o || !o.gate || !o.ref || !o.reason || !String(o.reason).trim())
          problems.push(f + ': entry ' + (i + 1) + ' has no gate, ticket or stated reason');
        // The one field the escalation actually reads, and the only one this check skipped. An
        // unreadable stamp is treated as recent so it cannot disarm the gate, but silently
        // hardening for ever is not a fault anyone should have to deduce from a refusal.
        else if (isNaN(Date.parse(String(o.at).replace(' ', 'T'))))
          problems.push(f + ': entry ' + (i + 1) + ' has an unreadable timestamp, so it can never age out');
      });
      continue;
    }
    // The filename IS the address every command resolves through, so a ref that disagrees with
    // the file holding it means show and move reach a different record from the one list drew.
    if (t.ref && t.ref + '.json' !== f) problems.push(f + ': holds ref ' + t.ref + ', so the file and the ref disagree');
    // S18's sibling. A reused number points two pieces of history at one address, which is the
    // defect assertFreshNumber refuses at write time; this finds one already on disk.
    if (t.num != null) { (byNum[t.num] = byNum[t.num] || []).push(f); }
  }

  Object.keys(byNum).forEach(n => {
    if (byNum[n].length > 1) problems.push('number ' + n + ' is held by ' + byNum[n].length + ' files: ' + byNum[n].join(', '));
  });

  console.log('\nDOCTOR  ' + files.length + ' ticket file(s) in ' + TICKETS);
  if (!problems.length) { console.log('  no faults\n'); process.exit(0); }
  for (const p of problems) console.log('  FAULT  ' + p);
  console.log('');
  process.exit(1);
};

// GIT IS THIS BOARD'S DURABLE STORE and this program has no other. Nothing here used to say so
// and nothing checked, so the only thing that committed a decision was a person remembering to.
// That is operations-lead's objection 12 at ST-065's front door and it is S46's exact class: an
// instruction standing where a control belongs.
//
// Reported as a COUNT, never as a flag. "uncommitted" reads as normal and "9 ticket files
// uncommitted" reads as a problem, and they are the same fact (S44).
//
// It warns and never refuses, and it fails open on every path. A board outside a repository, or
// on a machine with no git at all, is a legitimate way to run this and must not be blocked.
const MUTATORS = ['init', 'add', 'assess', 'move', 'assign', 'rank', 'note', 'ask', 'answer', 'close', 'reopen', 'delete', 'restore', 'under', 'evict'];

// THE DETECTOR, AND IT IS WHAT MAKES THE JOURNAL MORE THAN A LOG FILE. A journal nobody reads
// records a broken board without stopping anyone building on top of it. So every command that
// WRITES refuses while an eviction is unfinished, and every command that READS carries on and
// says so, because a half-evicted board is exactly the thing you need to be able to look at.
// Bricking the reading commands would leave the operator with a broken board and no way to see it.
//
// `evict --rollback` is the one writer that passes THIS guard, because it is the way out. Refusing
// it here too would be a refusal with no remedy, which is the shape people delete files to escape.
//
// IT IS NOT A WAY OUT OF EVERYTHING, AND SAYING SO HERE IS THE POINT. On a journal that is
// unreadable, rollback refuses as well, because it cannot know what to put back. That is the one
// branch where deleting the file by hand really is the only escape, and it was shipped as a loop:
// `move` sent the reader to rollback, rollback sent them to `move`, and `doctor` told them to
// restore from git, which .gitignore makes impossible. Both messages now name the deletion FIRST,
// because every other writer is refused until the file is gone.
if (MUTATORS.indexOf(cmd) !== -1 && !(cmd === 'evict' && args.indexOf('--rollback') !== -1)) {
  const unfinished = readJournal();
  if (unfinished) {
    const what = unfinished.corrupt
      ? 'the journal itself is unreadable (' + unfinished.corrupt + '), which this program\n' +
        '       cannot produce, because it writes the journal by rename. Something outside it did'
      : 'of ' + unfinished.initiative + ', started ' + String(unfinished.started_at).slice(0, 19) +
        ' by ' + unfinished.by + ', covering ' + unfinished.tickets.length + ' ticket(s)';
    die('an eviction did not finish and this board is part way through it.\n' +
        '       ' + what + '\n' +
        '       Journal: ' + JOURNAL + '\n' +
        '       Nothing may be written until it is resolved, because a refusal computed over a\n' +
        '       half-evicted board is a refusal reasoning from a state nobody chose.\n' +
        '       Put it back:  node board.js evict --rollback --by <role>\n' +
        '       Reading commands (list, show, wip, audit, doctor) still work.');
  }
}

if (MUTATORS.indexOf(cmd) !== -1 && !process.env.BOARD_NO_GIT_WARN) {
  process.on('exit', () => {
    try {
      const out = require('child_process').execFileSync(
        'git', ['-C', ROOT, 'status', '--porcelain', '-uall', '--', TICKETS],
        { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
      if (!out) return;
      const n = out.split('\n').length;
      process.stderr.write(
        '\n  ' + n + ' ticket file(s) uncommitted. git is the durable store for this board, so\n' +
        '  nothing written here is safe until it is committed and pushed.\n');
    } catch (e) { /* no git, or not a repository. Both are legitimate ways to run this. */ }
  });
}

// ---- the readable surface -----------------------------------------------------------------
// A founder should not need a terminal to see the board. BOARD.md is rewritten on every
// mutation and committed alongside the tickets, so the board renders on a phone in any git
// host without a server, an account or a deploy.
//
// Raised at the front door as an objection: the site says UAT is the one point
// on the board that waits for YOU, and a board only readable through a CLI would make that the
// one thing you cannot look at. The answer is a rendered file rather than a new concept.
//
// It is generated, never edited. Anything written here by hand is gone on the next mutation,
// which the file says about itself at the top so nobody learns that the expensive way.
function renderBoard() {
  const N = String.fromCharCode(10);
  const p = readProject();
  const ts = allTickets();
  const out = ['# ' + p.slug + ' board', ''];
  out.push('Generated by `board.js` on every change. Do not edit by hand: it is rewritten.');
  out.push('');
  const line = t => {
    const open = t.decisions.filter(x => x.answer === null).length;
    const p = parentOf(t);
    // The rendered board is the only view of this a founder sees without a terminal, so the
    // relation belongs here too. Without it the page shows a flat list of tickets and the reader
    // is back to inferring which initiative each one serves from its title.
    return '- **' + t.ref + '** ' + t.title +
      '  `' + t.size + '`' +
      (p ? '  under ' + p : '') +
      (t.assignee ? '  @' + t.assignee : '') +
      (open ? '  **' + open + ' DECISION WAITING**' : '');
  };
  for (const c of COLUMNS) {
    const inCol = ts.filter(t => t.status === c);
    out.push('## ' + c.toUpperCase().split('_').join(' ') + '  (' + inCol.length + ')', '');
    if (!inCol.length) { out.push('_nothing here_', ''); continue; }
    for (const t of inCol) out.push(line(t));
    out.push('');
  }
  // Parked and killed are statuses, not columns, and they are the whole point of S27: what was
  // started ends explicitly. A board that renders only its columns hides every ending.
  for (const term of ['parked', 'killed']) {
    const inTerm = ts.filter(t => t.status === term);
    if (!inTerm.length) continue;
    out.push('## ' + term.toUpperCase() + '  (' + inTerm.length + ')', '');
    for (const t of inTerm) out.push(line(t));
    out.push('');
  }
  fs.writeFileSync(path.join(ROOT, 'BOARD.md'), out.join(N) + N);
}
if (!cmd || !commands[cmd]) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('\n')
    .filter(l => l.startsWith(' *')).map(l => l.slice(2)).join('\n'));
  process.exit(cmd ? 1 : 0);
}
commands[cmd]();
// Rewritten after anything that changed the board. MUTATORS is compared against the set of
// commands that actually write, in both directions, so a new writer cannot quietly skip this.
if (MUTATORS.indexOf(cmd) > -1) renderBoard();
