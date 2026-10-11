#!/usr/bin/env node
/* Checks 6_QuestionGuide.gs as tools/guide-gs.mjs writes it (reflection §40.146): it compiles; it holds one line for
   every command word of the master and nothing else (the old page's card shapes went with that page); no line can
   carry markup; and My assessments reads it (QS_COMMAND_WORDS) and nothing older (qsGuideLegacy_).
   Read-only: it reads the master and the reflection folder, and writes nothing. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..', 'bio-english-lab-source');
/* the folder the generator writes: the reflection's Code folder, found from here (out/reflection is the fallback) */
const REFLECT = [path.resolve(HERE, '..', '..', '..', '..', 'AppScript', 'AppScript REFLECTION System', 'Code')]
  .filter(d => fs.existsSync(path.join(d, '6_QuestionGuide.gs')));
const OUT = REFLECT[0] || path.join(SRC, 'out', 'reflection');
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const guide = fs.readFileSync(path.join(OUT, '6_QuestionGuide.gs'), 'utf8');
const G = JSON.parse(fs.readFileSync(path.join(SRC, 'guide.master.json'), 'utf8'));
const want = {}; G.commands.forEach(c => { if (c.word && c.plain) want[c.word] = c.plain; });
const ctx = vm.createContext({});
try { vm.runInContext(guide, ctx); ok(true, '6_QuestionGuide.gs compiles and runs'); } catch (e) { ok(false, '6_QuestionGuide.gs: ' + e.message); }
const names = Object.keys(ctx);
ok(names.length === 1 && names[0] === 'QS_COMMAND_WORDS', 'it defines QS_COMMAND_WORDS and nothing else (' + names.join(', ') + ')');
const W = ctx.QS_COMMAND_WORDS || {};
ok(JSON.stringify(W) === JSON.stringify(want), 'one line for each of the master’s ' + Object.keys(want).length + ' command words, word for word');
ok(['State', 'Describe', 'Explain', 'Suggest', 'Give', 'Predict', 'Discuss'].every(w => typeof W[w] === 'string' && W[w].length > 10), 'State, Describe, Explain, Suggest, Give, Predict and Discuss are there');
ok(!Object.values(W).some(t => /[<>]/.test(t)), 'no line can carry markup');
if (REFLECT.length) {
  const page = fs.readFileSync(path.join(REFLECT[0], '4_StudentDashboardHTML.gs'), 'utf8');
  ok(/QS_COMMAND_WORDS/.test(page) && !/qsGuideLegacy_/.test(page), 'My assessments reads QS_COMMAND_WORDS, and nothing older');
}
console.log(fail ? '✗ ' + fail + ' failed' : '✓ all checks passed');
process.exit(fail ? 1 : 0);
