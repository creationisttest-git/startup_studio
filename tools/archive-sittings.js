#!/usr/bin/env node
'use strict';
/**
 * archive-sittings.js -- moves older DATED SITTING BLOCKS out of a loaded state document and
 * leaves the trail followable from the one that remains.
 *
 * WHY THIS EXISTS, WHICH IS NOT THE SAME AS WHY archive-decisions.js EXISTS.
 *
 * A state document is @-imported, so it is re-sent on EVERY request for the life of every
 * session. Its two largest sections are dated history: a Current state block and a Session log
 * entry are written at every wind-down and neither is ever read again after the sitting that
 * follows it. `archive-decisions.js` already moves the decisions table out unsupervised. The two
 * sections that actually dominate the file had no equivalent and were moved BY HAND, at a
 * wind-down, by a session that had already spent its budget.
 *
 * THE DEFECT THIS FIXES IS THE TRIGGER, NOT THE MOVE. Archiving fired only when
 * `check-context-budget.js` REFUSED. So the limit became the target: the document was cut to
 * just under the ceiling and grew back to it, every sitting, and never went below. Six sittings
 * of this project's own record show the same shape, each one describing the move as "the
 * documented fallback rather than the plan". A saving you only take when you are forced to is a
 * saving you never compound.
 *
 *   node tools/archive-sittings.js <path-to-markdown-file> [--keep N] [--write]
 *                                  [--section "<heading>"] [--boundary "<text>"]
 *
 * DRY RUN BY DEFAULT, for the same reason archive-decisions.js is: this rewrites the one
 * artefact the studio treats as the record, and getting it wrong is worse than the bloat it
 * fixes. Without --write nothing on disk is modified and the plan is printed for a human.
 *
 * EXIT CODES, AND ONE OF THEM IS A DELIBERATE DEPARTURE FROM ITS SIBLING.
 *
 *     0   archived cleanly, OR there was nothing to archive
 *     1   refused: something could not be established safely, and nothing was written
 *     2   usage or read error
 *
 * `archive-decisions.js` exits 1 when there is nothing to do, and ST-263 records what that
 * costs: the wind-down runs it every sitting, a healthy document is the common case, so the
 * correct outcome is a non-zero code that every session must learn to ignore, sitting next to
 * three checks whose non-zero codes block a commit. Teaching a reader that an exit code carries
 * no information is worse than printing nothing at all. Here a no-op is success, because it is.
 *
 * HOW A DATED BLOCK IS RECOGNISED, and why each refusal is a refusal rather than a guess.
 *
 *   - AN OPENER IS A PARAGRAPH WHOSE LEADING BOLD SPAN CARRIES "<date>, <ORDINAL> sitting".
 *     The comma matters and is not cosmetic. Without it this pattern also matches the pointer
 *     paragraphs a previous archive left behind, which say things like "the 2026-09-10 TENTH
 *     sitting block is now in" and "Archived again 2026-09-10, at the FOURTH sitting WIND-DOWN".
 *     Archiving a pointer removes the trail to everything already archived.
 *
 *   - THE DATED REGION ENDS AT THE FIRST PARAGRAPH NAMING THE ARCHIVE FILE. This is the part
 *     that cannot be inferred from shape, and it is the reason this tool refuses instead of
 *     guessing. In a Current state section the dated blocks are followed by DURABLE state:
 *     which repositories exist, how many roles there are, what the board is. Those paragraphs
 *     are bold, look exactly like a block's continuation, and must never be archived, because
 *     they are the only copy of facts a session needs today. The existing pointer paragraph is
 *     the one reliable marker of where history stops and live state begins.
 *
 *   - IF THERE IS NO SUCH PARAGRAPH THE RUN REFUSES AND NAMES A REMEDY YOU CAN PERFORM.
 *     `--boundary "<text>"` names the first paragraph that is NOT dated history. A refusal with
 *     no performable remedy is the failure class this studio keeps recording, so this one has
 *     an answer rather than an apology.
 *
 *   - THE BLOCK DATES MUST NOT ASCEND. Newest first is the convention here, and archiving the
 *     wrong end discards exactly what the next session needs. If the dates rise anywhere in the
 *     region, which end is newest cannot be established and nothing is written.
 *
 * WHAT MAKES IT SAFE TO RUN UNSUPERVISED, which is the whole point of building it:
 *
 *   - IT PROVES THE SPLIT ACCOUNTS FOR EVERY LINE BEFORE IT WRITES ANYTHING. Kept plus archived
 *     must equal the region exactly, line for line, or the run is abandoned with the source
 *     untouched.
 *
 *   - IT WRITES EVERY ARCHIVE FIRST AND READS EACH ONE BACK FROM DISK. The source is rewritten
 *     only once every archive exists and every distinct non-blank line is proved present in it
 *     (S106). A crash between the two steps leaves duplication, which is recoverable, rather
 *     than a truncated record, which is not.
 *
 *   - IT LEAVES A POINTER, as a hard requirement. Moving history out of the loaded file stops it
 *     being re-read, which is the point, and stops it being SEEN, which is not.
 */

const fs = require('fs');
const path = require('path');

const KEEP_DEFAULT = 1;

// The sections this tool knows, each with the archive that belongs to it. Kept as data rather
// than as two code paths, because the two sections differ only in their names and a second code
// path is a second place for the safety proofs to be almost right.
// THESE TWO ARE THIS PROJECT'S SECTIONS AND THEY USED TO BE EVERY PROJECT'S. A sibling's
// quarter-megabyte of dated history lives under "## Build status" and archived to nothing,
// because the headings, the archive filenames and the convention a date is written in were all
// facts about _STUDIO compiled into the tool. Six leads, a front door and three CEO decisions all
// planned to "run the existing tools against the other projects" and nobody ran one first: total
// reachable across three siblings was ZERO (S249). They stay as the fallback so this project
// needs no config file, and any project describes its own in '.studio-archive.json'.
const BUILT_IN = [
  { heading: 'Current state', archive: 'WARM_START-ARCHIVE.md', noun: 'sitting state block',
    title: 'Current state archive', opener: 'auto', group: 'Sitting blocks', groupUnit: 'sittings' },
  { heading: 'Session log', archive: 'SESSION-LOG-ARCHIVE.md', noun: 'sitting session log entry',
    title: 'Session log archive', opener: 'auto', group: 'Sitting blocks', groupUnit: 'sittings' },
];
const CONFIG_NAME = '.studio-archive.json';

// The comma is load-bearing. See the header.
const OPENER = /(\d{4}-\d{2}-\d{2}),\s+([A-Z][A-Z-]*)\s+sitting/;

// A SECOND CONVENTION, BECAUSE THE FIRST ONE IS THIS PROJECT'S AND NOT THE METHOD'S.
//
// Measured 2026-09-20 across the estate under ST-294. The pattern above requires a bold span
// carrying "<date>, <ORDINAL> sitting", which is how _STUDIO writes its history and how NO other
// project does. A sibling project's Session log was 217,682 characters, EIGHTY-NINE PER CENT of
// its WARM_START.md, written as 78 unbolded paragraphs opening "2026-09-20 (" and "2026-09-19,
// evening (". The pattern above matched 0 of 78 and the tool reported "nothing to archive" about
// a quarter-megabyte of dated history, in silence, which is S219: a check that never fires and a
// check with nothing to report produce byte-identical evidence.
//
// WHY THIS ONE IS SAFE WITHOUT THE COMMA THE OTHER ONE NEEDS. The comma exists above because that
// pattern is matched against a bold span found ANYWHERE in the paragraph, so without it the
// pointer paragraphs left by earlier archives also match and archiving a pointer removes the trail
// to everything already archived. This pattern is ANCHORED AT THE FIRST CHARACTER of the
// paragraph. A pointer paragraph begins "**The ..." or "**Every dated ...", never with a digit, so
// the anchor does the job the comma does above.
//
// The trailing class is what stops a date being swallowed out of the middle of a sentence and what
// keeps "2026-09-19" from matching inside "2026-09-1999". The optional word after the comma is the
// time of day that project uses to separate several sittings on one calendar day.
// WHAT FOLLOWS THE DATE IS THE DISCRIMINATOR, AND IT USED TO BE ANY WHITESPACE, WHICH IS NO
// DISCRIMINATOR AT ALL. The bold pattern above has the comma doing that job. This one had a
// character class containing \s, so EVERY paragraph opening with a date read as a sitting block,
// including a live fact such as "2026-03-05 is the day the board reached 295 live". That is worse
// than a false positive: blocks are newest first and --keep holds the top ones, so a live line
// dated the same day as the newest block sorts ABOVE it, is kept in its place, and pushes the
// genuinely newest block out into an archive nothing imports. It decides what gets moved out of
// somebody's record, so it refuses the ambiguous shape rather than guessing at it.
//
// A HEADING SEPARATES ITS DATE FROM WHAT FOLLOWS; A SENTENCE DOES NOT. Measured against the real
// conventions in the estate: "2026-09-20 (" and "2026-09-19, evening (" at one sibling project,
// "2026-03-04: " elsewhere. All three put a bracket, a colon, a full stop or a dash after the
// date. Prose puts a word there. The comma was removed from the class for the same reason: the
// optional group already accepts "<date>, <one word>", so a bare comma in the class only ever
// admitted "<date>, <several words>", which is a sentence.
// THE BRACKET IS THE DISCRIMINATOR AND THE OTHERS NEVER WERE. The first version of this class
// contained \s, which is no discriminator at all. The second narrowed it to [(:.-] and was still
// wrong, because a colon, a full stop and a dash are all things PROSE puts after a date: a
// reviewer archived live state through four of them, and the fixture written to prove the fix
// happened to use the one form the guard caught. An opening bracket after a date is not something
// a sentence does, and it is what both real conventions in the estate use: "2026-09-20 (" and
// "2026-09-19, evening (".
//
// THIS FAILS SAFE AND THE OTHER DIRECTION DOES NOT. A project whose entries open "2026-03-04: "
// is no longer recognised, so nothing is archived and somebody reads a dry run that says so. The
// alternative is a live sentence moved into a file nothing imports, silently, and the two are not
// comparable. A project with another convention describes it with lead:<word> or does not archive.
const DATE_OPENER = /^(\d{4}-\d{2}-\d{2})(?:,\s+([A-Za-z]+))?(?=\s*\()/;

// ONE PLACE THAT ANSWERS "IS THIS PARAGRAPH A BLOCK, AND WHAT IS IT CALLED". Both conventions
// return the same shape, so everything downstream stays convention-blind. A block identified by
// date carries the date as its name, because there is no ordinal to carry and inventing one would
// put a number in the record that appears nowhere in the document it came from.
// A THIRD CONVENTION, AND THE RULE ALL THREE OBEY. Measured on a sibling's "## Build status":
// 244 paragraphs, the entry headings opening "Added 2026-09-20 AT THE CLOSE, and it SUPERSEDES
// every commit count below it". The date is not at the first character, so the anchored pattern
// cannot see it, and there is no bold ordinal either. What marks it is the LEAD WORD, which that
// project writes deliberately and prose does not.
//
// THE RULE: A CONVENTION MUST CARRY A DISCRIMINATOR PROSE DOES NOT HAVE. For 'ordinal' it is
// ", <ORDINAL> sitting" inside a bold span. For 'date' it is the separator that follows the date,
// because a heading separates its date from what comes next and a sentence puts a word there. For
// 'lead' it is the word itself. A convention without one archives live state, which is the whole
// failure this tool is built to make impossible.
function leadOpener (word) {
  const re = new RegExp('^' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '\\s+(\\d{4}-\\d{2}-\\d{2})\\b');
  return function (text) {
    const m = text.match(re);
    return m ? { date: m[1], ordinal: word + ' ' + m[1] } : null;
  };
}

// A FOURTH CONVENTION, AND IT IS THE ONE THAT UNBLOCKED THE LARGEST DOCUMENT IN THE ESTATE.
// Measured 2026-09-22 under ST-293. A sibling's "## Session log" is 230,982 characters, 80 per cent
// of its WARM_START.md, written as 34 blocks opening "**2026-09-11, session 28. ...**". The
// 'ordinal' convention above needs "<ORDINAL> sitting" in CAPITALS after the comma, which is how
// _STUDIO writes a block and how that project does not; 'date' needs the date at the first
// character, and there it sits inside a bold span. Both matched 0 of 34 and the tool said "nothing
// to archive" about a quarter-megabyte, which is S219 for the third time in this file.
//
// THE DISCRIMINATOR, because a convention without one archives live state. The bold span, the
// comma after the date, the configured word, and a NUMBER after that word. Prose does not open a
// bold span with a date, a comma, a fixed noun and a numeral; a session heading does, deliberately.
// The number is what separates "2026-09-11, session 28." from "2026-09-11, session notes were
// lost", and it is required rather than optional for exactly that reason.
//
// THE NAME IS THE DOCUMENT'S OWN TEXT rather than a rebuild of it, for the reason ST-302 HIGH 3
// records: every receipt is proved by looking its name up in the archive, so a name this tool
// invented is a name no archive will ever contain and the receipts never fold.
function numberedOpener (word) {
  const re = new RegExp('^(\\d{4}-\\d{2}-\\d{2}),\\s+' +
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+(\\d+)\\b');
  return function (text) {
    const m = boldHead(text).match(re);
    return m ? { date: m[1], ordinal: m[0] } : null;
  };
}

const CONVENTIONS = {
  ordinal: function (text) {
    const m = boldHead(text).match(OPENER);
    return m ? { date: m[1], ordinal: m[2] } : null;
  },
  // THE NAME IS THE DOCUMENT'S OWN TEXT, NOT A REBUILD OF IT. This used to join the date and the
  // time-of-day word with a space, dropping the comma the document actually carries, so a block
  // opening "2026-03-01, evening" was named "2026-03-01 evening". The archive holds the original,
  // and every receipt is proved by looking its name up IN THE ARCHIVE, so the proof searched for a
  // string no archive will ever contain: the receipts never folded and six runs left six of them.
  // The match is taken whole because DATE_OPENER's tail is a lookahead and consumes nothing, so
  // d[0] is exactly the opener as written. Invisible in this project only because its own blocks
  // are named by ordinal, which is S249 again: correct here, broken for the convention the header
  // of this file names as the one it was built for. ST-302 HIGH 3.
  date: function (text) {
    const d = text.match(DATE_OPENER);
    return d ? { date: d[1], ordinal: d[0] } : null;
  },
};

// ONE PLACE THAT ANSWERS "IS THIS PARAGRAPH A BLOCK, AND WHAT IS IT CALLED". Everything
// downstream stays convention-blind. 'auto' is what this project has always done: try the bold
// ordinal, then the anchored date. A block identified by date carries the date as its name,
// because there is no ordinal and inventing one puts a number in the record that appears nowhere
// in the document it came from.
function conventionFor (name) {
  if (!name || name === 'auto') {
    return function (text) { return CONVENTIONS.ordinal(text) || CONVENTIONS.date(text); };
  }
  if (CONVENTIONS[name]) return CONVENTIONS[name];
  const lead = /^lead:(.+)$/.exec(name);
  if (lead) return leadOpener(lead[1].trim());
  const numbered = /^numbered:(.+)$/.exec(name);
  if (numbered) return numberedOpener(numbered[1].trim());
  die('no opener convention called "' + name + '". Known: auto, ordinal, date, lead:<word>, ' +
      'numbered:<word>.');
}

function openerOf (text, conv) {
  return (conv || conventionFor('auto'))(text);
}

const args = process.argv.slice(2);
function flagValue (name) {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : null;
}
const write = args.includes('--write');
const KEEP = args.indexOf('--keep') > -1 ? parseInt(flagValue('--keep'), 10) : KEEP_DEFAULT;
const onlySection = flagValue('--section');
const boundaryOpt = flagValue('--boundary');

const archiveOpt = flagValue('--archive');
const openerOpt = flagValue('--opener');
const nounOpt = flagValue('--noun');
const valued = ['--keep', '--section', '--boundary', '--archive', '--opener', '--noun'];
const consumed = new Set();
for (const v of valued) { const i = args.indexOf(v); if (i > -1) consumed.add(i + 1); }
const target = args.filter((a, i) => !a.startsWith('--') && !consumed.has(i))[0];

// A BOUNDARY DESCRIBES ONE SECTION AND WAS APPLIED TO EVERY SECTION. The refusal that recommends
// it names the section it is about, so obeying that refusal literally, with no --section, pointed
// the phrase at all of them: a reviewer followed a refusal about the session log and archived the
// live tail of a different section. --boundary end made it worse, because "this section is history
// all the way down" is a claim about ONE section and was read as a claim about all of them.
if (boundaryOpt && !onlySection) {
  die('--boundary says where history stops in ONE section, and without --section it is applied to ' +
    'every section in the document, including ones whose live state sits in a different place. ' +
    'Nothing was written. Name the section it belongs to: --section "<heading>" --boundary "...". ' +
    'To give each section its own, put "boundary" on it in .studio-archive.json.');
}

function die (msg) { console.error('archive-sittings: ' + msg); process.exit(2); }
function refuse (msg) { console.log('REFUSED  ' + msg); process.exit(1); }
function say (msg) { console.log('  ' + msg); }

if (!target) die('usage: node tools/archive-sittings.js <file> [--keep N] [--write]');
if (!fs.existsSync(target)) die('no such file: ' + target);
if (!Number.isInteger(KEEP) || KEEP < 1) die('--keep must be a positive whole number');

const src = fs.readFileSync(target, 'utf8');
const nl = src.indexOf('\r\n') > -1 ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);

// --- reading the document ----------------------------------------------------------------------

// A paragraph is a run of non-blank lines. Blocks are found at paragraph level and not at line
// level because a block's opening sentence wraps: the date that identifies a sitting is routinely
// on the SECOND line of its own bold header, so any line-wise scan misses every block in the file.
function paragraphs (lo, hi) {
  const out = [];
  let buf = [], start = -1;
  for (let i = lo; i <= hi && i < lines.length; i++) {
    if (lines[i].trim() === '') {
      if (buf.length) { out.push({ start: start, end: i - 1, text: buf.join(' ') }); buf = []; }
      continue;
    }
    if (!buf.length) start = i;
    buf.push(lines[i]);
  }
  if (buf.length) out.push({ start: start, end: Math.min(hi, lines.length - 1), text: buf.join(' ') });
  return out;
}

function boldHead (text) {
  const m = text.match(/^\*\*([\s\S]+?)\*\*/);
  return m ? m[1] : '';
}

// A HORIZONTAL RULE ENDS A SECTION HERE AND SEPARATES ONE INSIDE A SIBLING'S, AND THE TOOL COULD
// NOT TELL THOSE APART. In _STUDIO a "---" sits BETWEEN sections, so stopping at one is right and
// stops a run walking out of the section it was aimed at. Measured 2026-09-22 under ST-293: a
// sibling writes "## Session log", then the pointer to its archive, then a "---", then 34 blocks
// and 230,982 characters. The scan stopped at that rule, the region was the pointer alone, and the
// tool reported "nothing to archive" about 80 per cent of the document. S219 again, and this time
// the silence was produced by a rule that is CORRECT in the project the tool was written in.
//
// SO IT IS OPT-IN AND IT WILL NEVER BE A DEFAULT, exactly like --boundary end. "rules: through"
// says: I have read this document and a horizontal rule inside this section is a separator rather
// than its end. Getting that wrong walks into the next section, which is why it is typed by a
// human in a config rather than inferred from shape. Everything else still stops at the rule.
function sectionRange (heading, throughRules) {
  const want = new RegExp('^##\\s+' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
  let at = -1;
  for (let i = 0; i < lines.length; i++) { if (want.test(lines[i])) { at = i; break; } }
  if (at === -1) return null;
  let end = lines.length - 1;
  for (let i = at + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || (!throughRules && /^---\s*$/.test(lines[i]))) { end = i - 1; break; }
  }
  return { start: at, end: end };
}

// --- planning one section -----------------------------------------------------------------------

function plan (section) {
  const range = sectionRange(section.heading, section.throughRules);
  if (!range) return { section: section, skip: 'no "## ' + section.heading + '" section in this file' };

  const conv = conventionFor(section.opener);
  const paras = paragraphs(range.start + 1, range.end);
  const openers = paras.filter(p => openerOf(p.text, conv) !== null);
  if (!openers.length) {
    return { section: section, skip: 'no dated blocks under "' + section.heading + '" by the "' +
      section.opener + '" convention' };
  }

  const first = openers[0];

  // Where history stops. The archive pointer is the marker; --boundary overrides it by naming
  // the first paragraph that is not dated history.
  // A SECTION CAN BE HISTORY ALL THE WAY DOWN, AND THE FIRST DESIGN COULD NOT EXPRESS THAT.
  // Found by running the dry run against a real sibling document rather than by reading: its
  // "## Build status" is 244 paragraphs of dated entries with no live tail at all, because the
  // live state lives in a different section. The rule below demands a paragraph that is NOT
  // history, so the region collapsed to the first block and the tool reported nothing to archive
  // about 94,965 characters, which is the same silence S249 is about.
  //
  // IT IS AN EXPLICIT WORD AND IT WILL NEVER BE A DEFAULT. "--boundary end" says: I have read this
  // section and every paragraph in it down to the next heading is history. That is a claim only a
  // human can make, and making it wrong archives live state, so it has to be typed rather than
  // inferred. Everything else still refuses.
  const marker = boundaryOpt || section.boundary || section.archive;
  const toTheEnd = /^end$/i.test(marker);
  const bound = toTheEnd ? { start: range.end + 1 }
    : paras.find(p => p.start > first.start && p.text.indexOf(marker) > -1);
  if (!bound) {
    refuse('"' + section.heading + '" has dated blocks but nothing marking where they stop. This ' +
      'tool bounds the dated region at the first paragraph naming ' + section.archive + ', because ' +
      'the paragraphs after the last block are live state that looks identical to a block and must ' +
      'not be archived. Nothing was written. Re-run naming the first paragraph that is NOT dated ' +
      'history: --boundary "<a distinctive phrase from it>". If the section really is history all ' +
      'the way down to the next heading, say so deliberately with --boundary end.');
  }

  const regionStart = first.start;
  const regionEnd = bound.start - 1;
  const inRegion = openers.filter(o => o.start >= regionStart && o.start <= regionEnd);

  const blocks = inRegion.map((o, i) => {
    const next = inRegion[i + 1];
    const m = openerOf(o.text, conv);
    return {
      start: o.start,
      end: next ? next.start - 1 : regionEnd,
      date: m.date,
      ordinal: m.ordinal,
    };
  });

  // WHICH END IS NEWEST, AND THE ANSWER USED TO BE ASSUMED RATHER THAN ESTABLISHED.
  //
  // Newest first is _STUDIO's convention and this refused anything else outright, on the correct
  // reasoning that archiving the wrong end discards exactly what the next session needs. What it
  // could not tell apart was a document in the OTHER consistent order from a document in no order
  // at all, and it named both "no consistent order". Measured 2026-09-22 under ST-293: a sibling's
  // 230,982-character Session log runs session 28 at the top to session 64 at the bottom, rising
  // 8 times and falling never, which is as establishable as newest-first and was refused as if it
  // were a shuffled table. This is `archive-decisions.js`'s own rule arriving one file late: that
  // tool has read a table from either end since the day it was written, because two projects in
  // this studio number in opposite directions.
  //
  // THE TEST IS BOTH DIRECTIONS AT ONCE, NOT EITHER ONE. A region that rises somewhere and falls
  // somewhere else is genuinely unorderable and still refuses. Equal dates are neither, which is
  // ordinary: several sittings land on one calendar day and all-equal keeps today's behaviour.
  const rises = [];
  const falls = [];
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].date > blocks[i - 1].date) rises.push(blocks[i - 1].date + ' then ' + blocks[i].date);
    if (blocks[i].date < blocks[i - 1].date) falls.push(blocks[i - 1].date + ' then ' + blocks[i].date);
  }
  if (rises.length && falls.length) {
    refuse('the dates under "' + section.heading + '" rise ' + rises.length + ' time(s) (' +
      rises[0] + ') and fall ' + falls.length + ' time(s) (' + falls[0] + '), so they are in no ' +
      'consistent order and which end is newest cannot be established. Nothing was written.');
  }
  const oldestFirst = rises.length > 0;

  if (blocks.length <= KEEP) {
    return { section: section, skip: blocks.length + ' block(s) under "' + section.heading +
      '", keeping ' + KEEP + ', so there is nothing to archive yet' };
  }

  // The kept blocks are the NEWEST ones wherever they sit, and the moved ones stay in document
  // order on both paths, so an archive reads in the order the document did.
  const keep = oldestFirst ? blocks.slice(blocks.length - KEEP) : blocks.slice(0, KEEP);
  const move = oldestFirst ? blocks.slice(0, blocks.length - KEEP) : blocks.slice(KEEP);

  // Prove the split accounts for every line of the region BEFORE anything is written.
  //
  // AND THIS IS RECORDED AS UNPROVABLE RATHER THAN LEFT LOOKING LIKE A CONTROL. ST-295 MEDIUM. The
  // three checks below cannot fail as the code stands: blocks are built by walking the openers in
  // the region, each one ending where the next begins and the last ending at regionEnd, so they
  // tile it by construction and the count, the overlap and the coverage all follow. A reviewer
  // guarded them and nothing reddened. They are kept as a TRIPWIRE for a future change to that
  // walk, not deleted, because the cost is three comparisons and the thing they would catch is a
  // silent rewrite of somebody's record. What actually guards the splice today is the orphan check
  // after the rebuild, which compares the document that will be written against the archives on
  // disk and CAN fail: it is covered by a fixture that breaks the splice deliberately.
  //
  // A check nobody has watched fail and a check that always passes are the same thing until
  // somebody writes down which it is. This is the second one, and now it says so.
  const regionLines = regionEnd - regionStart + 1;
  const counted = blocks.reduce((n, b) => n + (b.end - b.start + 1), 0);
  if (counted !== regionLines) {
    die('the split does not account for every line of "' + section.heading + '" (' + counted +
      ' against ' + regionLines + '). Nothing has been written.');
  }
  const seen = new Set();
  for (const b of blocks) for (let i = b.start; i <= b.end; i++) {
    if (seen.has(i)) die('line ' + (i + 1) + ' falls in two blocks at once. Nothing has been written.');
    seen.add(i);
  }
  if (seen.size !== regionLines) {
    die('a line of "' + section.heading + '" falls in no block. Nothing has been written.');
  }

  const body = [];
  for (const b of move) for (let i = b.start; i <= b.end; i++) body.push(lines[i]);
  while (body.length && body[body.length - 1].trim() === '') body.pop();

  return {
    section: section, regionStart: regionStart, regionEnd: regionEnd,
    blocks: blocks, keep: keep, move: move, body: body, oldestFirst: oldestFirst,
  };
}

// --- the pointer left behind ---------------------------------------------------------------------

function today () {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Wrapped to the width the rest of the document uses, and bold on the LEAD SENTENCE only rather
// than on the whole paragraph. Both are house style here, and a pointer that does not look like
// the document it sits in reads as machine exhaust, which is the first thing a reader skips.
const WIDTH = 98;
function wrap (text) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (line + ' ' + word).length > WIDTH) { out.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

function pointerFor (p, proved) {
  const s = p.section;
  const names = p.move.map(b => b.ordinal);
  const which = names.length === 1
    ? 'The ' + names[0] + ' ' + s.noun
    : 'The ' + names[0] + ' back to ' + names[names.length - 1] + ' ' + s.nounPlural;
  const verb = names.length === 1 ? 'was' : 'were';
  const lead = '**' + which + ' ' + verb + ' archived on ' + today() + ' to [' + s.archive + '](' +
    s.archive + ')**, unedited and in the same order.';
  const rest = proved + ' of ' + proved + ' distinct non-blank lines were proved present at the ' +
    'destination and read back from disk before a byte was removed here (S106), 0 missing. This ' +
    'file is @-imported and an archive is not, so a block moved out is still binding, exactly ' +
    'like an archived decision: read ' + s.archive + ' when you are looking for what an earlier ' +
    'sitting found.';
  return wrap(lead + ' ' + rest);
}

// --- THE RECEIPTS ARE ONE PARAGRAPH PER ARCHIVE, NOT ONE PER RUN ----------------------------------
// Every archive leaves a receipt in the loaded document saying what moved, when, to which file, and
// how many distinct non-blank lines were proved at the destination. The receipt is correct and it
// NEVER LEAVES, so it accumulates at one or more per sitting forever inside the file archiving
// exists to shrink. Measured on the real WARM_START.md at the thirty-fifth sitting: 22,756
// characters of archiver residue, 20.4 per cent of the whole document, and the only project that
// had ever archived was the only project paying for it. That makes this a PRECONDITION for asking
// any other project to adopt archiving rather than a tidy-up to do afterwards. ST-257, ST-258.
//
// WHAT IS KEPT AND WHAT GOES. Kept: which sittings, which file, and the sentence saying a block
// moved out is STILL BINDING, because that is the only part a later session has to act on. Dropped:
// the per-run proof counts. S106 is a rule about PROVING a move before making it, and the proof was
// performed; it never asked for the receipt to sit in a loaded document forever. The proof belongs
// in the commit message and in the archive, both findable and NEITHER loaded, which is brevity.md's
// own "findable AND NOT LOADED".
//
// IT ONLY TOUCHES RECEIPTS THIS TOOL WROTE. Hand-written pointer paragraphs say different things
// and are left exactly where they are, because a consolidation that eats prose it did not author
// is a deletion wearing a consolidation's costume.
// THE UNDERSCORE IN THE FILENAME CLASS IS LOAD-BEARING. Written as [A-Z-]+ this matched
// SESSION-LOG-ARCHIVE.md and silently missed WARM_START-ARCHIVE.md, so half the receipts
// consolidated and half did not, and the run reported success about the half it could see.
// The name group takes EITHER convention: an ORDINAL from the bold form, or a date, optionally
// with a time-of-day word, from the anchored form. Left as ordinals only, a project whose blocks
// are dated would have its receipts go unrecognised and accumulate one per run, which is the very
// defect this consolidation exists to fix, reintroduced for everyone except this project.
// THE THIRD ALTERNATIVE IS THE LEAD CONVENTION'S NAME, e.g. "Added 2026-09-20". Left out, a
// project whose entries are named that way would have its receipts go unrecognised and accumulate
// one per run, which is the defect this consolidation exists to fix, reintroduced for everyone
// except the projects that happen to write dates the way this one does.
// THE DATE BRANCH TAKES THE COMMA, because the name it has to match is now the document's own
// opener rather than a rebuild of it. Optional, so a date with no time-of-day word and the
// receipts already written in this project both still parse. ST-302 HIGH 3.
//
// AND IT TAKES A RUN OF SPACES OR TABS, BECAUSE THE OPENER IT HAS TO MATCH DOES. DATE_OPENER
// accepts ",\s+" while this accepted exactly one space, so a block headed "2026-03-01,  evening ("
// with two spaces was given a name this pattern could never read back, and the receipt went
// unfindable on the next run. That is the same residue ST-302 HIGH 3 was about, one whitespace
// character away, and it survived that fix because the two patterns were written apart and never
// compared. Any pattern that reads a name another pattern WROTE has to accept what that one emits.
//
// NOT \s, DELIBERATELY, AND THE GAP IS NAMED RATHER THAN PAPERED OVER. \s would also match a
// newline, and this pattern is not line-anchored at its tail, so it could run a name across a line
// break and match text from the row below. DATE_OPENER can therefore still emit one thing this
// cannot read, a heading split by a newline inside the comma, which is not a shape markdown
// produces. A reviewer flagged the earlier version of this comment for claiming total coverage it
// did not have, which is the same overclaim the rest of this release is about.
const NAME = '([A-Z][A-Z-]+|\\d{4}-\\d\\d-\\d\\d(?:,?[ \\t]+[A-Za-z]+)?|[A-Z][A-Za-z]* \\d{4}-\\d\\d-\\d\\d)';
const ARCHIVE = '\\[([A-Z_-]+\\.md)\\]';
// THE WORD "sitting" MOVED OUT OF THIS PATTERN AND INTO THE SECTION'S OWN NOUN. Hard-coded here
// it was a claim about every project's vocabulary, and writing "sitting" into a sibling's build
// status is a false word in somebody else's record. The existing receipts in this project still
// match, because its nouns now begin with that word.
// THE NOUN MUST BE WHOLE WORDS AND IT USED TO BE [a-z ]+?, WHICH COULD MATCH NOTHING. NAME's own
// optional trailing word then swallowed the first word of the noun: for a project whose blocks are
// named by date, "2026-03-01 rounds were archived" parsed with last = "2026-03-01 rounds", a
// string no archive will ever contain, so the proof failed, the receipts never consolidated and
// residue accrued at 473 characters a sitting forever. Invisible in THIS project only because the
// ordinal branch of NAME cannot take a lowercase word, which is S249 inside one regular
// expression: correct here, broken for everyone whose convention differs.
const NOUN = '(?:[a-z]+ )*?[a-z]+';
const RECEIPT_RE = new RegExp('^\\*\\*The ' + NAME + '(?: back to ' + NAME + ')? ' + NOUN + ' ' +
  '(?:was|were) archived on \\d{4}-\\d\\d-\\d\\d to ' + ARCHIVE);

// AND THE PARAGRAPH THE CONSOLIDATION ITSELF WRITES, because otherwise this tool cannot recognise
// its own output. It writes "**Sitting blocks for the" and the pattern above demands "**The ", so
// one run consolidated, the next saw a paragraph it could not read plus one fresh receipt, counted
// fewer than two it understood, and left both alone. Receipts then accumulated at one per two
// sittings forever: the defect this consolidation exists to remove, halved rather than fixed.
const CONSOLIDATED_RE = new RegExp('^\\*\\*[A-Z][A-Za-z ]*? for the ' + NAME + ' back to the ' + NAME +
  ' ' + NOUN + ' were archived to ' + ARCHIVE);

// THE TAIL IS WHAT MAKES DROPPING THE PARAGRAPH SAFE, AND IT WAS MISSING. Both patterns above
// identify a receipt by its HEAD, and the consolidation then dropped every LINE of the paragraph.
// A sentence somebody appended to a receipt was therefore deleted into no archive while the run
// printed success, and the header five lines up promises the exact opposite: that this only
// touches receipts it wrote. A paragraph whose head matches and whose tail does not is a receipt
// SOMEBODY HAS EDITED. It is reported and left exactly where it is, because the alternative is a
// deletion wearing a consolidation's costume.
// ANCHORED AT BOTH ENDS WITH NO ROOM IN BETWEEN, because guarding the head and the tail leaves the
// MIDDLE free and the whole paragraph is still dropped. A sentence inserted between the first
// sentence and the last was deleted, held by no archive, with no report and exit 0, by the guard
// written to stop exactly that. The error was in the direction that flatters the fix: it caught
// the case that had been reported and not the case it claimed to cover. These two patterns are
// the sentences this tool generates, end to end, so anything a human has added anywhere in the
// paragraph fails to match and the paragraph is reported and left alone.
const WHOLE_RECEIPT = new RegExp('^\\*\\*The ' + NAME + '(?: back to ' + NAME + ')? ' + NOUN + ' ' +
  '(?:was|were) archived on \\d{4}-\\d\\d-\\d\\d to ' + ARCHIVE + '\\([A-Z0-9_-]+\\.md\\)' +
  '\\*\\*, unedited and in the same order\\. \\d+ of \\d+ distinct non-blank lines were proved ' +
  'present at the destination and read back from disk before a byte was removed here \\(S106\\), ' +
  '0 missing\\. This file is @-imported and an archive is not, so a block moved out is still ' +
  'binding, exactly like an archived decision: read [A-Z0-9_-]+\\.md when you are looking for ' +
  'what an earlier sitting found\\.$');
const WHOLE_CONSOLIDATED = new RegExp('^\\*\\*[A-Z][A-Za-z ]*? for the ' + NAME + ' back to the ' +
  NAME + ' ' + NOUN + ' were archived to ' + ARCHIVE + '\\([A-Z0-9_-]+\\.md\\)\\*\\*, unedited and ' +
  'in the same order, every distinct non-blank line proved present at the destination and read ' +
  'back from disk before a byte was removed here \\(S106\\)\\. This file is @-imported and an ' +
  'archive is not, so a block moved out is still binding, exactly like an archived decision: read ' +
  '[A-Z0-9_-]+\\.md when you are looking for what an earlier sitting found\\.$');

// ONE PLACE THAT ANSWERS "IS THIS A RECEIPT, AND IS IT STILL WORD FOR WORD OURS".
function receiptOf (text) {
  const m = text.match(RECEIPT_RE) || text.match(CONSOLIDATED_RE);
  if (!m) return null;
  const t = text.trim();
  return { first: m[1], last: m[2] || m[1], archive: m[3],
           ours: WHOLE_RECEIPT.test(t) || WHOLE_CONSOLIDATED.test(t) };
}

function paragraphsOf (all) {
  const out = [];
  let i = 0;
  while (i < all.length) {
    if (all[i].trim() === '') { i++; continue; }
    const start = i;
    while (i < all.length && all[i].trim() !== '') i++;
    out.push({ start: start, end: i - 1, text: all.slice(start, i).join(' ') });
  }
  return out;
}

function consolidateReceipts (all, dir, sections) {
  const groups = new Map();
  const edited = new Map();
  for (const p of paragraphsOf(all)) {
    // MATCHED AGAINST THE WHOLE PARAGRAPH, NOT ITS FIRST LINE. These receipts are wrapped at 98
    // characters by this same tool, so the archive filename that identifies which group a receipt
    // belongs to routinely lands on line two. Matching line one found nothing on the real document
    // and the consolidation silently did no work, which looked exactly like having nothing to do.
    const m = receiptOf(p.text);
    if (!m) continue;
    if (!m.ours) { edited.set(m.archive, (edited.get(m.archive) || 0) + 1); continue; }
    if (!groups.has(m.archive)) groups.set(m.archive, []);
    groups.get(m.archive).push({ start: p.start, end: p.end, first: m.first, last: m.last });
  }

  const drop = new Set();
  const replace = new Map();
  const report = [];
  for (const [archive, n] of edited) {
    report.push(archive + ': ' + n + ' receipt(s) HAND-EDITED since this tool wrote them, so ' +
      'they carry text that is in no archive and they are left exactly where they are');
  }
  for (const [archive, found] of groups) {
    if (found.length < 2) continue;
    // PROVE IT BEFORE REMOVING IT, same protection as a decision row. Every ordinal the receipts
    // name is looked for in the archive file READ BACK FROM DISK. One that is not there means the
    // receipts stay exactly as they are, because they would be the only trail to it.
    const file = path.join(dir, archive);
    if (!fs.existsSync(file)) { report.push(archive + ': no such archive on disk, receipts left alone'); continue; }
    const text = fs.readFileSync(file, 'utf8');
    const unproved = [];
    for (const f of found) {
      if (text.indexOf(f.first) === -1) unproved.push(f.first);
      if (text.indexOf(f.last) === -1) unproved.push(f.last);
    }
    if (unproved.length) {
      report.push(archive + ': ' + found.length + ' receipt(s) NOT consolidated, ' +
        Array.from(new Set(unproved)).join(', ') + ' absent from the archive, so the receipts are ' +
        'the only trail to them and they stay');
      continue;
    }
    const newest = found[0].first;
    const oldest = found[found.length - 1].last;
    const owner = (sections || []).filter(x => x.archive === archive)[0];
    const group = owner ? owner.group : 'Sitting blocks';
    const unit = owner ? owner.groupUnit : 'sittings';
    replace.set(found[0].start, wrap('**' + group + ' for the ' + newest + ' back to the ' + oldest +
      ' ' + unit + ' were archived to [' + archive + '](' + archive + ')**, unedited and in the same ' +
      'order, every distinct non-blank line proved present at the destination and read back from ' +
      'disk before a byte was removed here (S106). This file is @-imported and an archive is not, ' +
      'so a block moved out is still binding, exactly like an archived decision: read ' + archive +
      ' when you are looking for what an earlier sitting found.'));
    for (const f of found) for (let i = f.start; i <= f.end; i++) drop.add(i);
    report.push(archive + ': ' + found.length + ' receipt(s) consolidated to 1 (' + newest +
      ' back to ' + oldest + ')');
  }
  if (!drop.size) return { lines: all, report: report };

  const out = [];
  for (let i = 0; i < all.length; i++) {
    if (replace.has(i)) { out.push.apply(out, replace.get(i)); continue; }
    if (drop.has(i)) {
      // take the blank line that followed the receipt with it, never a line of prose
      if (!drop.has(i + 1) && !replace.has(i + 1) && out.length && out[out.length - 1] === '' &&
          all[i + 1] !== undefined && all[i + 1].trim() === '') out.pop();
      continue;
    }
    out.push(all[i]);
  }
  return { lines: out, report: report };
}

// --- run ------------------------------------------------------------------------------------------

// WHERE THE SECTION LIST COMES FROM, most specific first. Flags beat the config file, the config
// file beats this project's built-in two, and naming --section with --archive lets a project be
// archived once from the command line before anybody writes a config for it. That order is what
// makes the tool usable on a document nobody has described yet, which is how every rollout starts.
function normalise (raw, where) {
  if (!raw || typeof raw.heading !== 'string' || !raw.heading.trim()) {
    die(where + ': every section needs a "heading", naming the "## " line it archives.');
  }
  if (typeof raw.archive !== 'string' || !/^[A-Z0-9_-]+\.md$/.test(raw.archive)) {
    die(where + ': section "' + raw.heading + '" needs an "archive" filename in capitals ending ' +
      '.md, because the receipt left behind has to be findable by pattern as well as by eye.');
  }
  // CONSTRAINED FOR THE SAME REASON `archive` IS, and it was not. The noun is interpolated into
  // RECEIPT_RE, which can only read lower-case words, so a project whose entries are "Round" or
  // "build-status" gets receipts written that the consolidation can never match again: six
  // sittings leave six receipts, growing the document this tool exists to shrink, silently and in
  // somebody else's record. Same cause as the tool failing to read its own consolidated output: a
  // field a PROJECT supplies, interpolated into a pattern without being constrained. ST-295.
  //
  // REFUSED RATHER THAN LOWER-CASED. Coercing it would write a word into a sibling's document that
  // its authors did not choose, which is the exact fault pluralOf exists to avoid one line below.
  const noun = raw.noun || 'entry';
  const plural = raw.nounPlural || pluralOf(noun);
  for (const pair of [['noun', noun], ['nounPlural', plural]]) {
    if (!/^[a-z]+( [a-z]+)*$/.test(pair[1])) {
      // THE REMEDY HAS TO BE ONE THE READER CAN PERFORM, and the first version of this message
      // named one that cannot be. It told them to supply "nounPlural", which is checked by this
      // same predicate, so following the instruction produces the identical refusal. A content
      // reviewer proved it with a config. The header of this file promises a refusal names a
      // remedy you can perform, so the message was falsifying its own file's claim. ST-295.
      die(where + ': section "' + raw.heading + '" has a "' + pair[0] + '" of "' + pair[1] + '". ' +
        'It must be one or more lower-case words separated by single spaces, with no capital, ' +
        'hyphen or digit, because it is written into the receipt paragraph and read back out of ' +
        'it by pattern. Rewrite it in lower-case words, for example "build status entry" rather ' +
        'than "Build-Status Entry". Both "noun" and "nounPlural" are held to this, so supplying ' +
        'one to escape the other will not help; set "nounPlural" only when the plural this tool ' +
        'derives is the wrong word.');
    }
  }
  return {
    heading: raw.heading,
    archive: raw.archive,
    noun: noun,
    nounPlural: plural,
    title: raw.title || (raw.heading + ' archive'),
    opener: raw.opener || 'auto',
    group: raw.group || (plural.charAt(0).toUpperCase() + plural.slice(1)),
    groupUnit: raw.groupUnit || plural,
    boundary: raw.boundary || null,
    throughRules: raw.rules === 'through',
  };
}

// THE PLURAL IS GENERATED INTO SOMEBODY'S RECORD, so it cannot be noun + 's'. A section whose
// noun is "build status entry" would have had "entrys" written into a sibling project's own
// document, permanently, by a tool whose entire claim is that it does not damage the record it
// edits. A project that wants a word this does not reach supplies "nounPlural".
// A SAVING THAT IS NEGATIVE IS NOT A SAVING, AND THIS TOOL PRINTED IT AS ONE. Three call sites all
// said "N off every request" with N computed as before minus after, so a run that GREW the document
// reported the growth as a benefit with a minus sign in front of it. That is the one number anybody
// reads to decide whether archiving is working, and it was the number that could not tell them it
// had stopped. Ten simulated sittings once grew a document from 1,134 to 5,642 characters while
// archiving it, and every one of those runs printed a saving. ST-295 LOW.
function savingLine (before, after) {
  const d = before - after;
  if (d > 0) return before + ' to ' + after + ' characters, ' + d + ' off every request';
  if (d === 0) return before + ' to ' + after + ' characters, no change';
  return before + ' to ' + after + ' characters, which is ' + (-d) + ' MORE on every request. ' +
    'Archiving is supposed to shrink this document and this run grew it.';
}

function pluralOf (noun) {
  if (/[^aeiou]y$/.test(noun)) return noun.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/.test(noun)) return noun + 'es';
  return noun + 's';
}

function configuredSections (dir) {
  const f = path.join(dir, CONFIG_NAME);
  if (!fs.existsSync(f)) return null;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { die(CONFIG_NAME + ' is not readable JSON (' + e.message + '). Nothing was written, ' +
    'because a tool that falls back to its defaults when a project\'s own configuration is broken ' +
    'archives the wrong thing and reports success.'); }
  const list = cfg && cfg.sections;
  if (!Array.isArray(list) || !list.length) {
    die(CONFIG_NAME + ' has no "sections" array. Nothing was written.');
  }
  return list.map(x => normalise(x, CONFIG_NAME));
}

const configured = configuredSections(path.dirname(target));
// THE BUILT-IN TWO GO THROUGH THE SAME NORMALISER as a project's own, so there is one place that
// decides what a section means. Left raw they would carry no plural and no group, and this
// project's own archiving would be the one case the generic path had never run.
const SECTIONS = configured || BUILT_IN.map(x => normalise(x, 'the built-in defaults'));
const sourceOfSections = configured ? CONFIG_NAME : 'the built-in defaults';

let wanted;
if (onlySection && archiveOpt) {
  wanted = [normalise({ heading: onlySection, archive: archiveOpt, noun: nounOpt,
                        opener: openerOpt, boundary: boundaryOpt }, 'the command line')];
} else {
  wanted = onlySection ? SECTIONS.filter(x => x.heading.toLowerCase() === onlySection.toLowerCase()) : SECTIONS;
  if (!wanted.length) {
    die('no section called "' + onlySection + '" in ' + sourceOfSections + '. Known: ' +
      SECTIONS.map(x => x.heading).join(', ') + '. To archive a section nothing has described yet, ' +
      'name it with --section and give it --archive <FILE.md>, and --opener when the dates are not ' +
      'written this project\'s way.');
  }
  if (openerOpt || nounOpt) wanted = wanted.map(x => normalise(Object.assign({}, x,
    { opener: openerOpt || x.opener, noun: nounOpt || x.noun }), 'the command line'));
}

const plans = wanted.map(plan);
const doable = plans.filter(p => !p.skip);

// TWO SECTIONS THAT RESOLVE TO THE SAME LINES TRUNCATE THE DOCUMENT, AND THE RUN REPORTS A SAVING.
// The splices below run bottom up so an earlier one cannot move indices a later one was computed
// against, which is correct for regions that do not overlap and is no protection at all for
// regions that do: both plans hold indices into the ORIGINAL array, so the second splice runs
// against an array the first already shortened and slice(regionEnd + 1) takes lines past the end
// of its own region. Reproduced with a config naming one heading twice: exit 0, a character saving
// printed as success, and 11 lines gone into no archive including every live-state line, the next
// heading and the tail of the file. sectionRange matches case-insensitively, so "Rounds" and
// "rounds" is the same fault wearing a disguise. Refused here, before anything is written.
for (let i = 0; i < doable.length; i++) {
  for (let j = i + 1; j < doable.length; j++) {
    const a = doable[i], b = doable[j];
    // AND THE SAME DESTINATION IS THE SAME FAULT ONE STEP LATER. Two DIFFERENT sections pointed at
    // one archive filename pass the overlap test below, because their regions are disjoint and that
    // test is about lines. What they share is where everything downstream is keyed: receipts are
    // grouped by archive NAME, so the second section's receipt folds into the first section's group
    // and the pointer belonging to it is erased. No text is lost, the archive holds both, and the
    // TRAIL to the second section stops existing. Refused rather than merged, because a merged
    // group cannot say which section a block came from and the boundary is per-section. ST-295.
    if (a.section.archive === b.section.archive) {
      refuse('"' + a.section.heading + '" and "' + b.section.heading + '" both write to the ' +
        'same archive file, ' + a.section.archive + '. Receipts and pointers are grouped by that ' +
        'filename, so the second section would lose the pointer that leads to it while its text ' +
        'sat in the archive with nothing naming it. Nothing was written. Give each section its ' +
        'own archive file.');
    }
    if (a.regionStart <= b.regionEnd && b.regionStart <= a.regionEnd) {
      refuse('"' + a.section.heading + '" and "' + b.section.heading + '" resolve to the same ' +
        'lines of this document (' + (a.regionStart + 1) + '-' + (a.regionEnd + 1) + ' and ' +
        (b.regionStart + 1) + '-' + (b.regionEnd + 1) + '). Headings are matched without regard to ' +
        'case, so two entries differing only in case are one section. Archiving both would rewrite ' +
        'the same lines twice and destroy whatever followed them. Nothing was written. Give each ' +
        'section a heading that appears once.');
    }
  }
}

console.log('');
console.log('  ' + target + '  ' + src.length + ' characters');
for (const p of plans) {
  if (p.skip) { say(p.section.heading + ': ' + p.skip); continue; }
  say(p.section.heading + ': ' + p.blocks.length + ' dated block(s), keep ' + p.keep.length +
      ' (' + p.keep.map(b => b.ordinal).join(', ') + '), archive ' + p.move.length +
      ' (' + p.move.map(b => b.ordinal).join(', ') + ')');
  say('  ' + p.body.length + ' line(s) to ' + p.section.archive);
}
console.log('');

// NOTHING TO ARCHIVE IS NOT NOTHING TO DO. The receipts are residue from PREVIOUS runs and they
// cost on every request whether or not this run has a block to move, so the consolidation is
// attempted on this path too. The real document had one dated block in each section, so the tool
// said "already inside the shape this tool keeps" and exited, about a 111,332 character file whose
// archiver residue was 20.4 per cent. Found by RUNNING the tool on the real file, not by reading it.
if (!doable.length) {
  const c = consolidateReceipts(lines, path.dirname(target), wanted.concat(SECTIONS));
  c.report.forEach(say);
  if (c.lines === lines) {
    console.log('Nothing to archive. The document is already inside the shape this tool keeps.');
    process.exit(0);
  }
  const out = c.lines.join(nl);
  say(savingLine(src.length, out.length));
  if (!write) {
    console.log('DRY RUN. Nothing was modified. Re-run with --write to apply.');
    process.exit(0);
  }
  fs.writeFileSync(target, out, 'utf8');
  // WHOLE, NOT BY LENGTH. This read it back and compared the SIZE, and a document of the right
  // length that is not the right document passes that. S258: a file with clean bytes and broken
  // content reads as repaired. ST-302 LOW 6.
  const back = fs.readFileSync(target, 'utf8');
  if (back !== out) die('the consolidated document did not survive the write: ' + out.length +
      ' characters were written and ' + back.length + ' read back.');
  // THROUGH savingLine LIKE THE OTHER TWO. Its own comment counts three call sites and it covered
  // two; a reviewer found this one still doing the raw subtraction. Unreachable with a negative
  // today, because consolidation only fires on two or more receipts and always folds them into one
  // shorter paragraph, and that is exactly the kind of "cannot happen" that ships wrong the day
  // the path changes. ST-295.
  console.log('consolidated the archive receipts, ' + savingLine(src.length, back.length) +
              '. Nothing was archived; there was nothing to archive.');
  process.exit(0);
}

if (!write) {
  console.log('DRY RUN. Nothing was modified. Re-run with --write to apply.');
  process.exit(0);
}

// --- write every archive FIRST, and read each one back --------------------------------------------
const dir = path.dirname(target);
for (const p of doable) {
  const archivePath = path.join(dir, p.section.archive);
  const exists = fs.existsSync(archivePath);
  const header = [
    '# ' + p.section.title,
    '',
    'Moved out of `' + path.basename(target) + '` so they are not re-read on every request.',
    'Nothing here is retired: this is the same record, read on demand instead of every time.',
    'This file is deliberately NOT @-imported.',
    '',
  ].join(nl);
  const body = p.body.join(nl);
  const existing = exists ? fs.readFileSync(archivePath, 'utf8') : null;
  const out = exists
    ? existing.replace(/\s*$/, '') + nl + nl + body + nl
    : header + body + nl;
  fs.writeFileSync(archivePath, out, 'utf8');

  const readBack = fs.readFileSync(archivePath, 'utf8');
  const distinct = Array.from(new Set(p.body.filter(l => l.trim() !== '')));
  const missing = distinct.filter(l => readBack.indexOf(l) === -1);
  if (missing.length) {
    die(missing.length + ' of ' + distinct.length + ' distinct non-blank line(s) did not survive ' +
      'the write to ' + p.section.archive + '. The source has NOT been touched, so nothing is lost.');
  }
  p.proved = distinct.length;
  say(p.section.archive + ': ' + p.proved + ' of ' + p.proved + ' distinct non-blank lines read ' +
      'back from disk, 0 missing');
}

// --- only now rewrite the source --------------------------------------------------------------------
// Bottom up, so an earlier splice cannot move the line numbers a later one was computed against.
let rebuilt = lines.slice();
for (const p of doable.slice().sort((a, b) => b.regionStart - a.regionStart)) {
  const kept = [];
  for (const b of p.keep) for (let i = b.start; i <= b.end; i++) kept.push(lines[i]);
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  // THE POINTER GOES WHERE THE HISTORY WENT. In a newest-first document the moved blocks sat at
  // the BOTTOM of the region, so the pointer belongs under what is kept. In an oldest-first one
  // they sat at the TOP, and a pointer left at the bottom would tell a reader that the oldest
  // sittings are below the newest ones, which is the one thing it exists to get right.
  const ptr = pointerFor(p, p.proved);
  const replacement = p.oldestFirst
    ? ptr.concat([''], kept, [''])
    : kept.concat([''], ptr, ['']);
  rebuilt = rebuilt.slice(0, p.regionStart).concat(replacement, rebuilt.slice(p.regionEnd + 1));
}

// EVERY LINE THAT LEAVES THIS DOCUMENT HAS TO BE IN AN ARCHIVE, AND NOTHING PROVED THAT DIRECTION.
// The read-back above proves the archive received what was SENT to it. This proves the opposite
// and more important thing: that nothing left the document which no archive holds. Every check in
// this file until now was about the plan, and a plan is only as good as the splice that executes
// it; the refusal above catches the one way that splice is known to go wrong, and this catches the
// ways nobody has found yet. It runs BEFORE the receipt consolidation, because that deliberately
// drops text this tool generated and no archive was ever meant to hold.
const survived = new Set(rebuilt.filter(l => l.trim() !== ''));
const inArchives = doable.map(p => {
  try { return fs.readFileSync(path.join(dir, p.section.archive), 'utf8'); } catch (e) { return ''; }
}).join('\n');
const orphaned = Array.from(new Set(lines.filter(l => l.trim() !== '')))
  .filter(l => !survived.has(l) && inArchives.indexOf(l) === -1);
if (orphaned.length) {
  die(orphaned.length + ' line(s) would leave the document without being present in any archive. ' +
    'The source has NOT been touched, so nothing is lost. The first is: ' +
    JSON.stringify(orphaned[0].slice(0, 90)));
}
// THE CONSOLIDATION RUNS HERE TOO, WHICH IS THE WHOLE POINT OF IT. It used to be called from one
// place only, inside the branch taken when there is nothing to archive, so it never ran at a real
// wind-down: every wind-down has a block to move. Ten simulated sittings grew the document from
// 1,134 to 5,642 characters WHILE ARCHIVING IT. It looked correct because the one document it was
// run against happened to have nothing to archive that day, which is the corner case and not the
// norm. A fix that runs only in the corner case is indistinguishable from a fix. S250.
//
// IT RUNS AFTER THE SPLICES AND NEVER BEFORE THEM. Everything above addresses lines by the index
// plan() computed against the ORIGINAL array, and consolidating first would move those lines out
// from under it. This reads the rebuilt array, which is the document as it will be written, and
// that is also what lets it fold the receipt this very run is adding in with the older ones.
const settled = consolidateReceipts(rebuilt, dir, wanted.concat(SECTIONS));
settled.report.forEach(say);
const after = settled.lines.join(nl);
fs.writeFileSync(target, after, 'utf8');
// READ IT BACK, BECAUSE THIS IS THE WRITE WITH SOMETHING TO LOSE. The no-op path above, which
// only folds receipts and removes nothing, verified its own write from the day it was written.
// This one has just taken dated history OUT of the document and did not, which is the wrong way
// round. Compared WHOLE rather than by length: a check on the size cannot tell a document that
// survived from one of the same length that did not, which is the distinction S258 was paid for.
// Nothing is lost when this fires, because the archive was written and proved first, so the
// remedy is to re-run. ST-302 LOW 6.
const landed = fs.readFileSync(target, 'utf8');
if (landed !== after) {
  // "NOTHING IS LOST" WAS FALSE AND A REVIEWER SAID SO. This fires only when the source write did
  // NOT land, so what is at risk is the DOCUMENT rather than the archive, and re-running against a
  // document in an unknown state is not obviously safe. The archive is safe; the remedy is version
  // control. A refusal that misdescribes what survived is worse than one that says less. ST-295.
  die(path.basename(target) + ' did not survive the write: ' + after.length + ' characters were ' +
      'written and ' + landed.length + ' read back. The archive was written and PROVED first, so ' +
      'every block that moved is safe there. The document on disk is in an unknown state: restore ' +
      'it from version control before running this again.');
}

console.log('');
console.log('archived ' + doable.reduce((n, p) => n + p.move.length, 0) + ' dated block(s)');
console.log(path.basename(target) + ' went ' + savingLine(src.length, after.length));
process.exit(0);
