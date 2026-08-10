/**
 * deploy.js -- build site/ into .dist with credentials substituted, then publish.
 *
 *   node deploy.js            build and deploy
 *   node deploy.js --build    build only, print what would be published
 *
 * Why a build step rather than editing board.html directly.
 *
 * The page needs the backend URL and the publishable key literally, because a static host
 * has no runtime environment. Those two are public by design and governed by row-level
 * security, so publishing them adds no exposure.
 *
 * They still do not belong in the repository. The repo holds the NAME of every value and
 * none of the values, so a credential is rotated in one place, so a reader cannot mistake a
 * committed secret for an accident, and so the same source can be deployed against a
 * different backend without editing a tracked file. `.dist/` is gitignored.
 *
 * If the board has been changed to sign itself in as a shared viewer account rather than
 * per-person, that account's password is substituted here too, and the refusal below keeps
 * it from ever being the same account the CLI uses.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const SRC = path.join(HERE, 'site');
const OUT = path.join(HERE, '.dist');

// ---- env ------------------------------------------------------------------------------
const envPath = path.join(HERE, '.board.env');
if (!fs.existsSync(envPath)) {
  console.error('No .board.env. Copy .board.env.example and fill it in.');
  process.exit(1);
}
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'BOARD_PAGES_PROJECT'];
const missing = REQUIRED.filter(k => !env[k]);
if (missing.length) { console.error('Missing in .board.env: ' + missing.join(', ')); process.exit(1); }

// A service key must never reach a page that is about to be published to the internet.
for (const banned of ['SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (env[banned]) {
    console.error('REFUSING: ' + banned + ' is in .board.env. It bypasses row-level security and\n' +
                  'this script publishes what it substitutes. Remove it.');
    process.exit(1);
  }
}

// The bot credential drives the CLI and must never reach a public page. Distinct accounts
// exist precisely so that publishing one does not publish the other.
if (env.BOARD_VIEWER_PASSWORD && env.BOARD_VIEWER_PASSWORD === env.BOARD_BOT_PASSWORD) {
  console.error('REFUSING: the viewer and bot share a password. The viewer credential is published;\n' +
                'the bot credential must not be. Give them separate accounts.');
  process.exit(1);
}

// ---- build ----------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const name of fs.readdirSync(SRC)) {
  const from = path.join(SRC, name), to = path.join(OUT, name);
  if (!fs.statSync(from).isFile()) continue;
  if (name.endsWith('.html')) {
    let h = fs.readFileSync(from, 'utf8');
    h = h.replace(/var SB_URL = '[^']*';/, "var SB_URL = '" + env.SUPABASE_URL + "';")
         .replace(/var SB_KEY = '[^']*';/, "var SB_KEY = '" + env.SUPABASE_ANON_KEY + "';");
    if (env.BOARD_PROJECT) h = h.replace(/var BOARD_PROJECT = '[^']*';/, "var BOARD_PROJECT = '" + env.BOARD_PROJECT + "';");
    if (env.BOARD_VIEWER_EMAIL) h = h.replace(/email: '[^']*viewer[^']*'/, "email: '" + env.BOARD_VIEWER_EMAIL + "'");
    if (env.BOARD_VIEWER_PASSWORD) h = h.replace('__VIEWER_PASSWORD__', env.BOARD_VIEWER_PASSWORD);
    fs.writeFileSync(to, h);
  } else {
    fs.copyFileSync(from, to);
  }
}

// A placeholder that survives the build deploys a board that cannot reach its backend, and
// the failure shows up as an empty page with no clue why.
const built = fs.readFileSync(path.join(OUT, 'board.html'), 'utf8');
for (const marker of ['__VIEWER_PASSWORD__', 'SET VIA ENV', '<your-project-slug>']) {
  if (built.includes(marker)) {
    console.error('Build left "' + marker + '" unsubstituted. Not deploying.');
    process.exit(1);
  }
}
console.log('built ' + fs.readdirSync(OUT).length + ' files into .dist');

if (process.argv.includes('--build')) { console.log('build only, not deploying'); process.exit(0); }

// ---- deploy ---------------------------------------------------------------------------
// shell:true because on Windows npx is a .cmd shim and execFileSync cannot spawn it directly.
execFileSync('npx',
  ['wrangler', 'pages', 'deploy', '.dist', '--project-name', env.BOARD_PAGES_PROJECT,
   '--branch', 'main', '--commit-dirty=true'],
  { cwd: HERE, stdio: 'inherit', shell: true });

// After a redeploy, verify against the RESPONSE, not against a browser tab. A reload, a hard
// reload and a cache-busting query string have all been seen to keep serving the previous
// document while curl returned the new one, which reads exactly like a bug in your change.
console.log('\nVerify the response rather than a tab:');
console.log('  curl -s https://<hostname>/board.html | grep -c "<some string you just added>"');
