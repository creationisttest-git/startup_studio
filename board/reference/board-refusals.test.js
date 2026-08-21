#!/usr/bin/env node
/*
 * Proves the board refusals, both ways, with no database, no network and no credential.
 *
 * WHY IT SHIPS WITH THE REFERENCE. The first project to install a reference is testing the
 * reference: one install found six defects that had never appeared on the board this was
 * extracted from, and every one was invisible until somebody built from it clean. These refusals
 * are the part of the board that is supposed to be unbreakable, so they are the part that most
 * needs to arrive with its own evidence rather than with a description of itself.
 *
 * EACH REFUSAL IS ASSERTED TWICE. Once that it refuses the thing it names, and once that it does
 * NOT refuse a legitimate case. A guard that refuses everything passes the first half and is
 * useless, and only the second failure mode announces itself.
 *
 *   node board-refusals.test.js
 */
const assert = require('assert');
const R = require('./board-refusals.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; process.stdout.write('FAIL  ' + name + '\n      ' + e.message.split('\n')[0] + '\n'); }
}
function refuses(fn, matcher, why) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  assert.ok(threw, 'expected a refusal, got none: ' + why);
  if (matcher) assert.ok(matcher.test(threw.message), 'refused for the wrong reason: ' + threw.message);
}
function allows(fn) { fn(); }

/* ---------- only QA moves to UAT, and only with notes ---------- */

test('the builder cannot certify their own work', function () {
  refuses(() => R.assertUatMove('uat', 'backend-engineer', 'I tested it'), /only qa-tester/,
    'the agent that built the thing moved it to UAT');
});
test('an unattributed move to UAT is refused', function () {
  refuses(() => R.assertUatMove('uat', null, 'notes'), /only qa-tester/, 'nobody signed for it');
});
test('QA cannot move to UAT without test notes', function () {
  refuses(() => R.assertUatMove('uat', 'qa-tester', null), /test notes/,
    'a ticket in UAT with no notes is a process failure, not a fast one');
});
test('QA with notes is allowed through', function () {
  allows(() => R.assertUatMove('uat', 'qa-tester', 'opened it at 375px and checked both flows'));
});
test('the rule applies to UAT and to nothing else', function () {
  allows(() => R.assertUatMove('in_progress', 'backend-engineer', null));
  allows(() => R.assertUatMove('done', 'anyone', null));
});

/* ---------- the in-flight ceiling ---------- */

const wip = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, status: 'in_progress', size: 'large' }));

test('a third large item is refused', function () {
  refuses(() => R.assertCeiling(wip(2), { id: 'new', size: 'large' }, 'in_progress'), /ceiling/,
    'four things at sixty per cent ship nothing');
});
test('a second large item is allowed', function () {
  allows(() => R.assertCeiling(wip(1), { id: 'new', size: 'large' }, 'in_progress'));
});
test('small work has its own ceiling, not the large one', function () {
  const smalls = Array.from({ length: 3 }, (_, i) => ({ id: 's' + i, status: 'in_progress', size: 'small' }));
  refuses(() => R.assertCeiling(smalls, { id: 'new', size: 'small' }, 'in_progress'), /ceiling/, 'a fourth small item');
  allows(() => R.assertCeiling(smalls, { id: 'new', size: 'large' }, 'in_progress'));
});
test('a ticket already in progress does not count against itself', function () {
  const all = [{ id: 'me', status: 'in_progress', size: 'large' }, { id: 'o', status: 'in_progress', size: 'large' }];
  allows(() => R.assertCeiling(all, { id: 'me', size: 'large' }, 'in_progress'));
});
test('the ceiling applies to starting work and to nothing else', function () {
  allows(() => R.assertCeiling(wip(9), { id: 'new', size: 'large' }, 'done'));
});

/* ---------- a decision cannot evaporate ---------- */

test('a ticket with an unanswered decision cannot be closed', function () {
  refuses(() => R.assertNoOpenDecision({ title: 'T', decisions: [{ question: 'Which?', answered_at: null }] }, 'closed'),
    /unanswered decision/, 'the question is lost and gets re-argued in six weeks');
});
test('the refusal quotes the question, so it can be answered', function () {
  let msg = '';
  try { R.assertNoOpenDecision({ title: 'T', decisions: [{ question: 'Ship or park?', answered_at: null }] }, 'closed'); }
  catch (e) { msg = e.message; }
  assert.ok(msg.indexOf('Ship or park?') !== -1, 'the reader is told a decision is open and not which one');
});
test('an answered decision does not block anything', function () {
  allows(() => R.assertNoOpenDecision({ title: 'T', decisions: [{ question: 'Q', answered_at: '2026-08-22' }] }, 'closed'));
});
test('a ticket with no decisions at all is fine', function () {
  allows(() => R.assertNoOpenDecision({ title: 'T' }, 'closed'));
  allows(() => R.assertNoOpenDecision({ title: 'T', decisions: [] }, 'closed'));
});

/* ---------- the decision format ---------- */

test('an open question is refused', function () {
  refuses(() => R.assertDecisionShape(null, 1), /options/, 'it hands the analysis back to the founder');
});
test('one option is not a decision', function () {
  refuses(() => R.assertDecisionShape(['only this'], 1), /at least two/, 'a single option is an announcement');
});
test('options with no recommendation are refused', function () {
  refuses(() => R.assertDecisionShape(['a', 'b'], null), /recommend/,
    'without it the founder is still doing the thinking, from a shorter list');
});
test('a recommendation naming no real option is refused', function () {
  refuses(() => R.assertDecisionShape(['a', 'b'], 5), /recommend/, 'it points at an option that does not exist');
});
test('numbered options with a recommendation are allowed', function () {
  allows(() => R.assertDecisionShape(['a', 'b', 'something else'], 2));
});

/* ---------- numbering ---------- */

test('a number belonging to a deleted ticket cannot be reissued', function () {
  refuses(() => R.assertFreshNumber([{ num: 7, title: 'old', deleted_at: '2026-01-01' }], 7), /already belongs/,
    'a reused number points two pieces of history at one address');
});
test('the refusal says the clash was with a deleted ticket', function () {
  let msg = '';
  try { R.assertFreshNumber([{ num: 7, title: 'old', deleted_at: 'x' }], 7); } catch (e) { msg = e.message; }
  assert.ok(msg.indexOf('deleted') !== -1, 'the operator looks for a live ticket, finds none, and blames the tool');
});
test('an unused number is issued', function () {
  allows(() => R.assertFreshNumber([{ num: 1 }, { num: 2 }], 3));
});

process.stdout.write('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
