/* ============================================================
   text.js — the words themselves: how a typed answer is compared with the accepted ones,
   and how a model answer is drawn with its parts coloured.

   A typed keyword is marked by meaning, not by keystrokes. Case, spaces, a hyphen for a
   space, a closing full stop, "the" in front, and American spelling are all forgiven. One
   slip of the finger in a long word is forgiven too — but never when the slip lands on
   ANOTHER biology word. "meiosis" typed for "mitosis" is two letters away, "ilium" for
   "ileum" one: those are different answers, not typing errors, and are marked wrong.
   ============================================================ */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* American → British, whole words or word endings a 0610 answer might use */
  var US = [
    [/\bhemo/g, 'haemo'], [/\bhema/g, 'haema'], [/\besophag/g, 'oesophag'], [/\bestrogen/g, 'oestrogen'],
    [/\bfetus/g, 'foetus'], [/\bfeces\b/g, 'faeces'], [/\bsulfur/g, 'sulphur'], [/\banemi/g, 'anaemi'],
    [/\bleukocyte/g, 'leucocyte'], [/\bcolor/g, 'colour'], [/\bfiber/g, 'fibre'], [/\bcenter/g, 'centre'],
    [/\bliter/g, 'litre'], [/\bmeter\b/g, 'metre'], [/\bmeters\b/g, 'metres'], [/\bcentimeter/g, 'centimetre'],
    [/\bmillimeter/g, 'millimetre'], [/\bmicrometer/g, 'micrometre'], [/\bdefense/g, 'defence'],
    [/\bbehavior/g, 'behaviour'], [/\banalyz/g, 'analys'], [/\bpaediatric/g, 'paediatric'],
    [/iz(e|es|ed|ing|ation|ations)\b/g, 'is$1'], [/yz(e|es|ed|ing)\b/g, 'ys$1']
  ];
  /* The foetus / fetus pair is the one place Cambridge itself prints both; either is fine,
     so both are folded to one form before comparing. */

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

  function match(typed, accepted) {
    var t = norm(typed);
    if (!t) return { ok: false, empty: true };
    var acc = (accepted || []).map(norm);
    for (var i = 0; i < acc.length; i++) if (acc[i] === t) return { ok: true, exact: true };
    if (KNOWN[t]) return { ok: false };                          /* a real word, and not this one */
    var bestAcc = 99, bestKnown = 99, k;
    for (i = 0; i < acc.length; i++) {
      var cap = allowance(acc[i].length);
      if (!cap) continue;
      var da = dist(t, acc[i], cap);
      if (da <= cap && da < bestAcc) bestAcc = da;
    }
    if (bestAcc === 99) return { ok: false };
    for (k in KNOWN) {
      if (acc.indexOf(k) >= 0) continue;
      if (Math.abs(k.length - t.length) > 2) continue;
      var dk = dist(t, k, 2);
      if (dk < bestKnown) bestKnown = dk;
    }
    if (bestKnown <= bestAcc) return { ok: false };             /* closer to a different word */
    return { ok: true, exact: false, near: true };
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
                   plain: plain, words: words, PART: PART };
})(window);
