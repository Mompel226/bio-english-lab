#!/usr/bin/env node
/* ============================================================
   tools/guide-gs.mjs — what each command word asks, for the reflection system's My assessments.

   The command-word guide has ONE master: ../bio-english-lab-source/guide.master.json. This site's "Command words"
   page is built from it (tools/build.mjs). This tool writes the one line per command word that My assessments shows
   beside each command word that cost a pupil marks, as AppScript REFLECTION System/Code/6_QuestionGuide.gs
   (var QS_COMMAND_WORDS), found from this file's own place so it is the same folder on both Macs
   (../bio-english-lab-source/out/reflection/ only where the estate has no reflection folder). There is no dry run.

     node tools/guide-gs.mjs
         writes 6_QuestionGuide.gs, remakes the lean Paste/ copy, and says what Daniel pastes. Then raise
         REFLECTION_BUILD in Code/Code.gs (and run lean_paste.cjs once more).

   Until 11 Oct 2026 (reflection §40.146) the file also carried the whole guide in the old My assessments page's card
   shapes (qsGuideLegacy_), and a FULL mode rebuilt that page, 4_StudentDashboardHTML.gs, from an old copy. The old
   page went to the Archive; its file holds the new page, which links each command word to its card here
   (#/commands/<word>). Full mode is gone, and asking for it says so.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..', 'bio-english-lab-source');
/* The reflection system's own folder, found from here: labs/bio-english-lab/tools → IGCSE/AppScript/…/Code (one folder
   since 28 Sep 2026; the same OneDrive path on both Macs, under each Mac's own home folder). */
const REFLECT = [path.resolve(HERE, '..', '..', '..', '..', 'AppScript', 'AppScript REFLECTION System', 'Code')]
  .filter(d => fs.existsSync(path.join(d, 'Code.gs')));
const OUT = REFLECT.length ? REFLECT : [path.join(SRC, 'out', 'reflection')];
/* Daniel PASTES the reflection from its Paste/ folder, a lean copy MADE from Code/ (reflection spec §40.108, 2 Oct 2026:
   Apps Script loads every byte of every .gs at the start of every call). A file written into Code/ therefore needs
   that copy made again. This does it when the tool ends, and says what he pastes. */
let wroteReflection = false;
process.on('exit', (code) => {
  if (code !== 0 || !wroteReflection || !REFLECT.length || process.env.NO_LEAN_PASTE) return;
  const tool = path.join(REFLECT[0], '..', '..', 'Test System harness', 'lean_paste.cjs');
  if (!fs.existsSync(tool)) { console.log('! Daniel pastes the reflection from its Paste/ folder: run lean_paste.cjs (IGCSE/AppScript/Test System harness) to remake it.'); return; }
  const r = spawnSync(process.execPath, [tool], { encoding: 'utf8' });
  const last = String((r.stdout || '') + (r.stderr || '')).trim().split('\n').pop();
  if (r.status !== 0) { console.log('✗ Paste/ was NOT remade — ' + last + '\n  Daniel must not paste the reflection until `node lean_paste.cjs` runs clean.'); return; }
  console.log('✓ Paste/ remade from Code/ (' + last.replace(/^written to .*\(/, '').replace(/\)$/, '') + ').\n' +
    '  Next: raise REFLECTION_BUILD in Code/Code.gs, run lean_paste.cjs once more, then Daniel pastes FROM\n' +
    '  AppScript REFLECTION System/Paste/: 6_QuestionGuide.gs.');
});
function writeReflection(name, text) {
  if (REFLECT.length) wroteReflection = true;
  OUT.forEach(d => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), text); console.log('✓ written: ' + path.join(d, name)); });
}
const G = JSON.parse(fs.readFileSync(path.join(SRC, 'guide.master.json'), 'utf8'));
const ARGS = process.argv.slice(2).filter(a => a !== '--guide-only');   // the old flag for this, still accepted
if (ARGS.length) {
  console.error('✗ Nothing was written. This tool takes no arguments: it writes 6_QuestionGuide.gs alone.\n' +
    '  Full mode, which rebuilt the old My assessments page (4_StudentDashboardHTML.gs) from an old copy, is gone:\n' +
    '  that page went to the Archive on 11 Oct 2026 (reflection §40.146), and its file holds the new page.');
  process.exit(1);
}

/* ---------- 6_QuestionGuide.gs: one line per command word ---------- */
const words = {};
G.commands.forEach(c => { if (c.word && c.plain) words[c.word] = c.plain; });
/* Daniel's copyright block, the same one every file in his reflection project carries */
const COPYRIGHT_GS = ['// ============================================================',
  '//  IGCSE Biology Assessment Reflection System — Question Guide (generated)',
  '//  Copyright (c) 2025-2026 Daniel Mompel Riera',
  '//  All rights reserved. This code is proprietary and confidential.',
  '//  Unauthorised copying, distribution, or modification is prohibited.',
  '// ============================================================', '', ''].join('\n');
const gs = COPYRIGHT_GS + `/**
 * 6_QuestionGuide.gs — what each command word asks, for My assessments.
 * ─────────────────────────────────────────────────────────────────
 * GENERATED by Bio English Lab (labs/bio-english-lab/tools/guide-gs.mjs) from its master,
 * guide.master.json, on ${new Date().toISOString().slice(0, 10)}. Edit the master, not this file.
 *
 * My assessments (4_StudentDashboardHTML.gs) shows each command word that cost a pupil marks with its line from here,
 * and links it to that word on Bio English Lab's "Command words" page, built from the same master: the whole guide
 * (the method for each word, real examples with their mark schemes, the examiners' mistakes) is there.
 * ─────────────────────────────────────────────────────────────────
 */
var QS_COMMAND_WORDS = ${JSON.stringify(words, null, 1)};
`;
writeReflection('6_QuestionGuide.gs', gs);
console.log(Object.keys(words).length + ' command words');
