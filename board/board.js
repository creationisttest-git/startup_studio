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
 * answered. A question put to the founder must carry numbered options and a recommendation.
 * Work in progress has a ceiling. Every one of those is a refusal in this file rather than a
 * paragraph somebody is trusted to remember, because a rule nobody can break is the only kind
 * that survives a bad afternoon.
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
 *   node board.js add "<title>" --desc "..." [--size large|small] [--assignee X]
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
// tech-lead's objection 5 at ST-065's front door: promoting board.js turns the studio's own
// working queue into a published artefact, and with ST-064 staging the whole tree, a project's
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
    // root, and qa-tester showed the consequence: board.test.js runs init with BOARD_HOME
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
const CEILING = { large: 2, small: 3 };

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
// on ST-065, the CEO answered the first, and the tool filed that answer against the third and
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
// This board reused a number within its first hour: ST-008 was soft-deleted, the next `add`
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
  // what ST-072 set out to fix.
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
// form, raised by tech-lead at the ST-065 front door.
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
  // which is correct for every other command and destructive here. qa-tester reproduced it at the
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
    test_notes: null, decisions: [], history: [], created_at: now(), updated_at: now(), deleted_at: null,
  };
  log(t, flag('by', 'unattributed'), 'created in backlog');
  save(t);
  ok(ref + '  ' + title + '  [' + size + ']');
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
  if (to === 'in_progress') {
    const live = allTickets().filter(x => x.status === 'in_progress' && x.ref !== t.ref);
    const n = live.filter(x => x.size === t.size).length;
    if (n >= CEILING[t.size])
      die(t.size + ' work in progress is already at the ceiling (' + n + '/' + CEILING[t.size] + ').\n' +
          '       In progress: ' + live.filter(x => x.size === t.size).map(x => x.ref).join(', ') + '\n' +
          '       Finish or park one before starting another. Four things at sixty per cent ship nothing.');
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
  log(t, by, 'moved ' + from + ' -> ' + to + (notes && notes !== true ? ' | notes: ' + notes : ''));
  save(t);
  ok(t.ref + '  ' + from + ' -> ' + to + '  (' + by + ')');
};

// Added after the audit caught a ticket "assigned" in a note
// with the assignee field still null. Writing the assignment in prose and never recording it
// is the same failure the board exists to stop: the narrative and the data disagreed, and only
// the data is queryable. There was no way to assign an existing ticket at all.
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

// The backlog item raised 2026-08-17: an agent asking the CEO for a decision must arrive with
// numbered options, a recommendation, an escape hatch, and the ticket number. The value is
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
  const live = allTickets().filter(t => t.status === 'in_progress');
  const L = live.filter(t => t.size === 'large'), S = live.filter(t => t.size === 'small');
  console.log('\nIN PROGRESS   large ' + L.length + '/' + CEILING.large + '   small ' + S.length + '/' + CEILING.small);
  for (const t of live) console.log('  ' + t.ref + '  ' + (t.size === 'large' ? '[L]' : '[s]') + ' ' + t.title);
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
  const L = live.filter(t => t.size === 'large').length, S = live.filter(t => t.size === 'small').length;
  if (L > CEILING.large) problems.push('large WIP over ceiling: ' + L + '/' + CEILING.large);
  if (S > CEILING.small) problems.push('small WIP over ceiling: ' + S + '/' + CEILING.small);

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
  // for both, and so did list, wip and audit, which is half of what ST-072 set out to fix.
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

  for (const entry of [{ f: 'project.json', p: PROJECT }].concat(files.map(f => ({ f: f, p: path.join(TICKETS, f) })))) {
    const f = entry.f;
    const raw = fs.readFileSync(entry.p, 'utf8');
    const marker = raw.split('\n').findIndex(l => /^(<{7}|={7}|>{7})/.test(l));
    if (marker >= 0) { problems.push(f + ': unresolved git conflict marker at line ' + (marker + 1)); continue; }
    let t;
    try { t = JSON.parse(raw); } catch (e) { problems.push(f + ': not valid JSON (' + e.message + ')'); continue; }
    if (f === 'project.json') continue;
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
const MUTATORS = ['init', 'add', 'assess', 'move', 'assign', 'rank', 'note', 'ask', 'answer', 'close', 'reopen', 'delete', 'restore'];
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
// design-lead raised this at the front door as objection 7: the site says UAT is the one point
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
    return '- **' + t.ref + '** ' + t.title +
      '  `' + t.size + '`' +
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
