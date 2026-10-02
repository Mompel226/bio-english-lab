#!/usr/bin/env node
/* ============================================================
   tools/guide-gs.mjs — the command-word guide, for the reflection system's student dashboard.

   The guide has ONE master: ../bio-english-lab-source/guide.master.json. This site's "Command
   words" page is built from it (tools/build.mjs). This tool makes the dashboard's copy, and it
   writes STRAIGHT INTO THE REAL REFLECTION FOLDER, by absolute path:
     …/IGCSE/AppScript/AppScript REFLECTION System/Code/
   (../bio-english-lab-source/out/reflection/ only on a machine that has no such folder). There is no
   dry run: run from a copy of this repository, it still writes the real folder.

     node tools/guide-gs.mjs --guide-only
         THE SAFE WAY, and the one to use: writes Code/6_QuestionGuide.gs alone (the guide as data,
         plus qsGuideLegacy_(), which turns it into the dashboard's own card shapes). The dashboard,
         Code/4_StudentDashboardHTML.gs, is not touched. Then raise REFLECTION_BUILD in Code/Code.gs.

     node tools/guide-gs.mjs <an UNPATCHED 4_StudentDashboardHTML.gs> --full-i-know-it-drops-hand-edits
         FULL mode, refused without that flag. It also REBUILDS Code/4_StudentDashboardHTML.gs: the
         copy you name (an old one from OneDrive history — the live file carries the marker
         "BIO ENGLISH LAB EDITS APPLIED" and is refused) plus the 13 edits below, and nothing else.
         Every hand edit made to 4_ since then is DROPPED, silently: the §40.87 escapes (the plan
         JSON's "</" and the coaching's "<"), the "Which syllabus" block (28 Sep 2026), the §40.92
         edits in _loadBatchedCoaching, and §40.94's rule that a card with no real example shows no
         "Real example". Carry each of them into the edit list below before you ever use it.

   The 13 edits (full mode only). Each must find its original text exactly once, or the tool stops
   and writes no dashboard, so a dashboard that has moved on is never patched blind:
      1 ?tab=commands (any tab id) opens the dashboard on that tab
      2 each card links to "Practise it" on Bio English Lab
      3 the command-word maps (CMD_DESCRIPTIONS, CMD_TO_PATTERN) come from 6_QuestionGuide.gs
      4 the pattern cards and the mistakes come from 6_QuestionGuide.gs (unchanged without it)
      5 and 6 the two card counts follow the data (command words, skills)
      7 the hero sentence
      8, 9 and 10 the decoder's signals 1, 3 and 4
     11, 12 and 13 the worked example's signals 3 and 4, and its tip
   and then the worked example's model answer, when its old text is there.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..', 'bio-english-lab-source');
/* The reflection system's own folder: ONE copy of each file, in Daniel's synced project folder
   "Code" (one folder since 28 Sep 2026: the numbered .gs files at its top), never a second in this
   source tree. */
const REFLECT = [
  '/Users/NLCS/Library/CloudStorage/OneDrive-Personal/NLCS/IGCSE/AppScript/AppScript REFLECTION System/Code'
].filter(d => fs.existsSync(d));
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
    '  AppScript REFLECTION System/Paste/: 6_QuestionGuide.gs, and 4_StudentDashboardHTML.gs if this run wrote it.');
});
function writeReflection(name, text) {
  if (REFLECT.length) wroteReflection = true;
  OUT.forEach(d => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), text); console.log('✓ written: ' + path.join(d, name)); });
}
const G = JSON.parse(fs.readFileSync(path.join(SRC, 'guide.master.json'), 'utf8'));
const ARGS = process.argv.slice(2);
/* --guide-only: the guide's text changed but the dashboard's 13 edits are already in place — write
   6_QuestionGuide.gs alone and leave the dashboard untouched */
const guideOnly = ARGS.includes('--guide-only');
const FULL = '--full-i-know-it-drops-hand-edits';
const dashPath = ARGS.filter(a => !a.startsWith('--'))[0];
if (!guideOnly && !dashPath) {
  console.error('usage: node tools/guide-gs.mjs --guide-only     (the safe way: 6_QuestionGuide.gs alone)\n' +
    '   or: node tools/guide-gs.mjs <an UNPATCHED 4_StudentDashboardHTML.gs> ' + FULL);
  process.exit(1);
}
/* Full mode rebuilds the live dashboard from an old copy, so it would silently undo every hand edit made
   to 4_ since (found on 30 Sep 2026: nothing had been lost yet, only because nobody had run it). It stops
   before writing anything unless it is asked for by name. */
if (!guideOnly && !ARGS.includes(FULL)) {
  console.error([
    '✗ Full mode is switched off, and nothing was written.',
    '  It REBUILDS AppScript REFLECTION System/Code/4_StudentDashboardHTML.gs from the copy you name, with',
    '  only this tool\'s own 13 edits, so every hand edit made to that file since is DROPPED:',
    '    · the §40.87 escapes (the plan JSON\'s "</" and the coaching\'s "<"),',
    '    · the "Which syllabus" block (28 Sep 2026),',
    '    · the §40.92 edits in _loadBatchedCoaching,',
    '    · §40.94: a card with no real example shows no "Real example" section.',
    '  The safe path:  node tools/guide-gs.mjs --guide-only   (writes 6_QuestionGuide.gs alone;',
    '  the dashboard is untouched). Only once every edit above is in this tool\'s edit list:',
    '  add ' + FULL + '.'
  ].join('\n'));
  process.exit(1);
}
const dash = guideOnly ? '' : fs.readFileSync(dashPath, 'utf8');
if (!guideOnly && /BIO ENGLISH LAB EDITS APPLIED/.test(dash)) {
  console.error('That dashboard already carries these edits — it is the patched file, not the original.\n' +
    'Point this at an unpatched 4_StudentDashboardHTML.gs, or take the previous version from OneDrive history.');
  process.exit(1);
}

/* ---------- 6_QuestionGuide.gs ---------- */
function exampleOf(x) {
  if (!x) return null;
  return Object.assign({ source: x.source, stem: x.stem, marks: x.marks, markScheme: x.markScheme || [], guidance: x.guidance || [], model: x.model || '' },
    x.figureNote ? { figureNote: x.figureNote } : {}, x.why ? { why: x.why } : {});
}
const data = {
  commands: G.commands.map(c => ({ word: c.word, official: c.official || '', plain: c.plain || '', pattern: c.pattern, status: c.status || '' })),
  patterns: G.patterns.map(p => Object.assign({ id: p.id, group: p.group, order: p.order, freq: p.freq, title: p.title, strategy: p.strategy || '', signature: p.signature || '',
    steps: p.steps || [], pitfalls: p.pitfalls || [], note: p.cambridgeNote || '', commands: p.commands || [],
    example: exampleOf(p.example) },
    /* the guide's other examples: the dashboard shows one of them when only it has its figure */
    (p.moreExamples || []).length ? { examples: p.moreExamples.map(exampleOf) } : {},
    /* parts of the dashboard's old card the guide says are wrong now (dropFromDashboard: part → why) */
    p.dropFromDashboard ? { drop: Object.keys(p.dropFromDashboard) } : {})),
  mistakes: G.mistakes.map(m => ({ id: m.id, title: m.title, body: m.body, source: m.source }))
};
/* Daniel's copyright block, the same one every file in his reflection project carries */
const COPYRIGHT_GS = ['// ============================================================',
  '//  IGCSE Biology Assessment Reflection System — Question Guide (generated)',
  '//  Copyright (c) 2025-2026 Daniel Mompel Riera',
  '//  All rights reserved. This code is proprietary and confidential.',
  '//  Unauthorised copying, distribution, or modification is prohibited.',
  '// ============================================================', '', ''].join('\n');
const gs = COPYRIGHT_GS + `/**
 * 6_QuestionGuide.gs — the command-word guide ("How to answer" tab), as data.
 * ─────────────────────────────────────────────────────────────────
 * GENERATED by Bio English Lab (labs/bio-english-lab/tools/guide-gs.mjs) from its master,
 * guide.master.json, on ${new Date().toISOString().slice(0, 10)}. Bio English Lab's "Command words" page is built from
 * the same master, so the two always give students the same advice. Edit the master, not this file.
 *
 * 4_StudentDashboardHTML.gs uses this file when it is present (qsGuideLegacy_ below turns the
 * guide into the dashboard's own card shapes). Remove this file and the dashboard falls back to
 * the cards written inside 4_StudentDashboardHTML.gs.
 *
 * Every example is a real Cambridge 0610 question; its mark-scheme lines are as printed. A card whose
 * guide entry has no real example shows none.
 * ─────────────────────────────────────────────────────────────────
 */
var QS_GUIDE = ${JSON.stringify(data, null, 1)};

/* The dashboard's shapes, built from QS_GUIDE. \`old\` is the dashboard's own data: each card keeps its
   emoji and star rating, its diagram, year tip and tip unless the guide drops them, and its figure and
   grey note only while its example is unchanged. */
function qsGuideLegacy_(old) {
  old = old || {};
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function key(cite) {                         /* "0610/41 May/June 2024 Q5(a)" and "…0610/41, May/June 2024, Question 5(a)" are one question */
    var s = String(cite || ''), m = s.match(/0610\\/(\\d\\d)/), y = s.match(/(20\\d\\d)/), q = s.match(/(?:Q|Question)\\s*([0-9]+[a-z()ivx]*)/i);
    var ses = /march|feb/i.test(s) ? 'm' : /june|may/i.test(s) ? 's' : /nov|oct/i.test(s) ? 'w' : '';
    return m && y && q ? m[1] + ses + y[1] + q[1].replace(/\\s/g, '') : s;
  }
  var oldCards = {};
  (old.QS_PATTERNS || []).concat(old.QS_SKILLS || []).forEach(function (c) { oldCards[c.num] = c; });
  var EMOJI = { 22: '🔮', 23: '✏️', 24: '🕸️' };
  /* The same guide, and the practice for it, are one click apart: each card links to that command
     word on Bio English Lab, which is built from this very master. */
  var SITE = 'https://nlcsbiology.com/bio-english-lab/#/commands';
  var firstWord = {};
  (QS_GUIDE.commands || []).forEach(function (c) { if (c.pattern && !firstWord[c.pattern]) firstWord[c.pattern] = c.word; });
  var FIG = /\\b(?:Fig\\.|Table)\\s*\\d+\\.\\d+/g;
  function figsIn(s) {                         /* "Fig. 1.2", "Table 3.1": each once, in order */
    var seen = {}, out = [];
    (String(s || '').match(FIG) || []).forEach(function (f) { f = f.replace(/\\s+/g, ' '); if (!seen[f]) { seen[f] = 1; out.push(f); } });
    return out;
  }
  function plain(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }   /* the renderer escapes it */
  function card(p) {
    var o = oldCards[p.id] || {}, ex = p.example, drop = p.drop || [];
    /* The dashboard has pictures only of its own old examples' figures. When the guide's example cites a
       figure the dashboard does not have, and the guide keeps that old, figured example as another one,
       the card shows that one, with its figure. */
    if (ex && o.ex && o.ex.figRef && key(o.ex.cite) !== key(ex.source) && figsIn(ex.stem).length)
      (p.examples || []).forEach(function (x) { if (key(x.source) === key(o.ex.cite)) ex = x; });
    var same = ex && o.ex && key(o.ex.cite) === key(ex.source);
    var figRef = same && o.ex.figRef ? o.ex.figRef : '';
    var ms = '', said = '';
    if (ex) {
      var lines = ex.markScheme.slice(), prefix = '';
      if (lines.length && /^(any \\w+ from|total of|max \\w+ from)/i.test(lines[0])) prefix = lines.shift().replace(/:?\\s*$/, ': ');
      ms = prefix + lines.map(function (l) { return esc(String(l).replace(/\\s*;\\s*$/, '')); }).join(' <b>;</b> ') +
           (ex.guidance.length ? ' <b>;</b> <i>Guidance: ' + ex.guidance.map(esc).join(' · ') + '</i>' : '');
      /* a figure or table the card cannot show is said to be in the paper, never cited as if it were here */
      var figs = figRef ? [] : figsIn(ex.stem);
      if (figs.length) said = '<span style="display:block;margin-bottom:6px;font-size:11px;font-style:italic;color:#8b949e">' +
        esc((ex.figureNote ? ex.figureNote + ' ' : '') + figs.join(' and ') + (figs.length > 1 ? ' are' : ' is') + ' in the question paper, not shown here.') + '</span>';
    }
    var out = {
      num: p.id, freq: p.freq || o.freq || 1, em: o.em || EMOJI[p.id] || '📌',
      name: p.title, tag: p.strategy, sig: p.signature,
      app: p.steps.map(esc), watch: p.pitfalls.map(esc), note: p.note,
      /* no real example in the guide: the card shows none (the dashboard's own MCQ item was invented) */
      ex: ex ? { cite: ex.source, stem: said + esc(ex.stem) + (ex.marks ? ' <b>[' + ex.marks + ']</b>' : ''), ms: ms, exemplar: esc(ex.model) }
             : { cite: '', stem: '', ms: '' },
      /* the grey line under the example: the guide's own reason for this example, or else the dashboard's
         old line, but only while the example is the one that line was written about */
      also: ex && ex.why ? ex.why : (same && drop.indexOf('also') < 0 ? plain(o.also) : ''),
      practise: SITE + (firstWord[p.id] ? '/' + encodeURIComponent(String(firstWord[p.id]).toLowerCase()) : '')
    };
    if (figRef) out.ex.figRef = figRef;
    if (o.diagram && drop.indexOf('diagram') < 0) out.diagram = o.diagram;
    if (o.yearTip && drop.indexOf('yearTip') < 0) out.yearTip = o.yearTip;
    if (o.seeAlso && drop.indexOf('seeAlso') < 0) out.seeAlso = o.seeAlso;
    return out;
  }
  function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }
  var cmdDesc = {}, cmdLink = {};
  QS_GUIDE.commands.forEach(function (c) { if (c.plain) cmdDesc[c.word] = c.plain; if (c.pattern) cmdLink[c.word] = c.pattern; });
  return {
    CMD_DESCRIPTIONS: cmdDesc,
    CMD_TO_PATTERN: cmdLink,
    QS_PATTERNS: QS_GUIDE.patterns.filter(function (p) { return p.group === 'command'; }).sort(byOrder).map(card),
    QS_SKILLS: QS_GUIDE.patterns.filter(function (p) { return p.group === 'skill'; }).sort(byOrder).map(card),
    QS_MISTAKES: QS_GUIDE.mistakes.map(function (m, i) {
      var was = (old.QS_MISTAKES || [])[i] || {};
      return { em: was.em || '⚠️', title: m.title, body: esc(m.body) + '<br><span style="font-size:11px;color:#6e7681">' + esc(m.source) + '</span>' };
    })
  };
}
`;
writeReflection('6_QuestionGuide.gs', gs);
if (guideOnly) { console.log('guide only — the dashboard is untouched'); process.exit(0); }

/* Applying the edits twice is impossible by construction — each `from` is gone after the first
   pass — but the error would be cryptic. The written file carries a marker, and finding it here
   means somebody pointed this tool at an already-patched dashboard. */
const MARK = 'BIO ENGLISH LAB EDITS APPLIED';

/* ---------- the exact edits to a copy of the dashboard ---------- */
const edits = [];
function edit(name, from, to) { edits.push({ name, from, to }); }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const js = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

edit('?tab=commands opens the dashboard on that tab',
  "    `})();` +\n\n    `</script></body></html>`;",
  `    \`})();\` +\n\n    /* ?tab=commands (or any tab id) opens the dashboard on that tab: Bio English Lab links a student\n       straight to the command words that cost them marks. Waits for the tab to exist, then switches. */\n    \`(function(){if(!(window.google&&google.script&&google.script.url))return;\` +\n    \`google.script.url.getLocation(function(l){var t=l&&l.parameter&&l.parameter.tab;if(!t)return;var n=0;\` +\n    \`(function go(){if(document.getElementById("tab-"+t)&&typeof showTab==="function"){showTab(t)}else if(n++<50){setTimeout(go,200)}})()})})();\` +\n\n    \`</script></body></html>\`;`);

edit('each card links to its practice on Bio English Lab',
  `            '<div class="pc-section"><h6>Cambridge note</h6><p>' + escH(p.note) + '</p></div>' +`,
  `            '<div class="pc-section"><h6>Cambridge note</h6><p>' + escH(p.note) + '</p></div>' +
            /* one guide, one place to practise it: the site is built from the same master */
            (p.practise ? '<div class="pc-section"><h6>Practise it</h6><p><a href="' + escH(p.practise) +
              '" target="_blank" rel="noopener">Practise this command word on Bio English Lab</a></p></div>' : '') +`);

edit('use the guide for the command-word maps',
  `  // ── Command word performance (sorted by weakness score — most marks lost first) ──`,
  `  /* ONE guide for this dashboard and Bio English Lab (6_QuestionGuide.gs, generated from the same
     master as the site's Command words page). Without that file, the maps above are used. */
  if (typeof qsGuideLegacy_ === 'function') {
    try { var _QG1 = qsGuideLegacy_({}); CMD_DESCRIPTIONS = _QG1.CMD_DESCRIPTIONS; CMD_TO_PATTERN = _QG1.CMD_TO_PATTERN; }
    catch (e_qg1) { Logger.log('question guide (commands) not applied: ' + e_qg1); }
  }

  // ── Command word performance (sorted by weakness score — most marks lost first) ──`);
edit('use the guide for the pattern cards and mistakes',
  `  var FIGURE_IMAGES = {`,
  `  /* ONE guide for this dashboard and Bio English Lab (6_QuestionGuide.gs). The cards above stay as the
     fallback, and lend each new card its emoji, stars, diagram and year tip (and its figure, when the
     example is unchanged). */
  if (typeof qsGuideLegacy_ === 'function') {
    try {
      var _QG2 = qsGuideLegacy_({ QS_PATTERNS: QS_PATTERNS, QS_SKILLS: QS_SKILLS, QS_MISTAKES: QS_MISTAKES });
      QS_PATTERNS = _QG2.QS_PATTERNS; QS_SKILLS = _QG2.QS_SKILLS; QS_MISTAKES = _QG2.QS_MISTAKES;
    } catch (e_qg2) { Logger.log('question guide (cards) not applied: ' + e_qg2); }
  }

  var FIGURE_IMAGES = {`);
edit('card count follows the data (command words)', `12 Question Patterns (Command Words)</div>'`, `' + QS_PATTERNS.length + ' Question Patterns (Command Words)</div>'`);
edit('card count follows the data (skills)', `9 Skills Questions (Drawings, Graphs, Tables, Genetics, MCQ…)</div>'`, `' + QS_SKILLS.length + ' Skills Questions (Drawings, Graphs, Tables, Genetics, MCQ…)</div>'`);
edit('hero claim', `'Every example below is sourced from a real Cambridge 0610 Paper 4 from May/June or Oct/Nov 2022\\u20132025.</p>'`,
  `'Every example is a real Cambridge 0610 question (Paper 4 or Paper 6) with its real mark scheme. The same guide is on Bio English Lab.</p>'`);
const D = Object.fromEntries(G.decoder.map(d => [d.n, d]));
edit('decoder 1', `'<p>Tells you what to do. <em>State</em>, <em>describe</em> and <em>explain</em> all need different kinds of answer.</p>' +
        '<div class="qs-cue">Look for: usually the first verb (action word) in the question.</div></div>'`,
  `'<p>${js(esc(D[1].what))}</p>' +
        '<div class="qs-cue">Look for: ${js(esc(D[1].cue))}</div></div>'`);
edit('decoder 3', `'<p>Whether your answer must use numbers or labels from the question (e.g. from a graph, table, or diagram).</p>' +
        '<div class="qs-cue">Look for: \\u201cusing the information in Fig.\\u201d / \\u201cfrom Fig. 5.1\\u201d.</div></div>'`,
  `'<p>${js(esc(D[3].what))}</p>' +
        '<div class="qs-cue">Look for: ${js(esc(D[3].cue))}</div></div>'`);
edit('decoder 4', `'<p>Special rules in the question: e.g. \\u201cin your own words\\u201d, \\u201cother than X\\u201d, \\u201cnot including Y\\u201d.</p>' +
        '<div class="qs-cue">Look for: italic words, or phrases like \\u201cother than\\u201d.</div></div>'`,
  `'<p>${js(esc(D[4].what))}</p>' +
        '<div class="qs-cue">Look for: ${js(esc(D[4].cue))}</div></div>'`);
const W = G.decoderWorkedExample, WS = Object.fromEntries(W.signals.map(s => [s.n, s.text]));
edit('worked example, signal 3', `<div>\\u201cshown in Fig. 5.1\\u201d means your answer must be about THIS graph, not general theory. The mark scheme for THIS question does not require you to write specific numbers, but adding numbers makes a stronger answer.</div>`,
  `<div>${js(esc(WS[3]))}</div>`);
edit('worked example, signal 4', `<div>The question says \\u201cthe results\\u201d (plural \\u2014 more than one) AND mentions BOTH \\u201cupper and lower surfaces\\u201d. So you must describe BOTH lines on the graph, not just one of them.</div>`,
  `<div>${js(esc(WS[4]))}</div>`);
edit('worked example, tip', `'<div class="qs-worked-tip"><b>Tip.</b> If the question says <em>\\u201cUsing the information in Fig./Table\\u201d</em>, you MUST quote numbers from the graph or table. Answers without numbers will lose marks.</div>'`,
  `'<div class="qs-worked-tip"><b>Tip.</b> ${js(esc(W.tip))}</div>'`);

let patched = dash, report = [];
for (const e of edits) {
  const n = patched.split(e.from).length - 1;
  if (n !== 1) { console.error('✗ "' + e.name + '": the original text was found ' + n + ' times (need exactly 1). Nothing written.'); process.exit(1); }
  patched = patched.replace(e.from, () => e.to);
  report.push('✓ ' + e.name);
}
/* the worked example's own model answer (it had "increases … becomes constant", not the scheme's words) */
const mOld = patched.match(/<div class="pc-exemplar" style="margin-top:12px"><div class="pc-exemplar-head">\\u2705 Model answer \(full marks\)<\/div><div class="pc-exemplar-body">[^']*<\/div><\/div>/);
if (mOld) { patched = patched.replace(mOld[0], () => `<div class="pc-exemplar" style="margin-top:12px"><div class="pc-exemplar-head">\\u2705 Model answer (full marks)</div><div class="pc-exemplar-body">${js(esc(W.model))}</div></div>`); report.push('✓ worked example, model answer'); }
writeReflection('4_StudentDashboardHTML.gs',
  '/* ' + MARK + ' — ' + new Date().toISOString().slice(0, 10) + ': the command-word guide comes from 6_QuestionGuide.gs.\n   Regenerate from an UNPATCHED dashboard only (labs/bio-english-lab/tools/guide-gs.mjs). */\n' + patched);
console.log(report.join('\n'));
