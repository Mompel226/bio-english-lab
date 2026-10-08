#!/usr/bin/env node
/* ============================================================
   tools/keep-records.mjs — a question reworded WITHOUT changing what it asks keeps its answers.

   WHY (Daniel, 7 Oct 2026): pupils found that the right answer of a "Which answer scores?" question was nearly always
   the longest, and the wrong answers were rewritten. Any change to a question's words changes its fingerprint (`h`,
   made by tools/build.mjs from everything in it), and a changed fingerprint restarts that question on every pupil's
   browser (answers are kept as id@h) and changes its set's `v`, so a set kept in the spreadsheet no longer comes back
   on another computer, and the spreadsheet starts the set's record again. Daniel's rule: fixing the questions must not
   touch the work pupils have already done.

   HOW: the question carries `keep: { h, now, on, why }` in its master. `h` is the fingerprint its answers were saved
   under; `now` is the fingerprint of the wording it was declared for. tools/build.mjs publishes `h` while the question
   still reads exactly as `now` says. Reword it again and the build refuses until the keep is written again (or taken
   out, and the question restarts for everyone). To reword a kept question again: take its keep out of the master,
   reword it, and run this tool again with the masters from before: the new keep carries the FIRST fingerprint on.

   This tool writes `keep` only after checking that the question still asks the same thing: the same type, the same
   question, task, marks and every other field, the same number of options, each still right or wrong as before. Only the
   options' words (and their `why`) may differ, the other right orders the marking accepts (`orders` on a build or order
   question, `anyOrder` list groups on a gap question), and the words of the model answer, line by line, with the same
   number of lines and the same marks on each (8 Oct 2026, Daniel: "cause and effect words in model answers": the model
   is shown after the question and marks nothing). Anything else changed is reported and left to restart.

   usage (from bio-english-lab/), after editing the masters:
     node tools/keep-records.mjs --was-masters <folder with topics/ and methods.master.js from before the edit>
                                 [--was-built <js/data/content.js from before the edit>] [--why "<one line>"] [--write]
   --was-built defaults to this repository's last commit (git show HEAD:js/data/content.js). The new fingerprints come
   from a staging build (tools/build.mjs --out, which writes nothing else). Without --write it only reports. With --write
   it writes the keeps, builds a second staging copy and proves that every kept question has its old fingerprint again;
   then build for real (node tools/build.mjs).

   --korean (8 Oct 2026, the translation audit): a card whose ONLY change since the published version is its Korean term
   (`ko`, shown beside the keyword after the answer, marking nothing) keeps its fingerprint through an entry in
   ../bio-english-lab-source/korean-keeps.json, which tools/build.mjs applies; the generated cards (meanings, etymology)
   have no master entry to hold a keep. It compares every BUILT card of the published content.js (--was-built, or the
   last commit) with a staging build: equal but for `ko` → an entry; anything else changed is listed and left alone.
     node tools/keep-records.mjs --korean [--was-built <content.js>] [--write]
   Correcting a kept card's Korean again: take its entry out of korean-keeps.json and run this again.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(REPO, '..', 'bio-english-lab-source');
const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const WAS = opt('--was-masters'), WRITE = args.includes('--write'), KOREAN = args.includes('--korean');
const WHY = opt('--why') || 'the options reworded without changing what the question asks';
const ON = new Date().toISOString().slice(0, 10);
if (!WAS && !KOREAN) { console.error('usage: node tools/keep-records.mjs --was-masters <old folder> [--was-built <old content.js>] [--why "…"] [--write]\n   or: node tools/keep-records.mjs --korean [--was-built <old content.js>] [--write]'); process.exit(2); }

/* ---------- --korean: the cards whose only change is the Korean term ---------- */
if (KOREAN) {
  const decode = text => {
    const w = {}; vm.runInNewContext(text, { window: w });
    const AL = w.AL, items = {};
    for (const sid of Object.keys(AL.sets)) {
      const bin = Buffer.from(AL.sets[sid], 'base64').toString('latin1'); let o = '';
      for (let i = 0; i < bin.length; i++) o += String.fromCharCode(bin.charCodeAt(i) ^ AL.k.charCodeAt(i % AL.k.length));
      for (const it of JSON.parse(decodeURIComponent(escape(o))).items) items[it.id] = it;
    }
    return { items, v: Object.fromEntries(Object.values(AL.meta.sets).map(x => [x.id, x.v])) };
  };
  const stage = () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-korean-'));
    execFileSync('node', [path.join(REPO, 'tools/build.mjs'), '--out', tmp], { stdio: ['ignore', 'ignore', 'inherit'] });
    return decode(fs.readFileSync(path.join(tmp, 'content.js'), 'utf8'));
  };
  const was = decode(opt('--was-built') ? fs.readFileSync(opt('--was-built'), 'utf8')
    : execFileSync('git', ['-C', REPO, 'show', 'HEAD:js/data/content.js'], { encoding: 'utf8', maxBuffer: 256 << 20 }));
  const now = stage(), strip = ({ h, ko, ...r }) => r, kept = [], beyond = [];
  for (const id of Object.keys(now.items)) {
    const a = was.items[id], b = now.items[id];
    if (!a || a.h === b.h) continue;
    if (JSON.stringify(strip(a)) === JSON.stringify(strip(b))) kept.push({ id, h: a.h, now: b.h, was: a.ko || '', ko: b.ko || '' });
    else beyond.push(id);
  }
  console.log(`${kept.length} card(s) changed only in their Korean term: they keep their answers` + (WRITE ? '' : ' (dry run: --write writes the entries)'));
  kept.forEach(k => console.log('  keep  ' + k.id.padEnd(34) + ' ' + k.was + ' → ' + k.ko));
  if (beyond.length) console.log(`${beyond.length} card(s) changed in more than the Korean term since the published version (left alone): ` + beyond.slice(0, 12).join(', ') + (beyond.length > 12 ? ' …' : ''));
  if (!WRITE || !kept.length) process.exit(0);
  const FILE = path.join(SRC, 'korean-keeps.json'), cur = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const why = opt('--why') || 'the Korean term corrected (the translation audit); the card asks the same';
  kept.forEach(k => { cur[k.id] = { h: k.h, now: k.now, on: ON, why }; });
  fs.writeFileSync(FILE, JSON.stringify(cur, null, 1) + '\n');
  const after = stage();
  let wrong = 0;
  kept.forEach(k => { if (after.items[k.id].h !== k.h) { wrong++; console.error(`✗ ${k.id}: built as ${after.items[k.id].h}, not ${k.h}`); } });
  const moved = Object.keys(was.v).filter(x => after.v[x] !== was.v[x]);
  console.log(`staging build: ${kept.length - wrong} of ${kept.length} kept cards have their published fingerprint; ${moved.length} set(s) with a new v` +
    (moved.length ? ' (' + moved.join(', ') + ')' : '') + '. Now build for real: node tools/build.mjs');
  process.exit(wrong ? 1 : 0);
}

/* the fingerprints a built content.js gives each question: id → h */
const fingerprints = text => {
  const w = {}; vm.runInNewContext(text, { window: w });
  const out = {};
  Object.values(w.AL.meta.sets).forEach(s => s.keys.forEach(k => { const i = k.lastIndexOf('@'); out[k.slice(0, i)] = k.slice(i + 1); }));
  return { h: out, v: Object.fromEntries(Object.values(w.AL.meta.sets).map(s => [s.id, s.v])) };
};
const oldBuilt = fingerprints(opt('--was-built') ? fs.readFileSync(opt('--was-built'), 'utf8')
  : execFileSync('git', ['-C', REPO, 'show', 'HEAD:js/data/content.js'], { encoding: 'utf8', maxBuffer: 256 << 20 }));
const staging = () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-english-'));
  execFileSync('node', [path.join(REPO, 'tools/build.mjs'), '--out', tmp], { stdio: ['ignore', 'ignore', 'inherit'] });
  return fingerprints(fs.readFileSync(path.join(tmp, 'content.js'), 'utf8'));
};
const newBuilt = staging();

/* every authored question, id → { item, file } */
const files = dir => fs.readdirSync(path.join(dir, 'topics')).filter(x => x.endsWith('.master.js')).map(f => 'topics/' + f).concat(['methods.master.js']);
async function items(dir) {
  const out = {};
  for (const f of files(dir)) {
    const sets = (await import(pathToFileURL(path.join(dir, f)).href + '?' + Date.now() + Math.random())).SETS || [];
    for (const s of sets) for (const it of s.items || []) out[it.id] = { item: it, file: f };
  }
  return out;
}
const oldItems = await items(path.resolve(WAS)), newItems = await items(SRC);

/* the same question, in other words: only the options' t and why may differ, and the other right orders a build or an
   order question accepts (`orders`), or the list groups of a gap question (`anyOrder`): marking that accepts more right
   answers changes nothing a pupil has done */
function sameQuestion(a, b) {
  if (!a || !b) return 'not in both versions';
  const strip = x => { const { options, keep, orders, anyOrder, model, ...rest } = x; return rest; };
  if (JSON.stringify(strip(a)) !== JSON.stringify(strip(b))) return 'something besides the options’ words, the other right orders or the model answer’s words changed';
  const ma = a.model || [], mb = b.model || [], mk = ln => (typeof ln === 'string' ? 1 : (ln.m == null ? 1 : ln.m));
  if (ma.length !== mb.length) return 'the model answer has a different number of lines';
  for (let j = 0; j < ma.length; j++) if (mk(ma[j]) !== mk(mb[j])) return 'model line ' + (j + 1) + ' carries different marks';
  if (!a.options && !b.options) return '';
  if (!Array.isArray(a.options) || !Array.isArray(b.options)) return 'options came or went';
  if (a.options.length !== b.options.length) return 'the number of options changed';
  for (let j = 0; j < a.options.length; j++) {
    const { t: t1, why: w1, ...o1 } = a.options[j], { t: t2, why: w2, ...o2 } = b.options[j];
    if (!!o1.ok !== !!o2.ok || JSON.stringify(o1) !== JSON.stringify(o2)) return 'option ' + (j + 1) + ' is right or wrong where it was not';
  }
  return '';
}

const keep = [], refuse = [];
for (const id of Object.keys(newBuilt.h)) {
  if (!(id in oldBuilt.h) || oldBuilt.h[id] === newBuilt.h[id]) continue;
  const why = sameQuestion(oldItems[id] && oldItems[id].item, newItems[id] && newItems[id].item);
  if (why) refuse.push(id + ': ' + why); else keep.push({ id, file: newItems[id].file, h: oldBuilt.h[id], now: newBuilt.h[id] });
}
console.log(`${keep.length} question(s) reworded within the rules: they keep their answers` + (WRITE ? '' : ' (dry run: --write writes the keeps)'));
keep.forEach(k => console.log('  keep  ' + k.id.padEnd(16) + ' ' + k.now + ' → ' + k.h));
if (refuse.length) { console.log(`${refuse.length} question(s) changed beyond the options' words: they restart for every pupil`); refuse.forEach(r => console.log('  ✗ ' + r)); }
if (!WRITE || !keep.length) process.exit(refuse.length ? 1 : 0);

/* write each keep just after its question's id */
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const byFile = {};
keep.forEach(k => (byFile[k.file] = byFile[k.file] || []).push(k));
for (const [f, list] of Object.entries(byFile)) {
  const p = path.join(SRC, f);
  let text = fs.readFileSync(p, 'utf8');
  for (const k of list) {
    const re = new RegExp("\\bid:\\s*(['\"])" + k.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\1\\s*,", 'g');
    const hits = [...text.matchAll(re)];
    if (hits.length !== 1) { console.error(`✗ ${k.id}: its id is found ${hits.length} times in ${f}; nothing written for it`); process.exitCode = 1; continue; }
    const at = hits[0].index + hits[0][0].length;
    text = text.slice(0, at) + ` keep: { h: '${esc(k.h)}', now: '${esc(k.now)}', on: '${ON}', why: '${esc(WHY)}' },` + text.slice(at);
  }
  fs.writeFileSync(p, text);
}

/* the proof: a staging build gives every kept question its old fingerprint, and every set whose questions all kept
   theirs its old v */
const staged = staging();
let wrong = 0;
keep.forEach(k => { if (staged.h[k.id] !== k.h) { wrong++; console.error(`✗ ${k.id}: built as ${staged.h[k.id]}, not ${k.h}`); } });
const moved = Object.keys(oldBuilt.v).filter(s => staged.v[s] !== oldBuilt.v[s]);
console.log(`staging build: ${keep.length - wrong} of ${keep.length} kept questions have their old fingerprint; ${moved.length} set(s) with a new v` +
  (moved.length ? ' (' + moved.join(', ') + ')' : '') + '. Now build for real: node tools/build.mjs');
process.exit(wrong || refuse.length ? 1 : 0);
