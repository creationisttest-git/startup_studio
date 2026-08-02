/**
 * board-cli.js  -- manage the PROJECT ticket board from the terminal.
 *
 * SERVER-SIDE ONLY. Uses the Supabase service-role key (bypasses RLS).
 * NEVER copy this file or its key into public/.
 *
 * Run from deploy-project/. Node built-ins only (no npm install).
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
 *
 *   status   = backlog | todo | in_progress | uat | uat_complete | prod_ready | prod_deployed | done
 *   Matching = full id, id prefix, or a case-insensitive title substring (must be unique).
 */
'use strict';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment. Never hardcode the service key.');
  process.exit(1);
}
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // server only, never in public/

const STATUSES = ['backlog','todo','in_progress','uat','uat_complete','prod_ready','prod_deployed','done'];
const LABELS = { backlog:'BACKLOG', todo:'TO DO', in_progress:'IN PROGRESS', uat:'UAT', uat_complete:'UAT COMPLETE', prod_ready:'PROD READY', prod_deployed:'PROD DEPLOYED', done:'DONE' };
const ASSIGNEES = ['SQUAD','FOUNDER','CC'];
function normStatus(s){ return s === 'uat_deployed' ? 'uat' : s; } // tolerate legacy value pre-migration

function req(method, path, body, extra) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? JSON.stringify(body) : null;
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
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

async function getAll() {
  const r = await req('GET', '/rest/v1/tickets?select=*&order=status,position', null);
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
async function patch(id, body) {
  body.updated_at = new Date().toISOString();
  const r = await req('PATCH', '/rest/v1/tickets?id=eq.'+id, body, { 'Prefer':'return=representation' });
  if (r.status >= 400) throw new Error('update failed ('+r.status+'): ' + JSON.stringify(r.body));
  return r.body && r.body[0];
}

function reqStatus(s){ if(STATUSES.indexOf(s)===-1) throw new Error('bad status "'+s+'". use: '+STATUSES.join(', ')); return s; }
function reqAssignee(a){ if(a==='none'||a===''||a==null) return null; if(ASSIGNEES.indexOf(a)===-1) throw new Error('bad assignee "'+a+'". use: '+ASSIGNEES.join(', ')+', none'); return a; }

async function main() {
  const [cmd, a1, a2, a3] = process.argv.slice(2);
  if (!cmd || cmd==='list') {
    const all = await getAll();
    const filter = a1 ? reqStatus(a1) : null;
    STATUSES.filter(s=>!filter||s===filter).forEach(s => {
      const list = all.filter(t=>normStatus(t.status)===s).sort((x,y)=>(+x.position||0)-(+y.position||0));
      console.log('\n== ' + LABELS[s] + ' (' + list.length + ') ==');
      list.forEach(t => console.log('  ['+t.id.slice(0,8)+'] '+(t.num!=null?('MUS-'+t.num+' '):'')+(t.assignee?('('+t.assignee+') '):'')+(t.release_version?('<'+t.release_version+'> '):'')+t.title));
    });
    console.log('');
    return;
  }
  if (cmd==='add') {
    if (!a1) throw new Error('add needs a title');
    const status = a2 ? reqStatus(a2) : 'backlog';
    const assignee = a3 ? reqAssignee(a3) : 'SQUAD';
    const row = { title:a1, status, assignee, position: await nextPos(status), description:'', images:[] };
    const r = await req('POST', '/rest/v1/tickets', row, { 'Prefer':'return=representation' });
    if (r.status >= 400) throw new Error('add failed ('+r.status+'): ' + JSON.stringify(r.body));
    console.log('added ['+r.body[0].id.slice(0,8)+'] '+(r.body[0].num!=null?('MUS-'+r.body[0].num+' '):'')+r.body[0].title+' -> '+LABELS[status]);
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
    const r = await req('DELETE', '/rest/v1/tickets?id=eq.'+t.id, null);
    if (r.status >= 400) throw new Error('delete failed ('+r.status+'): '+JSON.stringify(r.body));
    console.log('deleted "'+t.title+'"');
    return;
  }
  throw new Error('unknown command: ' + cmd);
}
main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
