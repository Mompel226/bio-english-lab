#!/usr/bin/env node
/* ============================================================
   tools/keywords.mjs — the ONE keyword list, and the reflection system's copy of it.

   The keyword list lives in ../bio-english-lab-source/keywords.master.js. Two things are made from it:
     • Bio English Lab's "Keywords: meanings" sets (tools/build.mjs reads the master directly), and
     • 5_IgcseBiologyKeywords.gs — the flashcards in the reflection system's student dashboard and the
       tracker's "IGCSE Keywords" tab. Same ids, same schema as the file it replaces.
   So a definition corrected once is corrected in both places.

     node tools/keywords.mjs import <path to 5_IgcseBiologyKeywords.gs>   make the master from the .gs (once)
     node tools/keywords.mjs gs                                            write ../bio-english-lab-source/out/5_IgcseBiologyKeywords.gs
     node tools/keywords.mjs check <path to a pasted .gs>                  is that copy the same as the master?
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..', 'bio-english-lab-source');
const MASTER = path.join(SRC, 'keywords.master.js');
/* The reflection system's own folders. Daniel keeps ONE copy of each of these files, in his two
   synced project folders — never a third in this repository's source tree, which is what these
   tools used to write. Both folders are written, because they are meant to be identical. */
const REFLECT = [
  '/Users/NLCS/Library/CloudStorage/OneDrive-Personal/NLCS/IGCSE/AppScript/AppScript REFLECTION System/Claude code',
  '/Users/NLCS/Library/CloudStorage/OneDrive-Personal/NLCS/IGCSE/AppScript/AppScript REFLECTION System/Final code'
].filter(d => fs.existsSync(d));
/* not on this machine? fall back to a working copy, so the tool still runs */
const FALLBACK = path.join(SRC, 'out', 'reflection');
function writeReflection(name, text) {
  const dirs = REFLECT.length ? REFLECT : [FALLBACK];
  dirs.forEach(d => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), text); console.log('✓ ' + path.join(d, name)); });
}

const FIELDS = ['id', 'en', 'en_def', 'ko', 'ko_def', 'zh', 'zh_def', 'topic', 'subtopic', 'year', 'strict', 'sup', 'confidence', 'ko_check', 'tags', 'pro_en', 'pro_ko', 'pro_zh'];

function readGs(file) {
  const src = fs.readFileSync(file, 'utf8');
  const got = new Function(src + '; return { K: IGCSE_BIOLOGY_KEYWORDS, T: IGCSE_TOPICS };')();
  const header = src.slice(0, src.indexOf('var IGCSE_TOPICS'));
  return { K: got.K, T: got.T, header };
}
function ordered(k) {
  const o = {};
  FIELDS.forEach(f => { if (k[f] !== undefined) o[f] = k[f]; });
  Object.keys(k).forEach(f => { if (!(f in o)) o[f] = k[f]; });
  return o;
}
function jsLit(v) { return JSON.stringify(v, null, 0); }

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'import') {
  const { K, T, header } = readGs(arg);
  fs.mkdirSync(path.dirname(MASTER), { recursive: true });
  const body = '/* ============================================================\n' +
    '   keywords.master.js — THE keyword list. NEVER published; tools/build.mjs and tools/keywords.mjs read it.\n' +
    '   Imported from 5_IgcseBiologyKeywords.gs on ' + new Date().toISOString().slice(0, 10) + '. Edit HERE, then\n' +
    '   `node tools/keywords.mjs gs` writes the reflection system’s copy. Ids never change.\n' +
    '   ============================================================ */\n' +
    'export const GS_HEADER = ' + JSON.stringify(header) + ';\n' +
    'export const TOPICS = ' + JSON.stringify(T, null, 1) + ';\n' +
    'export const KEYWORDS = [\n' + K.map(k => '  ' + jsLit(ordered(k))).join(',\n') + '\n];\n';
  fs.writeFileSync(MASTER, body);
  console.log('✓ master written: ' + K.length + ' keywords → ' + MASTER);
} else if (cmd === 'gs' || cmd === 'check') {
  const m = await import(pathToFileURL(MASTER).href + '?t=' + Date.now());
  const today = new Date().toISOString().slice(0, 10);
  const note = ' *\n * GENERATED from Bio English Lab’s keyword master (bio-english-lab-source/keywords.master.js) by\n' +
    ' * tools/keywords.mjs on ' + today + '. The same list builds Bio English Lab’s keyword questions, so a\n' +
    ' * definition corrected there is corrected here. Edit the master, not this file.\n';
  let header = m.GS_HEADER;
  header = header.replace(/ \* ─{10,}\s*\*\/\s*$/, note + ' * ─────────────────────────────────────────────────────────────────\n */\n');
/* Daniel's copyright block, the same one every file in his reflection project carries */
  const COPYRIGHT_GS = ['// ============================================================',
    '//  IGCSE Biology Assessment Reflection System — IGCSE Biology Keywords (generated)',
    '//  Copyright (c) 2025-2026 Daniel Mompel Riera',
    '//  All rights reserved. This code is proprietary and confidential.',
    '//  Unauthorised copying, distribution, or modification is prohibited.',
    '// ============================================================', '', ''].join('\n');
  const text = COPYRIGHT_GS + header + '\nvar IGCSE_TOPICS = ' + JSON.stringify(m.TOPICS, null, 2).replace(/"(\w+)":/g, '$1:') + ';\n\n' +
    'var IGCSE_BIOLOGY_KEYWORDS = [\n' + m.KEYWORDS.map(k => '  ' + jsLit(ordered(k)).replace(/"(\w+)":/g, '$1:')).join(',\n\n') + '\n];\n';
  /* the copy must load exactly as the old one did */
  const back = new Function(text + '; return { K: IGCSE_BIOLOGY_KEYWORDS, T: IGCSE_TOPICS };')();
  if (back.K.length !== m.KEYWORDS.length) { console.error('the generated file does not load back'); process.exit(1); }
  if (cmd === 'gs') {
        writeReflection('5_IgcseBiologyKeywords.gs', text);
      } else {
    const other = readGs(arg);
    const a = JSON.stringify(other.K.map(ordered)), b = JSON.stringify(m.KEYWORDS.map(ordered));
    if (a === b) { console.log('✓ in step: ' + arg); process.exit(0); }
    const byId = Object.fromEntries(other.K.map(k => [k.id, k]));
    let diff = 0;
    m.KEYWORDS.forEach(k => { if (JSON.stringify(ordered(k)) !== JSON.stringify(byId[k.id] ? ordered(byId[k.id]) : null)) diff++; });
    console.log('✗ ' + diff + ' keyword(s) differ from the master: run `node tools/keywords.mjs gs`, then paste 5_IgcseBiologyKeywords.gs');
    process.exit(1);
  }
} else if (cmd === 'patch') {
  /* apply review files: { changes:[{id, field, old, new}], additions:[entry], deletions_proposed:[{id, reason}] }.
     A change is applied only if the field still holds `old` — so a review cannot overwrite a later edit.
     A proposed deletion is NOT deleted: it is marked review:'delete?' (Daniel decides), and the site leaves it out. */
  const m = await import(pathToFileURL(MASTER).href + '?t=' + Date.now());
  const K = m.KEYWORDS.map(k => ({ ...k }));
  const byId = Object.fromEntries(K.map(k => [k.id, k]));
  let applied = 0, stale = [], added = 0, marked = 0;
  for (const file of process.argv.slice(3)) {
    const r = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const c of r.changes || []) {
      const k = byId[c.id];
      if (!k) { stale.push(c.id + ' (no such keyword)'); continue; }
      const cur = k[c.field];
      const same = JSON.stringify(cur === undefined ? null : cur) === JSON.stringify(c.old === undefined ? null : c.old);
      if (!same) { stale.push(c.id + '.' + c.field); continue; }
      if (c.new === null || c.new === undefined) delete k[c.field]; else k[c.field] = c.new;
      applied++;
    }
    for (const a of r.additions || []) {
      if (byId[a.id]) { stale.push(a.id + ' (added twice)'); continue; }
      const e = { ...a }; K.push(e); byId[e.id] = e; added++;
    }
    for (const d of r.deletions_proposed || []) {
      const k = byId[d.id]; if (!k) continue;
      k.review = 'delete?'; k.review_reason = d.reason; marked++;
    }
  }
  const body = fs.readFileSync(MASTER, 'utf8');
  const head = body.slice(0, body.indexOf('export const KEYWORDS'));
  fs.writeFileSync(MASTER, head + 'export const KEYWORDS = [\n' + K.map(k => '  ' + jsLit(ordered(k))).join(',\n') + '\n];\n');
  console.log('✓ ' + applied + ' changes applied, ' + added + ' keywords added, ' + marked + ' marked for Daniel to decide (review: delete?)');
  if (stale.length) console.log('  not applied (the field had changed since the review): ' + stale.length + '\n   ' + stale.slice(0, 30).join('\n   '));
} else {
  console.log('usage: node tools/keywords.mjs import <gs> | gs | check <gs> | patch <review.json>…');
}
