/**
 * hygiene-check.js -- fail if a privileged credential appears in any TRACKED file.
 *
 * Required by BOARD_SPEC.md. The rule is that the service-role key never reaches a project,
 * and a rule nobody checks is a rule that eventually breaks. So it is checked by a program
 * rather than remembered by a person.
 *
 * Tracked files only, deliberately. `.board.env` is gitignored and is SUPPOSED to hold the
 * bot password; scanning it would fail every run and the check would be switched off within
 * a week. What matters is what can reach the remote.
 *
 *   node hygiene-check.js <path-to-repo>
 *   BOARD_HYGIENE_REPO=<path> node hygiene-check.js
 *
 * The repository is an argument rather than inferred from this file's location, because the
 * board tooling does not necessarily live inside the repository it guards. Inferring it is
 * how this check silently started scanning the wrong tree.
 *
 * Exit 0 clean, exit 1 with the offending file and line.
 */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = process.argv[2] || process.env.BOARD_HYGIENE_REPO;
if (!REPO) {
  console.error('hygiene-check: no repository given.\n' +
    'Pass a path, or set BOARD_HYGIENE_REPO. There is deliberately no default: a wrong\n' +
    'default scans the wrong tree and reports clean, which is worse than refusing to run.');
  process.exit(1);
}

// Each pattern names the thing it is looking for, so a hit explains itself.
//
// A Supabase publishable ("anon") key is MEANT to be in a public file: it is embedded in
// board.html by design and holds no grants at all. Flagging every JWT would make the check
// cry wolf on a file that is correct, and a check that cries wolf gets switched off. So
// decode the payload and flag on the role claim rather than on the shape.
function jwtRole(tok) {
  try {
    const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));
    return p.role || p.aud || null;
  } catch { return null; }
}
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;

const PATTERNS = [
  {
    name: 'Supabase service-role key',
    test: line => {
      const m = line.match(JWT_RE);
      if (!m) return false;
      // Unknown role means it is not a key we can vouch for, so it is not ours to wave
      // through. Known-anon passes; anything else is reported.
      return jwtRole(m[0]) !== 'anon';
    },
  },
  { name: 'service_role reference with a value', re: /service_?role["'\s:=]+[A-Za-z0-9_.-]{20,}/i },
  { name: 'SUPABASE_SERVICE_KEY with a value', re: /SUPABASE_SERVICE(_ROLE)?_KEY\s*[:=]\s*\S+/ },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'OpenAI key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

// This file names every pattern it hunts for, so it would always match itself.
const SELF = path.basename(__filename);

let tracked;
try {
  tracked = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean);
} catch {
  console.error('hygiene-check: "' + REPO + '" is not a git repository, or git is unavailable.');
  process.exit(1);
}

const findings = [];

for (const rel of tracked) {
  if (path.basename(rel) === SELF) continue;
  const abs = path.join(REPO, rel);

  let stat;
  try { stat = fs.statSync(abs); } catch { continue; }   // deleted but still indexed
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
  // The escape, never a literal NUL. Written literally, this source reads as binary to grep,
  // to diff and to every review tool that would otherwise show you this line.
  if (text.indexOf(String.fromCharCode(0)) !== -1) continue;   // binary

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const p of PATTERNS) {
      const hit = p.test ? p.test(lines[i]) : p.re.test(lines[i]);
      if (hit) findings.push({ file: rel, line: i + 1, what: p.name, text: lines[i].trim().slice(0, 120) });
    }
  }
}

if (!findings.length) {
  console.log('hygiene-check: clean. ' + tracked.length + ' tracked files scanned, no privileged credential found.');
  process.exit(0);
}

console.error('hygiene-check: FAILED. A privileged credential is in a tracked file.\n');
for (const f of findings) {
  console.error('  ' + f.file + ':' + f.line + '  [' + f.what + ']');
  console.error('    ' + f.text + '\n');
}
console.error('Removing it in a later commit is not enough. It stays in history and stays valid.');
console.error('Rotate it at the source first, then remove it.');
process.exit(1);
