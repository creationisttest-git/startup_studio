'use strict';

/*
 * tmp-fixtures.js -- one way to make a throwaway fixture root, and one place that removes it.
 *
 * WHAT IT IS FOR (ST-281). Every node suite here builds fixtures under the machine's temp
 * directory, and most of them built the path by hand. Two habits came out of that and both are
 * defects rather than untidiness:
 *
 *   1. A ROOT KEYED ON THE PID IS NOT UNIQUE, IT IS UNIQUE UNTIL THE PID COMES ROUND AGAIN.
 *      `path.join(os.tmpdir(), 'x-' + process.pid)` with mkdirSync recursive succeeds on a
 *      directory that already exists and clears nothing, so a file left by an earlier run that
 *      drew the same pid is still there when the next run asserts it is absent. 2,895 such
 *      directories across 140 pids were on this machine when it was found, and the suite that
 *      gates every release was reproduced going 105 passed 1 failed against an unmodified tree.
 *      A failure like that reads as a flake, and a flake gets re-run rather than read.
 *
 *   2. A ROOT NOBODY REMOVES MAKES A SUITE'S ANSWER DEPEND ON HOW OFTEN THE MACHINE HAS BEEN
 *      ASKED. 27,629 fixture roots were counted across the other suites. That is the same shape
 *      as the defect above waiting for a tool that keys on something stable.
 *
 * WHY CLEANUP AT EXIT AND NOT PER CASE. The case that forgets to clean up is reliably the one
 * asserting that something is MISSING, which is exactly the case a leftover file breaks. That
 * was measured, not guessed: ten fixtures, nine cleanups, and the one that forgot was the
 * fail-open case. A process exit handler cannot be forgotten by a case that has not been
 * written yet.
 *
 * WHY THE REMOVAL IS ALLOWED TO FAIL SILENTLY. On Windows a file held open by a child process
 * that has not fully exited makes rmSync throw, and a suite that reported red because the
 * operating system was slow to let go would be a worse instrument than one that leaves a
 * directory behind. The residue is measured by the runner rather than by this file, so a
 * failure to remove shows up as a number there instead of as an exception here.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const roots = [];
let registered = false;

/* A fresh directory that no other run can be occupying. mkdtempSync appends six characters the
 * operating system guarantees are unused, which is the property the hand-built names lacked.
 * The pid stays in the name so a directory found in the wild can still be traced to a run. */
function fixtureRoot (prefix) {
  if (!registered) {
    process.on('exit', cleanup);
    registered = true;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix + '-' + process.pid + '-'));
  roots.push(dir);
  return dir;
}

function cleanup () {
  while (roots.length) {
    const d = roots.pop();
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* see the header */ }
  }
}

module.exports = { fixtureRoot, cleanup };
