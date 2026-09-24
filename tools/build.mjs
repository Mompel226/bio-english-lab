#!/usr/bin/env node
/* ============================================================
   tools/build.mjs — turns the authored masters into what the page loads.

     node tools/build.mjs            build, check every question, stamp
     node tools/build.mjs --check    check only, write nothing

   Reads   ../bio-english-lab-source/units.master.js      years, topics, and which sets each has
           ../bio-english-lab-source/methods.master.js    the front page's method lessons and extras
           ../bio-english-lab-source/topics/*.master.js   the sets for each topic
           ../bio-english-lab-source/keywords.master.js   the one keyword list (shared with the
                                                     reflection system's flashcards)
   Writes  js/data/content.js    the sets, each scrambled, plus the plain list the pages draw
           data/sets.json        the public list of sets (ids, names, counts — NO answers);
                                 the Apps Script reads it to offer sets as homework
           js/signin.js          copied from labs-shared/ (the one sign-in for the site)
           version.txt, and the ?v= stamps in index.html

   The masters are never published (see .gitignore): the page ships only the scrambled copy.
   Scrambled is not encrypted — it stops the answers being read by viewing the page, the way a
   covered answer sheet does. The page has to unscramble them to show the model answer after a
   try, so a determined student with the browser's developer tools could find them.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SRC = path.resolve(REPO, '..', 'bio-english-lab-source');
const CHECK_ONLY = process.argv.includes('--check');
/* --topics <dir>  read topic files from another folder (a writer's staging folder)
   --out <dir>     write ONLY content.js there (for a writer's own self-test); touch nothing else */
function opt(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; }
const TOPICS_DIR = opt('--topics') ? path.resolve(process.cwd(), opt('--topics')) : null;
const OUT_DIR = opt('--out') ? path.resolve(process.cwd(), opt('--out')) : null;
const problems = [];
const warn = [];
function bad(where, msg) { problems.push(`${where}: ${msg}`); }

async function load(file) {
  const u = pathToFileURL(file).href + '?t=' + Date.now();
  return import(u);
}

/* ---------- find labs-shared: an ancestor, by name ---------- */
function findShared() {
  let d = REPO;
  for (let i = 0; i < 8; i++) {
    const c = path.join(d, 'labs-shared');
    if (fs.existsSync(path.join(c, 'signin.js'))) return c;
    d = path.dirname(d);
  }
  return null;
}

/* ---------- a question's fingerprint: its content, not its id ---------- */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => k !== 'id' && k !== 'h').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

/* ---------- the tags inside authored text ---------- */
const TAG = /\{([kdcnl]):([^{}]*)\}/g;
function checkTags(where, s) {
  if (typeof s !== 'string') return;
  const stripped = s.replace(TAG, '$2').replace(/\{\{[^}]*\}\}/g, '').replace(/\[\[[^\]]*\]\]/g, '');
  if (/[{}]/.test(stripped)) bad(where, 'a brace that is not a {k:…} {d:…} {c:…} {n:…} {l:…} tag: ' + s.slice(0, 80));
}
function allText(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => allText(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => allText(x, out));
  return out;
}

/* ---------- each kind of question, checked ---------- */
const NEEDS_MODEL = new Set(['pick', 'choose', 'build', 'fix', 'trim', 'gap', 'exam', 'order']);
function checkItem(it, where) {
  const T = it.type;
  if (!it.id) bad(where, 'no id');
  if (!it.type) bad(where, 'no type');
  if (T !== 'learn' && T !== 'kw' && !it.src) bad(where, 'no src — every question names the paper or syllabus statement it is based on');
  if (T !== 'learn' && T !== 'kw' && !it.q && !it.task) bad(where, 'no question and no task');
  if (NEEDS_MODEL.has(T) && !(it.model && it.model.length)) bad(where, 'no model answer');
  /* the two syllabus fields: a sentence each, tagged like any other text */
  ['older', 'deeper'].forEach(k => {
    if (it[k] == null) return;
    if (typeof it[k] !== 'string' || it[k].trim().length < 15) bad(where, `${k} must be a sentence that explains it`);
    else checkTags(`${where} ${k}`, it[k]);
  });
  /* a fix question marks its weak words {like this} — braces with no colon, in its text only */
  allText(T === 'fix' ? { ...it, text: String(it.text || '').replace(/\{[^{}:]+\}/g, '') } : it).forEach(s => checkTags(where, s));
  switch (T) {
    case 'learn':
      if (!Array.isArray(it.body) || !it.body.length) bad(where, 'learn card with no body');
      /* "Examiners did not credit…" is a claim about a real report: the card must say which one */
      if (!it.src && /\bexaminers?\s+(did|saw|wanted|reported|rejected|noted|were|gave|accepted|credited|ignored)\b/i.test(JSON.stringify(it.body)))
        bad(where, 'a learn card reports what examiners did but names no examiner report in src');
      break;
    case 'pick': {
      const ok = (it.options || []).filter(o => o.ok).length;
      if ((it.options || []).length < 2) bad(where, 'pick needs 2+ options');
      if (ok !== 1) bad(where, `pick needs exactly one right option (has ${ok})`);
      (it.options || []).forEach((o, i) => { if (!o.why) warn.push(`${where}: option ${i + 1} has no "why"`); });
      break;
    }
    case 'choose': {
      const slots = (it.text || '').match(/\[\[[^\]]+\]\]/g) || [];
      if (!slots.length) bad(where, 'choose has no [[…]] slot');
      slots.forEach(s => { if (s.slice(2, -2).split('|').length < 2) bad(where, 'a slot with one option: ' + s); });
      break;
    }
    case 'build': {
      if (!Array.isArray(it.chunks) || it.chunks.length < 2) bad(where, 'build needs 2+ chunks');
      (it.orders || []).forEach(o => { if (o.slice().sort((a, b) => a - b).join() !== it.chunks.map((_, i) => i).join()) bad(where, 'an alternative order that is not a rearrangement of every chunk: ' + o); });
      const all = (it.chunks || []).concat(it.extra || []);
      if (new Set(all.map(s => s.trim().toLowerCase())).size !== all.length) bad(where, 'two pieces with the same words');
      break;
    }
    case 'fix': {
      const n = ((it.text || '').match(/\{[^{}:]+\}/g) || []).length;
      if (!n) bad(where, 'fix has no {weak} word');
      if (n !== (it.flaws || []).length) bad(where, `fix marks ${n} weak words but lists ${(it.flaws || []).length} flaws`);
      (it.flaws || []).forEach((f, i) => { if (!(f.opts || []).includes(f.fix)) bad(where, `flaw ${i + 1}: the right word is not among its options`); if ((f.opts || []).length < 2) bad(where, `flaw ${i + 1}: fewer than 2 options`); });
      break;
    }
    case 'trim': {
      const c = it.chunks || [];
      if (!c.some(x => x.x)) bad(where, 'trim has nothing to cut');
      if (!c.some(x => !x.x)) bad(where, 'trim has nothing to keep');
      break;
    }
    case 'order': if ((it.steps || []).length < 3) bad(where, 'order needs 3+ steps'); break;
    case 'gap': if (!/\{\{[^}]+\}\}/.test(it.text || '')) bad(where, 'gap has no {{…}}'); break;
    case 'sort': {
      if ((it.bins || []).length < 2) bad(where, 'sort needs 2+ groups');
      (it.items || []).forEach((x, i) => { if (!(x.b >= 0 && x.b < it.bins.length)) bad(where, `sort piece ${i + 1} has no valid group`); });
      break;
    }
    case 'mark': {
      if (!it.answer) bad(where, 'mark has no student answer');
      if (!(it.scheme || []).length) bad(where, 'mark has no scheme');
      break;
    }
    case 'kw': {
      if (!it.key || !it.prompt) bad(where, 'keyword question needs key and prompt');
      if (it.input === 'choose' && !(it.opts || []).some(o => o.toLowerCase() === String(it.key).toLowerCase())) bad(where, 'keyword options do not include the keyword');
      if (it.input === 'choose' && new Set((it.opts || []).map(o => o.toLowerCase())).size !== (it.opts || []).length) bad(where, 'the same option twice');
      break;
    }
    case 'exam': {
      const good = (it.ideas || []).filter(x => x.ok).length;
      if (!good) bad(where, 'exam has no idea that scores');
      if (!(it.frames || []).length) bad(where, 'exam has no sentences to write');
      (it.frames || []).forEach((f, i) => { if (!/\{\{[^}]+\}\}/.test(f)) bad(where, `exam sentence ${i + 1} has no {{keyword}} to write`); });
      if (good !== (it.frames || []).length) warn.push(`${where}: ${good} scoring ideas but ${(it.frames || []).length} sentences`);
      break;
    }
    default: bad(where, 'unknown type ' + T);
  }
}

/* ============================================================ */
const shared = findShared();
if (!shared) bad('build', 'labs-shared/ not found above the repo');
if (!fs.existsSync(SRC)) { console.error('No ../bio-english-lab-source/ beside the repo.'); process.exit(1); }

const { YEARS, UNITS } = await load(path.join(SRC, 'units.master.js'));
const methodsMod = await load(path.join(SRC, 'methods.master.js'));
const kwMod = fs.existsSync(path.join(SRC, 'keywords.master.js')) ? await load(path.join(SRC, 'keywords.master.js')) : { KEYWORDS: [] };
const KEYWORDS = kwMod.KEYWORDS || [];

const SETS = {};           /* id → set */

/* ---------- the keyword list becomes each topic's "Keywords: meanings" set ----------
   Definition in, keyword out: the same definitions the reflection system's flashcards show,
   so the two can never teach a word two ways. The wrong choices are other keywords from the
   same topic (same section first), picked the same way every build so a question's
   fingerprint only changes when its words do. */
function unitOfKeyword(k) {
  const t = Number(k.topic), sub = String(k.subtopic || '');
  if (!t || k.year === 'IB' || k.review === 'delete?') return null;
  if (t === 14 && sub.startsWith('14.5')) return 't14-5';
  if (t === 16 && sub.startsWith('16.3')) return 't16-3';
  return UNITS['t' + t] ? 't' + t : null;
}
function firstSentence(def) {
  const d = String(def || '').trim();
  const re = /(?<!\be\.g|\bi\.e|\betc)\.\s+(?=[A-Z(])/g;
  const m = re.exec(d);
  let s = m ? d.slice(0, m.index + 1) : d;
  if (s.split(/\s+/).length < 7 && m) { const m2 = re.exec(d); s = m2 ? d.slice(0, m2.index + 1) : d; }
  return s;
}
function maskTerm(text, term) {
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = [term, term + 's', term + 'es', term.replace(/y$/, 'ies'), term.replace(/um$/, 'a'), term.replace(/us$/, 'i'), term.replace(/on$/, 'a')];
  let out = text;
  forms.sort((a, b) => b.length - a.length).forEach(f => { out = out.replace(new RegExp('\\b' + esc(f) + '\\b', 'gi'), '______'); });
  return out;
}
/* "Neurone (nerve cell)" → main "Neurone", also "nerve cell"; "Stimulus (plural: stimuli)" → also "stimuli" */
function names(en) {
  const m = String(en || '').match(/^(.*?)\s*\((.*)\)\s*$/);
  const main = (m ? m[1] : String(en || '')).trim();
  const also = m ? m[2].split(/[;,/]|\bor\b/).map(x => x.replace(/^\s*(plural|singular|also|abbreviation)\s*:\s*/i, '').trim()).filter(x => x && x.length > 1) : [];
  return { main, also, all: [main].concat(also).map(x => x.toLowerCase()) };
}
function seeded(id) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
const kwByUnit = {};
KEYWORDS.forEach(k => { const u = unitOfKeyword(k); if (u) (kwByUnit[u] = kwByUnit[u] || []).push(k); });
const AUTO_MAX = 24;
for (const [uid, list] of Object.entries(kwByUnit)) {
  const sorted = list.slice().sort((a, b) => String(a.subtopic).localeCompare(String(b.subtopic), 'en', { numeric: true }) || (b.strict ? 1 : 0) - (a.strict ? 1 : 0));
  const parts = Math.ceil(sorted.length / AUTO_MAX);
  const per = Math.ceil(sorted.length / parts);
  for (let p = 0; p < parts; p++) {
    const chunk = sorted.slice(p * per, (p + 1) * per);
    const sid = uid + '.kw.meanings' + (parts > 1 ? '.' + (p + 1) : '');
    const items = chunk.map(k => {
      const rnd = seeded(k.id);
      const lower = s => String(s).toLowerCase();
      const N = names(k.en);
      /* never a choice that shares a name with the answer: "Vitamin C" and "Ascorbic acid (vitamin C)" are one word */
      const clash = o => { const O = names(o.en); return O.all.some(x => N.all.some(y => x === y || x.includes(y) || y.includes(x))); };
      const pool = list.filter(o => o.id !== k.id && !clash(o));
      const same = pool.filter(o => o.subtopic === k.subtopic), rest = pool.filter(o => o.subtopic !== k.subtopic);
      const pickFrom = (arr, n) => { const a = arr.slice(); const out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };
      let wrong = pickFrom(same, 3); if (wrong.length < 3) wrong = wrong.concat(pickFrom(rest, 3 - wrong.length));
      let prompt = firstSentence(k.en_def);
      [N.main].concat(N.also).forEach(t => { prompt = maskTerm(prompt, t); });
      /* a keyword may carry the fuller biology behind its examined definition; the card folds it away */
      return { id: 'kwm.' + k.id, type: 'kw', input: 'choose', key: N.main, accept: N.also, full: k.en, prompt, def: k.en_def, ko: k.ko || '',
               ...(k.deeper ? { deeper: k.deeper } : {}), ...(k.older ? { older: k.older } : {}),
               opts: [N.main].concat(wrong.map(o => names(o.en).main)), src: 'Keyword list' + (k.subtopic ? ' · syllabus ' + k.subtopic : '') };
    }).filter(it => it.opts.length === 4 && new Set(it.opts.map(o => o.toLowerCase())).size === 4);
    SETS[sid] = { id: sid, unit: uid, kind: 'kw', auto: true,
      title: 'Keywords: meanings' + (parts > 1 ? ' ' + (p + 1) : ''),
      blurb: 'Every keyword of the topic, from its definition' + (parts > 1 ? ' (part ' + (p + 1) + ' of ' + parts + ')' : ''), items };
  }
}
/* authored keyword questions borrow the Korean from the same list */
/* Korean for an authored keyword item, found by any name the list gives the word. A word's OWN
   names win ("Enzyme"; "Exponential (log) phase" read as "exponential phase" and "exponential log
   phase"); a bracketed alternative ("Complementary shape (enzyme/substrate)") only fills a gap, and
   never when two words offer it with different Korean. */
const koKey = x => String(x || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
const KO = {}, KO_ALSO = {};
KEYWORDS.forEach(k => { if (!k.ko) return; const n = names(k.en);
  [k.en, n.main, String(k.en).replace(/\s*\([^)]*\)\s*/g, ' '), String(k.en).replace(/[()]/g, '')]
    .forEach(nm => { const key = koKey(nm); if (key && !(key in KO)) KO[key] = k.ko; }); });
KEYWORDS.forEach(k => { if (!k.ko) return;
  names(k.en).also.forEach(nm => { const key = koKey(nm); if (!key || key in KO) return; (KO_ALSO[key] = KO_ALSO[key] || new Set()).add(k.ko); }); });
Object.keys(KO_ALSO).forEach(key => { if (KO_ALSO[key].size === 1) KO[key] = [...KO_ALSO[key]][0]; });
/* ...and a plural card ("antibodies", "memory cells") by its singular. */
function koFor(key) {
  const k = koKey(key);
  for (const c of [k, k.replace(/ies$/, 'y'), k.replace(/es$/, ''), k.replace(/s$/, '')]) if (KO[c]) return KO[c];
  return '';
}
function addSets(list, from) {
  (list || []).forEach(s => {
    if (!s.id) { bad(from, 'a set with no id'); return; }
    if (SETS[s.id]) bad(from, 'two sets called ' + s.id);
    SETS[s.id] = s;
  });
}
addSets(methodsMod.SETS, 'methods.master.js');
const topicDir = TOPICS_DIR || path.join(SRC, 'topics');
for (const f of fs.readdirSync(topicDir).filter(f => f.endsWith('.master.js')).sort()) {
  const mod = await load(path.join(topicDir, f));
  addSets(mod.SETS, f);
}

/* ---------- check everything ---------- */
const ids = new Set();
for (const s of Object.values(SETS)) {
  if (!s.title) bad(s.id, 'no title');
  if (!['kw', 'describe', 'explain', 'plan', 'method'].includes(s.kind)) bad(s.id, 'kind must be kw, describe, explain, plan or method');
  if (s.unit && !UNITS[s.unit]) bad(s.id, 'unit ' + s.unit + ' is not in units.master.js');
  (s.items || []).forEach((it, i) => {
    const where = `${s.id} #${i + 1}${it.id ? ' (' + it.id + ')' : ''}`;
    if (ids.has(it.id)) bad(where, 'id used twice: ' + it.id);
    ids.add(it.id);
    checkItem(it, where);
  });
  if (!(s.items || []).length) bad(s.id, 'a set with no questions');
}
/* a set that names its unit but is not listed there is added at the end, in file order */
for (const s of Object.values(SETS)) if (s.unit && UNITS[s.unit] && !(UNITS[s.unit].sets || []).includes(s.id)) (UNITS[s.unit].sets = UNITS[s.unit].sets || []).push(s.id);
/* with --topics, only the sets that exist are listed */
if (TOPICS_DIR) for (const u of Object.values(UNITS)) u.sets = (u.sets || []).filter(sid => SETS[sid]);
/* the automatic keyword sets go first in their topic */
for (const s of Object.values(SETS)) if (s.auto) { const u = UNITS[s.unit]; u.sets = (u.sets || []).filter(x => x !== s.id); }
for (const s of Object.values(SETS).filter(s => s.auto).sort((a, b) => b.id.localeCompare(a.id))) UNITS[s.unit].sets.unshift(s.id);
/* every set a unit names exists; every set with a unit is named by it */
for (const [uid, u] of Object.entries(UNITS)) {
  (u.sets || []).forEach(sid => { if (!SETS[sid]) bad(uid, 'names a set that does not exist: ' + sid); });
}
for (const s of Object.values(SETS)) if (s.unit && !(UNITS[s.unit].sets || []).includes(s.id)) bad(s.id, `not listed in ${s.unit}.sets, so no page would show it`);
for (const Y of YEARS) Y.units.forEach(uid => { if (!UNITS[uid]) bad('YEARS', 'unknown unit ' + uid); });
for (const m of methodsMod.METHODS || []) if (!SETS[m.set]) bad('METHODS', 'unknown set ' + m.set);
for (const m of methodsMod.EXTRAS || []) if (!SETS[m.set]) bad('EXTRAS', 'unknown set ' + m.set);

/* keywords: ids unique, every keyword question names a known keyword */
const kwIds = new Set();
KEYWORDS.forEach(k => { if (kwIds.has(k.id)) bad('keywords', 'id twice: ' + k.id); kwIds.add(k.id); });

if (problems.length) {
  console.error('\n✗ ' + problems.length + ' problem' + (problems.length === 1 ? '' : 's') + ':\n  ' + problems.join('\n  '));
  process.exit(1);
}
if (warn.length) console.log('Notes (' + warn.length + '):\n  ' + warn.slice(0, 40).join('\n  ') + (warn.length > 40 ? '\n  …' : ''));

/* ---------- what the page gets ---------- */
const KEY = crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 14) || 'answerlab';
function scramble(obj) {
  const bytes = Buffer.from(JSON.stringify(obj), 'utf8');
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY.charCodeAt(i % KEY.length);
  return out.toString('base64');
}
const meta = { years: YEARS, units: {}, sets: {}, methods: methodsMod.METHODS || [], extras: methodsMod.EXTRAS || [], hero: methodsMod.HERO || null, known: [] };
const known = new Set();
KEYWORDS.forEach(k => { if (k.en) known.add(k.en); });
const shipped = {};
let totalQ = 0;
for (const s of Object.values(SETS)) {
  const items = s.items.map(it => {
    const x = (it.type === 'kw' && !it.ko && koFor(it.key)) ? { ...it, ko: koFor(it.key) } : it;
    return { ...x, h: fnv(canon(x)) };
  });
  items.forEach(it => {
    if (it.type === 'kw') { known.add(it.key); (it.accept || []).forEach(a => known.add(a)); (it.opts || []).forEach(a => known.add(a)); }
    if (it.type === 'gap' || it.type === 'exam') ((it.text || '') + (it.frames || []).join(' ')).replace(/\{\{([^}]+)\}\}/g, (_, a) => { a.split('|').forEach(x => known.add(x.trim())); return ''; });
  });
  const keys = items.filter(it => it.type !== 'learn').map(it => it.id + '@' + it.h);
  totalQ += keys.length;
  meta.sets[s.id] = { id: s.id, unit: s.unit || null, kind: s.kind, title: s.title, blurb: s.blurb || '', keys, v: fnv(keys.join('|')) };
  shipped[s.id] = scramble({ id: s.id, items });
}
for (const [uid, u] of Object.entries(UNITS)) {
  const count = (u.sets || []).reduce((n, sid) => n + meta.sets[sid].keys.length, 0);
  meta.units[uid] = { id: uid, n: u.n, title: u.title, year: u.year, syl: u.syl || '', sets: u.sets || [], count };
}
meta.known = Array.from(known).filter(Boolean).sort();
/* each topic's keywords, to read before a test: term, definition, Korean. Not answers to anything
   the site marks by hiding them, so they ship as they are — the same words as the flashcards. */
meta.words = {};
for (const [uid, list] of Object.entries(kwByUnit)) {
  meta.words[uid] = list.slice().sort((a, b) => String(a.subtopic).localeCompare(String(b.subtopic), 'en', { numeric: true }))
    .map(k => ({ t: k.en, d: k.en_def, ko: k.ko || '', s: k.subtopic || '', sup: !!k.sup }));
}
/* Every sentence frame the topic teaches, gathered in one place. The frames are scattered through
   the questions, where they are used one at a time; a student revising wants to see the shapes
   together. Nothing new is written here — this is the same text the cards already carry. */
meta.frames = {};
for (const s of Object.values(SETS)) {
  if (!s.unit) continue;
  const out = meta.frames[s.unit] = meta.frames[s.unit] || [];
  const add = (t, kind) => {
    const text = String(t || '').replace(/\{\{([^}]+)\}\}/g, (_, a) => a.split('|')[0].trim()).trim();
    if (text && !out.some(x => x.t === text)) out.push({ t: text, k: kind });
  };
  s.items.forEach(it => {
    (it.body || []).forEach(p => { if (p && p.frame) add(p.frame, s.kind); });
    /* an exam question's frames are one answer, line by line: keep them together, in order */
    const g = (it.frames || []).map(f => String(f).replace(/\{\{([^}]+)\}\}/g, (_, a) => a.split('|')[0].trim()).trim()).filter(Boolean);
    if (g.length === 1) add(g[0], s.kind);
    else if (g.length && !out.some(x => (x.g || []).join('|') === g.join('|'))) out.push({ g: g, k: s.kind, q: it.cmd || '' });
  });
}
Object.keys(meta.frames).forEach(u => { if (!meta.frames[u].length) delete meta.frames[u]; });

meta.methodOrder = (methodsMod.METHODS || []).map(m => m.set).concat((methodsMod.EXTRAS || []).map(m => m.set));
/* the command-word guide: ONE master (guide.master.json) for this site and the reflection dashboard */
const GUIDE_FILE = path.join(SRC, 'guide.master.json');
if (fs.existsSync(GUIDE_FILE)) {
  const G = JSON.parse(fs.readFileSync(GUIDE_FILE, 'utf8'));
  const keep = c => !/^not used|^dashboard tag/i.test(String(c.status || ''));
  const byId = Object.fromEntries(G.patterns.map(p => [p.id, p]));
  G.commands.filter(keep).forEach(c => { if (!byId[c.pattern]) bad('guide', c.word + ' links to pattern ' + c.pattern + ', which does not exist'); });
  meta.guide = {
    commands: G.commands.filter(keep).map(c => ({ word: c.word, official: c.official || '', status: c.status || '', plain: c.plain || '', shape: c.answerShape || '', frame: c.frame || '', pattern: c.pattern, method: c.answerLabMethod || '', note: c.note || '' })),
    patterns: G.patterns.map(p => ({ id: p.id, group: p.group, order: p.order, title: p.title, commands: p.commands || [], signature: p.signature || '', strategy: p.strategy || '',
      steps: p.steps || [], pitfalls: p.pitfalls || [], note: p.cambridgeNote || '',
      example: p.example ? { source: p.example.source, stem: p.example.stem, marks: p.example.marks, scheme: p.example.markScheme || [], guidance: p.example.guidance || [], model: p.example.model || '', figureNote: p.example.figureNote || '' } : null })),
    mistakes: G.mistakes.map(m => ({ title: m.title, body: m.body, source: m.source })),
    decoder: G.decoder.map(d => ({ n: d.n, name: d.name, what: d.what, cue: d.cue })),
    symbols: G.markSchemeSymbols.map(x => ({ symbol: x.symbol, official: x.official, plain: x.plain }))
  };
  if (problems.length) { console.error('\n✗ ' + problems.join('\n  ')); process.exit(1); }
}

/* ---------- the public list of sets, for the Apps Script ---------- */
const manifest = {
  site: 'bio-english-lab', built: new Date().toISOString(),
  years: YEARS.map(Y => ({ y: Y.y, title: Y.title, units: Y.units })),
  units: Object.fromEntries(Object.entries(meta.units).map(([k, u]) => [k, { n: u.n, title: u.title, year: u.year, sets: u.sets }])),
  sets: Object.values(meta.sets).map(s => ({ id: s.id, unit: s.unit, kind: s.kind, title: s.title, total: s.keys.length, v: s.v }))
};

/* ---------- report ---------- */
const byKind = {};
Object.values(meta.sets).forEach(s => { byKind[s.kind] = (byKind[s.kind] || 0) + s.keys.length; });
console.log(`✓ ${Object.keys(SETS).length} sets, ${totalQ} questions (${Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(', ')}), ${KEYWORDS.length} keywords`);
if (CHECK_ONLY) process.exit(0);

/* ---------- write ---------- */
const STAMP = Math.floor(Date.now() / 1000);
if (OUT_DIR) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'content.js'), 'window.AL = ' + JSON.stringify({ k: KEY, v: STAMP, meta, sets: shipped }) + ';\n');
  console.log('✓ staging content written: ' + path.join(OUT_DIR, 'content.js'));
  process.exit(0);
}
fs.mkdirSync(path.join(REPO, 'js/data'), { recursive: true });
fs.mkdirSync(path.join(REPO, 'data'), { recursive: true });
fs.writeFileSync(path.join(REPO, 'js/data/content.js'),
  '/* GENERATED by tools/build.mjs — do not edit. The questions, scrambled; see the build for why. */\n' +
  'window.AL = ' + JSON.stringify({ k: KEY, v: STAMP, meta, sets: shipped }) + ';\n');
fs.writeFileSync(path.join(REPO, 'data/sets.json'), JSON.stringify(manifest, null, 1) + '\n');
if (shared) {
  const src = fs.readFileSync(path.join(shared, 'signin.js'), 'utf8');
  fs.writeFileSync(path.join(REPO, 'js/signin.js'), src);
}
const idx = path.join(REPO, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
const before = html;
html = html.replace(/(\.(?:js|css))\?v=\d+/g, `$1?v=${STAMP}`);
if (html === before && !/\?v=\d+/.test(before)) { console.error('index.html has no ?v= stamps'); process.exit(1); }
fs.writeFileSync(idx, html);
fs.writeFileSync(path.join(REPO, 'version.txt'), String(STAMP) + '\n');
console.log('✓ written · stamp ' + STAMP);
