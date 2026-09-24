#!/usr/bin/env node
/* Checks the reflection-system files made by tools/guide-gs.mjs:
   both compile; the guide turns into the dashboard's shapes; every command word links to a card
   that exists; the dashboard's own card renderer draws every card without falling back. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
/* the generator writes into Daniel's two reflection folders; read the same place (out/reflection is the fallback) */
const REFLECT = ['/Users/NLCS/Library/CloudStorage/OneDrive-Personal/NLCS/IGCSE/AppScript/AppScript REFLECTION System/Claude code',
  '/Users/NLCS/Library/CloudStorage/OneDrive-Personal/NLCS/IGCSE/AppScript/AppScript REFLECTION System/Final code']
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
/* draw them with the dashboard's own renderer */
const render = vm.createContext({ Logger: { log: m => { throw new Error('renderer fell back: ' + m); } }, FIGURE_IMAGES: {}, _figMime_: () => 'image/png',
  escH: s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), QS_MISTAKES: G.QS_MISTAKES });
vm.runInContext(fn(orig, 'formatMs_') + '\n' + fn(orig, 'buildPatternCardsHtml_') + '\n' + fn(orig, 'buildCommonMistakesHtml_'), render);
const html = render.buildPatternCardsHtml_(G.QS_PATTERNS) + render.buildPatternCardsHtml_(G.QS_SKILLS);
ok(!/unavailable/.test(html) && (html.match(/class="pattern-card"/g) || []).length === G.QS_PATTERNS.length + G.QS_SKILLS.length, 'the dashboard’s renderer draws all ' + (G.QS_PATTERNS.length + G.QS_SKILLS.length) + ' cards');
ok(/ms-list/.test(html), 'mark schemes are drawn as the dashboard’s numbered list');
const mh = render.buildCommonMistakesHtml_();
ok(!/unavailable/.test(mh) && (mh.match(/cm-card/g) || []).length === G.QS_MISTAKES.length, 'the mistakes card draws all ' + G.QS_MISTAKES.length);
ok(!/<script/i.test(html + mh), 'nothing from the guide can inject a script');
ok(patched.includes("' + QS_PATTERNS.length + ' Question Patterns"), 'the card titles count the cards instead of saying 12 and 9');
console.log(fail ? '✗ ' + fail + ' failed' : '✓ all checks passed');
process.exit(fail ? 1 : 0);
