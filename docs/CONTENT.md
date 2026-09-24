# Writing questions for Bio English Lab

Everything a student sees is authored in `../bio-english-lab-source/` (never published) and built by
`node tools/build.mjs`, which refuses to finish if a question is broken. Then
`node tools/selftest-run.mjs` answers every question right and wrong in a real browser and fails
if either marking is wrong. Both must pass before anything is published.

## The one rule about sources

**Every question is based on something real, and says so in `src`.**

- A real Cambridge IGCSE Biology 0610 question and its mark scheme: `src: '0610/42, May/June 2023, Q1(b).'`
  The stem may be reworded; **the marking points may not be invented.** The model answer is written
  from the scheme's own marking points.
- Or a syllabus statement (2026–2028): `src: 'Syllabus 3.2.7 (Supplement).'`
- Or an examiner report: `src: 'Examiner report, June 2024, 0610/41.'`
- A graph or table uses real numbers: the mark scheme's own (`cap: '… Redrawn from the numbers in the
  mark scheme.'`) or, where the scheme gives none, the question paper's (`cap: 'Table 3.1 from the question
  paper.'`; values read off a printed graph are called approximate). If numbers must be invented, say so in
  the caption: `'Illustrative data.'` Never pass invented data off as real.

Never state that a wording earns or loses a mark unless a real scheme or report says so.

## Data or theory

Every describe and explain question is one of two kinds, and its card says which: **from data** (a
graph or a table: the trend, the numbers, the comparison, then the reason) or **from theory** (a
process, a structure, a feature and what it does). The build decides from the item — a `figure`, or
a stem that names a graph or table, means data — and `mode: 'data'` / `mode: 'theory'` on the item
overrides it. Keep both kinds in every topic: a student who only meets data-describes believes that
is what the word means.

## When the syllabus and the paper disagree

Two optional fields, on any item. Both are one sentence or two, in the site's own voice, and both
may carry `{k:…}` tags.

- `older:` — the question comes from an **older syllabus** and something in it has since changed.
  The card shows an "Older syllabus" chip while it is being answered, and this sentence with the
  model answer. Say what changed, and what the 2026–28 syllabus says instead.
  `older: 'The 2026–28 syllabus no longer includes sewage treatment (it was 20.2 until 2025). The writing practice still counts.'`
- `deeper:` — the **fuller biology** behind the answer the examiner wants, folded away behind a
  toggle so the examined answer comes first. Use it wherever the exam answer is a simplification,
  and say plainly what to write in the exam.
  `deeper: 'A human small intestine has THREE parts … This syllabus names only the {k:duodenum} and the {k:ileum} (7.5.2) … Write jejunum in the exam and it is unlikely to be credited.'`

Never let `deeper` contradict the model answer: the model is what the mark scheme credits.

## How the words are written (the students are Korean, learning in English)

- Short declarative sentences. One idea per sentence.
- **The examined word, not the everyday one**: *absorbs* not *takes in*, *releases* energy not
  *makes/produces* energy, *denatured* not *killed*, *pathogen* not *germ*, *increases* not *goes up*.
- **No phrasal verbs** (take in, go up, give off, use up, break down → *digest*, set up), **no idioms**,
  **no personification** (a cell does not *want*, *know* or *decide*). Exception: where the syllabus or
  mark scheme itself uses the phrase (nutrition is "the taking in of materials…"), keep it.
- British spelling. No exclamation marks. Second person for instructions ("Choose…", "Tap…").
- Same word for the same thing everywhere.
- Feedback (`why`) is one or two short sentences in the examiner's voice: what loses the mark and
  what scores instead. Never just "Wrong".

## The model answer: one line, one mark

`model` is an array of lines. Each line is one marking point (or `{ t, m: 2 }` for a line that earns
two). Use the fewest words that still earn the mark — about **6 words per mark** is what real
full-mark answers use. Mark the parts with tags:

| tag | part | examples |
|---|---|---|
| `{k:…}` | keyword | osmosis, active site, one cell thick |
| `{d:…}` | direction | increases, from … to …, into, down a gradient |
| `{c:…}` | comparison | higher than, more … than, both |
| `{n:…}` | data | 46 beats per minute, 30 °C |
| `{l:…}` | link | so, because, which |

Tags are for the model answer, learn cards and questions. Options in `pick`, tiles in `build`, steps
in `order`, pieces in `sort` and ideas in `exam` are drawn **without colour** (the colour would give
the answer away), so tags there are harmless but pointless.

## A set

```js
{ id: 't7.explain.1', unit: 't7', kind: 'explain',        // kind: kw | describe | explain | plan
  title: 'Explain: digestion and absorption', blurb: 'one short line',
  items: [ … ] }
```

A set is 6–10 questions (keyword sets 12–24), about 10–15 minutes: something a teacher can set as
homework. Order the questions so the support fades: learn → pick → choose → build → fix/trim →
order → gap → mark → exam. The first card of a describe/explain/plan set may be a `learn` card that
teaches this topic's version of the method.

Every set must also be listed, in order, in `units.master.js` under its unit's `sets`.

## The question types

Common fields: `id` (unique, never reused, e.g. `t7e.04`), `type`, `cmd` (the command word shown:
Describe, Explain, Suggest, State, Plan…), `marks`, `q` (the exam question), `task` (what to do on
this card, one line), `model`, `src`, optional `note` (one plain-English line about the mark scheme —
write "The mark scheme ignores “water concentration”", not "I water concentration"), optional
`figure` (`{ graph:{…} }` or `{ table:{ head:[…], rows:[[…]] } }`, plus `cap`).

| type | fields | how it is marked |
|---|---|---|
| `learn` | `title`, `body`: strings, `{frame}`, `{ex}`, `{bad, good, why}`, `{steps:[…]}`, `{legend:true}` | not marked |
| `pick` | `options: [{ t, ok:true, why }, { t, why }…]` — exactly one `ok` | the choice |
| `choose` | `text` with `[[right|wrong~why|wrong~why]]` slots; first option is right | each slot |
| `build` | `chunks` (the answer, in order, 3–6 phrase-sized pieces), `extra` (1–2 pieces that score nothing), optional `orders` (other right orders as index lists) | whole line |
| `fix` | `text` with `{weak}` words, `flaws: [{ fix, opts:[…fix among them], why }]` in order | each word |
| `trim` | `chunks: [{ t }, { t, x:true, why }]` — `x` = scores nothing, strike it | whole answer |
| `order` | `steps` in the right order (3–6) | whole order |
| `gap` | `text` with `{{answer|also accepted}}` gaps | each gap (spelling slips forgiven, but never one that makes another biology word) |
| `sort` | `bins: […]`, `items: [{ t, b: binIndex }]` | whole answer |
| `mark` | `answer` (a realistic weak student answer), `scheme: [{ t, got:true/false, why }]` | whole answer |
| `exam` | `ideas: [{ t, ok:true }, { t, ok:false, why }]`, `frames` (one sentence per scoring idea, in order, each with a `{{keyword}}` gap), optional `anyOrder:true` | step by step: think → order → write |
| `kw` | `key`, `prompt`, `input: 'choose' | 'type'`, `opts` (for choose: the key + 3 confusable keywords from the same topic), `accept` (other accepted forms), `def`, `near` (optional, choose only: `{ '<wrong option>': 'why it is not this one' }`) | the choice / the typed word |

Distractors should be **near misses**: the confusable keyword (osmosis for diffusion), the everyday
word (goes, food, germs), the rejected wording from a real scheme, the right idea in the wrong
direction, the answer to a different command word (a reason in a describe question).

## Keywords

`keywords.master.js` is the ONE list of keywords and definitions, shared with the reflection
system's flashcards (`node tools/keywords-gs.mjs` writes `5_IgcseBiologyKeywords.gs` from it). The
build makes each topic's "Keywords: meanings" set from it automatically (definition → choose the
keyword). Authors write the other keyword set by hand: situations and exam sentences, where the
student has to recognise the keyword in use.
