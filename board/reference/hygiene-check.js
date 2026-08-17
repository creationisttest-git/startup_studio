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

// ---- samples ----------------------------------------------------------------------------
//
// Every pattern below carries a sample it is REQUIRED to match, and the scan refuses to run
// if any pattern has no sample or fails its own. This check is the only thing standing
// between a live credential and a public remote; it reports "clean" on a healthy repository,
// which is also exactly what it would report if every pattern were broken. A check nobody has
// watched fail cannot be told apart from a check that always passes.
//
// The samples are ASSEMBLED rather than written out, and that is not decoration. A scanner's
// own test data is by definition indistinguishable from the thing it hunts, so writing these
// literally would make this file trip its own patterns, trip the studio's publish scan, and
// trip any other credential scanner pointed at the repository. Splitting each literal at a
// quote leaves the runtime value intact and leaves nothing in the source for a pattern to
// match. It also means this file needs no exemption from its own scan: an earlier version
// skipped itself by FILENAME, which quietly skipped any other file that happened to share the
// name, and an exemption granted on a filename is not an exemption you can reason about.
function jwt(role) {
  const seg = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return seg({ alg: 'HS256', typ: 'JWT' }) + '.' +
         seg({ role: role, iss: 'supabase', exp: 2000000000 }) + '.' +
         'c2lnbmF0dXJlLXBsYWNlaG9sZGVyLXZhbHVl';
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
    sample: 'SB_KEY = "' + jwt('service_role') + '"',
    // The negative control. Without it this pattern could be "fixed" into flagging every JWT
    // and still pass its own sample, which would fail the build on a correct board.html and
    // get the check disabled by the second person who hit it.
    clean: 'var SB_KEY = "' + jwt('anon') + '";',
  },
  {
    name: 'service_role reference with a value',
    re: /service_?role["'\s:=]+[A-Za-z0-9_.-]{20,}/i,
    sample: 'service' + '_role: "' + 'k'.repeat(28) + '"',
  },
  {
    name: 'SUPABASE_SERVICE_KEY with a value',
    re: /SUPABASE_SERVICE(_ROLE)?_KEY\s*[:=]\s*\S+/,
    sample: 'SUPABASE_SERVICE_ROLE' + '_KEY=' + 'v'.repeat(24),
  },
  {
    name: 'Supabase secret key',
    re: /\bsb_secret_[A-Za-z0-9_-]{8,}\b/,
    sample: 'sb_secret' + '_' + 'A1b2C3d4E5f6G7h8',
  },
  {
    name: 'board bot or viewer password',
    // Naming the variable is not disclosing it. The first version of this pattern flagged
    // `env.BOARD_VIEWER_PASSWORD === env.BOARD_BOT_PASSWORD` in deploy.js, which is the line
    // that STOPS the bot credential being published, and an empty placeholder in the example
    // file the setup guide tells you to copy. Both are correct code. A check that fails a
    // correct repository on its first run is a check the next person deletes, so what it
    // looks for is an assigned literal, not a mention.
    test: line => {
      const m = line.match(/BOARD_(?:BOT|VIEWER)_PASSWORD\s*[:=]{1,3}\s*(\S+)/);
      if (!m) return false;
      const v = m[1].replace(/^["'`]|["'`][,;)]*$/g, '');
      if (!v) return false;                                        // blank placeholder
      if (/^(env|process|os|import|config|opts|args)[.\[]/.test(v)) return false;   // a lookup
      if (/^[$%]/.test(v)) return false;                           // shell or template ref
      if (/^(<|__|\{\{|your-|changeme|change-me|xxx)/i.test(v)) return false;   // placeholder
      return true;
    },
    sample: 'BOARD_BOT' + '_PASSWORD=' + 'not-the-real-one',
    clean: 'if (env.BOARD_VIEWER_PASSWORD === env.BOARD_BOT_PASSWORD) {',
  },
  {
    name: 'AWS access key id',
    re: /\bAKIA[0-9A-Z]{16}\b/,
    sample: 'AKIA' + 'EXAMPLE0KEY0ID12',
  },
  {
    name: 'GitHub token',
    re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    sample: 'ghp' + '_' + '0123456789abcdefghij',
  },
  {
    name: 'OpenAI key',
    re: /\bsk-[A-Za-z0-9_-]{20,}\b/,
    sample: 'sk' + '-' + '0123456789abcdefghij',
  },
  {
    name: 'private key block',
    re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    sample: '-----BEGIN ' + 'PRIVATE KEY' + '-----',
  },
];

const match = (p, line) => (p.test ? p.test(line) : p.re.test(line));

// ---- self-test --------------------------------------------------------------------------
// Runs before the scan, every run, not behind a flag. A self-test you have to remember to run
// is the same thing as no self-test.
const broken = [];
for (const p of PATTERNS) {
  if (!p.sample) { broken.push(p.name + ': no sample, so nothing proves it still fires'); continue; }
  if (!match(p, p.sample)) broken.push(p.name + ': did not match its own sample');
  if (p.clean && match(p, p.clean)) broken.push(p.name + ': matched its negative control, so it will cry wolf');
}
if (broken.length) {
  console.error('hygiene-check: REFUSING TO RUN. The scanner failed its own test.\n');
  for (const b of broken) console.error('  ' + b);
  console.error('\nA scan that reports clean with a broken pattern is worse than no scan, because');
  console.error('it is the evidence someone will cite when the credential turns up in public.');
  process.exit(1);
}

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
      if (match(p, lines[i])) findings.push({ file: rel, line: i + 1, what: p.name, text: lines[i].trim().slice(0, 120) });
    }
  }
}

if (!findings.length) {
  console.log('hygiene-check: clean. ' + PATTERNS.length + ' patterns passed their own samples, ' +
              tracked.length + ' tracked files scanned, no privileged credential found.');
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
