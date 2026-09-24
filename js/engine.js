/* ============================================================
   engine.js — every kind of question on the site, drawn and marked.

   One card per question. Every card has the same bones:
     the exam question (as it would be printed, with its [marks]),
     the task (what to do here, in one line),
     the work area, then Check · Try again · Show the model answer,
     and, once checked, the model answer — ONE LINE, ONE MARK — with the reason.

   Two rules carried over from the Biology Labs:
     • "Try again" never throws the student's work away. Only the marking is cleared.
     • Where a whole arrangement is marked as one answer (build, order, sort, trim, mark),
       the card does not say which piece is wrong: working it out is the learning.
       Where each gap is its own answer (choose, gap, fix), each is marked on its own.

   Scoring, kept by app.js from what each card reports:
     first  right at the first check, before the model answer was shown
     done   right at some point, or the model answer was shown
   ============================================================ */
(function (global) {
  'use strict';
  var T = global.AText;

  var KIND = {
    learn: 'Learn', pick: 'Which answer scores?', choose: 'Choose the words', build: 'Build the sentence',
    fix: 'Fix the weak words', trim: 'Cut the words that score nothing', order: 'Put in order',
    gap: 'Write the keyword', sort: 'Sort', mark: 'Be the examiner', exam: 'Exam question', kw: 'Keyword'
  };

  /* ---------- small helpers ---------- */
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(label, cls) { var b = h('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; return b; }
  function shuffle(a, seed) {
    a = a.slice();
    var s = 0; seed = String(seed || Math.random());
    for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    for (var j = a.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    return a;
  }
  /* a fresh order on every visit, but never the answer's own order when that can be avoided */
  function mixed(n, seed, avoid) {
    var idx = []; for (var i = 0; i < n; i++) idx.push(i);
    for (var tries = 0; tries < 6; tries++) {
      var o = shuffle(idx, seed + ':' + tries + ':' + Date.now());
      if (!avoid || o.join() !== avoid.join() || n < 2) return o;
    }
    return idx.slice().reverse();
  }
  function marksTag(m) { return m ? '<span class="q__marks">[' + m + ']</span>' : ''; }

  /* ---------- the model answer: one line, one mark ---------- */
  function modelBlock(item) {
    var lines = item.model || [];
    if (!lines.length) return null;
    var box = h('div', 'model');
    var total = 0, words = 0;
    var head = h('div', 'model__head', '<span class="model__title">' + (item.modelTitle || 'Model answer') + '</span>');
    box.appendChild(head);
    var list = h('ol', 'model__lines');
    lines.forEach(function (ln) {
      var text = typeof ln === 'string' ? ln : ln.t;
      var m = typeof ln === 'string' ? 1 : (ln.m == null ? 1 : ln.m);
      total += m; words += T.words(text);
      var li = h('li', 'mline' + (m ? '' : ' mline--nomark'));
      li.innerHTML = '<span class="mline__text">' + T.tags(text) + '</span>' +
        (m ? '<span class="mline__tick" aria-label="' + m + ' mark' + (m > 1 ? 's' : '') + '">✓<b>' + m + '</b></span>' : '<span class="mline__tick mline__tick--none" aria-label="no mark">—</span>');
      list.appendChild(li);
    });
    box.appendChild(list);
    var foot = h('div', 'model__foot', '<span>' + words + ' words</span><span>' + total + ' mark' + (total === 1 ? '' : 's') + '</span>');
    box.appendChild(foot);
    if (item.note) box.appendChild(h('p', 'model__note', T.tags(item.note)));
    var ex = extrasHTML(item); if (ex) box.appendChild(h('div', 'model__extra', ex));
    if (item.src) box.appendChild(h('p', 'model__src', 'Based on ' + T.esc(item.src)));
    return box;
  }

  /* Two things a question may carry beside its model answer.
     older:  the question comes from an older syllabus, and what has changed since. Shown as a
             chip on the card BEFORE it is answered as well, so nobody learns the old rule first.
     deeper: the biology behind the answer the examiner wants. Folded away, because the exam
             answer comes first: "name another part of the small intestine" wants ileum or
             duodenum, and the jejunum — real, but not in this syllabus — belongs in here. */
  function extrasHTML(item) {
    var out = '';
    if (item.older) out += '<p class="model__old"><b>From an older syllabus.</b> ' + T.tags(item.older) + '</p>';
    if (item.deeper) out += '<details class="deep"><summary>The fuller biology</summary>' +
      '<div class="deep__b">' + T.tags(item.deeper) + '</div></details>';
    return out;
  }

  /* ---------- the card and its footer ---------- */
  function shell(item, opts) {
    var card = h('article', 'card card--' + item.type);
    var top = h('div', 'card__top');
    top.appendChild(h('span', 'card__kind', KIND[item.type] || item.type));
    if (item.cmd) top.appendChild(h('span', 'card__cmd', T.esc(item.cmd)));
    /* which kind of describe or explain this is, because the two want different sentences */
    if (item.mode) top.appendChild(h('span', 'card__mode card__mode--' + item.mode, item.mode === 'data' ? 'from data' : 'from theory'));
    if (item.older) top.appendChild(h('span', 'card__old', 'Older syllabus'));
    card.appendChild(top);
    if (item.q) {
      var q = h('div', 'q');
      q.innerHTML = '<p class="q__text">' + T.tags(item.q) + ' ' + marksTag(item.marks) + '</p>';
      if (item.figure) q.appendChild(figure(item.figure));
      card.appendChild(q);
    }
    if (item.task) card.appendChild(h('p', 'task', T.tags(item.task)));
    var body = h('div', 'card__body');
    card.appendChild(body);
    return { card: card, body: body };
  }

  /* A small data figure: a table, or a line graph drawn from numbers (never a drawing of
     an organism — the site shows words and data, not pictures of biology). */
  function figure(f) {
    var wrap = h('figure', 'fig');
    if (f.table) {
      var tb = '<table class="fig__table"><thead><tr>' + f.table.head.map(function (c) { return '<th>' + T.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      f.table.rows.forEach(function (r) { tb += '<tr>' + r.map(function (c) { return '<td>' + T.esc(c) + '</td>'; }).join('') + '</tr>'; });
      wrap.innerHTML = tb + '</tbody></table>';
    } else if (f.graph) {
      wrap.innerHTML = graphSvg(f.graph);
    }
    if (f.cap) wrap.appendChild(h('figcaption', 'fig__cap', T.esc(f.cap)));
    return wrap;
  }
  function graphSvg(g) {
    var W = 520, H = 300, L = 62, R = 18, TOP = 16, B = 52;
    var xs = [], ys = [];
    g.series.forEach(function (s) { s.pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    var x0 = g.xmin != null ? g.xmin : Math.min.apply(null, xs), x1 = g.xmax != null ? g.xmax : Math.max.apply(null, xs);
    var y0 = g.ymin != null ? g.ymin : 0, y1 = g.ymax != null ? g.ymax : Math.max.apply(null, ys);
    function X(v) { return L + (v - x0) / (x1 - x0) * (W - L - R); }
    function Y(v) { return H - B - (v - y0) / (y1 - y0) * (H - TOP - B); }
    var s = '<svg class="fig__graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + T.esc(g.alt || 'graph') + '">';
    var xt = g.xticks || [], yt = g.yticks || [];
    yt.forEach(function (v) { s += '<line class="gx" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/><text class="tk" x="' + (L - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>'; });
    xt.forEach(function (v) { s += '<line class="gy" y1="' + TOP + '" y2="' + (H - B) + '" x1="' + X(v) + '" x2="' + X(v) + '"/><text class="tk" y="' + (H - B + 18) + '" x="' + X(v) + '" text-anchor="middle">' + v + '</text>'; });
    s += '<line class="ax" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/><line class="ax" x1="' + L + '" x2="' + L + '" y1="' + TOP + '" y2="' + (H - B) + '"/>';
    s += '<text class="lab" x="' + ((L + W - R) / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + T.esc(g.x) + '</text>';
    s += '<text class="lab" transform="translate(16,' + ((TOP + H - B) / 2) + ') rotate(-90)" text-anchor="middle">' + T.esc(g.y) + '</text>';
    g.series.forEach(function (se, i) {
      var d = se.pts.map(function (p, j) { return (j ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
      s += '<path class="ln ln--' + i + '" d="' + d + '"/>';
      se.pts.forEach(function (p) { s += '<circle class="gpt ln--' + i + '" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="3.2"/>'; });
      if (se.name) { var lp = se.pts[se.pts.length - 1]; s += '<text class="sname ln--' + i + '" x="' + (X(lp[0]) - 4) + '" y="' + (Y(lp[1]) - 9) + '" text-anchor="end">' + T.esc(se.name) + '</text>'; }
    });
    return s + '</svg>';
  }

  /* The footer every markable card shares.
       check()  → { ok, parts? } or null when the answer is not complete yet
       clear()  → remove the red/green marking, keep the work
       lock(b)  → stop / allow editing                                              */
  function foot(card, item, ctx, api) {
    var bar = h('div', 'card__foot');
    var bCheck = btn('Check', 'btn--go'), bAgain = btn('Try again', 'btn--quiet'), bShow = btn('Show the model answer', 'btn--quiet'), bNext = btn('Next →', 'btn--go');
    bAgain.hidden = true; bShow.hidden = true; bNext.hidden = true;
    bar.appendChild(bCheck); bar.appendChild(bAgain); bar.appendChild(bShow);
    var verdict = h('p', 'verdict'); verdict.setAttribute('role', 'status'); verdict.setAttribute('aria-live', 'polite');
    var fb = h('div', 'feedback'); fb.hidden = true;
    var modelHost = h('div', 'model-host');
    var after = h('div', 'card__next'); after.appendChild(bNext);
    card.appendChild(bar); card.appendChild(verdict); card.appendChild(fb); card.appendChild(modelHost); card.appendChild(after);
    var shown = false, tries = 0;

    function reveal() {
      if (modelHost.firstChild) return;
      var m = modelBlock(item);
      if (m) modelHost.appendChild(m);
    }
    function finish() { bNext.hidden = !ctx.onNext; }

    bCheck.addEventListener('click', function () {
      var res = api.check();
      if (!res) { verdict.className = 'verdict verdict--wait'; verdict.textContent = api.incomplete || 'Finish the answer first.'; return; }
      tries++;
      api.lock(true);
      card.classList.remove('is-right', 'is-wrong');
      card.classList.add(res.ok ? 'is-right' : 'is-wrong');
      verdict.className = 'verdict ' + (res.ok ? 'verdict--ok' : 'verdict--no');
      verdict.textContent = res.ok ? (res.say || '✓ Correct') : (res.say || '✗ Not yet');
      /* why  = words, escaped and tagged here;  whyHTML = already-built markup (a keyword card,
         a list of lines). Running the second through T.tags printed the markup at the reader. */
      var why = res.ok ? (res.why || item.why || '') : (res.why || '');
      var whyHTML = res.whyHTML || '';
      if (!res.ok && !why && !whyHTML) why = api.wholeAnswer ? 'Your answer is kept as you left it. Change only what you want, then check again.' : 'Look again at the parts marked in red, then try once more.';
      fb.hidden = !(why || whyHTML);
      fb.className = 'feedback ' + (res.ok ? 'feedback--ok' : 'feedback--no');
      fb.innerHTML = whyHTML || T.tags(why);
      bCheck.hidden = true;
      if (res.ok) { reveal(); finish(); bAgain.hidden = true; bShow.hidden = true; }
      else { bAgain.hidden = false; bShow.hidden = shown || !(item.model && item.model.length) && !api.showAnswer; }
      if (ctx.onResult) ctx.onResult({ ok: !!res.ok, first: !!res.ok && tries === 1 && !shown, shown: shown });
    });
    bAgain.addEventListener('click', function () {
      api.clear(); api.lock(false);
      card.classList.remove('is-right', 'is-wrong');
      verdict.textContent = ''; verdict.className = 'verdict'; fb.hidden = true;
      bAgain.hidden = true; bCheck.hidden = false;
      if (api.focus) api.focus();
    });
    bShow.addEventListener('click', function () {
      shown = true;
      if (api.showAnswer) api.showAnswer();
      reveal(); finish(); bShow.hidden = true;
      if (ctx.onResult) ctx.onResult({ ok: false, first: false, shown: true });
    });
    bNext.addEventListener('click', function () { if (ctx.onNext) ctx.onNext(); });
    /* a question already answered on an earlier visit shows its answer and moves on freely */
    if (ctx.state && (ctx.state.ok || ctx.state.shown)) { bNext.hidden = !ctx.onNext; }
    return { bar: bar };
  }

  /* ============================================================
     learn — a teaching card: nothing to mark
     ============================================================ */
  function learn(item, ctx) {
    var sh = shell(item);
    var b = sh.body;
    if (item.title) b.appendChild(h('h3', 'learn__title', T.tags(item.title)));
    (item.body || []).forEach(function (p) {
      if (typeof p === 'string') b.appendChild(h('p', 'learn__p', T.tags(p)));
      else if (p.frame) b.appendChild(h('p', 'frame', T.tags(p.frame)));
      else if (p.ex) b.appendChild(h('p', 'learn__ex', T.tags(p.ex)));
      else if (p.bad) {
        var pair = h('div', 'pair');
        pair.appendChild(h('p', 'pair__bad', '<span class="pair__tag">Scores nothing</span>' + T.tags(p.bad)));
        pair.appendChild(h('p', 'pair__good', '<span class="pair__tag">Scores</span>' + T.tags(p.good)));
        if (p.why) pair.appendChild(h('p', 'pair__why', T.tags(p.why)));
        b.appendChild(pair);
      } else if (p.steps) {
        var ol = h('ol', 'steps');
        p.steps.forEach(function (s) { ol.appendChild(h('li', '', T.tags(s))); });
        b.appendChild(ol);
      } else if (p.legend) {
        b.appendChild(legend());
      }
    });
    var m = modelBlock(item); if (m) b.appendChild(m);
    else { var lex = extrasHTML(item); if (lex) b.appendChild(h('div', 'model__extra', lex)); }
    var bar = h('div', 'card__foot'), next = btn(item.next || 'Got it →', 'btn--go');
    next.addEventListener('click', function () { if (ctx.onResult) ctx.onResult({ ok: true, first: true, learn: true }); if (ctx.onNext) ctx.onNext(); });
    bar.appendChild(next); sh.card.appendChild(bar);
    return sh.card;
  }
  function legend() {
    var d = h('div', 'legend');
    [['k', 'Keyword', 'the biology word the mark needs'], ['d', 'Direction', 'from … to …, increases, decreases'],
     ['c', 'Compare', 'higher than, more … than'], ['n', 'Data', 'a number with its unit'], ['l', 'Link', 'so, because, which']]
      .forEach(function (x) { d.appendChild(h('span', 'legend__i', '<span class="pt pt--' + x[0] + '">' + x[1] + '</span> ' + T.esc(x[2]))); });
    return d;
  }

  /* ============================================================
     pick — which of these answers scores?  (one choice, a reason for each)
     item.options = [{ t, ok, why }]
     ============================================================ */
  function pick(item, ctx) {
    var sh = shell(item);
    var order = mixed(item.options.length, item.id);
    var chosen = -1, locked = false, buttons = [];
    var list = h('div', 'opts');
    order.forEach(function (i) {
      var o = item.options[i];
      var b = h('button', 'opt', '<span class="opt__t">' + T.esc(T.plain(o.t)) + '</span>');   /* plain: colouring only the right answer would give it away */
      b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        if (locked) return;
        chosen = i;
        buttons.forEach(function (x) { x.el.classList.toggle('is-on', x.i === i); x.el.setAttribute('aria-pressed', x.i === i ? 'true' : 'false'); });
      });
      buttons.push({ el: b, i: i });
      list.appendChild(b);
    });
    sh.body.appendChild(list);
    foot(sh.card, item, ctx, {
      incomplete: 'Choose one answer first.',
      check: function () {
        if (chosen < 0) return null;
        var o = item.options[chosen];
        buttons.forEach(function (x) { if (x.i === chosen) x.el.classList.add(o.ok ? 'is-right' : 'is-wrong'); });
        return { ok: !!o.ok, why: o.why };
      },
      clear: function () { buttons.forEach(function (x) { x.el.classList.remove('is-right', 'is-wrong', 'is-on'); x.el.setAttribute('aria-pressed', 'false'); }); chosen = -1; },
      lock: function (b) { locked = b; }
    });
    return sh.card;
  }

  /* ============================================================
     choose — a sentence with choices in it.
     item.text: "Oxygen [[diffuses|moves~'Moves' names no process|goes]] from …"
     The first choice in [[…]] is right; ~ adds the reason a wrong one scores nothing.
     Each choice is its own answer and is marked on its own.
     ============================================================ */
  function parseChoices(text) {
    var parts = [], re = /\[\[([^\]]+)\]\]/g, last = 0, m;
    while ((m = re.exec(text))) {
      parts.push({ s: text.slice(last, m.index) });
      var opts = m[1].split('|').map(function (x) { var p = x.split('~'); return { t: p[0].trim(), why: (p[1] || '').trim() }; });
      parts.push({ slot: opts });
      last = re.lastIndex;
    }
    parts.push({ s: text.slice(last) });
    return parts;
  }
  function choose(item, ctx) {
    var sh = shell(item);
    var line = h('p', 'sent');
    var slots = [];
    parseChoices(item.text).forEach(function (p, k) {
      if (p.s != null) { line.appendChild(h('span', '', T.tags(p.s))); return; }
      var sel = document.createElement('select');
      sel.className = 'slot';
      sel.setAttribute('aria-label', 'Choice ' + (slots.length + 1));
      sel.appendChild(new Option('choose…', ''));
      mixed(p.slot.length, item.id + ':' + k).forEach(function (i) { sel.appendChild(new Option(p.slot[i].t, String(i))); });
      sel.addEventListener('change', function () { sel.classList.remove('is-right', 'is-wrong'); sel.classList.toggle('is-set', sel.value !== ''); });
      slots.push({ el: sel, opts: p.slot });
      line.appendChild(sel);
    });
    sh.body.appendChild(line);
    foot(sh.card, item, ctx, {
      incomplete: 'Make a choice in every box first.',
      check: function () {
        if (slots.some(function (s) { return s.el.value === ''; })) return null;
        var wrong = 0, whys = [];
        slots.forEach(function (s) {
          var i = +s.el.value, ok = i === 0;
          s.el.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) { wrong++; if (s.opts[i].why) whys.push('<b>' + T.esc(s.opts[i].t) + '</b> — ' + T.esc(s.opts[i].why)); }
        });
        return { ok: !wrong, say: wrong ? '✗ ' + (slots.length - wrong) + ' of ' + slots.length + ' right' : '✓ Every choice scores', whyHTML: whys.join('<br>') };
      },
      clear: function () { slots.forEach(function (s) { if (s.el.classList.contains('is-wrong')) s.el.classList.remove('is-wrong'); s.el.classList.remove('is-right'); }); },
      lock: function (b) { slots.forEach(function (s) { s.el.disabled = b; }); },
      showAnswer: function () { slots.forEach(function (s) { s.el.value = '0'; s.el.classList.remove('is-wrong'); s.el.classList.add('is-right'); s.el.disabled = true; }); }
    });
    return sh.card;
  }

  /* ============================================================
     build — tap the pieces into the answer line, in order. Some pieces score nothing
     and must be left out. item.chunks (in the right order), item.extra (the waste),
     item.orders (other right orders, as index lists; optional).
     ============================================================ */
  function build(item, ctx) {
    var sh = shell(item);
    var pieces = item.chunks.map(function (t, i) { return { t: t, i: i }; })
      .concat((item.extra || []).map(function (t, j) { return { t: t, i: 100 + j }; }));
    var answer = h('div', 'line'); answer.setAttribute('aria-label', 'Your answer');
    var ph = h('span', 'line__ph', 'Tap the pieces in the order you would write them.');
    answer.appendChild(ph);
    var pool = h('div', 'pool');
    var locked = false, placed = [];
    var tiles = {};
    mixed(pieces.length, item.id).forEach(function (k) {
      var p = pieces[k];
      var b = h('button', 'tile', T.esc(T.plain(p.t))); b.type = 'button';
      b.dataset.i = p.i;
      b.addEventListener('click', function () {
        if (locked) return;
        var at = placed.indexOf(p.i);
        if (at >= 0) { placed.splice(at, 1); pool.appendChild(b); }
        else { placed.push(p.i); answer.appendChild(b); }
        ph.hidden = placed.length > 0;
        answer.classList.remove('is-right', 'is-wrong');
      });
      tiles[p.i] = b;
      pool.appendChild(b);
    });
    sh.body.appendChild(answer);
    sh.body.appendChild(h('p', 'hint', 'Tap a piece again to take it back.'));
    sh.body.appendChild(pool);
    var right = [item.chunks.map(function (_, i) { return i; })].concat(item.orders || []);
    foot(sh.card, item, ctx, {
      wholeAnswer: true,
      incomplete: 'Tap some pieces into the answer line first.',
      check: function () {
        if (!placed.length) return null;
        var got = placed.join(',');
        var ok = right.some(function (o) { return o.join(',') === got; });
        answer.classList.add(ok ? 'is-right' : 'is-wrong');
        var extra = placed.filter(function (i) { return i >= 100; }).length;
        var why = '';
        if (!ok && extra) why = 'Something in your line scores no mark. Every piece you write must earn its place.';
        else if (!ok && placed.length < item.chunks.length) why = 'A piece that carries a mark is still in the pool.';
        else if (!ok) why = 'The right pieces, in an order an examiner would not follow. Read it aloud: what happens first?';
        return { ok: ok, why: why };
      },
      clear: function () { answer.classList.remove('is-right', 'is-wrong'); },
      lock: function (b) { locked = b; },
      showAnswer: function () {
        placed.slice().forEach(function (i) { pool.appendChild(tiles[i]); });
        placed = item.chunks.map(function (_, i) { return i; });
        placed.forEach(function (i) { answer.appendChild(tiles[i]); });
        ph.hidden = true; locked = true; answer.classList.add('is-right');
      }
    });
    return sh.card;
  }

  /* ============================================================
     fix — a weak answer with its weak words underlined. Tap one, choose the word that scores.
     item.text: "The {food} {goes} into the blood."   item.flaws: [{ fix, opts:[…], why }] in order.
     Set item.find to make the student FIND the weak words first (no underlines).
     ============================================================ */
  function fix(item, ctx) {
    var sh = shell(item);
    var line = h('p', 'sent sent--fix');
    var flaws = [], n = 0;
    var re = /\{([^{}:]+)\}/g, last = 0, m, text = item.text;
    function words(str) {
      str.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        if (/^\s+$/.test(w)) { line.appendChild(document.createTextNode(w)); return; }
        var s = h('span', item.find ? 'w w--any' : 'w', T.esc(w));
        if (item.find) { s.tabIndex = 0; s.setAttribute('role', 'button'); s.addEventListener('click', function () { toggleSuspect(s, null); }); }
        line.appendChild(s);
      });
    }
    var found = {};
    function toggleSuspect(el, fl) {
      if (lockedAll || phase !== 'find') return;
      el.classList.toggle('is-suspect');
      if (fl) found[fl.k] = el.classList.contains('is-suspect');
      else el.dataset.miss = el.classList.contains('is-suspect') ? '1' : '';
    }
    while ((m = re.exec(text))) {
      words(text.slice(last, m.index));
      var fl = item.flaws[n];
      var el = h('button', 'flaw' + (item.find ? ' flaw--hidden' : ''), '<span class="flaw__was">' + T.esc(m[1]) + '</span><span class="flaw__now"></span>');
      el.type = 'button';
      var rec = { k: n, el: el, was: m[1], fl: fl, val: null };
      (function (rec) {
        el.addEventListener('click', function () {
          if (lockedAll) return;
          if (item.find && phase === 'find') { toggleSuspect(el, rec); return; }
          openPicker(rec);
        });
      })(rec);
      flaws.push(rec); line.appendChild(el);
      last = re.lastIndex; n++;
    }
    words(text.slice(last));
    sh.body.appendChild(line);
    var picker = h('div', 'picker'); picker.hidden = true;
    sh.body.appendChild(picker);
    var phase = item.find ? 'find' : 'fix', lockedAll = false;
    var tip = h('p', 'hint', item.find ? 'Tap every word that would not score. Then press Check.' : 'Tap an underlined word, then choose the word that scores.');
    if (item.find || !item.task) sh.body.insertBefore(tip, line);

    function openPicker(rec) {
      if (phase !== 'fix') return;
      picker.innerHTML = '';
      picker.hidden = false;
      picker.appendChild(h('p', 'picker__q', 'Replace <b>' + T.esc(rec.was) + '</b> with:'));
      var row = h('div', 'picker__row');
      mixed(rec.fl.opts.length, item.id + ':' + rec.k).forEach(function (i) {
        var o = rec.fl.opts[i];
        var b = btn(T.esc(o), 'chip'); if (rec.val === i) b.classList.add('is-on');
        b.addEventListener('click', function () {
          rec.val = i; rec.el.classList.add('is-set'); rec.el.classList.remove('is-right', 'is-wrong');
          rec.el.querySelector('.flaw__now').textContent = o;
          picker.hidden = true;
        });
        row.appendChild(b);
      });
      picker.appendChild(row);
    }
    var api = {
      incomplete: item.find ? 'Tap the words you would change first.' : 'Choose a replacement for every underlined word first.',
      check: function () {
        if (phase === 'find') {
          var any = flaws.some(function (r) { return found[r.k]; }) || line.querySelector('[data-miss="1"]');
          if (!any) return null;
          var missed = flaws.filter(function (r) { return !found[r.k]; }).length;
          var false_ = line.querySelectorAll('[data-miss="1"]').length;
          var ok = !missed && !false_;
          if (ok) {
            /* found them all: now they become fixable */
            phase = 'fix';
            flaws.forEach(function (r) { r.el.classList.remove('flaw--hidden', 'is-suspect'); });
            tip.textContent = 'You found them. Now tap each one and choose the word that scores.';
            return { ok: true, partial: true, say: '✓ You found every weak word', why: 'Now replace each one.' };
          }
          return { ok: false, say: '✗ Not yet', why: missed && false_ ? 'Some weak words are still unmarked, and something you marked is fine as it is.' : missed ? 'There are still weak words you have not marked.' : 'You marked a word that is fine as it is.' };
        }
        if (flaws.some(function (r) { return r.val == null; })) return null;
        var wrong = 0, whys = [];
        flaws.forEach(function (r) {
          var ok = r.fl.opts[r.val] === r.fl.fix;
          r.el.classList.add(ok ? 'is-right' : 'is-wrong');
          if (!ok) wrong++;
          if (r.fl.why) whys.push('<b>' + T.esc(r.was) + '</b> → <b>' + T.esc(r.fl.fix) + '</b>: ' + T.esc(r.fl.why));
        });
        return { ok: !wrong, say: wrong ? '✗ ' + (flaws.length - wrong) + ' of ' + flaws.length + ' right' : '✓ Every word now scores', whyHTML: wrong ? '' : whys.join('<br>') };
      },
      clear: function () { flaws.forEach(function (r) { if (r.el.classList.contains('is-wrong')) { r.el.classList.remove('is-wrong'); } r.el.classList.remove('is-right'); }); },
      lock: function (b) { lockedAll = b; },
      showAnswer: function () {
        phase = 'fix';
        flaws.forEach(function (r) { r.el.classList.remove('flaw--hidden', 'is-suspect', 'is-wrong'); r.el.classList.add('is-set', 'is-right'); r.el.querySelector('.flaw__now').textContent = r.fl.fix; });
        lockedAll = true;
      }
    };
    /* the find step passes straight into the fix step without a Try again */
    var f = foot(sh.card, item, ctx, api);
    sh.card.addEventListener('click', function (e) {
      if (phase === 'fix' && item.find && sh.card.classList.contains('is-right') && !flaws.every(function (r) { return r.val != null; })) {
        sh.card.classList.remove('is-right');
        var bar = f.bar; bar.querySelectorAll('button').forEach(function (b) { b.hidden = true; });
        bar.querySelector('.btn--go').hidden = false;
        lockedAll = false;
        sh.card.querySelector('.verdict').textContent = '';
        sh.card.querySelector('.feedback').hidden = true;
      }
    }, true);
    return sh.card;
  }

  /* ============================================================
     trim — strike out every piece that scores no mark. Keep every piece that does.
     item.chunks: [{ t, x:true (waste), why }]
     ============================================================ */
  function trim(item, ctx) {
    var sh = shell(item);
    var line = h('p', 'sent sent--trim');
    var els = [], locked = false;
    var counter = h('p', 'counter');
    function count() {
      var w = 0; els.forEach(function (e) { if (!e.el.classList.contains('is-cut')) w += T.words(e.c.t); });
      var all = 0; item.chunks.forEach(function (c) { all += T.words(c.t); });
      counter.innerHTML = '<b>' + w + '</b> of ' + all + ' words left';
    }
    item.chunks.forEach(function (c, i) {
      var b = h('button', 'cut', T.esc(T.plain(c.t))); b.type = 'button';
      b.addEventListener('click', function () { if (locked) return; b.classList.toggle('is-cut'); line.classList.remove('is-right', 'is-wrong'); count(); });
      els.push({ el: b, c: c });
      line.appendChild(b); line.appendChild(document.createTextNode(' '));
    });
    sh.body.appendChild(h('p', 'hint', 'Tap a piece to strike it out. Tap again to bring it back.'));
    sh.body.appendChild(line);
    sh.body.appendChild(counter); count();
    foot(sh.card, item, ctx, {
      wholeAnswer: true,
      incomplete: 'Strike out at least one piece first.',
      check: function () {
        if (!els.some(function (e) { return e.el.classList.contains('is-cut'); })) return null;
        var lostMark = els.some(function (e) { return !e.c.x && e.el.classList.contains('is-cut'); });
        var keptWaste = els.some(function (e) { return e.c.x && !e.el.classList.contains('is-cut'); });
        var ok = !lostMark && !keptWaste;
        line.classList.add(ok ? 'is-right' : 'is-wrong');
        var why = ok ? els.filter(function (e) { return e.c.x && e.c.why; }).map(function (e) { return '<s>' + T.esc(T.plain(e.c.t)) + '</s> — ' + T.esc(e.c.why); }).join('<br>') :
          lostMark && keptWaste ? 'You struck out a piece that earns a mark, and kept a piece that does not.' :
          lostMark ? 'You struck out a piece that earns a mark. Bring it back.' : 'Something that scores nothing is still there.';
        return ok ? { ok: ok, whyHTML: why } : { ok: ok, why: why };
      },
      clear: function () { line.classList.remove('is-right', 'is-wrong'); },
      lock: function (b) { locked = b; },
      showAnswer: function () { els.forEach(function (e) { e.el.classList.toggle('is-cut', !!e.c.x); }); count(); locked = true; line.classList.add('is-right'); }
    });
    return sh.card;
  }

  /* ============================================================
     order — put the steps in the order an examiner reads them. ↑ ↓ buttons (keyboard too).
     item.steps in the right order.
     ============================================================ */
  function order(item, ctx) {
    var sh = shell(item);
    var list = h('ol', 'olist');
    var right = item.steps.map(function (_, i) { return i; });
    var cur = mixed(item.steps.length, item.id, right);
    var locked = false;
    function draw() {
      list.innerHTML = '';
      cur.forEach(function (i, pos) {
        var li = h('li', 'orow');
        li.appendChild(h('span', 'orow__t', T.esc(T.plain(item.steps[i]))));
        var up = btn('↑', 'mv'), dn = btn('↓', 'mv');
        up.setAttribute('aria-label', 'Move up'); dn.setAttribute('aria-label', 'Move down');
        up.disabled = pos === 0 || locked; dn.disabled = pos === cur.length - 1 || locked;
        up.addEventListener('click', function () { if (pos > 0) { var t = cur[pos - 1]; cur[pos - 1] = cur[pos]; cur[pos] = t; list.classList.remove('is-right', 'is-wrong'); draw(); list.children[pos - 1].querySelector('.mv').focus(); } });
        dn.addEventListener('click', function () { if (pos < cur.length - 1) { var t = cur[pos + 1]; cur[pos + 1] = cur[pos]; cur[pos] = t; list.classList.remove('is-right', 'is-wrong'); draw(); list.children[pos + 1].querySelectorAll('.mv')[1].focus(); } });
        var ctl = h('span', 'orow__ctl'); ctl.appendChild(up); ctl.appendChild(dn);
        li.appendChild(ctl);
        list.appendChild(li);
      });
    }
    draw();
    sh.body.appendChild(list);
    foot(sh.card, item, ctx, {
      wholeAnswer: true,
      check: function () { var ok = cur.join() === right.join(); list.classList.add(ok ? 'is-right' : 'is-wrong'); return { ok: ok }; },
      clear: function () { list.classList.remove('is-right', 'is-wrong'); },
      lock: function (b) { locked = b; draw(); },
      showAnswer: function () { cur = right.slice(); locked = true; draw(); list.classList.add('is-right'); }
    });
    return sh.card;
  }

  /* ============================================================
     gap — type the keyword into the sentence. Each gap is its own answer.
     item.text: "Water moves by {{osmosis}} through a {{partially permeable|selectively permeable}} membrane."
     ============================================================ */
  function parseGaps(text) {
    var parts = [], re = /\{\{([^}]+)\}\}/g, last = 0, m;
    while ((m = re.exec(text))) { parts.push({ s: text.slice(last, m.index) }); parts.push({ acc: m[1].split('|').map(function (x) { return x.trim(); }) }); last = re.lastIndex; }
    parts.push({ s: text.slice(last) });
    return parts;
  }
  function gap(item, ctx) {
    var sh = shell(item);
    var line = h('p', 'sent sent--gap');
    var gaps = [];
    parseGaps(item.text).forEach(function (p) {
      if (p.s != null) { line.appendChild(h('span', '', T.tags(p.s))); return; }
      var wrap = h('span', 'gapw');
      var inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'gap'; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('aria-label', 'Gap ' + (gaps.length + 1));
      inp.size = Math.max(6, Math.min(26, p.acc[0].length + 2));
      var hb = btn('?', 'hintbtn'); hb.setAttribute('aria-label', 'Show the first letter');
      var g = { el: inp, acc: p.acc, hint: 0 };
      hb.addEventListener('click', function () {
        g.hint = Math.min(g.hint + 1, p.acc[0].length);
        inp.placeholder = p.acc[0].slice(0, g.hint) + '…';
        inp.focus();
      });
      inp.addEventListener('input', function () { inp.classList.remove('is-right', 'is-wrong'); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var c = sh.card.querySelector('.card__foot .btn--go:not([hidden])'); if (c) c.click(); } });
      wrap.appendChild(inp); wrap.appendChild(hb);
      gaps.push(g); line.appendChild(wrap);
    });
    sh.body.appendChild(line);
    foot(sh.card, item, ctx, {
      incomplete: 'Fill every gap first.',
      focus: function () { var w = gaps.filter(function (g) { return g.el.classList.contains('is-wrong'); })[0] || gaps[0]; if (w) w.el.focus(); },
      check: function () {
        if (gaps.some(function (g) { return !g.el.value.trim(); })) return null;
        var wrong = 0, near = [];
        gaps.forEach(function (g) {
          var r = T.match(g.el.value, g.acc);
          g.el.classList.add(r.ok ? 'is-right' : 'is-wrong');
          if (!r.ok) wrong++;
          else if (r.near) near.push('“' + T.esc(g.el.value.trim()) + '” is accepted, but check the spelling: <b>' + T.esc(g.acc[0]) + '</b>.');
          else { var cn = T.caseNote(g.el.value, g.acc); if (cn) near.push(cn); }
        });
        return { ok: !wrong, say: wrong ? '✗ ' + (gaps.length - wrong) + ' of ' + gaps.length + ' right' : '✓ Correct', whyHTML: wrong ? '' : near.join('<br>') + (near.length && item.why ? '<br>' : '') + (item.why ? T.tags(item.why) : '') };
      },
      clear: function () { gaps.forEach(function (g) { g.el.classList.remove('is-right'); }); },
      lock: function (b) { gaps.forEach(function (g) { g.el.readOnly = b; }); },
      showAnswer: function () { gaps.forEach(function (g) { g.el.value = g.acc[0]; g.el.classList.remove('is-wrong'); g.el.classList.add('is-right'); g.el.readOnly = true; }); }
    });
    return sh.card;
  }

  /* ============================================================
     sort — put each piece in its group. Marked as one whole answer.
     item.bins: ["…", "…"], item.items: [{ t, b }]
     ============================================================ */
  function sort(item, ctx) {
    var sh = shell(item);
    var rows = h('div', 'srows'), locked = false, picks = [];
    mixed(item.items.length, item.id).forEach(function (i) {
      var it = item.items[i];
      var row = h('div', 'srow');
      row.appendChild(h('p', 'srow__t', T.esc(T.plain(it.t))));
      var seg = h('div', 'seg'); seg.setAttribute('role', 'group');
      var rec = { i: i, v: -1, btns: [] };
      item.bins.forEach(function (b, k) {
        var x = btn(T.esc(b), 'seg__b'); x.setAttribute('aria-pressed', 'false');
        x.addEventListener('click', function () {
          if (locked) return;
          rec.v = k; rec.btns.forEach(function (y, j) { y.classList.toggle('is-on', j === k); y.setAttribute('aria-pressed', j === k ? 'true' : 'false'); });
          rows.classList.remove('is-right', 'is-wrong');
        });
        rec.btns.push(x); seg.appendChild(x);
      });
      row.appendChild(seg); rows.appendChild(row); picks.push(rec);
    });
    sh.body.appendChild(rows);
    foot(sh.card, item, ctx, {
      wholeAnswer: true,
      incomplete: 'Put every piece in a group first.',
      check: function () {
        if (picks.some(function (p) { return p.v < 0; })) return null;
        var ok = picks.every(function (p) { return p.v === item.items[p.i].b; });
        rows.classList.add(ok ? 'is-right' : 'is-wrong');
        return { ok: ok };
      },
      clear: function () { rows.classList.remove('is-right', 'is-wrong'); },
      lock: function (b) { locked = b; },
      showAnswer: function () { picks.forEach(function (p) { var k = item.items[p.i].b; p.v = k; p.btns.forEach(function (y, j) { y.classList.toggle('is-on', j === k); }); }); locked = true; rows.classList.add('is-right'); }
    });
    return sh.card;
  }

  /* ============================================================
     mark — be the examiner. A student's answer and the mark scheme: tick the points it earns.
     item.answer (the student's words), item.scheme: [{ t, got:true|false, why }]
     ============================================================ */
  function mark(item, ctx) {
    var sh = shell(item);
    sh.body.appendChild(h('div', 'script', '<span class="script__tag">A student wrote</span><p>' + T.esc(item.answer) + '</p>'));
    sh.body.appendChild(h('p', 'hint', 'Tick each point of the mark scheme this answer earns. Leave the others.'));
    var list = h('ul', 'scheme'), boxes = [], locked = false;
    item.scheme.forEach(function (p, i) {
      var li = h('li', 'scheme__p');
      var id = 'mk_' + String(item.id).replace(/\W/g, '_') + '_' + i;
      li.innerHTML = '<input type="checkbox" id="' + id + '"><label for="' + id + '">' + T.tags(p.t) + '</label>';
      var cb = li.querySelector('input');
      cb.addEventListener('change', function () { list.classList.remove('is-right', 'is-wrong'); });
      boxes.push({ cb: cb, p: p, li: li });
      list.appendChild(li);
    });
    sh.body.appendChild(list);
    var total = h('p', 'counter');
    function sum() { var n = boxes.filter(function (b) { return b.cb.checked; }).length; total.innerHTML = 'You award <b>' + n + '</b> mark' + (n === 1 ? '' : 's'); }
    boxes.forEach(function (b) { b.cb.addEventListener('change', sum); }); sum();
    sh.body.appendChild(total);
    foot(sh.card, item, ctx, {
      wholeAnswer: true,
      check: function () {
        var ok = boxes.every(function (b) { return b.cb.checked === !!b.p.got; });
        list.classList.add(ok ? 'is-right' : 'is-wrong');
        var got = boxes.filter(function (b) { return b.p.got; }).length;
        var why = ok ? boxes.map(function (b) { return (b.p.got ? '✓ ' : '✗ ') + T.esc(T.plain(b.p.t)) + (b.p.why ? ' — ' + T.esc(b.p.why) : ''); }).join('<br>') :
          'An examiner would give a different total. Read each point again: is the idea really in the student’s words?';
        return ok ? { ok: ok, say: '✓ Right: ' + got + ' mark' + (got === 1 ? '' : 's'), whyHTML: why }
                  : { ok: ok, say: '✗ Not the examiner’s mark', why: why };
      },
      clear: function () { list.classList.remove('is-right', 'is-wrong'); },
      lock: function (b) { locked = b; boxes.forEach(function (x) { x.cb.disabled = b; }); },
      showAnswer: function () { boxes.forEach(function (b) { b.cb.checked = !!b.p.got; b.cb.disabled = true; }); sum(); list.classList.add('is-right'); }
    });
    return sh.card;
  }

  /* ============================================================
     kw — one keyword question: a definition, a situation, or an exam sentence with a gap.
     item.prompt, item.key (the keyword), item.accept, item.opts (for choose), item.input
     ============================================================ */
  function kw(item, ctx) {
    if (!item.task) item = Object.assign({}, item, { task: item.input === 'choose' ? 'Which keyword is this?' : 'Write the keyword.' });
    var sh = shell(item);
    var p = h('p', 'kw__prompt', T.tags(item.prompt));
    sh.body.appendChild(p);
    var api;
    if (item.input === 'choose') {
      var chosen = -1, locked = false, bs = [];
      var row = h('div', 'kw__opts');
      mixed(item.opts.length, item.id).forEach(function (i) {
        var b = btn(T.esc(item.opts[i]), 'kwopt'); b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { if (locked) return; chosen = i; bs.forEach(function (x) { x.b.classList.toggle('is-on', x.i === i); x.b.setAttribute('aria-pressed', x.i === i ? 'true' : 'false'); }); });
        bs.push({ b: b, i: i }); row.appendChild(b);
      });
      sh.body.appendChild(row);
      api = {
        incomplete: 'Choose one keyword first.',
        check: function () {
          if (chosen < 0) return null;
          var ok = T.norm(item.opts[chosen]) === T.norm(item.key);
          bs.forEach(function (x) { if (x.i === chosen) x.b.classList.add(ok ? 'is-right' : 'is-wrong'); });
          return ok ? { ok: ok, whyHTML: keyCard(item) }
                    : { ok: ok, why: (item.near && item.near[item.opts[chosen]]) || '' };
        },
        clear: function () { bs.forEach(function (x) { x.b.classList.remove('is-right', 'is-wrong', 'is-on'); }); chosen = -1; },
        lock: function (b) { locked = b; },
        showAnswer: function () { bs.forEach(function (x) { x.b.classList.remove('is-wrong', 'is-on'); if (T.norm(item.opts[x.i]) === T.norm(item.key)) x.b.classList.add('is-right'); }); locked = true; }
      };
    } else {
      var wrap = h('div', 'kw__type');
      var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'gap gap--wide'; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('aria-label', 'The keyword');
      inp.placeholder = 'type the keyword';
      var hb = btn('First letter', 'btn--quiet hintbtn--wide'), hint = 0;
      hb.addEventListener('click', function () { hint = Math.min(hint + 1, item.key.length); inp.placeholder = item.key.slice(0, hint) + '…'; inp.focus(); });
      inp.addEventListener('input', function () { inp.classList.remove('is-right', 'is-wrong'); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var c = sh.card.querySelector('.card__foot .btn--go:not([hidden])'); if (c) c.click(); } });
      wrap.appendChild(inp); wrap.appendChild(hb);
      sh.body.appendChild(wrap);
      api = {
        incomplete: 'Type the keyword first.',
        focus: function () { inp.focus(); },
        check: function () {
          if (!inp.value.trim()) return null;
          var r = T.match(inp.value, [item.key].concat(item.accept || []));
          inp.classList.add(r.ok ? 'is-right' : 'is-wrong');
          /* right, but written with the wrong capitals: say how it is written, never refuse it */
          var cap = r.ok && !r.near ? T.caseNote(inp.value, [item.key].concat(item.accept || [])) : '';
          return { ok: r.ok, whyHTML: r.ok
            ? (r.near ? 'Accepted — check the spelling: <b>' + T.esc(item.key) + '</b>.<br>' : '') +
              (cap ? cap + '<br>' : '') + keyCard(item)
            : '' };
        },
        clear: function () {},
        lock: function (b) { inp.readOnly = b; },
        showAnswer: function () { inp.value = item.key; inp.classList.remove('is-wrong'); inp.classList.add('is-right'); inp.readOnly = true; }
      };
    }
    var f = foot(sh.card, item, ctx, api);
    /* the keyword card also appears when the answer is shown */
    sh.card.addEventListener('click', function (e) {
      if (e.target && e.target.textContent === 'Show the model answer') {
        var fb = sh.card.querySelector('.feedback'); fb.hidden = false; fb.className = 'feedback feedback--ok'; fb.innerHTML = keyCard(item);
      }
    });
    return sh.card;
  }
  function keyCard(item) {
    return '<span class="kcard"><b class="kcard__t">' + T.esc(item.full || item.key) + '</b>' + (item.def ? '<span class="kcard__d">' + T.esc(item.def) + '</span>' : '') +
      (item.ko && (global.AL_CONFIG || {}).koreanGloss !== false ? '<span class="kcard__ko" lang="ko">' + T.esc(item.ko) + '</span>' : '') + '</span>' +
      extrasHTML(item);
  }

  /* ============================================================
     exam — a real exam question, answered the way the site teaches:
       1  think: which ideas earn marks? (tick them — some score nothing)
       2  order: in what order would you write them?
       3  write: complete each sentence (the keywords are typed)
     then the finished answer, one line, one mark, against the model.
     item.ideas: [{ t, ok:true|false, why }], item.frames: ["… {{keyword}} …"] (in the right order)
     ============================================================ */
  function exam(item, ctx) {
    var sh = shell(item);
    var stepBox = h('div', 'esteps');
    var steps = ['Think', 'Order', 'Write'];
    var pills = steps.map(function (s, i) { var p = h('span', 'estep', '<b>' + (i + 1) + '</b> ' + s); stepBox.appendChild(p); return p; });
    sh.body.appendChild(stepBox);
    var stage = h('div', 'estage'); sh.body.appendChild(stage);
    var marksNeeded = item.marks || item.frames.length;
    var state = { step: 0, firstAll: true, tries: 0 };
    var goodIdx = item.ideas.map(function (x, i) { return x.ok ? i : -1; }).filter(function (i) { return i >= 0; });

    function setStep(n) { state.step = n; pills.forEach(function (p, i) { p.classList.toggle('is-on', i === n); p.classList.toggle('is-done', i < n); }); }

    var bar = h('div', 'card__foot'), bGo = btn('Check', 'btn--go'), bAgain = btn('Try again', 'btn--quiet'), bShow = btn('Show the model answer', 'btn--quiet'), bNext = btn('Next →', 'btn--go');
    bAgain.hidden = bShow.hidden = bNext.hidden = true;
    [bGo, bAgain, bShow].forEach(function (b) { bar.appendChild(b); });
    var verdict = h('p', 'verdict'); verdict.setAttribute('role', 'status');
    var fb = h('div', 'feedback'); fb.hidden = true;
    var modelHost = h('div', 'model-host');
    var after = h('div', 'card__next'); after.appendChild(bNext);
    sh.card.appendChild(bar); sh.card.appendChild(verdict); sh.card.appendChild(fb); sh.card.appendChild(modelHost); sh.card.appendChild(after);
    var cur = null;       /* the api of the step on screen */

    function say(ok, text, why) {
      verdict.className = 'verdict ' + (ok ? 'verdict--ok' : 'verdict--no'); verdict.textContent = text;
      fb.hidden = !why; fb.className = 'feedback ' + (ok ? 'feedback--ok' : 'feedback--no'); fb.innerHTML = why || '';
    }
    function quiet() { verdict.textContent = ''; verdict.className = 'verdict'; fb.hidden = true; }

    /* step 1 — think */
    function think() {
      setStep(0); stage.innerHTML = '';
      stage.appendChild(h('p', 'hint', 'This question is worth <b>' + marksNeeded + ' mark' + (marksNeeded === 1 ? '' : 's') + '</b>. Tick the ideas that would earn them. Leave out anything that scores nothing.'));
      var list = h('ul', 'ideas'), boxes = [];
      mixed(item.ideas.length, item.id + ':i').forEach(function (i) {
        var li = h('li', 'idea'), id = 'ex_' + String(item.id).replace(/\W/g, '_') + '_' + i;
        li.innerHTML = '<input type="checkbox" id="' + id + '"><label for="' + id + '">' + T.esc(T.plain(item.ideas[i].t)) + '</label>';
        boxes.push({ cb: li.querySelector('input'), i: i, li: li }); list.appendChild(li);
      });
      stage.appendChild(list);
      cur = {
        check: function () {
          var on = boxes.filter(function (b) { return b.cb.checked; });
          if (!on.length) return null;
          var ok = boxes.every(function (b) { return b.cb.checked === !!item.ideas[b.i].ok; });
          list.classList.add(ok ? 'is-right' : 'is-wrong');
          var why = '';
          if (ok) why = boxes.filter(function (b) { return !item.ideas[b.i].ok && item.ideas[b.i].why; }).map(function (b) { return '✗ ' + T.esc(T.plain(item.ideas[b.i].t)) + ' — ' + T.esc(item.ideas[b.i].why); }).join('<br>');
          else {
            var extra = on.filter(function (b) { return !item.ideas[b.i].ok; }).length, missing = goodIdx.length - on.filter(function (b) { return item.ideas[b.i].ok; }).length;
            why = extra && missing ? 'One idea you ticked scores nothing, and an idea that scores is not ticked.' : extra ? 'One of the ideas you ticked scores nothing here.' : 'An idea that earns a mark is not ticked yet.';
          }
          return { ok: ok, why: why };
        },
        clear: function () { list.classList.remove('is-right', 'is-wrong'); },
        lock: function (b) { boxes.forEach(function (x) { x.cb.disabled = b; }); },
        show: function () { boxes.forEach(function (b) { b.cb.checked = !!item.ideas[b.i].ok; b.cb.disabled = true; }); list.classList.add('is-right'); }
      };
    }
    /* step 2 — order (skipped when the answer has only one idea, or order does not matter) */
    function orderStep() {
      setStep(1); stage.innerHTML = '';
      if (item.anyOrder || item.frames.length < 2) { writeStep(); return; }
      stage.appendChild(h('p', 'hint', 'Put the ideas in the order you would write them. Cause first, then what it leads to.'));
      var right = item.frames.map(function (_, i) { return i; });
      var cur2 = mixed(item.frames.length, item.id + ':o', right), list = h('ol', 'olist'), locked = false;
      var labels = item.frames.map(function (f) { return f.replace(/\{\{([^}|]+)[^}]*\}\}/g, '$1'); });
      function draw() {
        list.innerHTML = '';
        cur2.forEach(function (i, pos) {
          var li = h('li', 'orow'); li.appendChild(h('span', 'orow__t', T.esc(T.plain(labels[i]))));
          var up = btn('↑', 'mv'), dn = btn('↓', 'mv'); up.disabled = pos === 0 || locked; dn.disabled = pos === cur2.length - 1 || locked;
          up.setAttribute('aria-label', 'Move up'); dn.setAttribute('aria-label', 'Move down');
          up.addEventListener('click', function () { var t = cur2[pos - 1]; cur2[pos - 1] = cur2[pos]; cur2[pos] = t; list.classList.remove('is-right', 'is-wrong'); draw(); });
          dn.addEventListener('click', function () { var t = cur2[pos + 1]; cur2[pos + 1] = cur2[pos]; cur2[pos] = t; list.classList.remove('is-right', 'is-wrong'); draw(); });
          var c = h('span', 'orow__ctl'); c.appendChild(up); c.appendChild(dn); li.appendChild(c); list.appendChild(li);
        });
      }
      draw(); stage.appendChild(list);
      cur = {
        check: function () { var ok = cur2.join() === right.join(); list.classList.add(ok ? 'is-right' : 'is-wrong'); return { ok: ok, why: ok ? '' : 'Not the order an examiner follows. What has to happen first for the next idea to be true?' }; },
        clear: function () { list.classList.remove('is-right', 'is-wrong'); },
        lock: function (b) { locked = b; draw(); },
        show: function () { cur2 = right.slice(); locked = true; draw(); list.classList.add('is-right'); }
      };
    }
    /* step 3 — write: each idea as a sentence, keywords typed */
    function writeStep() {
      setStep(2); stage.innerHTML = '';
      stage.appendChild(h('p', 'hint', 'Now write it. Type the missing keyword in each sentence.'));
      var gaps = [], lines = h('ol', 'wlines');
      item.frames.forEach(function (f) {
        var li = h('li', 'wline');
        parseGaps(f).forEach(function (p) {
          if (p.s != null) { li.appendChild(h('span', '', T.tags(p.s))); return; }
          var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'gap'; inp.autocomplete = 'off'; inp.spellcheck = false;
          inp.setAttribute('autocapitalize', 'off'); inp.size = Math.max(6, Math.min(24, p.acc[0].length + 2));
          inp.addEventListener('input', function () { inp.classList.remove('is-right', 'is-wrong'); });
          gaps.push({ el: inp, acc: p.acc }); li.appendChild(inp);
        });
        lines.appendChild(li);
      });
      stage.appendChild(lines);
      cur = {
        check: function () {
          if (gaps.some(function (g) { return !g.el.value.trim(); })) return null;
          var wrong = 0;
          gaps.forEach(function (g) { var r = T.match(g.el.value, g.acc); g.el.classList.add(r.ok ? 'is-right' : 'is-wrong'); if (!r.ok) wrong++; });
          return { ok: !wrong, say: wrong ? '✗ ' + (gaps.length - wrong) + ' of ' + gaps.length + ' keywords right' : '✓ Full marks', why: '' };
        },
        clear: function () { gaps.forEach(function (g) { g.el.classList.remove('is-right'); }); },
        lock: function (b) { gaps.forEach(function (g) { g.el.readOnly = b; }); },
        show: function () { gaps.forEach(function (g) { g.el.value = g.acc[0]; g.el.classList.remove('is-wrong'); g.el.classList.add('is-right'); g.el.readOnly = true; }); }
      };
    }

    var nextStep = [orderStep, writeStep, null];
    /* One button, two jobs: "Check" marks the step on screen; after a right step it becomes
       "Next step →" and only moves on. Never both on one press. */
    var mode = 'check';
    function advanceMode() { mode = 'advance'; bGo.textContent = 'Next step →'; bGo.hidden = false; }
    bGo.addEventListener('click', function () {
      if (mode === 'advance') { mode = 'check'; bGo.textContent = 'Check'; quiet(); nextStep[state.step](); return; }
      var r = cur.check();
      if (!r) { verdict.className = 'verdict verdict--wait'; verdict.textContent = 'Finish this step first.'; return; }
      state.tries++;
      cur.lock(true);
      if (!r.ok) { state.firstAll = false; say(false, r.say || '✗ Not yet', r.why); bGo.hidden = true; bAgain.hidden = false; bShow.hidden = false; return; }
      say(true, r.say || '✓ Right', r.why);
      if (state.step < 2) { advanceMode(); return; }
      done();
    });
    bAgain.addEventListener('click', function () { cur.clear(); cur.lock(false); quiet(); bAgain.hidden = true; bShow.hidden = true; bGo.hidden = false; bGo.textContent = 'Check'; mode = 'check'; });
    bShow.addEventListener('click', function () {
      state.shown = true;
      cur.show(); bShow.hidden = true; bAgain.hidden = true;
      if (state.step < 2) advanceMode();
      else done();
    });
    function done() {
      bGo.hidden = true; bAgain.hidden = true; bShow.hidden = true;
      var m = modelBlock(item); if (m && !modelHost.firstChild) modelHost.appendChild(m);
      bNext.hidden = !ctx.onNext;
      if (ctx.onResult) ctx.onResult({ ok: !state.shown, first: state.firstAll && !state.shown, shown: !!state.shown });
    }
    bNext.addEventListener('click', function () { if (ctx.onNext) ctx.onNext(); });
    think();
    return sh.card;
  }

  var MAKERS = { learn: learn, pick: pick, choose: choose, build: build, fix: fix, trim: trim, order: order, gap: gap, sort: sort, mark: mark, kw: kw, exam: exam };
  function render(item, ctx) {
    var mk = MAKERS[item.type];
    if (!mk) { var e = h('article', 'card', '<p>Unknown question type: ' + T.esc(item.type) + '</p>'); return e; }
    return mk(item, ctx || {});
  }
  global.AEngine = { render: render, KIND: KIND, modelBlock: modelBlock, legend: legend, parseChoices: parseChoices, parseGaps: parseGaps };
})(window);
