/**
 * board-cli.js -- manage one project's ticket board from the terminal.
 *
 * This CLI holds NO privileged key. It signs in as that project's bot user and is subject
 * to exactly the same row-level security as the browser and as any anonymous API caller.
 *
 * It used to authenticate with the service-role key, which bypasses row-level security by
 * definition. On a shared backend that meant any project holding the key could read and
 * write every other project's board, and no policy could have prevented it. The fix is not
 * a better policy; it is not giving this program a credential that outranks policies.
 *
 * If SUPABASE_SERVICE_KEY is present in the environment, this program refuses to start.
 * That is deliberate. A service key reaching a project's environment is the failure, and it
 * should be loud rather than convenient.
 *
 * Environment:
 *   SUPABASE_URL         https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY    the publishable key, safe to hold, governed by RLS
 *   BOARD_PROJECT        this project's slug in board_project, e.g. "your-project"
 *   BOARD_BOT_EMAIL      the bot user for this project only
 *   BOARD_BOT_PASSWORD   its password. Never commit. Rotate by resetting the user.
 *
 * Usage:
 *   node board-cli.js list [status]
 *   node board-cli.js add "Title text" [status] [assignee]
 *   node board-cli.js move <id|titleMatch> <status>
 *   node board-cli.js assign <id|titleMatch> <SQUAD|FOUNDER|CC|none>
 *   node board-cli.js title   <id|titleMatch> "New title"
 *   node board-cli.js desc    <id|titleMatch> "New description"
 *   node board-cli.js version <id|titleMatch> "uat-20260715"   (code-only release tag)
 *   node board-cli.js rm      <id|titleMatch>
 *   node board-cli.js whoami                                   (prove the scoping)
 *
 *   status   = backlog | todo | in_progress | uat | uat_complete | prod_ready | prod_deployed | done
 *   Matching = full id, id prefix, or a case-insensitive title substring (must be unique).
 */
'use strict';

// A service key here would silently restore cross-project access. Fail before doing anything.
for (const banned of ['SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (process.env[banned]) {
    console.error(
      'REFUSING TO RUN: ' + banned + ' is set in this environment.\n' +
      'The service key bypasses row-level security, so this board would be able to read and\n' +
      'write every other project on the shared backend. Remove it and use the bot user.'
    );
    process.exit(1);
  }
}

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'BOARD_PROJECT', 'BOARD_BOT_EMAIL', 'BOARD_BOT_PASSWORD'];
const missing = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing environment: ' + missing.join(', '));
  process.exit(1);
}

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const PROJECT_SLUG = process.env.BOARD_PROJECT;

const STATUSES = ['backlog','todo','in_progress','uat','uat_complete','prod_ready','prod_deployed','done'];
const LABELS = { backlog:'BACKLOG', todo:'TO DO', in_progress:'IN PROGRESS', uat:'UAT', uat_complete:'UAT COMPLETE', prod_ready:'PROD READY', prod_deployed:'PROD DEPLOYED', done:'DONE' };
const ASSIGNEES = ['SQUAD','FOUNDER','CC'];
function normStatus(s){ return s === 'uat_deployed' ? 'uat' : s; }

let TOKEN = null;      // the bot user's access token, not a key
let PROJECT = null;    // { id, slug, name, ticket_prefix }

function req(method, path, body, extra) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + (TOKEN || ANON_KEY),
    }, extra || {});
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const u = new URL(SUPABASE_URL + path);
    const r = https.request({ hostname:u.hostname, port:443, path:u.pathname+u.search, method, headers }, res => {
      let d=''; res.on('data', c => d+=c);
      res.on('end', () => { let j=null; try{ j=d?JSON.parse(d):null; }catch(e){ j=d; } resolve({ status:res.statusCode, body:j }); });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function signIn() {
  const r = await req('POST', '/auth/v1/token?grant_type=password', {
    email: process.env.BOARD_BOT_EMAIL,
    password: process.env.BOARD_BOT_PASSWORD,
  });
  if (r.status >= 400 || !r.body || !r.body.access_token) {
    throw new Error('bot sign-in failed (' + r.status + '). Check BOARD_BOT_EMAIL and BOARD_BOT_PASSWORD.');
  }
  TOKEN = r.body.access_token;
}

// Resolving the slug through RLS is itself the membership check: a project this bot does
// not belong to simply does not exist as far as this query is concerned.
async function loadProject() {
  const r = await req('GET', '/rest/v1/board_project?select=id,slug,name,ticket_prefix&slug=eq.' + encodeURIComponent(PROJECT_SLUG));
  if (r.status >= 400) throw new Error('project lookup failed (' + r.status + '): ' + JSON.stringify(r.body));
  if (!r.body || !r.body.length) {
    throw new Error('project "' + PROJECT_SLUG + '" is not visible to this bot user. Either the slug is wrong or the bot is not a member.');
  }
  PROJECT = r.body[0];
}

const scope = () => 'project_id=eq.' + PROJECT.id;
const ref = t => PROJECT.ticket_prefix + '-' + t.num;

async function getAll() {
  const r = await req('GET', '/rest/v1/tickets?select=*&' + scope() + '&order=status,position');
  if (r.status >= 400) throw new Error('load failed ('+r.status+'): ' + JSON.stringify(r.body));
  return r.body || [];
}
async function findOne(match) {
  const all = await getAll();
  let hits = all.filter(t => t.id === match || t.id.indexOf(match) === 0);
  if (!hits.length) hits = all.filter(t => t.title.toLowerCase().indexOf(String(match).toLowerCase()) !== -1);
  if (!hits.length) throw new Error('no ticket matches: ' + match);
  if (hits.length > 1) throw new Error('ambiguous match (' + hits.length + '): ' + hits.map(h=>h.title).join(' | '));
  return hits[0];
}
async function nextPos(status) {
  const all = await getAll();
  return all.filter(t => t.status===status).reduce((a,t)=>Math.max(a, +t.position||0), 0) + 1;
}
// Scoped by project as well as id. RLS already prevents touching another board's row; this
// makes an attempt fail as "not found" rather than relying solely on the policy.
async function patch(id, body) {
  body.updated_at = new Date().toISOString();
  const r = await req('PATCH', '/rest/v1/tickets?id=eq.'+id+'&'+scope(), body, { 'Prefer':'return=representation' });
  if (r.status >= 400) throw new Error('update failed ('+r.status+'): ' + JSON.stringify(r.body));
  return r.body && r.body[0];
}

function reqStatus(s){ if(STATUSES.indexOf(s)===-1) throw new Error('bad status "'+s+'". use: '+STATUSES.join(', ')); return s; }
function reqAssignee(a){ if(a==='none'||a===''||a==null) return null; if(ASSIGNEES.indexOf(a)===-1) throw new Error('bad assignee "'+a+'". use: '+ASSIGNEES.join(', ')+', none'); return a; }

async function main() {
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  await signIn();
  await loadProject();

  if (cmd === 'whoami') {
    const all = await getAll();
    console.log('board   : ' + PROJECT.name + '  (' + PROJECT.slug + ', prefix ' + PROJECT.ticket_prefix + ')');
    console.log('user    : ' + process.env.BOARD_BOT_EMAIL);
    console.log('tickets : ' + all.length + ' visible');
    console.log('note    : this is everything this credential can reach. Other boards are not hidden, they are unreachable.');
    return;
  }
  if (!cmd || cmd==='list') {
    const all = await getAll();
    const filter = a1 ? reqStatus(a1) : null;
    console.log('\n' + PROJECT.name + ' board');
    STATUSES.filter(s=>!filter||s===filter).forEach(s => {
      const list = all.filter(t=>normStatus(t.status)===s).sort((x,y)=>(+x.position||0)-(+y.position||0));
      console.log('\n== ' + LABELS[s] + ' (' + list.length + ') ==');
      list.forEach(t => console.log('  ['+t.id.slice(0,8)+'] '+(t.num!=null?(ref(t)+' '):'')+(t.assignee?('('+t.assignee+') '):'')+(t.release_version?('<'+t.release_version+'> '):'')+t.title));
    });
    console.log('');
    return;
  }
  if (cmd==='add') {
    if (!a1) throw new Error('add needs a title');
    const status = a2 ? reqStatus(a2) : 'backlog';
    const assignee = a3 ? reqAssignee(a3) : 'SQUAD';
    const row = { project_id: PROJECT.id, title:a1, status, assignee, position: await nextPos(status), description:'', images:[] };
    const r = await req('POST', '/rest/v1/tickets', row, { 'Prefer':'return=representation' });
    if (r.status >= 400) throw new Error('add failed ('+r.status+'): ' + JSON.stringify(r.body));
    console.log('added ['+r.body[0].id.slice(0,8)+'] '+ref(r.body[0])+' '+r.body[0].title+' -> '+LABELS[status]);
    return;
  }
  if (cmd==='move') {
    const t = await findOne(a1); const status = reqStatus(a2);
    await patch(t.id, { status, position: await nextPos(status) });
    console.log('moved "'+t.title+'" -> '+LABELS[status]);
    return;
  }
  if (cmd==='assign') {
    const t = await findOne(a1); const assignee = reqAssignee(a2);
    await patch(t.id, { assignee });
    console.log('assigned "'+t.title+'" -> '+(assignee||'unassigned'));
    return;
  }
  if (cmd==='title') { const t = await findOne(a1); await patch(t.id, { title:a2 }); console.log('retitled -> '+a2); return; }
  if (cmd==='desc')  { const t = await findOne(a1); await patch(t.id, { description:a2 }); console.log('updated description of "'+t.title+'"'); return; }
  if (cmd==='version') {
    const t = await findOne(a1);
    const v = (a2==='none' || a2==='') ? null : a2;
    await patch(t.id, { release_version: v });
    console.log('tagged "'+t.title+'" -> '+(v||'(cleared)'));
    return;
  }
  if (cmd==='rm') {
    const t = await findOne(a1);
    const r = await req('DELETE', '/rest/v1/tickets?id=eq.'+t.id+'&'+scope());
    if (r.status >= 400) throw new Error('delete failed ('+r.status+'): '+JSON.stringify(r.body));
    console.log('deleted "'+t.title+'"');
    return;
  }
  throw new Error('unknown command: ' + cmd);
}
main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
