#!/usr/bin/env node
/* Checks the reflection-system files made by tools/guide-gs.mjs:
   both compile; the guide turns into the dashboard's shapes; every command word links to a card
   that exists; the dashboard's own card renderer draws every card without falling back; and no card
   says something the guide does not (30 Sep 2026: an invented MCQ shown as a "Real example", old
   notes about a figure the card no longer shows, a figure cited that is not there).
   Read-only: it reads the reflection folder, and writes nothing. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
/* the generator writes into Daniel's reflection folder "Code"; read the same place (out/reflection is the fallback) */
const REFLECT = ['/Users/NLCS/Library/CloudStorage/OneDrive-Personal/NLCS/IGCSE/AppScript/AppScript REFLECTION System/Code']
  .filter(d => fs.existsSync(path.join(d, '6_QuestionGuide.gs')));
const OUT = REFLECT[0] || path.resolve(HERE, '..', '..', 'bio-english-lab-source', 'out', 'reflection');
const ORIG = process.argv[2];   /* optional: the patched dashboard keeps the original cards and renderer */
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const guide = fs.readFileSync(path.join(OUT, '6_QuestionGuide.gs'), 'utf8');
const patched = fs.readFileSync(path.join(OUT, '4_StudentDashboardHTML.gs'), 'utf8');
const orig = ORIG ? fs.readFileSync(ORIG, 'utf8') : patched;
try { new Function(guide); ok(true, '6_QuestionGuide.gs compiles'); } catch (e) { ok(false, '6_QuestionGuide.gs: ' + e.message); }
try { new Function(patched); ok(true, 'the patched 4_StudentDashboardHTML.gs compiles'); } catch (e) { ok(false, 'patched dashboard: ' + e.message); }
function block(src, start) {
  const i = src.indexOf(start); if (i < 0) throw new Error('not found: ' + start);
  const j = src.indexOf('\n  ];', i); return src.slice(i, j + 5);
}
function fn(src, name) {
  const i = src.indexOf('function ' + name + '('); let depth = 0, k = src.indexOf('{', i);
  for (let p = k; p < src.length; p++) { if (src[p] === '{') depth++; else if (src[p] === '}') { depth--; if (!depth) return src.slice(i, p + 1); } }
}
const ctx = vm.createContext({ Logger: { log: m => { throw new Error(String(m)); } }, console });
vm.runInContext(guide, ctx);
const old = vm.runInContext('(function(){ ' + block(orig, 'var QS_PATTERNS = [') + block(orig, 'var QS_MISTAKES = [') + block(orig, 'var QS_SKILLS = [') +
  ' return { QS_PATTERNS: QS_PATTERNS, QS_SKILLS: QS_SKILLS, QS_MISTAKES: QS_MISTAKES }; })()', ctx);
ok(old.QS_PATTERNS.length === 12 && old.QS_SKILLS.length === 9, 'the dashboard’s own cards read: 12 + 9');
const G = ctx.qsGuideLegacy_(old);
ok(G.QS_PATTERNS.length >= 12 && G.QS_SKILLS.length >= 9, 'from the guide: ' + G.QS_PATTERNS.length + ' command cards + ' + G.QS_SKILLS.length + ' skills cards');
const nums = new Set(G.QS_PATTERNS.concat(G.QS_SKILLS).map(c => c.num));
const broken = Object.entries(G.CMD_TO_PATTERN).filter(([w, n]) => !nums.has(n));
ok(!broken.length, 'every command word links to a card that exists' + (broken.length ? ': ' + JSON.stringify(broken) : ''));
ok(G.CMD_TO_PATTERN.Discuss === 8 && G.QS_PATTERNS.find(c => c.num === 8).name.includes('Discuss'), 'Discuss links to a card that says Discuss');
ok(G.CMD_TO_PATTERN.Predict === 22 && G.QS_PATTERNS.some(c => c.num === 22 && /Predict/.test(c.name)), 'Predict has its own card');
ok(!!G.CMD_DESCRIPTIONS.Give && G.CMD_TO_PATTERN.Give === 1, 'Give (an official command word) is there');
ok(G.QS_PATTERNS.concat(G.QS_SKILLS).every(c => c.name && c.tag && c.sig && c.app && c.watch && c.ex), 'every card has every field the renderer reads');
/* what a card says must be the guide's, or the old card's while it is about the same example */
const cards = G.QS_PATTERNS.concat(G.QS_SKILLS), QG = ctx.QS_GUIDE;
const guideBy = Object.fromEntries(QG.patterns.map(p => [p.id, p]));
const oldBy = Object.fromEntries(old.QS_PATTERNS.concat(old.QS_SKILLS).map(c => [c.num, c]));
const exsOf = p => [p.example].concat(p.examples || []).filter(Boolean);
function qkey(cite) {                           /* one question, however its source is written (as the template's key()) */
  const s = String(cite || ''), m = s.match(/0610\/(\d\d)/), y = s.match(/(20\d\d)/), q = s.match(/(?:Q|Question)\s*([0-9]+[a-z()ivx]*)/i);
  const ses = /march|feb/i.test(s) ? 'm' : /june|may/i.test(s) ? 's' : /nov|oct/i.test(s) ? 'w' : '';
  return m && y && q ? m[1] + ses + y[1] + q[1].replace(/\s/g, '') : s;
}
const notGuide = cards.filter(c => c.ex.cite && !exsOf(guideBy[c.num]).some(x => x.source === c.ex.cite)).map(c => c.num);
ok(!notGuide.length, 'every example shown is one the guide gives' + (notGuide.length ? ': not so on ' + notGuide.join(', ') : ''));
const noEx = cards.filter(c => !guideBy[c.num].example);
ok(noEx.every(c => !c.ex.cite && !c.ex.stem && !c.ex.ms), 'a card the guide gives no real example shows none (' + noEx.map(c => c.num).join(', ') + ')');
const FIG = /\b(?:Fig\.|Table)\s*\d+\.\d+/;
const unseen = cards.filter(c => FIG.test(String(c.ex.stem).replace(/<[^>]*>/g, '')) && !c.ex.figRef && !/in the question paper, not shown here/.test(c.ex.stem)).map(c => c.num);
ok(!unseen.length, 'every card that cites a figure or table shows it, or says it is not shown' + (unseen.length ? ': not so on ' + unseen.join(', ') : ''));
const staleNote = cards.filter(c => {
  if (!c.also) return false;
  const shown = exsOf(guideBy[c.num]).find(x => x.source === c.ex.cite);
  if (shown && shown.why) return c.also !== shown.why;
  const o = oldBy[c.num];
  return !(o && o.ex && qkey(o.ex.cite) === qkey(c.ex.cite));
}).map(c => c.num);
ok(!staleNote.length, 'no card keeps the old dashboard\u2019s note once its example has changed' + (staleNote.length ? ': ' + staleNote.join(', ') : ''));
const dropped = QG.patterns.filter(p => p.drop).filter(p => { const c = cards.find(x => x.num === p.id); return p.drop.some(k => c && c[k]); }).map(p => p.id);
ok(!dropped.length, 'what the guide drops from an old card is gone (' + QG.patterns.filter(p => p.drop).map(p => p.id + ': ' + p.drop.join('/')).join('; ') + ')' + (dropped.length ? ' — still on ' + dropped.join(', ') : ''));
/* draw them with the dashboard's own renderer */
const render = vm.createContext({ Logger: { log: m => { throw new Error('renderer fell back: ' + m); } }, FIGURE_IMAGES: {}, _figMime_: () => 'image/png',
  escH: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), QS_MISTAKES: G.QS_MISTAKES });
vm.runInContext(fn(orig, 'formatMs_') + '\n' + fn(orig, 'buildPatternCardsHtml_') + '\n' + fn(orig, 'buildCommonMistakesHtml_'), render);
const html = render.buildPatternCardsHtml_(G.QS_PATTERNS) + render.buildPatternCardsHtml_(G.QS_SKILLS);
ok(!/unavailable/.test(html) && (html.match(/class="pattern-card"/g) || []).length === G.QS_PATTERNS.length + G.QS_SKILLS.length, 'the dashboard’s renderer draws all ' + (G.QS_PATTERNS.length + G.QS_SKILLS.length) + ' cards');
ok(/ms-list/.test(html), 'mark schemes are drawn as the dashboard’s numbered list');
const exSections = (html.match(/<h6>Real example<\/h6>/g) || []).length, withEx = cards.filter(c => c.ex.stem).length;
ok(exSections === withEx, 'a "Real example" section on every card with an example, and on no other (' + exSections + ' of ' + cards.length + ' cards)');
const mh = render.buildCommonMistakesHtml_();
ok(!/unavailable/.test(mh) && (mh.match(/cm-card/g) || []).length === G.QS_MISTAKES.length, 'the mistakes card draws all ' + G.QS_MISTAKES.length);
ok(!/<script/i.test(html + mh), 'nothing from the guide can inject a script');
ok(patched.includes("' + QS_PATTERNS.length + ' Question Patterns"), 'the card titles count the cards instead of saying 12 and 9');
console.log(fail ? '✗ ' + fail + ' failed' : '✓ all checks passed');
process.exit(fail ? 1 : 0);
