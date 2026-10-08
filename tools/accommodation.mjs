#!/usr/bin/env node
/* ============================================================
   tools/accommodation.mjs — the help a teacher gives some pupils, and the redo every pupil has, checked in headless Chrome.
   (Daniel, 8 Oct 2026: "after two tries … the explanation of why it was wrong … only for those students that have been
   allowed the accommodation"; "a Korean meaning toggle … if you set the accommodation"; "redo the ones I got wrong".)

   Google's sign-in and the labs' Apps Script are FAKES served by this file (Chrome's Fetch interception): nobody signs
   in to anything real, and nothing reaches a spreadsheet. english.mine says acc: 1 only when this file says so.

   Without the accommodation: no help after any number of wrong tries, no 한국어 switch, js/data/ko.js never fetched.
   With it: nothing after the FIRST wrong try, nor after the same answer checked again; after a second, DIFFERENT wrong
   answer, the help (a mark card, a keyword card that never names
   its keyword, nor another form, plural or abbreviation of it, nor, on a typed card, an accepted answer — every keyword card
   is tried, its help read by a detector of its own; an etymology card adds none, its near note explains a wrong choice
   already; an exam card's first step); a pick card adds nothing (it explains every choice already); the switch starts
   off and fetches nothing; on, the Keywords page and a meanings card show the Korean meaning; off again, they hide.
   Redo: a finished set with questions missed at the first try offers "Redo the N you missed"; the redo plays exactly
   those, counts right first time, and changes nothing in the pupil's record.

   usage: node tools/accommodation.mjs        (serves Biology Hub/ itself on 127.0.0.1, a free port, and stops it)
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

const srv = { acc: false, calls: [] };
function fakeScript(body) {
  let d = {}; try { d = JSON.parse(body || '{}'); } catch (e) {}
  srv.calls.push(d.action || '');
  if (d.action === 'pass') return 'unknown lab';
  if (d.action === 'english.mine') return Object.assign({ ok: true, name: 'Pupil', onList: true, cls: '10A', sets: {}, homework: [] }, srv.acc ? { acc: 1 } : {});
  if (d.action === 'english.save') return { ok: true, saved: 0 };
  if (d.action === 'record') return { ok: true, reflected: 0, assessments: 0, unfinishedNames: [] };
  return { ok: false, why: 'unknown' };
}

const hport = await new Promise((ok) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const BASE = `http://127.0.0.1:${hport}/labs/bio-english-lab/index.html`;
const server = spawn('python3', ['-m', 'http.server', String(hport), '--bind', '127.0.0.1', '--directory', WS], { stdio: 'ignore' });
const dport = 9450 + (process.pid % 250);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'be-acc-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${dport}`, `--user-data-dir=${prof}`, '--no-first-run',
  '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let list = null;
for (let i = 0; i < 150 && !(list && list.length); i++) { try { list = await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json(); } catch {} await wait(100); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
let n = 0; const waiting = new Map(); const errors = []; const fetched = [];
const send = (method, params = {}) => new Promise((ok, no) => { const id = ++n; waiting.set(id, [ok, no]); ws.send(JSON.stringify({ id, method, params })); });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { const [ok, no] = waiting.get(m.id); waiting.delete(m.id); return m.error ? no(new Error(m.error.message)) : ok(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Network.requestWillBeSent') fetched.push(m.params.request.url);
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
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
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
const koFetched = () => fetched.some((u) => /\/js\/data\/ko\.js/.test(u));
const zhFetched = () => fetched.some((u) => /\/js\/data\/zh\.js/.test(u));
const KO_BTN = '.who__ko[data-lang="ko"]', ZH_BTN = '.who__ko[data-lang="zh"]';

/* ---------- in the page: open a set, draw one card into a test box, answer it wrong ---------- */
const PAGE_KIT = () => {
  const W = window;
  W.__open = (id) => { const key = W.AL.k, bin = atob(W.AL.sets[id]); let out = '';
    for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    return JSON.parse(decodeURIComponent(escape(out))); };
  W.__find = (test) => { for (const sid of Object.keys(W.AL.sets)) { const s = W.__open(sid); for (const it of s.items) if (test(it)) return { sid, it }; } return null; };
  W.__draw = (it) => { let box = document.getElementById('__box'); if (!box) { box = document.createElement('div'); box.id = '__box'; document.body.prepend(box); }
    box.innerHTML = ''; const card = W.AEngine.render(it, { onResult: function () {}, onNext: function () {} }); box.appendChild(card); return card; };
  const $$ = (c, s) => Array.prototype.slice.call(c.querySelectorAll(s));
  const check = (card) => { const b = $$(card, '.card__foot .btn--go').filter((x) => !x.hidden)[0]; if (b) b.click(); };
  const again = (card) => { const b = $$(card, '.card__foot .btn--quiet').filter((x) => !x.hidden && x.textContent === 'Try again')[0]; if (b) b.click(); };
  /* a wrong answer; v = 1 gives another wrong answer (still wrong, but not the same) */
  W.__wrong = (it, card, v) => {
    if (it.type === 'mark') $$(card, '.scheme__p input').forEach((cb, i) => { cb.checked = (v && i === 0) ? !!it.scheme[i].got : !it.scheme[i].got; cb.dispatchEvent(new Event('change', { bubbles: true })); });
    else if (it.type === 'kw') { const inp = card.querySelector('input.gap'); inp.value = v ? 'zzqy' : 'zzqx'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (it.type === 'pick') { const want = it.options.filter((o) => !o.ok)[v ? 1 : 0]; $$(card, '.opt').filter((x) => x.textContent.replace(/\s+/g, ' ').trim().indexOf(W.AText.plain(want.t).trim().slice(0, 30)) >= 0)[0].click(); }
    else if (it.type === 'exam') $$(card, '.idea input').forEach((cb, i) => { cb.checked = !(v && i === 0); cb.dispatchEvent(new Event('change', { bubbles: true })); });
    check(card);
  };
  W.__again = again;
  W.__help = (card) => { const h = card.querySelector('.helpbox'); return h ? h.textContent : ''; };
};

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) break; } catch {} await wait(100); }
  const signIn = async () => {
    await open('#/');
    await ev((a) => {
      localStorage.clear();
      localStorage.setItem('biology.signin', JSON.stringify({ token: a.token, name: 'Pupil One', email: a.one, exp: Math.floor(Date.now() / 1000) + 3600 }));
      localStorage.setItem('bio-english-lab.owner', a.one);
    }, { token: jwt(ONE), one: ONE });
    fetched.length = 0;
    await open('#/'); await wait(600);
    await ev(PAGE_KIT);
  };
  /* the cards the checks use: a mark card whose points carry reasons, a typed keyword card, a pick card, an exam card whose
     wrong ideas carry reasons, a meanings card */
  const picks = async () => ev(() => {
    const W = window;
    const mark = W.__find((it) => it.type === 'mark' && it.scheme.some((p) => p.why));
    const kwT = W.__find((it) => it.type === 'kw' && it.input !== 'choose' && it.def);
    const pick = W.__find((it) => it.type === 'pick');
    const exam = W.__find((it) => it.type === 'exam' && it.ideas.some((x) => !x.ok && x.why));
    const mean = W.__find((it) => String(it.id).indexOf('kwm.') === 0);
    return { mark, kwT, pick, exam, mean };
  });
  /* wrong, Try again, wrong again: a different wrong answer, or (same: true) the very same one */
  const tryTwice = async (which, same) => ev((a) => {
    const W = window, it = W.__cards[a.w], card = W.__draw(it);
    W.__wrong(it, card); const first = W.__help(card);
    W.__again(card); W.__wrong(it, card, a.same ? 0 : 1); const second = W.__help(card);
    return { first, second, key: it.key || '' };
  }, { w: which, same: !!same });

  /* ---- A. a pupil WITHOUT the accommodation ---- */
  srv.acc = false;
  await signIn();
  let C = await picks();
  await ev((c) => { window.__cards = { mark: c.mark.it, kwT: c.kwT.it, pick: c.pick.it, exam: c.exam.it, mean: c.mean.it }; }, C);
  await check('without the accommodation: the page knows nothing of it, no 한국어 or 中文 switch', async () => {
    const s = await ev(() => ({ acc: window.AL_HELP && window.AL_HELP.acc, ko: !!document.querySelector('.who__ko'), mine: true }));
    if (s.acc || s.ko) throw new Error(JSON.stringify(s));
    if (!srv.calls.includes('english.mine')) throw new Error('english.mine was never asked');
  });
  await check('without the accommodation: no help after two wrong tries (mark, keyword, exam)', async () => {
    for (const w of ['mark', 'kwT', 'exam']) { const r = await tryTwice(w); if (r.first || r.second) throw new Error(w + ': ' + JSON.stringify(r).slice(0, 160)); }
  });
  await check('without the accommodation: the Korean and Chinese files are never fetched', async () => {
    await open('#/w/' + (await ev(() => Object.keys(window.AL.meta.words)[0]))); await wait(400);
    if (koFetched() || zhFetched()) throw new Error('ko.js or zh.js was fetched');
    const shown = await ev(() => Array.prototype.filter.call(document.querySelectorAll('.kogloss'), (x) => !x.hidden).length);
    if (shown) throw new Error(shown + ' Korean lines shown');
  });

  /* ---- B. a pupil WITH the accommodation ---- */
  srv.acc = true;
  await signIn();
  await ev((c) => { window.__cards = { mark: c.mark.it, kwT: c.kwT.it, pick: c.pick.it, exam: c.exam.it, mean: c.mean.it }; }, C);
  await check('with the accommodation: the page knows it; 한국어 and 中文 are there, both off, neither file fetched', async () => {
    const s = await ev((q) => { const k = document.querySelector(q[0]), z = document.querySelector(q[1]);
      return { acc: window.AL_HELP.acc, ko: k && k.textContent, zh: z && z.textContent, pressed: [k, z].map((b) => b && b.getAttribute('aria-pressed')).join(','), zlang: z && z.lang }; }, [KO_BTN, ZH_BTN]);
    if (!s.acc || s.ko !== '한국어' || s.zh !== '中文' || s.pressed !== 'false,false' || s.zlang !== 'zh-Hans') throw new Error(JSON.stringify(s));
    if (koFetched() || zhFetched()) throw new Error('a language file was fetched before a language was chosen');
  });
  await check('with the accommodation: the same answer checked twice gets no help (mark card, keyword card, exam card)', async () => {
    for (const w of ['mark', 'kwT', 'exam']) { const r = await tryTwice(w, true); if (r.first || r.second) throw new Error(w + ': ' + JSON.stringify(r).slice(0, 160)); }
  });
  await check('with the accommodation: nothing after the FIRST wrong try; the help after the SECOND (mark card)', async () => {
    const r = await tryTwice('mark');
    if (r.first) throw new Error('help after the first try: ' + r.first.slice(0, 80));
    if (!/Why/.test(r.second) || r.second.length < 20) throw new Error('no help after the second: ' + JSON.stringify(r.second));
  });
  await check('with the accommodation: a keyword card says what the word means, never the word', async () => {
    const r = await tryTwice('kwT');
    if (r.first || !/The keyword you need means/.test(r.second)) throw new Error(JSON.stringify(r).slice(0, 200));
    if (new RegExp(r.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(r.second.replace(/^Why/, ''))) throw new Error('the help names the keyword: ' + r.second);
  });
  /* the final verification audits (8 Oct 2026): every keyword card, answered wrong twice in the page itself, its help read by
     a detector that does not share the help's own rule: the site's marker on every run of visible words, every word of an
     answer, and every visible word with the base of a word the answer has (denatured · denaturation, atria · atrium). The
     policy it checks: on a typed card every accepted form is an answer; on a choose card the option is, with an accepted
     abbreviation or full name; the common word of a longer keyword may show ("energy" in "kinetic energy") unless every word
     is common and no wrong option has it. */
  await check('with the accommodation: on EVERY keyword card the help shows no answer (its words, other forms, plurals, abbreviation); an etymology card adds none', async () => {
    const r = await ev(() => {
      const W = window, T = W.AText, $$ = (c, s) => Array.prototype.slice.call(c.querySelectorAll(s));
      const COMMON = /^(air|dna|energy|water|cells?|blood|light|plants?|animals?|carbon|dioxide|oxygen|systems?|tissues?|organs?|body|food|heart|roots?|leaf|leaves|acids?|rate|muscles?|growth|proteins?|sugars?|gas|gases|pressure|surface|area|volume|concentration|movement|transport|structure|function|vessels?|membrane|walls?|chain|levels?|reactions?|response|changes?|number|test|cycle|factors?|population|community|species|humans?|diseases?|enzymes?)$/i;
      const STOP = /^(and|the|for|with|from|into|its|per|via|non|off|out|not|one|two|all|of|in|to|by|on|at|as|or|an|is|it|be|up|so|no|if|a)$/i;
      const words = (x) => String(x || '').match(/[A-Za-zÀ-ÿ]+/g) || [];
      const base = (w) => w.toLowerCase().replace(/(?:ications?|ifying|ified|ations?|itions?|ptions?|tions?|sions?|ities|ity|osis|sis|ings?|ated|ed|ances?|ences?|ments?|age|ies|es|s|er|est|y|a|i|um|us|on|is)$/, '');
      const lcp = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
      const press = (card, label) => { const b = $$(card, '.card__foot button').filter((x) => !x.hidden && x.textContent === label)[0]; if (b) b.click(); };
      const answer = (it, card, v) => {
        if (it.input === 'choose') { const want = it.opts.filter((o) => T.norm(o) !== T.norm(it.key))[v ? 1 : 0]; $$(card, '.kwopt').filter((b) => b.textContent === want)[0].click(); }
        else { const inp = card.querySelector('input.gap'); inp.value = v ? 'zzqy' : 'zzqx'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
        press(card, 'Check');
      };
      const bad = [], etym = []; let n = 0, helped = 0;
      for (const sid of Object.keys(W.AL.sets)) for (const it of W.__open(sid).items) {
        if (it.type !== 'kw') continue;
        const card = W.__draw(it); answer(it, card, 0); press(card, 'Try again'); answer(it, card, 1); n++;
        const help = W.__help(card).replace(/^Why/, '').replace(/^The keyword you need means: /, '');
        if (String(it.id).indexOf('kwr.') === 0) { if (help) etym.push(it.id); continue; }
        if (!help) continue;
        helped++;
        const typed = it.input !== 'choose', abbr = (x) => /[A-Z]{2}|µ/.test(String(x || ''));
        const forms = [it.key].concat((it.accept || []).filter((a) => typed || abbr(a) || abbr(it.key))).map((x) => String(x || '').trim()).filter((x) => x.length >= 2);
        const marked = (ng) => (typed ? T.match(ng, forms).ok : T.norm(ng) === T.norm(it.key) || forms.some((f) => T.norm(f) === T.norm(ng)));
        /* 1. a run of visible words the marker would take as the answer */
        const segs = help.split('___').map(words);
        let hit = '';
        segs.forEach((ws) => { for (let i = 0; i < ws.length && !hit; i++) for (let j = i; j < Math.min(ws.length, i + 6) && !hit; j++) {
          const run = ws.slice(i, j + 1); if (run.every((w) => STOP.test(w) || w.length < 2)) continue;
          if (marked(run.join(' '))) hit = 'shows "' + run.join(' ') + '"'; } });
        /* 2. every word of a multi-word answer visible */
        const vis = segs.flat().map((w) => w.toLowerCase()), visSet = new Set(vis);
        if (!hit) forms.forEach((f) => { const fw = words(f).filter((w) => !STOP.test(w)); if (!hit && fw.length > 1 && fw.every((w) => visSet.has(w.toLowerCase()) || vis.some((v) => base(v) === base(w)))) hit = 'every word of "' + f + '"'; });
        /* 3. a visible word with the base of a word the help must hide */
        if (!hit) {
          const wrongs = typed ? [] : (it.opts || []).filter((o) => T.norm(o) !== T.norm(it.key));
          (typed ? forms : [it.key]).forEach((f) => {
            const fw = words(f), many = fw.length > 1, allCommon = fw.filter((w) => !STOP.test(w)).every((w) => COMMON.test(w));
            fw.forEach((w) => {
              if (hit || w.length < 2 || (many && STOP.test(w))) return;
              if (many && COMMON.test(w) && (!allCommon || wrongs.some((o) => words(o).some((x) => base(x) === base(w))))) return;
              const W2 = w.toLowerCase(), b = base(w);
              const v = vis.find((t) => t === W2 || (W2.length >= 5 && t.startsWith(W2)) ||   /* a short prefix is another word: cell · cellulose */ (b.length >= 4 && base(t) === b) || (W2.length >= 5 && lcp(t, W2) >= Math.max(5, W2.length - 2)));
              if (v) hit = 'shows "' + v + '" for "' + w + '"';
            });
          });
        }
        if (hit) bad.push(it.id + ' (' + it.key + '): ' + hit);
      }
      return { n, helped, bad, etym };
    });
    if (r.n < 1000 || r.helped < 800) throw new Error(r.n + ' keyword cards tried, ' + r.helped + ' with a help');
    if (r.bad.length) throw new Error(r.bad.length + ' helps show the answer: ' + r.bad.slice(0, 6).join('; '));
    if (r.etym.length) throw new Error(r.etym.length + ' etymology cards add a help: ' + r.etym.slice(0, 3).join(', '));
  });
  await check('with the accommodation: an exam card explains the ideas ticked that score nothing, after the second wrong check', async () => {
    const r = await tryTwice('exam');
    if (r.first || !/✗/.test(r.second)) throw new Error(JSON.stringify(r).slice(0, 200));
  });
  await check('with the accommodation: a pick card adds nothing (it already explains every choice)', async () => {
    const r = await tryTwice('pick');
    if (r.first || r.second) throw new Error(JSON.stringify(r).slice(0, 160));
  });
  await check('the 한국어 switch on: the Korean file is fetched (not the Chinese one); the Keywords page shows a Korean meaning under every definition', async () => {
    await ev((q) => document.querySelector(q).click(), KO_BTN); await wait(800);
    if (!koFetched()) throw new Error('ko.js was not fetched');
    if (zhFetched()) throw new Error('zh.js was fetched with Korean chosen');
    const uid = await ev(() => Object.keys(window.AL.meta.words)[0]);
    await open('#/w/' + uid); await wait(900);
    const s = await ev(() => { const all = document.querySelectorAll('.words__kodef'); const on = Array.prototype.filter.call(all, (x) => !x.hidden && /[가-힣]/.test(x.textContent)); return { all: all.length, on: on.length, sample: on[0] ? on[0].textContent.slice(0, 30) : '' }; });
    if (!s.all || s.on !== s.all) throw new Error(JSON.stringify(s));
  });
  await check('the switch on: a meanings card shows NO Korean before it is answered (its Korean names the keyword); its keyword card shows the Korean meaning after', async () => {
    await ev(PAGE_KIT); await ev((c) => { window.__cards = { mean: c.mean.it }; }, C);
    const t = await ev(() => {
      const W = window, it = W.__cards.mean, card = W.__draw(it);
      const before = Array.prototype.filter.call(card.querySelectorAll('.kogloss'), (x) => !x.hidden).map((x) => x.textContent).join(' | ');
      const b = Array.prototype.find.call(card.querySelectorAll('.kwopt'), (x) => x.textContent.trim() === it.key); b.click();
      Array.prototype.find.call(card.querySelectorAll('.card__foot .btn--go'), (x) => !x.hidden).click();
      const k = card.querySelector('.kcard__kodef');
      return { before, after: k && !k.hidden ? k.textContent : '' };
    });
    if (t.before) throw new Error('Korean before the answer: ' + t.before);
    if (!/[가-힣]/.test(t.after)) throw new Error('no Korean on the keyword card after the answer: ' + JSON.stringify(t.after));
  });
  await check('375 px phone: the signed-in corner with the 한국어 switch, and the Keywords page with Korean lines, are no wider than the screen', async () => {
    await ev((q) => document.querySelector(q).getAttribute('aria-pressed') === 'true' || document.querySelector(q).click(), KO_BTN);
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    const uid = await ev(() => Object.keys(window.AL.meta.words)[0]);
    const out = [];
    for (const hash of ['#/', '#/w/' + uid]) {
      await open(hash); await wait(900);
      out.push(await ev(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        bad: Array.from(document.querySelectorAll('.who *, .words__kodef')).filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => e.className).slice(0, 4),
        ko: !!document.querySelector('.who__ko') })));
    }
    await send('Emulation.clearDeviceMetricsOverride');
    if (out.some((x) => x.sw > x.iw || x.bad.length || !x.ko)) throw new Error(JSON.stringify(out));
  });
  await check('the switch off again: every Korean line hides', async () => {
    await ev((q) => document.querySelector(q).click(), KO_BTN); await wait(300);
    const shown = await ev(() => Array.prototype.filter.call(document.querySelectorAll('.kogloss'), (x) => !x.hidden).length);
    if (shown) throw new Error(shown + ' Korean lines still shown');
  });
  /* 中文 (Daniel, 8 Oct 2026: "most struggling students are chinese"; the pupil chooses) */
  const zhLines = () => ev(() => { const all = document.querySelectorAll('.words__kodef');
    const on = Array.prototype.filter.call(all, (x) => !x.hidden && /[\u4e00-\u9fff]/.test(x.textContent) && x.lang === 'zh-Hans' && /^[^：]+：/.test(x.textContent));
    return { all: all.length, on: on.length, sample: on[0] ? on[0].textContent.slice(0, 24) : '', ko: Array.prototype.filter.call(all, (x) => !x.hidden && /[가-힣]/.test(x.textContent)).length }; });
  await check('中文 chosen: the Chinese file is fetched; every definition on the Keywords page gets its Chinese term and meaning, marked as Chinese', async () => {
    await ev((q) => document.querySelector(q).click(), ZH_BTN); await wait(900);
    if (!zhFetched()) throw new Error('zh.js was not fetched');
    const s = await zhLines();
    if (!s.all || s.on !== s.all || s.ko) throw new Error(JSON.stringify(s));
    const p = await ev((q) => [q[0], q[1]].map((x) => document.querySelector(x).getAttribute('aria-pressed')).join(','), [KO_BTN, ZH_BTN]);
    if (p !== 'false,true') throw new Error('pressed: ' + p);
  });
  await check('中文 on: a meanings card shows NO Chinese before it is answered; its keyword card shows the Chinese after', async () => {
    await ev(PAGE_KIT); await ev((c) => { window.__cards = { mean: c.mean.it }; }, C);
    const t = await ev(() => {
      const W = window, it = W.__cards.mean, card = W.__draw(it);
      const before = Array.prototype.filter.call(card.querySelectorAll('.kogloss'), (x) => !x.hidden).map((x) => x.textContent).join(' | ');
      const b = Array.prototype.find.call(card.querySelectorAll('.kwopt'), (x) => x.textContent.trim() === it.key); b.click();
      Array.prototype.find.call(card.querySelectorAll('.card__foot .btn--go'), (x) => !x.hidden).click();
      const k = card.querySelector('.kcard__kodef');
      return { before, after: k && !k.hidden ? k.textContent : '', lang: k && k.lang };
    });
    if (t.before) throw new Error('Chinese before the answer: ' + t.before);
    if (!/[\u4e00-\u9fff]/.test(t.after) || t.lang !== 'zh-Hans') throw new Error('no Chinese on the keyword card after the answer: ' + JSON.stringify(t));
  });
  await check('한국어 pressed while 中文 is on: the lines turn Korean, and only 한국어 shows pressed', async () => {
    const uid = await ev(() => Object.keys(window.AL.meta.words)[0]);
    await open('#/w/' + uid); await wait(900);
    await ev((q) => document.querySelector(q).click(), KO_BTN); await wait(500);
    const s = await ev(() => { const all = document.querySelectorAll('.words__kodef');
      return { all: all.length, ko: Array.prototype.filter.call(all, (x) => !x.hidden && /[가-힣]/.test(x.textContent) && x.lang === 'ko').length,
               zh: Array.prototype.filter.call(all, (x) => !x.hidden && /[\u4e00-\u9fff]/.test(x.textContent)).length }; });
    const p = await ev((q) => [q[0], q[1]].map((x) => document.querySelector(x).getAttribute('aria-pressed')).join(','), [KO_BTN, ZH_BTN]);
    if (!s.all || s.ko !== s.all || s.zh || p !== 'true,false') throw new Error(JSON.stringify(s) + ' pressed ' + p);
  });
  await check('the language is the pupil’s own: another pupil signed in on this computer starts with it off; the first finds theirs again', async () => {
    await ev((q) => document.querySelector(q).click(), ZH_BTN); await wait(500);          /* pupil one: 中文 */
    const TWO = 'pupil.two@pupils.nlcsjeju.kr', as = async (email) => {
      await ev((a) => { localStorage.setItem('biology.signin', JSON.stringify({ token: a.token, name: 'Pupil', email: a.email, exp: Math.floor(Date.now() / 1000) + 3600 }));
        localStorage.setItem('bio-english-lab.owner', a.email); }, { token: jwt(email), email });
      await open('#/w/' + (await ev(() => Object.keys(window.AL.meta.words)[0]))); await wait(1200);
      return ev((q) => ({ pressed: [q[0], q[1]].map((x) => { const b = document.querySelector(x); return b ? b.getAttribute('aria-pressed') : 'none'; }).join(','),
        shown: Array.prototype.filter.call(document.querySelectorAll('.kogloss'), (x) => !x.hidden).length }), [KO_BTN, ZH_BTN]);
    };
    const two = await as(TWO);
    if (two.pressed !== 'false,false' || two.shown) throw new Error('the next pupil inherited it: ' + JSON.stringify(two));
    const one = await as(ONE);
    if (one.pressed !== 'false,true' || !one.shown) throw new Error('the first pupil lost their choice: ' + JSON.stringify(one));
    await ev((q) => document.querySelector(q).click(), ZH_BTN); await wait(300);          /* off again, for the checks after */
  });

  /* ---- C. the redo: every pupil ---- */
  await check('redo: a finished set offers "Redo the 2 you missed", plays exactly those, and changes nothing in the record', async () => {
    await ev(PAGE_KIT);              /* a page loaded since (the phone check) has none of the helpers */
    const sid = await ev(() => { const W = window; const ok = Object.keys(W.AL.sets).filter((s) => { const x = W.__open(s); return x.items.filter((i) => i.type !== 'learn' && i.type !== 'exam').length >= 4; }); return ok[0]; });
    const plan = await ev((s) => {
      const W = window, set = W.__open(s), items = set.items.filter((i) => i.type !== 'learn'), recs = {};
      items.forEach((it, i) => { recs[it.id + '@' + it.h] = i < 2 ? { t: 2, ok: 1, at: Date.now() } : { t: 1, ok: 1, first: 1, at: Date.now() }; });
      set.items.filter((i) => i.type === 'learn').forEach((it) => { recs[it.id + '@' + it.h] = { seen: 1 }; });
      const P = JSON.parse(localStorage.getItem('bio-english-lab.v1') || '{"sets":{}}'); P.sets = P.sets || {}; P.sets[s] = { items: recs, at: Date.now() };
      localStorage.setItem('bio-english-lab.v1', JSON.stringify(P));
      const words = (it) => W.AText.plain(String(it.q || it.prompt || it.task || it.text || '')).replace(/\s+/g, ' ').trim().slice(0, 40);
      return { n: set.items.length, missedQ: items.slice(0, 2).map(words) };
    }, sid);
    await open('#/s/' + sid + '/' + (plan.n + 1)); await wait(500);
    const before = await ev((s) => JSON.stringify(JSON.parse(localStorage.getItem('bio-english-lab.v1')).sets[s]), sid);
    const btn = await ev(() => { const b = Array.prototype.filter.call(document.querySelectorAll('.done button'), (x) => /^Redo the/.test(x.textContent))[0]; return b ? b.textContent : ''; });
    if (btn !== 'Redo the 2 you missed') throw new Error('the button reads ' + JSON.stringify(btn));
    await ev(() => Array.prototype.filter.call(document.querySelectorAll('.done button'), (x) => /^Redo the/.test(x.textContent))[0].click()); await wait(300);
    const seen = [];
    for (let k = 0; k < 2; k++) {
      const st = await ev(() => ({ prog: document.querySelector('.ptop__p').textContent, text: (document.querySelector('.stage .card') || { textContent: '' }).textContent.replace(/\s+/g, ' ') }));
      if (!new RegExp('Redo · question ' + (k + 1) + ' of 2').test(st.prog)) throw new Error('step ' + (k + 1) + ': ' + st.prog);
      if (!plan.missedQ[k] || st.text.indexOf(plan.missedQ[k]) < 0) throw new Error('step ' + (k + 1) + ' is not the question missed: wanted "' + plan.missedQ[k] + '"');
      seen.push(k);
      /* move on with the model answer, as a pupil who gives up would */
      await ev(() => { const card = document.querySelector('.stage .card'); const b = Array.prototype.filter.call(card.querySelectorAll('button'), (x) => !x.hidden && /^(Check|Show the model answer)$/.test(x.textContent));
        const show = Array.prototype.filter.call(card.querySelectorAll('button'), (x) => x.textContent === 'Show the model answer')[0]; if (show) { show.hidden = false; show.click(); }
        const nx = Array.prototype.filter.call(card.querySelectorAll('button'), (x) => /^Next/.test(x.textContent))[0]; if (nx) { nx.hidden = false; nx.click(); } });
      await wait(250);
    }
    const end = await ev(() => document.querySelector('.stage .done h2') ? document.querySelector('.stage .done').textContent : '');
    if (!/Redo finished/.test(end) || !/0\/2/.test(end)) throw new Error('the end reads ' + JSON.stringify(end.slice(0, 120)));
    const after = await ev((s) => JSON.stringify(JSON.parse(localStorage.getItem('bio-english-lab.v1')).sets[s]), sid);
    if (after !== before) throw new Error('the redo changed the record');
    if (seen.length !== 2) throw new Error('it played ' + seen.length + ' questions');
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
