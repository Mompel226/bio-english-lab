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
           ../bio-english-lab-source/guide.master.json    the command-word guide
           ../bio-english-lab-source/wordparts.master.js  the word parts (etymology): one more keyword set per topic
           ../bio-english-lab-source/syllabus-tags.json, past-keywords.json   the syllabus tags
           ../../labs-shared/syllabus.json, syllabus-versions.json, syllabus-past.json, signin.js
   Writes  js/data/content.js    the sets, each scrambled, plus the plain list the pages draw
           data/sets.json        the public list of sets (ids, names, counts — NO answers);
                                 the Apps Script reads it to offer sets as homework
           js/signin.js          copied from labs-shared/ (the one sign-in for the site)
           version.txt, and the ?v= stamps in index.html
           (with --out <folder>: only <folder>/content.js, a staging copy, and nothing else)

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
  if (it.mode != null && it.mode !== 'data' && it.mode !== 'theory') bad(where, "mode must be 'data' or 'theory'");
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
const SYL = {};
const SYL_TAGS = (() => { try { return JSON.parse(fs.readFileSync(path.join(SRC, 'syllabus-tags.json'), 'utf8')); } catch (e) { return { items: {}, keywords: {} }; } })();
/* `h`: the item's fingerprint now. A tag given to the item as it was before a rewording is not used: the reworded
   question may test something else (tools/syllabus-tags.mjs check names it) */
function sylOf(id, h) {
  /* an etymology question (kwr.<keyword>.…) is about that keyword's word: it carries that keyword's statements */
  if (String(id).startsWith('kwr.')) { const k = (SYL_TAGS.keywords || {})[String(id).split('.')[1]]; return k && Array.isArray(k.syl) ? k.syl.slice(0, 3) : []; }
  const x = String(id).startsWith('kwm.') ? (SYL_TAGS.keywords || {})[String(id).slice(4)] : (SYL_TAGS.items || {})[id];
  if (x && h && x.h && x.h !== h) return [];
  return x && Array.isArray(x.syl) ? x.syl.slice(0, 3) : [];
}

const { YEARS, UNITS } = await load(path.join(SRC, 'units.master.js'));
const methodsMod = await load(path.join(SRC, 'methods.master.js'));
const kwMod = fs.existsSync(path.join(SRC, 'keywords.master.js')) ? await load(path.join(SRC, 'keywords.master.js')) : { KEYWORDS: [] };
const KEYWORDS = kwMod.KEYWORDS || [];

const SETS = {};           /* id → set */

/* ---------- the keyword list becomes each topic's "Keywords: meanings" set ----------
   Definition in, keyword out: the same definitions the reflection system's flashcards show,
   so the two can never teach a word two ways. The wrong choices are other keywords from the
   same topic (same section first), picked the same way every build so a question's
   fingerprint only changes when its words do.
   The prompt must not hand over the answer (the syllabus-tag audit, 27 Sep 2026, found that
   it did — "(forming oxyhaemoglobin)", "the middle of the ______" where the blank was the heart):
     · a bracket that says WHICH one — "Septum (heart)", "Epidermis (leaf)" — is not another
       name for the keyword, so it is never blanked (QUALIFIER, in names());
     · a short first sentence borrows the next one only when the next one does not name the
       answer, and an aside that names it is left out (promptFor());
     · where the first sentence itself names the answer — a longer word built on it (ciliated,
       flowering) or its own head word as a label (the palisade mesophyll) — the keyword carries
       the question's prompt as `ask:` in the master. The flashcards keep the definition.
   And a keyword that cannot be built now stops the build: 14.5 has four keywords, three of
   which share "tropism", so three questions were being dropped without a word. A small unit
   now borrows its last wrong choices from its parent topic (14.5 from 14). */
function unitOfKeyword(k) {
  const t = Number(k.topic), sub = String(k.subtopic || '');
  if (!t || k.year === 'IB' || k.review === 'delete?') return null;
  if (t === 14 && sub.startsWith('14.5')) return 't14-5';
  if (t === 16 && sub.startsWith('16.3')) return 't16-3';
  return UNITS['t' + t] ? 't' + t : null;
}
/* the definition's sentences, cut where the old firstSentence() cut them */
function sentences(def) {
  const d = String(def || '').trim(), re = /(?<!\be\.g|\bi\.e|\betc)\.\s+(?=[A-Z(])/g, out = [];
  let from = 0, m;
  while ((m = re.exec(d))) { out.push(d.slice(from, m.index + 1)); from = m.index + m[0].length; }
  out.push(d.slice(from));
  return out.filter(Boolean);
}
function maskTerm(text, term) {
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = [term, term + 's', term + 'es', term.replace(/y$/, 'ies'), term.replace(/um$/, 'a'), term.replace(/us$/, 'i'), term.replace(/on$/, 'a')];
  let out = text;
  forms.sort((a, b) => b.length - a.length).forEach(f => { out = out.replace(new RegExp('\\b' + esc(f) + '\\b', 'gi'), '______'); });
  return out;
}
/* "Neurone (nerve cell)" → main "Neurone", also "nerve cell"; "Stimulus (plural: stimuli)" → also "stimuli";
   "Septum (heart)" → ctx "heart": a bracket that says which one is not a name, so it is never blanked.
   `all` keeps every bracketed word, so two choices never share one (the distractors are as before), and
   `words` keeps them in their old order for `accept`: a meanings question is always a choose, so `accept` is
   never read, and changing it would reset that question on every student's page. */
const QUALIFIER = /^(?:in|of|and)\b|^(?:life process|fat|oil|enzyme|substrate|plants?|leaf|heart|heart and veins|ribcage|urinary|eye|human|flower|comparison|body temperature|overview|conservation)$/i;
function names(en) {
  const m = String(en || '').match(/^(.*?)\s*\((.*)\)\s*$/);
  const main = (m ? m[1] : String(en || '')).trim();
  const words = m ? m[2].split(/[;,/]|\bor\b/).map(x => x.replace(/^\s*(plural|singular|also|abbreviation)\s*:\s*/i, '').trim()).filter(x => x && x.length > 1) : [];
  const list = m && /^\s*types?\s*:/i.test(m[2]);          /* "Tooth (types: incisor, canine, …)": kinds of it, not names */
  const ctx = words.filter(x => list || QUALIFIER.test(x));
  return { main, also: words.filter(x => !ctx.includes(x)), ctx, words, all: [main].concat(words).map(x => x.toLowerCase()) };
}
/* a word of the prompt that still spells the answer: the answer's head word inside a longer word (oxyhaemoglobin,
   ciliated, phototropism) or used as a label (the palisade mesophyll, iodine solution) */
function giveaway(text, N) {
  const stem = w => { w = w.toLowerCase(); return w.length > 6 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w; };
  const heads = [N.main].concat(N.also).map(x => (x.match(/[A-Za-z]+/) || [''])[0]).filter(w => w.length >= 5).map(stem);
  return String(text).replace(/______/g, ' ').split(/[^A-Za-z]+/).filter(w => w && heads.some(h => w.toLowerCase().includes(h)));
}
/* the meanings question's prompt: the keyword's own `ask`, or the definition's first sentence, blanked */
function promptFor(k, N) {
  const blank = t => [N.main].concat(N.also).reduce((p, n) => maskTerm(p, n), t);
  if (k.ask) return blank(k.ask);
  const S = sentences(k.en_def);
  let p = blank(S[0] || '');
  if (S[0] && S[0].split(/\s+/).length < 7 && S[1]) { const two = blank(S[0] + ' ' + S[1]); if (!giveaway(two, N).length) p = two; }
  if (giveaway(p, N).length) {
    p = p.replace(/\s*\((?:[^()]|\([^()]*\))*\)/g, a => giveaway(a, N).length ? '' : a)
         .replace(/,?\s*\b(?:e\.g\.|i\.e\.)[^.;]*(?=[.;]?$)/, a => giveaway(a, N).length ? '' : a)
         .replace(/\s+([.,;:])/g, '$1').trim();
    if (!/[.?!]$/.test(p)) p += '.';
  }
  return p;
}
/* single-word answers the gate below lets through: the prompt contrasts words from one root on purpose */
const GIVEAWAY_OK = { solvent: 'dissolve, solute and solution are the words it is told apart from' };
function seeded(id) { let h = 2166136261; for (const c of id) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
const kwByUnit = {};
KEYWORDS.forEach(k => { const u = unitOfKeyword(k); if (u) (kwByUnit[u] = kwByUnit[u] || []).push(k); });
const PARENT = { 't14-5': 't14', 't16-3': 't16' };   /* the units cut out of a topic, and where their wrong choices can also come from */
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
      if (wrong.length < 3 && PARENT[uid]) wrong = wrong.concat(pickFrom((kwByUnit[PARENT[uid]] || []).filter(o => !clash(o)), 3 - wrong.length));
      const prompt = promptFor(k, N);
      if (N.main.split(/\s+/).length === 1 && !GIVEAWAY_OK[k.id] && giveaway(prompt, { main: N.main, also: [] }).length)
        bad('keyword ' + k.id, `the meanings prompt still spells the answer ("${giveaway(prompt, { main: N.main, also: [] }).join('", "')}"): give the keyword an ask in the master`);
      /* a keyword may carry the fuller biology behind its examined definition; the card folds it away */
      return { id: 'kwm.' + k.id, type: 'kw', input: 'choose', key: N.main, accept: N.words, full: k.en, prompt, def: k.en_def, ko: k.ko || '',
               ...(k.deeper ? { deeper: k.deeper } : {}), ...(k.older ? { older: k.older } : {}),
               opts: [N.main].concat(wrong.map(o => names(o.en).main)), src: 'Keyword list' + (k.subtopic ? ' · syllabus ' + k.subtopic : '') };
    }).filter(it => {
      if (it.opts.length === 4 && new Set(it.opts.map(o => o.toLowerCase())).size === 4) return true;
      bad('keyword ' + it.id.slice(4), 'fewer than three other keywords to choose from, so its meanings question cannot be built');
      return false;
    });
    SETS[sid] = { id: sid, unit: uid, kind: 'kw', auto: true,
      title: 'Keywords: meanings' + (parts > 1 ? ' ' + (p + 1) : ''),
      blurb: 'Every keyword of the topic, from its definition' + (parts > 1 ? ' (part ' + (p + 1) + ' of ' + parts + ')' : ''), items };
  }
}
/* ---------- etymology: the Greek and Latin parts the keywords are built from (2 Oct 2026) ----------
   ../bio-english-lab-source/wordparts.master.js is the ONE list of word parts (cardi- = heart, -cyte = cell), each
   checked in a dictionary and carrying its source: PARTS, KW (which parts each keyword is built from, and where a
   word comes from) and MEET (words outside the keyword list that a student can work out from the parts).
   From it the build makes, for every topic, one set "Keywords: etymology" (<unit>.kw.roots, kind kw, so the labs
   script's homework needs nothing new) with three kinds of question, all a choice of four:
     · a part → what it means                      kwr.<keyword>.<part>
     · a keyword taken apart → its parts, in order  kwr.<keyword>.split
     · a word never taught → what it must mean      kwr.<keyword>.w.<word>
   The <keyword> in each id is a keyword of that topic built from the same part: the question borrows that keyword's
   syllabus tag (sylOf below, and englishTagOf in the estate's tools/syllabus-tags.mjs).
   A part is asked in ONE topic, the one with most keywords built from it (the earlier topic on a tie); a topic with
   few parts of its own also asks its commonest ones. The wrong choices are picked the same way every build, so a
   question's fingerprint changes only when its words do.
   What the pages draw (the topic's keyword list, the line under an answered keyword, the #/roots page) goes into
   meta.roots, beside the questions and never inside them: no keyword question's fingerprint changes, so nothing
   a student has answered restarts. */
const ROOTS_FILE = path.join(SRC, 'wordparts.master.js');
const RT = fs.existsSync(ROOTS_FILE) ? await load(ROOTS_FILE) : null;
/* small on purpose (Daniel, 3 Oct 2026: "for students to learn but not become completely overwhelmed") */
const ROOTS_PART_MAX = 10, ROOTS_PART_MIN = 4, ROOTS_END_MAX = 1, ROOTS_SPLIT_MAX = 4, ROOTS_MEET_MAX = 5, ROOTS_SET_MIN = 4, ROOTS_ASK_MIN_WORDS = 2;
function buildRoots() {
  const PARTS = RT.PARTS || [], KWR = RT.KW || {}, MEET = RT.MEET || [], GROUPS = RT.GROUPS || [], ALIKE = RT.ALIKE || [];
  const P = {};
  const plainText = (where, s) => { if (/[{}<>]/.test(String(s || ''))) bad(where, 'a brace or an angle bracket in its words: ' + String(s).slice(0, 60)); };
  PARTS.forEach(p => {
    const where = 'wordparts ' + (p.id || p.part);
    if (!p.id || P[p.id]) { bad(where, 'a part with no id, or its id twice'); return; }
    P[p.id] = p;
    ['part', 'means', 'origin', 'src', 'group'].forEach(f => { if (!p[f]) bad(where, 'no ' + f + ' (every part gives its meaning, its origin and the dictionary it was checked in)'); });
    if (!GROUPS.includes(p.group)) bad(where, 'group "' + p.group + '" is not in GROUPS');
    ['part', 'means', 'short', 'origin', 'src', 'ko'].forEach(f => plainText(where, p[f]));
  });
  ALIKE.forEach(g => g.forEach(pid => { if (!P[pid]) bad('wordparts ALIKE', 'unknown part ' + pid); }));
  const kwById = Object.fromEntries(KEYWORDS.map(k => [k.id, k]));
  const unitOrder = YEARS.flatMap(Y => Y.units);
  const unitOfId = {};
  Object.entries(kwByUnit).forEach(([u, l]) => l.forEach(k => { unitOfId[k.id] = u; }));
  for (const [id, x] of Object.entries(KWR)) {
    const where = 'wordparts KW ' + id;
    if (!kwById[id]) { bad(where, 'no such keyword'); continue; }
    (x.parts || []).concat(x.pro || []).forEach(pid => { if (!P[pid]) bad(where, 'unknown part ' + pid); });
    if ((x.pro || []).length && !kwById[id].pro_en) bad(where, 'pro parts, but the keyword has no professional term');
    if (x.nosplit != null && x.nosplit !== true) bad(where, 'nosplit is true or absent');
    if (!(x.parts || []).length && !(x.pro || []).length && !x.origin) bad(where, 'neither parts nor an origin');
    if ((x.parts || []).length || (x.pro || []).length || x.origin) { if (!x.src) bad(where, 'no src'); }
    ['lit', 'origin', 'src'].forEach(f => plainText(where, x[f]));
  }
  /* a keyword the site shows (and its professional term) is not a word to meet; an IB keyword, which no topic shows, may be */
  const kwNames = new Set(KEYWORDS.filter(k => unitOfKeyword(k)).flatMap(k => names(k.en).all.concat(k.pro_en ? names(k.pro_en).all : [])));
  const meetSeen = new Set();
  MEET.forEach(m => {
    const where = 'wordparts MEET ' + m.w;
    if (!m.w || !m.means || !m.src) bad(where, 'a word to meet needs w, means and src');
    if (!UNITS[m.unit]) bad(where, 'unit ' + m.unit + ' is not in units.master.js');
    if (!(m.parts || []).length) bad(where, 'no parts');
    (m.parts || []).forEach(pid => { if (!P[pid]) bad(where, 'unknown part ' + pid); });
    if (kwNames.has(String(m.w).toLowerCase())) bad(where, 'is a keyword of the list: it belongs in KW, not in MEET');
    if (meetSeen.has(String(m.w).toLowerCase())) bad(where, 'listed twice');
    meetSeen.add(String(m.w).toLowerCase());
    ['w', 'means', 'src'].forEach(f => plainText(where, m[f]));
  });
  if (problems.length) return null;

  /* how a part is written inside one word: "-cyte" in erythrocyte, "cyto-" in cytoplasm */
  const formsOf = p => p.part.replace(/\([^)]*\)/g, '').split(',').map(s => s.trim()).filter(Boolean);
  const bare = f => f.replace(/[^A-Za-z]/g, '').toLowerCase();
  const shownIn = (p, word) => {
    const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
    return formsOf(p).filter(f => w.includes(bare(f))).sort((a, b) => bare(b).length - bare(a).length)[0] || formsOf(p)[0];
  };
  /* the parts of one word, each as it is written there, found from left to right: in "semilunar valve" the ending is
     -ar (semilun-ar), not the -al that "valve" happens to hold */
  const shownList = (ids, word) => placed(ids, word).map(x => x.f);
  const allSeen = (ids, word) => placed(ids, word).every(x => x.i >= 0);
  const shownOf = (pid, ids, word) => shownList(ids, word)[ids.indexOf(pid)] || shownIn(P[pid], word);
  const gloss = p => p.short || p.means;
  /* a choice shows the meaning without its closing bracket ("green", not "green (in chemical names: chlorine)"): the
     bracket is teaching, shown with the answer, and would mark the right choice out by its length */
  const choice = p => String(p.means).replace(/\s*\([^()]*\)\s*$/, '').trim() || p.means;
  const PROPER = /^(Benedict|Bowman|Krebs|Punnett|Visking|Calvin)/;
  const lc = s => (/^[A-Z][a-z]/.test(s) && !PROPER.test(s)) ? s[0].toLowerCase() + s.slice(1) : s;
  const letters = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
  /* where each part of a word is written, read left to right: [{ f: the form, i: its place in the letters }] (i -1: not there) */
  /* Two parts may share ONE letter where they join (haplo- + -oid = haploid, cardi- + -itis = carditis), never more:
     "progesterone" is not gest- + ster-, it is a blend. */
  const placed = (ids, word) => {
    const w = letters(word);
    let from = 0;
    return ids.map(pid => {
      /* a form that starts after the last part wins over one that shares its letter (tens- + -ion, not tens- + -sion) */
      const clean = formsOf(P[pid]).map(f => ({ f, i: w.indexOf(bare(f), from) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i || bare(b.f).length - bare(a.f).length)[0];
      const shared = formsOf(P[pid]).map(f => ({ f, i: w.indexOf(bare(f), Math.max(0, from - 1)) })).filter(x => x.i >= 0 && x.i === from - 1).sort((a, b) => bare(b.f).length - bare(a.f).length)[0];
      const hit = clean && (!shared || clean.i <= from) ? clean : (shared || clean);
      if (!hit) return { f: shownIn(P[pid], word), i: -1 };
      from = hit.i + bare(hit.f).length;
      return hit;
    });
  };
  /* a keyword's name as its parts are seen in it: "ECG (electrocardiogram)" → electrocardiogram for cardi-;
     "Filtration in the glomerulus (ultrafiltration)" → ultrafiltration for ultra-. The main name wins a tie. */
  const wordOf = (k, ids) => {
    const N = names(k.en), all = [N.main].concat(N.also).map(v => lc(v).replace(/\s*\([^)]*\)/g, ''));      /* "Ethanol (emulsion) test" → ethanol test */
    if (!ids || !ids.length || all.length < 2) return all[0];
    return all.map((v, i) => ({ v, i, n: placed(ids, v).filter(x => x.i >= 0).length })).sort((a, b) => b.n - a.n || a.i - b.i)[0].v;
  };
  /* only the words of a name that hold a part: "partially permeable membrane" → "permeable", "semilunar valve" → "semilunar" */
  const heldWords = (ids, word) => {
    const toks = String(word).split(/[\s\u2013-]+/).filter(Boolean);
    let n = 0;
    const span = toks.map(t => { const a = n; n += letters(t).length; return [a, n]; });
    const at = placed(ids, word).filter(x => x.i >= 0).map(x => x.i);
    const keep = toks.filter((t, j) => at.some(i => i >= span[j][0] && i < span[j][1]));
    return keep.length ? keep.join(' ') : word;
  };
  const covered = (ids, word) => placed(ids, word).reduce((sum, x) => sum + (x.i >= 0 ? bare(x.f).length : 0), 0) / Math.max(1, letters(word).length);
  const proOf = k => lc(names(k.pro_en || '').main);
  const sentence = s => { s = String(s || '').trim(); return !s ? '' : /[.?!]$/.test(s) ? s : s + '.'; };
  /* "Greek hepar, liver" → "From Greek hepar, liver."; an origin that is already a clause ("from glucose", "Cut from…") only gets its capital */
  const fromLine = p => sentence(/^(Greek|Latin|Old|Medieval|Modern|Late|French|German|Sanskrit)\b/.test(p.origin) ? 'From ' + p.origin : p.origin[0].toUpperCase() + p.origin.slice(1));
  const same = (a, b) => { a = String(a).toLowerCase(); b = String(b).toLowerCase(); return a === b || a.includes(b) || b.includes(a); };
  const shuffled = (arr, rnd) => { const a = arr.slice(), out = []; while (a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return out; };

  /* THE VISIBILITY GATE (Daniel, 2 Oct 2026: "are you not just looking for words that have bi?"). A part is listed for a
     word only when the word was built from it or inherited it plainly (the master's rule, checked by people against a
     dictionary). The build can check one half of that by itself: every part must be FOUND in the word's letters, in
     order, each in one of its own forms. A part that is true only deeper in the word's history (bini inside combine),
     or is disguised (ef- for ex-), cannot pass, and stops the build. Passing proves nothing about the etymology:
     that is what `src` is for. */
  for (const [id, x] of Object.entries(KWR)) {
    const k = kwById[id];
    if ((x.parts || []).length) { const w = wordOf(k, x.parts), miss = placed(x.parts, w).map((y, i) => y.i < 0 ? x.parts[i] : '').filter(Boolean); if (miss.length) bad('wordparts KW ' + id, 'part ' + miss.join(', ') + ' cannot be seen in "' + w + '": give the part that form, or take it off this word and say it in the origin'); }
    if ((x.pro || []).length) { const w = proOf(k), miss = placed(x.pro, w).map((y, i) => y.i < 0 ? x.pro[i] : '').filter(Boolean); if (miss.length) bad('wordparts KW ' + id, 'part ' + miss.join(', ') + ' cannot be seen in "' + w + '" (the professional term)'); }
    /* and a word is never "built from" itself: one part that is nearly the whole word says nothing (vein = ven-) */
    if ((x.parts || []).length === 1 && !(x.pro || []).length) { const w = wordOf(k, x.parts); if (!/\s/.test(w) && covered(x.parts, w) >= 0.8) bad('wordparts KW ' + id, 'its one part is the word itself ("' + w + '"): give its origin, not a part'); }
  }
  MEET.forEach(m => { const miss = placed(m.parts, m.w).map((y, i) => y.i < 0 ? m.parts[i] : '').filter(Boolean); if (miss.length) bad('wordparts MEET ' + m.w, 'part ' + miss.join(', ') + ' cannot be seen in the word'); });
  if (problems.length) return null;

  /* which keywords of each topic are built from each part */
  const inUnit = {};
  KEYWORDS.forEach(k => {
    const u = unitOfId[k.id], x = KWR[k.id];
    if (!u || !x) return;
    new Set((x.parts || []).concat(x.pro || [])).forEach(pid => { const U = inUnit[u] = inUnit[u] || {}; (U[pid] = U[pid] || []).push(k.id); });
  });
  const total = {};
  Object.values(inUnit).forEach(U => Object.entries(U).forEach(([pid, l]) => { total[pid] = (total[pid] || 0) + l.length; }));
  const count = (u, pid) => ((inUnit[u] || {})[pid] || []).length;
  /* each part's topics, best first: most keywords, then the topic taught first */
  const ranked = pid => unitOrder.filter(u => count(u, pid)).sort((a, b) => count(b, pid) - count(a, pid) || unitOrder.indexOf(a) - unitOrder.indexOf(b));
  const asked = {};
  unitOrder.forEach(u => { asked[u] = []; });
  /* `plain: true` on a part: its meaning is the word itself (arteri- = artery), so it is listed and never asked.
     The parts with the fewest topics choose first (cardi- has only topic 9; cyt- has six to choose from), and a
     topic asks at most ROOTS_END_MAX endings (-tion, -ic), which every topic has. */
  const at = pid => PARTS.findIndex(p => p.id === pid);
  const isEnd = pid => P[pid].cls === 'ending';
  /* a part is ASKED only when students meet it in two words or more (keywords and words to meet): a part seen in one
     word only is shown under that word, never asked: it would be one more thing to remember */
  const used = pid => (total[pid] || 0) + MEET.filter(m => m.parts.includes(pid)).length;
  const order = PARTS.map(p => p.id).filter(pid => total[pid] && !P[pid].plain && used(pid) >= ROOTS_ASK_MIN_WORDS).sort((a, b) => ranked(a).length - ranked(b).length || total[b] - total[a] || at(a) - at(b));
  const homeless = [];
  order.forEach(pid => {
    const u = ranked(pid).find(x => asked[x].length < ROOTS_PART_MAX && (!isEnd(pid) || asked[x].filter(isEnd).length < ROOTS_END_MAX));
    if (u) asked[u].push(pid); else homeless.push(pid);
  });
  unitOrder.forEach(u => {
    const mine = Object.keys(inUnit[u] || {}).filter(pid => !asked[u].includes(pid) && !P[pid].plain && !isEnd(pid) && used(pid) >= ROOTS_ASK_MIN_WORDS).sort((a, b) => count(u, b) - count(u, a) || total[b] - total[a] || a.localeCompare(b));
    while (asked[u].length < ROOTS_PART_MIN && mine.length) asked[u].push(mine.shift());
    asked[u].sort((a, b) => count(u, b) - count(u, a) || a.localeCompare(b));
  });
  if (homeless.length) warn.push('etymology: ' + homeless.length + ' part(s) are asked in no topic (their topics are full): ' + homeless.join(', '));

  /* wrong meanings for a part: the same class first (organs with organs, colours with colours), then its group */
  const wrongParts = (p, rnd, n, taken) => {
    const out = [], seen = [gloss(p), choice(p)].concat(taken || []);
    const tiers = [PARTS.filter(q => q.cls && q.cls === p.cls), PARTS.filter(q => q.group === p.group), PARTS];
    for (const tier of tiers) for (const q of shuffled(tier, rnd)) {
      if (out.length >= n) break;
      /* ALIKE: parts that mean nearly the same (bi-, di-, diplo-: two, two, double) are never each other's wrong choice */
      if (q.id === p.id || ALIKE.some(g => g.includes(p.id) && g.includes(q.id)) || seen.some(s => same(s, gloss(q)) || same(s, q.means) || same(s, choice(q)))) continue;
      out.push(q); seen.push(gloss(q)); seen.push(q.means); seen.push(choice(q));
    }
    return out;
  };
  const exampleOf = (pid, u) => {            /* a word the student knows that has the part: this topic's first */
    const id = ((inUnit[u] || {})[pid] || [])[0] || (ranked(pid)[0] && inUnit[ranked(pid)[0]][pid][0]);
    if (!id) { const m = MEET.find(x => x.parts.includes(pid)); return m ? m.w : ''; }
    const k = kwById[id], x = KWR[id];
    return (x.parts || []).includes(pid) ? wordOf(k, x.parts) : proOf(k);
  };
  const partsLine = (ids, word) => { const sh = shownList(ids, word); return ids.map((pid, i) => sh[i] + ' (' + gloss(P[pid]) + ')').join(' + '); };
  const meetOf = pid => MEET.filter(m => m.parts.includes(pid));

  const made = {};
  unitOrder.forEach(uid => {
    const list = kwByUnit[uid] || [];
    if (!list.length) return;
    const items = [], rows = [];
    /* 1. a part → what it means */
    asked[uid].forEach(pid => {
      const size = i => { const y = KWR[i]; return ((y.parts || []).includes(pid) ? y.parts : y.pro).length; };
      /* the keyword the question leans on: one the syllabus names, if the topic has one (the question carries its tag), then the shortest */
      const tagged = i => (((SYL_TAGS.keywords || {})[i] || {}).syl || []).length ? 0 : 1;
      const p = P[pid], anchor = inUnit[uid][pid].slice().sort((a, b) => tagged(a) - tagged(b) || size(a) - size(b))[0], k = kwById[anchor], x = KWR[anchor];
      const inOwn = (x.parts || []).includes(pid), word = inOwn ? wordOf(k, x.parts) : proOf(k), shown = shownOf(pid, inOwn ? x.parts : x.pro, word);
      const id = 'kwr.' + anchor + '.' + pid, rnd = seeded(id);
      const wrong = wrongParts(p, rnd, 3);
      if (wrong.length < 3) { bad('etymology ' + pid, 'fewer than three other meanings to choose from'); return; }
      const here = inUnit[uid][pid].map(i => (KWR[i].parts || []).includes(pid) ? wordOf(kwById[i], KWR[i].parts) : proOf(kwById[i]));
      const meet = meetOf(pid).slice(0, 2);
      const near = {};
      wrong.forEach(q => { const ex = exampleOf(q.id, uid); near[choice(q)] = sentence(shownIn(q, ex) + ' means ' + choice(q) + (ex ? ', as in ' + ex : '')); });
      items.push({ id, type: 'kw', input: 'choose', cmd: 'Etymology', task: 'What does this word part mean?',
        prompt: '{k:' + shown + '}, as in ' + word + (inOwn ? '' : ' (' + wordOf(k) + ')'),
        key: choice(p), full: formsOf(p).join(', ') + ' = ' + p.means, ko: p.ko || '',
        def: fromLine(p) + (p.note ? ' ' + sentence(p.note) : '') + ' In this topic: ' + here.slice(0, 5).join(', ') + '.' + (meet.length ? ' You may also meet: ' + meet.map(m => m.w + ' (' + m.means + ')').join('; ') + '.' : ''),
        opts: [choice(p)].concat(wrong.map(choice)), near, rsrc: p.src, src: 'Word parts list · ' + p.src });
      rows.push([formsOf(p).join(', '), p.means, here.slice(0, 3).join(', ')]);
    });
    /* 2. a keyword taken apart */
    const splits = list.map(k => {
      const x = KWR[k.id]; if (!x || x.nosplit) return null;      /* nosplit: its parts leave out the root that carries the meaning */
      const own = (x.parts || []).length >= 2, ids = own ? x.parts : ((x.pro || []).length >= 2 ? x.pro : null);
      if (!ids || ids.length > 4) return null;                 /* five parts in a row make a choice nobody can read */
      const roots = ids.filter(pid => P[pid].cls !== 'ending').length;
      if (roots < 1 || new Set(ids.map(pid => gloss(P[pid]))).size !== ids.length) return null;
      const name = own ? wordOf(k, ids) : proOf(k);
      if (!allSeen(ids, name)) return null;                    /* "DNA" does not show de-, oxy-, nucle-: nothing to take apart */
      const word = heldWords(ids, name), whole = word === name;
      /* the parts must make most of the word ("denaturation" is more than de- + -ation), and a word cut out of a longer
         name must have two parts with a meaning of their own ("renal" out of "renal cortex" is one part and an ending) */
      const meaning = ids.filter(pid => P[pid].cls !== 'ending');
      if (covered(ids, word) < 0.6 || covered(meaning, word) < 0.3 || (!whole && roots < 2)) return null;
      /* a part no topic had room to ask is at least taken apart here */
      return { k, x, ids, own, word, whole, score: ids.filter(pid => homeless.includes(pid)).length * 40 + (whole ? 5 : 0) + roots * 10 + ids.filter(pid => asked[uid].includes(pid)).length * 3 + ids.length };
    }).filter(Boolean);
    const sr = seeded(uid + '.split');
    /* never two words built the same way (digestion, physical digestion, chemical digestion): the first one stands for them */
    const taken = [], chosen = [];
    const core = ids => ids.filter(pid => P[pid].cls !== 'ending').sort().join('+');
    shuffled(splits, sr).sort((a, b) => b.score - a.score).forEach(s => {
      const c = core(s.ids);
      if (chosen.length >= ROOTS_SPLIT_MAX || taken.some(t => t === c || t.split('+').every(q => c.split('+').includes(q)) || c.split('+').every(q => t.split('+').includes(q)))) return;
      taken.push(c); chosen.push(s);
    });
    chosen.forEach(s => {
      const { k, x, ids, own, word, whole } = s, id = 'kwr.' + k.id + '.split', rnd = seeded(id);
      const right = ids.map(pid => gloss(P[pid])).join(' + ');
      const opts = [right], near = {};
      for (let turn = 0; turn < ids.length * 4 && opts.length < 4; turn++) {
        const at = turn % ids.length, q = wrongParts(P[ids[at]], rnd, 1, ids.map(pid => gloss(P[pid])))[0];
        if (!q) continue;
        const o = ids.map((pid, i) => i === at ? gloss(q) : gloss(P[pid])).join(' + ');
        if (opts.includes(o)) continue;
        opts.push(o);
        near[o] = sentence(shownList(ids, word)[at] + ' means ' + gloss(P[ids[at]]) + '. ' + formsOf(q)[0] + ' means ' + gloss(q));
      }
      if (opts.length < 4) return;
      items.push({ id, type: 'kw', input: 'choose', cmd: 'Etymology', task: 'This word is built from ' + ids.length + ' parts. What do the parts mean, in order?',
        prompt: '{k:' + word + '} = ' + shownList(ids, word).join(' + '),
        key: right, full: word + ' = ' + partsLine(ids, word), ko: k.ko || '',
        def: ((x.lit && whole ? 'Read part by part: ' + sentence(x.lit) : '') + (own ? '' : ' ' + sentence(word[0].toUpperCase() + word.slice(1) + ' = ' + wordOf(k) + ' (the professional name)')) + (x.origin ? ' ' + sentence(x.origin) : '')).trim()
          || sentence('In this topic: ' + wordOf(k, ids)),
        opts, near, rsrc: x.src, src: 'Word parts list · ' + x.src });
    });
    /* 3. a word never taught, worked out from its parts */
    const mine = MEET.filter(m => m.unit === uid);
    const mr = seeded(uid + '.meet');
    shuffled(mine, mr).sort((a, b) => b.parts.filter(pid => asked[uid].includes(pid)).length - a.parts.filter(pid => asked[uid].includes(pid)).length)
      .slice(0, ROOTS_MEET_MAX).forEach(m => {
        const hasTag = k => (((SYL_TAGS.keywords || {})[k.id] || {}).syl || []).length > 0;
        const akin = k => KWR[k.id] && (KWR[k.id].parts || []).concat(KWR[k.id].pro || []).some(pid => m.parts.includes(pid));
        const anchorK = list.find(k => akin(k) && hasTag(k)) || list.find(akin) || list.find(k => KWR[k.id] && hasTag(k)) || list.find(hasTag) || list[0];
        const id = 'kwr.' + anchorK.id + '.w.' + String(m.w).toLowerCase().replace(/[^a-z0-9]+/g, '-'), rnd = seeded(id);
        const shared = o => o.parts.filter(pid => m.parts.includes(pid) && P[pid].cls !== 'ending').length;
        const pool = shuffled(MEET.filter(o => o !== m && !same(o.means, m.means)), rnd)
          .sort((a, b) => shared(b) - shared(a) || (b.unit === uid ? 1 : 0) - (a.unit === uid ? 1 : 0));
        const wrong = [];
        pool.forEach(o => { if (wrong.length < 3 && !wrong.some(w => same(w.means, o.means))) wrong.push(o); });
        if (wrong.length < 3) { warn.push('etymology: ' + m.w + ' has too few other words to choose from'); return; }
        const near = {};
        wrong.forEach(o => { near[o.means] = sentence('That is ' + o.w + ': ' + partsLine(o.parts, o.w)); });
        items.push({ id, type: 'kw', input: 'choose', cmd: 'Etymology', task: 'You have not been taught this word. Use its parts to choose what it means.',
          prompt: '{k:' + m.w + '}', key: m.means, full: m.w + ' = ' + partsLine(m.parts, m.w),
          def: sentence(m.means[0].toUpperCase() + m.means.slice(1)) + ' This word is not in your keyword list. You may meet it when you read.',
          opts: [m.means].concat(wrong.map(o => o.means)), near, rsrc: m.src, src: 'Word parts list · ' + m.src });
      });
    if (items.length < ROOTS_SET_MIN) { warn.push('etymology: ' + uid + ' has only ' + items.length + ' question(s), so it gets no set'); return; }
    const sid = uid + '.kw.roots';
    const learn = { id: 'kwr.learn.' + uid, type: 'learn', title: 'Etymology: the parts of this topic’s words',
      body: ['Etymology is the study of where words come from. Many biology words are built from Greek and Latin parts. Learn a part once, and you can often work out words you have never been taught.',
        ...(rows.length ? [{ table: { head: ['Word part', 'It means', 'You have met it in'], rows } }] : []),
        'Every part of this topic, with where it comes from, is on the topic’s keyword page.'] };
    SETS[sid] = { id: sid, unit: uid, kind: 'kw', auto: true, roots: true, title: 'Keywords: etymology',
      blurb: 'The Greek and Latin parts this topic’s words are built from, and new words to work out from them', items: [learn].concat(items) };
    made[uid] = sid;
  });

  /* what the pages draw */
  const R = { groups: GROUPS, parts: {}, units: {}, kw: {}, meet: {}, set: made };
  PARTS.forEach(p => {
    const us = ranked(p.id), ex = [];
    if (!us.length && !meetOf(p.id).length) return;      /* only practical-skills or IB keywords have it: nothing to show yet */
    us.forEach(u => inUnit[u][p.id].forEach(i => { const w = (KWR[i].parts || []).includes(p.id) ? wordOf(kwById[i], KWR[i].parts) : proOf(kwById[i]); if (ex.length < 4 && !ex.includes(w)) ex.push(w); }));
    R.parts[p.id] = { p: formsOf(p).join(', '), m: p.means, ...(p.short ? { sh: p.short } : {}), g: GROUPS.indexOf(p.group), o: fromLine(p), s: p.src, ...(p.ko ? { ko: p.ko } : {}), ...(p.note ? { n: p.note } : {}),
      u: us, x: ex, w: meetOf(p.id).slice(0, 3).map(m => [m.w, m.means]) };
  });
  unitOrder.forEach(u => { const ids = Object.keys(inUnit[u] || {}).sort((a, b) => count(u, b) - count(u, a) || a.localeCompare(b)); if (ids.length) R.units[u] = ids; });
  Object.entries(KWR).forEach(([id, x]) => {
    if (!unitOfId[id]) return;
    const k = kwById[id], o = {};
    if ((x.parts || []).length) { const sh = shownList(x.parts, wordOf(k, x.parts)); o.p = x.parts.map((pid, i) => [sh[i], pid]); }
    if ((x.pro || []).length) { const sh = shownList(x.pro, proOf(k)); o.pn = names(k.pro_en).main; o.pp = x.pro.map((pid, i) => [sh[i], pid]); }
    if (x.lit) o.l = x.lit;
    if (x.origin) o.o = x.origin;
    R.kw[id] = o;
  });
  MEET.forEach(m => { (R.meet[m.unit] = R.meet[m.unit] || []).push([m.w, m.parts, m.means]); });
  /* the dictionaries the list was checked in, most used first: the #/roots page names them */
  const dict = {};
  PARTS.concat(Object.values(KWR), MEET).forEach(x => String(x.src || '').split(';').forEach(s => { const d = s.split(':')[0].trim(); if (d) dict[d] = (dict[d] || 0) + 1; }));
  R.dicts = Object.keys(dict).sort((a, b) => dict[b] - dict[a]).slice(0, 4);
  R.count = { parts: Object.keys(R.parts).length, kw: Object.keys(R.kw).length, meet: MEET.length };
  return R;
}
const ROOTS = RT ? buildRoots() : null;

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
  /* A describe or explain question is about DATA (a graph or a table) or about THEORY, and the card
     says which: a student who only ever saw the data kind would think that is what the word means.
     `mode:` on the item overrides; otherwise a figure, or a stem that names one, means data. */
  const DATA_STEM = /\b(graph|table|figure|fig\.|curve|line [A-Z]\b|axis|axes|plot|the data|the results|percentage change|from the information)\b/i;
  const modeOf = it => it.mode || ((it.figure || DATA_STEM.test(String(it.q || '') + ' ' + String(it.task || ''))) ? 'data' : 'theory');
  const items = s.items.map(it => {
    let x = (it.type === 'kw' && !it.ko && koFor(it.key)) ? { ...it, ko: koFor(it.key) } : it;
    if ((s.kind === 'describe' || s.kind === 'explain' || s.kind === 'method') && it.type !== 'learn' && /^(Describe|Explain)/i.test(String(it.cmd || ''))) x = { ...x, mode: modeOf(it) };
    return { ...x, h: fnv(canon(x)) };
  });
  const modes = { data: 0, theory: 0 };
  items.forEach(it => { if (it.mode) modes[it.mode]++; });
  items.forEach(it => {
    if (it.type === 'kw' && !String(it.id).startsWith('kwr.')) { known.add(it.key); (it.accept || []).forEach(a => known.add(a)); (it.opts || []).forEach(a => known.add(a)); }
    if (it.type === 'gap' || it.type === 'exam') ((it.text || '') + (it.frames || []).join(' ')).replace(/\{\{([^}]+)\}\}/g, (_, a) => { a.split('|').forEach(x => known.add(x.trim())); return ''; });
  });
  const keys = items.filter(it => it.type !== 'learn').map(it => it.id + '@' + it.h);
  /* each scored question's syllabus statements, in the same order as `keys` (see SYL below) */
  SYL[s.id] = items.filter(it => it.type !== 'learn').map(it => sylOf(it.id, it.h));
  totalQ += keys.length;
  meta.sets[s.id] = { id: s.id, unit: s.unit || null, kind: s.kind, title: s.title, blurb: s.blurb || '', keys, v: fnv(keys.join('|')), modes };
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
    .map(k => ({ id: k.id, t: k.en, d: k.en_def, ko: k.ko || '', s: k.subtopic || '', sup: !!k.sup }));
}
/* the word parts, for the keyword pages and the #/roots page (see buildRoots above) */
if (ROOTS) meta.roots = ROOTS;
/* The keywords the 2026–28 syllabus does not name (Daniel, 28 Sep 2026: check them against the older syllabuses and say
   which one each belongs to). From a side file, ../bio-english-lab-source/past-keywords.json, into meta — which no
   question's fingerprint covers, so nothing resets: `old` names a statement of labs-shared/syllabus-past.json,
   `beyond` is outside the syllabus, `word` is an idea the syllabus has under other words. Drawn on the Keywords page
   and under an answered keyword card, never on a question before it is answered. */
/* which syllabus versions exist, and which share content (2029 = 2026–2028): each year's page turns the year group
   into the year of its IGCSE exams and so its syllabus, from the same files as the labs' IGCSE 0610 badge */
meta.sylYears = [];
if (shared) {
  try { meta.sylYears = Object.keys(JSON.parse(fs.readFileSync(path.join(shared, 'syllabus.json'), 'utf8'))).map(id => ({ id })); } catch (e) {}
  try {
    for (const [id, x] of Object.entries(JSON.parse(fs.readFileSync(path.join(shared, 'syllabus-versions.json'), 'utf8'))))
      if (!id.startsWith('_') && x.same) meta.sylYears.push({ id, same: x.same });
  } catch (e) {}
}
meta.past = { st: {}, id: {} };
{
  const f = path.join(SRC, 'past-keywords.json');
  const PS = shared ? JSON.parse(fs.readFileSync(path.join(shared, 'syllabus-past.json'), 'utf8')).statements : {};
  const shippedIds = new Set(Object.values(kwByUnit).flat().map(k => k.id));
  if (fs.existsSync(f)) for (const [id, x] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')).keywords || {})) {
    if (!shippedIds.has(id)) { warn.push(`past-keywords.json: ${id} is not a keyword on the site`); continue; }
    if (x.old) {
      const st = PS[x.old];
      if (!st) { bad('past-keywords.json', `${id}: no statement ${x.old} in labs-shared/syllabus-past.json`); continue; }
      meta.past.st[x.old] = { until: st.until, tier: st.tier || '', text: st.text, note: st.note || '' };
      meta.past.id[id] = { old: x.old };
    } else if (x.beyond) meta.past.id[id] = { beyond: true };
    else if (x.word) meta.past.id[id] = { word: String(x.word) };
  }
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

/* ---------- syllabus tags (27 Sep 2026) ----------
   ../bio-english-lab-source/syllabus-tags.json says which IGCSE 0610 (2026–2028) statements each question
   assesses: authored items by id, the "Keywords: meanings" questions (kwm.<keyword>) by keyword id. They go
   into the PUBLIC set list only (data/sets.json, as one short string per set: "9.1.2|9.2.1,9.3.3|…" — a question's
   statements joined by commas, questions in the set's order joined by |, kept short because the labs script
   caches this file only while it is under 95 KB), never into the questions: an item's fingerprint `h` covers every field it has, so a
   new field there would reset every student's saved answer. The reflection system's My assessments reads
   them to show practice statement by statement. tools/syllabus-tags.mjs (estate root) writes and checks them. */
/* ---------- the public list of sets, for the Apps Script ---------- */
const manifest = {
  site: 'bio-english-lab', built: new Date().toISOString(),
  years: YEARS.map(Y => ({ y: Y.y, title: Y.title, units: Y.units })),
  units: Object.fromEntries(Object.entries(meta.units).map(([k, u]) => [k, { n: u.n, title: u.title, year: u.year, sets: u.sets }])),
  sets: Object.values(meta.sets).map(s => ({ id: s.id, unit: s.unit, kind: s.kind, title: s.title, total: s.keys.length, v: s.v, syl: (SYL[s.id] || []).map(x => x.join(',')).join('|') }))
};

/* ---------- report ---------- */
const byKind = {};
Object.values(meta.sets).forEach(s => { byKind[s.kind] = (byKind[s.kind] || 0) + s.keys.length; });
console.log(`✓ ${Object.keys(SETS).length} sets, ${totalQ} questions (${Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(', ')}), ${KEYWORDS.length} keywords${ROOTS ? `, ${ROOTS.count.parts} word parts in ${Object.keys(ROOTS.set).length} etymology sets` : ''}`);
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
