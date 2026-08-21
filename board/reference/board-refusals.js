// ---------------------------------------------------------------- refusals

// PORTED FROM THE REHEARSAL BOARD, which enforces these and has done since 2026-08-18. This
// reference documented them and enforced none, so every project built from it got a board that
// TRUSTS its operator to remember the rules. The studio's own position on that is not subtle: a
// rule nobody can break is the only kind that survives a bad afternoon.
//
// The rehearsal board refused a shipped ticket being reopened during the session that wrote this,
// and it changed what got done. That is the argument, in one instance.

const CEILING = { large: 2, small: 3 };

// S3, and the most important rule on the board. The agent that built the thing never certifies
// it, and a ticket in UAT with no test notes is a process failure rather than a fast one.
function assertUatMove(target, by, notes) {
  if (target !== 'uat') return;
  if (by !== 'qa-tester') {
    throw new Error(
      'only qa-tester moves a ticket to UAT. "' + (by || 'nobody') + '" cannot certify this.\n' +
      '       The agent that built the thing does not get to say it works.');
  }
  if (!notes) {
    throw new Error(
      'qa-tester must write test notes before UAT.\n' +
      '       Pass --notes "what you tested, and how someone else would repeat it".\n' +
      '       A ticket sitting in UAT with no notes is a process failure, not a fast one.');
  }
}

// S27. Four things at sixty per cent ship nothing. Reaching the ceiling is said out loud with the
// count, rather than absorbed silently by starting a fifth.
function assertCeiling(all, ticket, target) {
  if (target !== 'in_progress') return;
  const size = ticket.size || 'small';
  const n = all.filter(t => t.status === 'in_progress' && (t.size || 'small') === size && t.id !== ticket.id).length;
  if (n >= CEILING[size]) {
    throw new Error(
      size + ' work in progress is already at the ceiling (' + n + '/' + CEILING[size] + ').\n' +
      '       Finish or park something before starting this. Say the count out loud rather than\n' +
      '       quietly starting a fifth thing.');
  }
}

// A ticket cannot be closed over a question the CEO never answered. Without this the decision
// evaporates and gets re-argued in six weeks by people who cannot remember whether it was
// rejected on principle or on timing.
function assertNoOpenDecision(ticket, action) {
  const open = (ticket.decisions || []).filter(d => d.answered_at == null);
  if (open.length) {
    throw new Error(
      ticket.title + ' has an unanswered decision, so it cannot be ' + action + '.\n' +
      '       "' + open[0].question + '"\n' +
      '       Answer it, or the question evaporates and gets re-argued in six weeks.');
  }
}

// The decision format, enforced rather than described. An agent cannot write numbered options
// until it has actually thought the alternatives through, which is the point of the format.
function assertDecisionShape(options, recommend) {
  if (!options || !options.length) {
    throw new Error(
      '--options "a|b|c" is required. An open question hands your analysis back to the CEO,\n' +
      '       which is the work the format exists to force you to do first.');
  }
  if (options.length < 2) throw new Error('give at least two options, or it is not a decision.');
  const n = Number(recommend);
  if (!n || n < 1 || n > options.length) {
    throw new Error(
      '--recommend <n> is required and must name one of your options.\n' +
      '       Without it the founder is still doing the thinking, just from a shorter list.');
  }
}

// A number reused after a soft delete points two pieces of history at one address. The deleted
// row keeps its number forever, which is why deletion here is a flag and never a removal.
function assertFreshNumber(all, num) {
  const clash = all.filter(t => t.num === num);
  if (clash.length) {
    throw new Error(
      'refusing to issue number ' + num + ': it already belongs to "' + clash[0].title + '"' +
      (clash[0].deleted_at ? ' (deleted)' : '') + '.\n' +
      '       Numbering is broken. A reused number points two pieces of history at one address.');
  }
}

module.exports = {
  CEILING, assertUatMove, assertCeiling, assertNoOpenDecision, assertDecisionShape, assertFreshNumber
};
