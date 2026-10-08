#!/usr/bin/env node
/* ============================================================
   tools/homework-best.mjs — a homework set the spreadsheet counts as done is done on the pupil's page too.
   (8 Oct 2026: a set rebuilt since a pupil finished it keeps its best in the labs script, which sends it to the page as
   `most`. Without it, the pupil's page said "not started" while the teacher's page said done.)

   Google's sign-in and the labs' Apps Script are FAKES served by this file (Chrome's Fetch interception): nobody signs
   in to anything real, and nothing reaches a spreadsheet. The pupil's browser holds nothing; the spreadsheet holds a
   finished set of an OLDER version (so the page cannot take its answers in) with `most` = every question.
   Checks: the front page's homework box, the homework page's card (colour, bar, button word) and the topic page's pill.

   usage: node tools/homework-best.mjs        (serves Biology Hub/ itself on 127.0.0.1, a free port, and stops it)
   ============================================================ */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ONE = 'pupil.one@pupils.nlcsjeju.kr';

const FAKE_GIS = `
window.google = { accounts: { id: {
  initialize: function (cfg) { window.__gcfg = cfg; },
  renderButton: function (el) { el.innerHTML = '<button type="button" class="fakeG">Sign in with Google</button>'; },
  prompt: function (cb) { if (cb) cb({ isNotDisplayed: function () { return true; }, isSkippedMoment: function () { return true; }, getDismissedReason: function () { return ''; } }); },
  disableAutoSelect: function () {}, cancel: function () {} } } };`;
const jwt = (email) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return b({ alg: 'RS256' }) + '.' + b({ email, name: 'Pupil One', exp: Math.floor(Date.now() / 1000) + 3600 }) + '.sig'; };

const srv = { sid: '', total: 0, calls: [] };
function fakeScript(body) {
  let d = {}; try { d = JSON.parse(body || '{}'); } catch (e) {}
  srv.calls.push(d.action || '');
  if (d.action === 'pass') return 'unknown lab';                 /* a script from before the pass: the sign-in alone is used */
  if (d.action === 'english.mine') return { ok: true, name: 'Pupil', onList: true, cls: '10A',
    sets: { [srv.sid]: { v: 'an-older-version', done: srv.total, first: 0, total: srv.total, most: srv.total } },
    homework: [{ id: 'HW-BEST', title: 'Best kept', due: '10 Oct', overdue: false, sets: [srv.sid] }] };
  if (d.action === 'english.save') return { ok: true, saved: 0 };
  return { ok: false, why: 'unknown' };
}

/* ---------- a server for Biology Hub/, and a browser ---------- */
const hport = await new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const BASE = `http://127.0.0.1:${hport}/labs/bio-english-lab/index.html`;
const server = spawn('python3', ['-m', 'http.server', String(hport), '--bind', '127.0.0.1', '--directory', WS], { stdio: 'ignore' });
const dport = 9700 + (process.pid % 250);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'be-hwbest-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${dport}`, `--user-data-dir=${prof}`, '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 150 && !(list && list.length); i++) { try { list = await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json(); } catch {} await wait(100); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let n = 0; const waiting = new Map(); const errors = [];
const send = (method, params = {}) => new Promise((ok, no) => { const id = ++n; waiting.set(id, [ok, no]); ws.send(JSON.stringify({ id, method, params })); });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const [ok, no] = waiting.get(m.id); waiting.delete(m.id); return m.error ? no(new Error(m.error.message)) : ok(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Fetch.requestPaused') {
    const { requestId, request } = m.params;
    let body = '', type = 'application/json';
    if (/accounts\.google\.com\/gsi\/client/.test(request.url)) { body = FAKE_GIS; type = 'text/javascript'; }
    else if (request.method === 'OPTIONS') body = '';
    else { const a = fakeScript(request.postData); body = typeof a === 'string' ? a : JSON.stringify(a); }
    send('Fetch.fulfillRequest', { requestId, responseCode: 200, body: Buffer.from(body).toString('base64'),
      responseHeaders: [{ name: 'Content-Type', value: type }, { name: 'Access-Control-Allow-Origin', value: '*' }] }).catch(() => {});
  }
};
await send('Page.enable'); await send('Runtime.enable');
await send('Fetch.enable', { patterns: [{ urlPattern: '*accounts.google.com/gsi/client*' }, { urlPattern: '*script.google.com/*' }] });
async function ev(fn, arg) {
  const r = await send('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
  return r.result.value;
}
let loads = 0;
const open = async (hash) => { await send('Page.navigate', { url: BASE + '?load=' + (++loads) + hash }); await wait(1800); };
let fails = 0, passes = 0;
async function check(label, fn) {
  try { await fn(); passes++; console.log('  ok   ' + label); }
  catch (e) { fails++; console.log('  FAIL ' + label + '  →  ' + e.message); }
}

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await wait(100); }
  await open('#/');
  const pick = await ev(() => { const s = window.AL.meta.sets; const id = Object.keys(s).filter((k) => (s[k].keys || []).length >= 3)[0]; return { id, total: s[id].keys.length, unit: s[id].unit }; });
  srv.sid = pick.id; srv.total = pick.total;
  if (!/^https:\/\/script\.google\.com\//.test(await ev(() => (window.AL_CONFIG || {}).submitUrl || ''))) throw new Error('the page has no labs script address to fake');
  /* signed in, as the hub's one sign-in leaves it; this browser holds no work at all */
  await ev((a) => {
    localStorage.clear();
    localStorage.setItem('biology.signin', JSON.stringify({ token: a.token, name: 'Pupil One', email: a.one, exp: Math.floor(Date.now() / 1000) + 3600 }));
    localStorage.setItem('bio-english-lab.owner', a.one);
  }, { token: jwt(ONE), one: ONE });
  await open('#/');
  await wait(800);
  await check('the records were asked for', async () => { if (!srv.calls.includes('english.mine')) throw new Error('calls: ' + srv.calls.join(',')); });
  await check('front page: the homework box counts the spreadsheet’s best (' + pick.total + '/' + pick.total + ' done)', async () => {
    const t = await ev(() => { const r = document.querySelector('.hw .hw__row'); return r ? r.textContent : '(no homework box)'; });
    if (!t.includes(pick.total + '/' + pick.total + ' done')) throw new Error(t);
  });
  await open('#/hw/HW-BEST'); await wait(600);
  await check('homework page: the set is green, its bar full and its button says Done', async () => {
    const s = await ev(() => { const a = document.querySelector('a.set'); return a ? { cls: a.className, bar: a.querySelector('.pbar i').style.width, go: a.querySelector('.set__go').textContent, pill: (a.querySelector('.hwpill') || {}).className } : null; });
    if (!s || !/set--hw-done/.test(s.cls) || s.bar !== '100%' || !/^Done/.test(s.go) || !/hwpill--done/.test(s.pill)) throw new Error(JSON.stringify(s));
  });
  await open('#/u/' + pick.unit); await wait(600);
  await check('topic page: the set’s homework pill says done', async () => {
    const p = await ev((sid) => { const a = document.querySelector('a[href="#/s/' + sid + '"]'); const x = a && a.querySelector('.hwpill'); return x ? x.className : '(no pill)'; }, pick.id);
    if (!/hwpill--done/.test(p)) throw new Error(p);
  });
  await check('no script error on any page', async () => { if (errors.length) throw new Error(errors.join(' | ')); });
} catch (e) { fails++; console.log('  FAIL (the run) ' + e.message); }
finally {
  console.log(passes + ' passed, ' + fails + ' failed');
  try { ws.close(); } catch {}
  chrome.kill(); server.kill();
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
  process.exit(fails ? 1 : 0);
}
