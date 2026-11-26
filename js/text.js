/* ============================================================
   text.js — the words themselves: how a typed answer is compared with the accepted ones,
   and how a model answer is drawn with its parts coloured.

   A typed keyword is marked by meaning, not by keystrokes. Case, spaces, a hyphen for a
   space, a closing full stop, "the" in front, and American spelling are all forgiven. One
   slip of the finger in a long word is forgiven too — but never when the slip lands on
   ANOTHER biology word. "meiosis" typed for "mitosis" is two letters away, "ilium" for
   "ileum" one: those are different answers, not typing errors, and are marked wrong.
   How many slips: none in a word of 4 letters or fewer, one in 5–9 letters, two in 10 or more
   (a wrong, missing or extra letter, or two letters swapped). A forgiven slip is still SHOWN:
   the box turns amber and the right spelling appears beside it (26 Nov 2026).
   ============================================================ */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* American → British, whole words or word endings a 0610 answer might use. Both the typed answer and the accepted ones
     are folded the same way before they are compared, so either spelling is right and never counted as a typing slip
     (26 Nov 2026, Daniel: "double check that both spellings are accepted"; tools/spelling-check.mjs tries every accepted
     answer of the site in its American spelling). */
  var US = [
    [/\bhemo/g, 'haemo'], [/\bhema/g, 'haema'], [/\besophag/g, 'oesophag'], [/\bestrogen/g, 'oestrogen'],
    [/\bfet(us|uses|al)\b/g, 'foet$1'], [/\bfec(es|al)\b/g, 'faec$1'], [/\bsulf/g, 'sulph'], [/\banemi/g, 'anaemi'],
    [/\bleukocyte/g, 'leucocyte'], [/\bleukem/g, 'leukaem'], [/glycem/g, 'glycaem'], [/\bdiarrhea/g, 'diarrhoea'],
    [/\bedema/g, 'oedema'], [/\bameb/g, 'amoeb'], [/\banesthe/g, 'anaesthe'], [/\bcesarean/g, 'caesarean'],
    [/\bpediatric/g, 'paediatric'], [/\bcecum/g, 'caecum'], [/\bisch(e)mi/g, 'ischaemi'],
    [/\bcolor/g, 'colour'], [/\b(vap|tum|od|flav|lab|fav|hum|neighb|harb|vig)or(s|ed|ing|able|ably|ite|ites|less)?\b/g, '$1our$2'],
    [/\bmold(s|y|ed|ing)?\b/g, 'mould$1'], [/\bgray\b/g, 'grey'], [/\baluminum\b/g, 'aluminium'],
    [/\bfiber/g, 'fibre'], [/\bcenter/g, 'centre'],
    [/\b(milli|centi|deci|micro)?liter(s?)\b/g, '$1litre$2'], [/\b(milli|centi|deci|kilo|micro|nano)?meter(s?)\b/g, '$1metre$2'],
    [/\bdefense/g, 'defence'], [/\bbehavior/g, 'behaviour'], [/\banalyz/g, 'analys'],
    [/\b(label|model|fuel|signal|channel|level|travel|cancel|dial|total)(ed|ing|er|ers)\b/g, '$1l$2'],
    [/iz(e|es|ed|ing|er|ers|ation|ations)\b/g, 'is$1'], [/yz(e|es|ed|ing|er|ers)\b/g, 'ys$1']
  ];
  /* A unit name keeps its own metre: "thermometer", "potometer" and "colorimeter" are instruments, so only metre and litre
     with a prefix are folded. The foetus / fetus pair is one place Cambridge itself prints both. */

  function norm(s) {
    var t = String(s == null ? '' : s).toLowerCase();
    if (t.normalize) t = t.normalize('NFKC');
    t = t.replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"')
         .replace(/[\u2010-\u2015\u2212]/g, '-')
         .replace(/\u00a0/g, ' ');
    t = t.replace(/[-_/]+/g, ' ')                 /* self-pollination = self pollination */
         .replace(/[.,;:!?"'()\[\]]+/g, ' ')
         .replace(/\s+/g, ' ').trim()
         .replace(/^(the|a|an)\s+/, '');
    for (var i = 0; i < US.length; i++) t = t.replace(US[i][0], US[i][1]);
    return t;
  }

  /* Damerau–Levenshtein distance (with adjacent swaps), capped for speed */
  function dist(a, b, cap) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > cap) return cap + 1;
    var d = [], i, j;
    for (i = 0; i <= la; i++) { d[i] = [i]; }
    for (j = 0; j <= lb; j++) { d[0][j] = j; }
    for (i = 1; i <= la; i++) {
      var best = 99;
      for (j = 1; j <= lb; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
          v = Math.min(v, d[i - 2][j - 2] + 1);
        }
        d[i][j] = v;
        if (v < best) best = v;
      }
      if (best > cap) return cap + 1;
    }
    return d[la][lb];
  }

  /* How many slips a word of this length may carry and still be the same word */
  function allowance(len) { return len >= 10 ? 2 : len >= 5 ? 1 : 0; }

  /* Every biology word the site knows (keywords, accepted answers). A typed answer that IS one
     of these, or is nearer to one of these than to the expected answer, is never forgiven. */
  var KNOWN = {};
  function know(list) {
    (list || []).forEach(function (w) { var n = norm(w); if (n) KNOWN[n] = true; });
  }

  /* ---------- the keywords inside a piece of text (26 Nov 2026) ----------
     One finder for the page (a word from a later topic marked on a card; a word tapped in look-up) and for tools/build.mjs
     (which later-topic words each topic's questions use), so the two always find the same words. termIndex takes
     [{ id, t }] (t = the keyword's name as the list writes it) and maps the name, each other name in brackets that is
     really a name ("singular: alveolus", "windpipe", "CHD") and the singular or plural of its last word to the id.
     findTerms(text, index) walks the words and takes the longest name at each place (six words at most). A name written
     in capitals (DNA, MRSA, LH) is found only in capitals. */
  var ODD_PLURAL = { leaves: 'leaf', teeth: 'tooth', feet: 'foot', mice: 'mouse', children: 'child', men: 'man', women: 'woman' };
  function termKey(s) {
    var t = norm(s), w = t.split(' '), last = w[w.length - 1];
    w[w.length - 1] = ODD_PLURAL[last] || last.replace(/ies$/, 'y').replace(/([^s])s$/, '$1');
    return w.join(' ');
  }
  /* a bracket that says WHERE or WHICH ("Epidermis (leaf)", "Ovary (human)", "(comparison)") is no other name */
  var NOT_A_NAME = /^(ib|and|in|of|on|at|to|for|from|with|the|types?|e\.?g\.?|plants?|animals?|humans?|leaf|flower|skin|comparison|overview|life process|general|body temperature)\b/i;
  /* map[name] = [ids]: two keywords with one name (Ovary (human), Ovary (flower)) are both kept, and the page shows both
     meanings. Names first, then other names, so another name never takes a keyword's own name; a glossary card of the
     labs (id "g.<word>") takes only a name that no keyword has. */
  function termIndex(entries) {
    var map = {}, caps = {}, alts = [];
    function put(name, id, alt) {
      name = String(name || '').trim();
      if (!name) return;
      var box = caps, k = name;
      if (!/^[A-Z][A-Z0-9₀-₉]+$/.test(name)) { box = map; k = termKey(name); }
      if (!k) return;
      if (!box[k]) box[k] = [id];
      else if (!alt && box[k].indexOf(id) < 0 && !box[k].alt && String(id).indexOf('g.') !== 0) box[k].push(id);
      if (alt && box[k].length === 1 && box[k][0] === id) box[k].alt = true;
    }
    (entries || []).forEach(function (e) {
      if (!e || !e.id || !e.t) return;
      var t = String(e.t), re = /\(([^()]*)\)\s*$/, m;
      while ((m = t.match(re))) { alts.push([m[1].trim(), e.id]); t = t.slice(0, m.index).trim(); }
      t.replace(/\([^()]*\)/g, ' ').split(/\s+\/\s+/).forEach(function (n) { put(n.replace(/\s+/g, ' '), e.id, false); });
    });
    alts.forEach(function (x) {
      var a = x[0], sp = a.match(/^(?:singular|plural)\s*:\s*(.+)$/i);
      if (sp) { put(sp[1], x[1], true); return; }
      if (/[\/:,]/.test(a) || NOT_A_NAME.test(a)) return;
      put(a, x[1], true);
    });
    return { map: map, caps: caps };
  }
  /* → [{ at, end, id, ids, text }] in reading order, never overlapping (ids: every keyword with that name) */
  function findTerms(text, index) {
    var out = [], toks = [], re = /[A-Za-zÀ-ÿµ][A-Za-z0-9À-ÿµ'’-]*/g, m;
    text = String(text == null ? '' : text);
    if (!index) return out;
    while ((m = re.exec(text))) toks.push({ at: m.index, end: m.index + m[0].replace(/['’-]+$/, '').length, w: m[0] });
    for (var i = 0; i < toks.length; i++) {
      var hit = null;
      for (var n = Math.min(6, toks.length - i); n >= 1 && !hit; n--) {
        var at = toks[i].at, end = toks[i + n - 1].end, phrase = text.slice(at, end);
        if (n > 1 && /[.;:!?]/.test(text.slice(toks[i].end, toks[i + n - 1].at))) continue;   /* a name never runs over a full stop */
        if (n > 1 && /^(the|a|an)$/i.test(toks[i].w)) continue;                               /* nor starts with "the" */
        var bare = phrase.replace(/['’]s$/, '');
        var ids = n === 1 && /^[A-Z][A-Z0-9]+$/.test(bare) ? index.caps[bare] : index.map[termKey(phrase)];
        if (ids) hit = { at: at, end: end, id: ids[0], ids: ids.slice(), text: phrase, n: n };
      }
      if (hit) { out.push(hit); i += hit.n - 1; }
    }
    return out;
  }

  /* match(typed, accepted[]) → { ok, exact, near } */
  /* ---------- capitals ----------
     The marker ignores case, and so does an examiner. The site still says how the word is written,
     because that is the point of the site: osmosis has no capital inside a sentence, while
     Benedict's solution keeps its B and DNA is written in capitals. Guidance, never a refusal. */
  var PROPER = /^(benedict|bowman|golgi|darwin|petri|fehling|biuret|sudan|leeuwenhoek|malpighi|celsius|bunsen)/i;
  function capForm(tok) {
    var w = tok.replace(/[^A-Za-z']/g, '');
    if (!w) return 'lower';
    if (/^[A-Z]{2,}$/.test(w)) return 'caps';               /* DNA, ATP, HIV, DCPIP */
    if (/^[A-Z]$/.test(w)) return 'cap';                    /* vitamin C */
    if (/^[A-Z]/.test(w) && (/'s$/i.test(w) || PROPER.test(w))) return 'cap';   /* Benedict's, Golgi */
    return 'lower';
  }
  /* '' when the capitals are already right (or the two cannot be lined up word for word). */
  function caseNote(typed, accepted) {
    var t = norm(typed);
    var want = null;
    var bare = function (x) { return norm(String(x).replace(/['\u2018\u2019]/g, '')); };
    (accepted || []).forEach(function (a) {
      if (want === null && (norm(a) === t || bare(a) === bare(typed))) want = String(a);
    });
    if (want === null) return '';
    /* an apostrophe counts as a space in norm, so "benedicts" and "Benedict's" are one word each
       here before they are lined up */
    var flat = function (x) { return String(x).replace(/['\u2018\u2019]/g, '').trim().split(/\s+/); };
    var got = flat(typed), exp = want.trim().split(/\s+/);
    if (got.length !== exp.length) { exp = flat(want); }
    if (got.length !== exp.length) return '';
    var over = 0, under = 0, form = [];
    for (var i = 0; i < exp.length; i++) {
      var kind = capForm(exp[i]), g = got[i].replace(/[^A-Za-z']/g, '');
      form.push(kind === 'caps' ? exp[i].toUpperCase() : kind === 'cap' ? exp[i] : exp[i].toLowerCase());
      if (!g) continue;
      if (kind === 'lower' && /^[A-Z]/.test(g)) over++;
      if ((kind === 'cap' || kind === 'caps') && !/^[A-Z]/.test(g)) under++;
    }
    if (!over && !under) return '';
    var shown = form.join(' ');
    if (under) return 'Accepted. This one keeps its capital letter: <b>' + esc(shown) + '</b>.';
    return 'Accepted. Inside a sentence it is written <b>' + esc(shown) + '</b>' +
           (/[A-Z]/.test(shown) ? '.' : ', with no capital letter.');
  }

  /* to = the accepted answer it matched, as the question writes it: a slip is shown beside the box with THAT spelling
     (26 Nov 2026, pupils: "highlight that I have made a typo", so nobody thinks a misspelt word was spelt right) */
  function match(typed, accepted) {
    var t = norm(typed);
    if (!t) return { ok: false, empty: true };
    var acc = (accepted || []).map(norm);
    for (var i = 0; i < acc.length; i++) if (acc[i] === t) return { ok: true, exact: true, to: String(accepted[i]) };
    if (KNOWN[t]) return { ok: false };                          /* a real word, and not this one */
    var bestAcc = 99, bestAt = -1, bestKnown = 99, k;
    for (i = 0; i < acc.length; i++) {
      var cap = allowance(acc[i].length);
      if (!cap) continue;
      var da = dist(t, acc[i], cap);
      if (da <= cap && da < bestAcc) { bestAcc = da; bestAt = i; }
    }
    if (bestAcc === 99) return { ok: false };
    for (k in KNOWN) {
      if (acc.indexOf(k) >= 0) continue;
      if (Math.abs(k.length - t.length) > 2) continue;
      var dk = dist(t, k, 2);
      if (dk < bestKnown) bestKnown = dk;
    }
    if (bestKnown <= bestAcc) return { ok: false };             /* closer to a different word */
    return { ok: true, exact: false, near: true, to: String(accepted[bestAt]) };
  }

  /* ---------- a model answer, drawn with its parts coloured ----------
     Authored as  "Water moves {k:by osmosis} {d:from a higher water potential} …"
       k  keyword        the biology word the mark needs
       d  direction      from … to …, into, out of, increases, decreases
       c  comparison     than, higher, more … than, both
       n  data           a number with its unit
       l  link           so, because, therefore, which
     Anything outside braces is plain. */
  var PART = { k: 'keyword', d: 'direction', c: 'compare', n: 'data', l: 'link' };
  function tags(s) {
    var out = '', re = /\{([kdcnl]):([^{}]*)\}/g, last = 0, m;
    s = String(s == null ? '' : s);
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      out += '<span class="pt pt--' + m[1] + '" data-part="' + PART[m[1]] + '">' + esc(m[2]) + '</span>';
      last = re.lastIndex;
    }
    return out + esc(s.slice(last));
  }
  function plain(s) { return String(s == null ? '' : s).replace(/\{[kdcnl]:([^{}]*)\}/g, '$1'); }
  function words(s) { var p = plain(s).trim(); return p ? p.split(/\s+/).length : 0; }

  global.AText = { esc: esc, norm: norm, dist: dist, match: match, know: know, tags: tags, caseNote: caseNote,
                   plain: plain, words: words, PART: PART, termIndex: termIndex, findTerms: findTerms, allowance: allowance };
})(window);
