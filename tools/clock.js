'use strict';

/*
 * clock.js (tools) -- reach the ONE clock from a tool, in either tree.
 *
 * WHY THIS INDIRECTION EXISTS AND IS NOT AVOIDABLE. The definition lives beside the board,
 * because board.js is the program that writes most of a board directory and it must be able to
 * reach it with a plain relative require that means the same thing everywhere. The two trees
 * disagree about where "beside the board" is as seen FROM A TOOL:
 *
 *     source tree      _STUDIO/base/board/clock.js      _STUDIO/tools/doctor-record.js
 *     published tree   startup_studio/board/clock.js    startup_studio/tools/doctor-record.js
 *
 * `base\board` publishes as `board` and `tools` publishes as `tools`, so the hop from a tool is
 * `../base/board` in one and `../board` in the other. board.js itself is unaffected: `./clock.js`
 * is correct in both. Rather than repeat that two-candidate search in every tool that stamps a
 * row, it is written once here and every tool requires `./clock.js`.
 *
 * IT THROWS WHEN IT CANNOT FIND THE DEFINITION, AND THAT IS THE POINT. The tempting fallback is
 * a local copy of the stamp function so the tool keeps working. That fallback is the defect this
 * whole ticket is about: a second definition of the clock, correct on the day it was written,
 * drifting silently afterwards, with every instrument reporting clean. The studio already made
 * this call once, for composed fragments: a missing fragment THROWS rather than warning, because
 * a role that silently loses a rule is worse than a role that will not load. Same reasoning.
 */

const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  path.join(__dirname, '..', 'base', 'board', 'clock.js'),
  path.join(__dirname, '..', 'board', 'clock.js')
];

function locate () {
  for (const c of CANDIDATES) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error(
    'clock.js: the one clock definition was not found. Looked in:\n' +
    CANDIDATES.map(c => '  ' + c).join('\n') + '\n' +
    'A tool that stamps a board row may not carry its own copy of the clock (ST-283), so this\n' +
    'throws rather than falling back. Restore base/board/clock.js, or board/clock.js in an\n' +
    'exported tree, beside the board this tool writes to.'
  );
}

module.exports = require(locate());
