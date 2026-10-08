# Writing questions for Bio English Lab

Everything a student sees is authored in `../bio-english-lab-source/` (never published) and built by
`node tools/build.mjs`, which refuses to finish if a question is broken. Then
`node tools/selftest-run.mjs` answers every question right and wrong in a real browser and fails
if either marking is wrong. Both must pass before anything is published. A change to how homework is counted on the
page (`hwDoneOf`, `hwStateOf`) also runs `node tools/homework-best.mjs`.

**Model answers link cause and effect** (Daniel, 8 Oct 2026). In an explain set, a model line that joins a cause to its
effect says it with a tagged link word ("…acid, {l:so} the pH is low", "…{l:because} memory cells are produced", ", {l:which}
…"), never a colon, never "because …, so …"; every line a full sentence; a colon after a label stays. The rule and its
checks: `docs/QUESTION-STANDARD.md` §7 (in Biology Hub/docs).

**The accommodation** (8 Oct 2026; atlas couplings C106). A pupil the teacher gives it sees, after a second, DIFFERENT wrong
check of a card (`api.sig`: the same answer checked again is no try), the card's own explanation of what they got wrong
(`res.help` in `js/engine.js`), and may choose keyword meanings in Korean or Chinese (한국어 · 中文: `js/data/ko.js` and
`js/data/zh.js`, written by the build from keywords.master.js `ko_def`, and `zh` + `zh_def`), shown only after an answer:
a Korean or Chinese definition often names the keyword. So every `why`, flaw `why`, chunk `why`, point
`why`, idea `why` and keyword definition may be read by the weakest readers: write them to the same standard as a question.
A keyword card's help is its definition with the answer hidden in any form (`kwMeaning`): the keyword and its plurals
(atria, teeth), an abbreviation spelled out (HIV), and its words with their other forms (denatured, clot, linked,
pulling). The common word of a longer keyword stays ("energy" in "kinetic energy") unless every word is common and it
would point to the right option. On a typed card every accepted form is an answer and goes too; on a choose card an
accepted form stays, except an abbreviation or its full name. So a definition must still say what the word means with
all that hidden, and an `accept` list should hold other names of the answer, never a bracket's context ("plant" for
Stem). A card that carries its own Korean term (`ko` in a topic master) must use the keyword list's term for the same
keyword: the build refuses a difference. An etymology card has no help: its story often states the meaning, and its `near` notes explain each wrong option
to everyone.
Proof: `node tools/accommodation.mjs` (one check answers every keyword card wrong twice and reads every help with its own
detector: the marker on every run of visible words, every word of an answer, the base of every visible word).

**Changing a question pupils have answered** (7 Oct 2026). Every word of a question is in its fingerprint `h` (answers
are kept as `id@h`): a new `h` restarts that question on every pupil's browser and changes its set's `v`, so the
spreadsheet starts that set's letters again (its best answered count is kept since 8 Oct 2026: the labs script's `x`,
so homework and the teacher page never go backwards). A reword that still asks the same thing (only the options' words and `why`,
other right orders: `orders`, `anyOrder`, or the words of the model answer with the same lines and marks, since 8 Oct 2026)
keeps the old `h`: first copy `../bio-english-lab-source/` (its
`topics/` and `methods.master.js`) to a scratch folder, then edit, then run
`node tools/keep-records.mjs --was-masters <that folder>` (it reports) and again with `--write`; it writes
`keep: { h, now }` after the question's id and proves it with a staging build. The build refuses a keep that no longer
applies: to reword a kept question again, take its keep out first. Anything else restarts the question: tell Daniel
which ones first. The rules for every site, wrong options included: `Biology Hub/docs/QUESTION-STANDARD.md`.

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

Aim for 6–10 questions, about 10–15 minutes: something a teacher can set as homework. Plan and
method sets may be shorter. The automatic "Keywords: meanings" sets follow the topic's keyword
count, split at 24 (`AUTO_MAX` in `tools/build.mjs`). Order the questions so the support fades: learn → pick → choose → build → fix/trim →
order → gap → mark → exam. The first card of a describe/explain/plan set may be a `learn` card that
teaches this topic's version of the method.

List a set under its unit's `sets` in `units.master.js` to fix its order; a set that is not listed is
added at the end of its unit, in file order (the automatic keyword sets always go first).

## The question types

Common fields: `id` (unique, never reused, e.g. `t7e.04`), `type`, `cmd` (the command word shown:
Describe, Explain, Suggest, State, Plan…), `marks`, `q` (the exam question), `task` (what to do on
this card, one line), `model`, `src`, optional `note` (one plain-English line about the mark scheme —
write "The mark scheme ignores “water concentration”", not "I water concentration"), optional
`modelTitle` (the model answer's heading, "Model answer" if left out), optional
`figure` (`{ graph:{…} }` or `{ table:{ head:[…], rows:[[…]] } }`, plus `cap`).

| type | fields | how it is marked |
|---|---|---|
| `learn` | `title`, `body`: strings, `{frame}`, `{ex}`, `{bad, good, why}`, `{steps:[…]}`, `{legend:true}` | not marked |
| `pick` | `options: [{ t, ok:true, why }, { t, why }…]` — exactly one `ok` | the choice |
| `choose` | `text` with `[[right|wrong~why|wrong~why]]` slots; first option is right | each slot |
| `build` | `chunks` (the answer, in order, 3–6 phrase-sized pieces), `extra` (1–2 pieces that score nothing), optional `orders` (other right orders as index lists) | whole line |
| `fix` | `text` with `{weak}` words, `flaws: [{ fix, opts:[…fix among them], why }]` in order; optional `find: true` makes the student find the weak words first (no underlines) | each word |
| `trim` | `chunks: [{ t }, { t, x:true, why }]` — `x` = scores nothing, strike it | whole answer |
| `order` | `steps` in the right order (3–6), optional `orders` (other right orders as index lists, as on `build`) | whole order |
| `gap` | `text` with `{{answer|also accepted}}` gaps, optional `anyOrder` (groups of 2–4 gap indexes, from 0, whose words are a list and may come in any order; one word typed twice in a group scores once; each gap of a group lists the words of its own point only, or two synonyms of one point would score both: the build refuses a word accepted in two gaps of one group) | each gap (spelling slips forgiven, but never one that makes another biology word) |
| `sort` | `bins: […]`, `items: [{ t, b: binIndex }]` | whole answer |
| `mark` | `answer` (a realistic weak student answer), `scheme: [{ t, got:true/false, why }]` | whole answer |
| `exam` | `ideas: [{ t, ok:true }, { t, ok:false, why }]`, `frames` (one sentence per scoring idea, in order, each with a `{{keyword}}` gap), optional `anyOrder:true` | step by step: think → order → write |
| `kw` | `key`, `prompt`, `input: 'choose' | 'type'`, `opts` (for choose: the key + 3 confusable keywords from the same topic), `accept` (other accepted forms), `def`, `near` (optional, choose only: `{ '<wrong option>': 'why it is not this one' }`) | the choice / the typed word |

Distractors should be **near misses**: the confusable keyword (osmosis for diffusion), the everyday
word (goes, food, germs), the rejected wording from a real scheme, the right idea in the wrong
direction, the answer to a different command word (a reason in a describe question). Write them as full and as
careful as the right answer, in the same form and of similar length: on 7 Oct 2026 the right option of 110 of 115
`pick` questions was the longest, and they were rewritten. In a "Which answer scores?" item, check every wrong one
against the REAL mark scheme (`IGCSE/Past Papers/_system/text/0610`), not the `model`: it must lose marks. The full
rules: `Biology Hub/docs/QUESTION-STANDARD.md` §3–4.

## Keywords

`keywords.master.js` is the ONE list of keywords and definitions, shared with the reflection
system's flashcards (`node tools/keywords.mjs gs` writes `5_IgcseBiologyKeywords.gs` from it). The
build makes each topic's "Keywords: meanings" set from it automatically (definition → choose the
keyword). Authors write the other keyword set by hand: situations and exam sentences, where the
student has to recognise the keyword in use.

A meanings question's prompt is the definition's first sentence with the keyword blanked, so write
that sentence as a definition that does not name the keyword. The build never blanks a bracket that
says which one ("Septum (heart)", "Epidermis (leaf)": `QUALIFIER` in `tools/build.mjs`), and leaves
out an aside that names the answer ("(forming oxyhaemoglobin)"). Where the first sentence names it
anyway — a longer word built on it (ciliated, flowering) or its head word as a label (the palisade
mesophyll) — give the keyword `ask:`, the question's own prompt; the flashcards keep the definition.
The build stops if a one-word keyword's prompt still spells it, or if a keyword has too few others in
its topic to choose from (a unit cut out of a topic, like 14.5, borrows from the topic).

## Etymology (word parts)

`wordparts.master.js` (beside the keyword list, never published) is the ONE list of the Greek and Latin
parts biology words are built from: cardi- (heart), hepat- (liver), -cyte (cell). The build makes one more
keyword set for every topic from it, "Keywords: etymology" (`<unit>.kw.roots`), and the pages show the rest:
the parts of each keyword on the topic's keyword list and under an answered keyword question, and every
part, group by group, on `#/roots`.

**Check it in a dictionary first, and say which.** Every part, every keyword's origin and every extra word
carries `src`: the dictionary's name and the headword (`Online Etymology Dictionary: hepatic`). The claim
must be on that page. Give the LITERAL meaning of the original word (Latin ventriculus is "little belly").
A look-alike is not a root: the por- of "portal vein" is Latin porta, a gate, not port- (carry); the di- of
"digestion" is dis- (apart), not di- (two); mitt- (send) is not mit- (thread).

**Which parts a word may be given (the rule of the audit of 2–3 Oct 2026).** Read the word's own etymology, then
give it a part only at one of the first two levels:

- **built**: the word was made from this element, in a modern language or in scientific Latin or Greek
  (bi- + nomial, hepat- + -ic, German Bi-uret = bi- + urea);
- **inherited**: the word came whole from Latin or Greek, where it already held the element, and the element is
  still plain to see in the English spelling with its usual meaning (ex-cretion, di-gestion, trans-port);
- **buried**: the element is real somewhere in the word's history but a student cannot see it or reuse it. It sits
  inside another stem (bini inside com-bin-e, so recombinant has no bi-), or it is disguised (ex- written ef- in
  effector, syn- written sy- in system), or it has another sense there (hydro- standing for hydrogen in
  hydrochloric, anti- clipped from antibody in antigen). A buried element is NOT a part of the word: say it in
  `origin` if the picture helps;
- **wrong**: the etymology does not hold the element at all.

A part's `means` is its meaning in English scientific words, with the ancestor's meaning in a closing bracket
("lymph (literally: clear water)"); the choices in a question drop that bracket. Forms that are different elements
with the same job (-ic, -al, -ary; in-, non-, un-) may share an entry only if its `origin` says so. A part that
looks like another gets a `note` (cent- / centr-, mit- / mitt-, sept- wall / septic). `ALIKE` lists parts that mean
nearly the same (bi-, di-, diplo-), so one is never a wrong choice for another.

**True is not enough: it must HELP (Daniel, 3 Oct 2026).** The section is for students to learn without being
overwhelmed. A part goes on a word only if reading it leads to the word's meaning in biology (hepat- + -ic: of the
liver; myo- + card- + -itis: inflammation of the heart muscle), and an origin sentence only if its picture makes the
word easier to understand or remember (atrium, an entrance hall; capillary, a hair). A part that is true but leads
away from the meaning (effector: ef- + fect- + -or; system: sy- + stem) is left out, because it is one more thing to
remember. Grammar endings (-tion, -ic, -er, -able, -ity) are never shown on a word. Words to meet are the common ones
a student will read (hepatitis, cardiovascular, antibiotic), never rare ones. A part is ASKED only if students meet it
in two words or more; a topic's set stays small (at most 10 parts, 4 words taken apart, 5 words to work out). The
lists of what was kept are in `audit/word-parts/overrides.py` (the section DANIEL'S RULE).

The build checks what a machine can: every part given to a word must be FOUND in its letters, left to right, each
in one of its listed forms, with at most one shared letter at a join (haplo- + -oid); and a word is never shown as
built from itself (vein = ven-). Passing those gates proves nothing about the etymology: letters can spell a part
by chance (the bi in recombinant). Only the dictionary check does that, and `src` records it.

- `PARTS`: `id` (never changes), `part` (its forms, British spelling), `means`, `short` (a gloss for
  "blood + cell" lines when `means` is long), `ko`, `origin` (language, the original word, its literal
  meaning), `src`, `group` (a heading on `#/roots`), `cls` (which other parts make near-miss wrong answers:
  organs with organs), `plain: true` (the meaning is the word itself, arteri- = artery: listed, never asked).
- `KW`, by keyword id: `parts` (the part ids, in the order they occur in the word), `pro` (the same for
  its professional term), `lit` (the parts read literally, when there are two or more), `origin` (ONE
  sentence on where the word comes from, only when the picture helps to remember it: atrium, an entrance
  hall), `src`, `nosplit: true` (its parts are shown, never asked as a split: they leave out the root that carries
  the meaning). A keyword whose only parts are endings (-tion, -ic) gets no `parts`.
- `MEET`: a word that is NOT a keyword, which a student can work out from the parts (hepatitis,
  cardiovascular): `w`, `parts`, `means` (plain, at most 12 words), `unit`, `src`. Common words a student
  meets when reading, never obscure ones.

The set asks three things, each a choice of four: what a part means; what the parts of a keyword mean, in
order; and what a word never taught must mean. A part is asked in one topic, the one with most keywords
built from it. Nothing from this file goes INSIDE a keyword question: it travels beside them (`meta.roots`),
so adding or correcting a part never restarts an answered keyword question. An etymology question's own
words do restart it, like any other question.

