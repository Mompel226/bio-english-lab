/* ============================================================
   tools/selftest.js — the marking gate for this site, run in a real browser.

   Every question in every set is drawn, answered RIGHT, and must say "correct"; drawn again,
   answered WRONG, and must NOT say "correct". Nothing here is shipped: _selftest.html (which
   the .gitignore keeps out of the repo) loads the site's own scripts and then this file.

     python3 -m http.server 8799 --bind 127.0.0.1   (from the Biology Hub folder)
     open http://127.0.0.1:8799/labs/bio-english-lab/_selftest.html
     or: node tools/selftest-run.mjs  (headless Chrome, prints the result, exits 1 on failure)

   The page writes its verdict into <pre id="out">, and window.SELFTEST = { ok, fails, n }.
   ============================================================ */
(function () {
  'use strict';
  var AL = window.AL, E = window.AEngine, T = window.AText;
  T.know(AL.meta.known || []);
  function open(id) {
    var key = AL.k, bin = atob(AL.sets[id]), out = '';
    for (var i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    return JSON.parse(decodeURIComponent(escape(out)));
  }
  var host = document.getElementById('host');
  function $(c, s) { return c.querySelector(s); }
  function $$(c, s) { return Array.prototype.slice.call(c.querySelectorAll(s)); }
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function check(card) { var b = $$(card, '.card__foot .btn--go').filter(function (x) { return !x.hidden; })[0]; if (b) b.click(); }
  function verdict(card) { var v = $(card, '.verdict'); return v ? txt(v) : ''; }
  function draw(item, results) {
    host.innerHTML = '';
    var card = E.render(item, { onResult: function (r) { results.push(r); }, onNext: function () {} });
    host.appendChild(card);
    return card;
  }
  function setInput(el, v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
  function plain(s) { return T.plain(s).replace(/\s+/g, ' ').trim(); }

  /* answer an item right (good=true) or wrong (good=false). Returns false when the item
     type cannot be answered wrongly in a meaningful way. */
  var ANSWER = {
    pick: function (item, card, good) {
      var want = item.options.filter(function (o) { return !!o.ok === good; })[0];
      var b = $$(card, '.opt').filter(function (x) { return txt(x) === plain(want.t); })[0];
      b.click(); check(card);
    },
    choose: function (item, card, good) {
      $$(card, 'select.slot').forEach(function (s, i) {
        var val = good ? '0' : (i === 0 ? '1' : '0');
        s.value = val; s.dispatchEvent(new Event('change', { bubbles: true }));
      });
      check(card);
    },
    build: function (item, card, good) {
      var tiles = $$(card, '.tile');
      var seq = good ? item.chunks.slice() : item.chunks.slice().reverse();
      if (!good && item.extra && item.extra.length) seq = item.chunks.concat([item.extra[0]]);
      seq.forEach(function (t) { var b = tiles.filter(function (x) { return txt(x) === plain(t); })[0]; b.click(); });
      check(card);
    },
    fix: function (item, card, good) {
      if (item.find) {
        $$(card, '.flaw').forEach(function (f) { f.click(); });
        check(card);
      }
      $$(card, '.flaw').forEach(function (f, i) {
        f.click();
        var fl = item.flaws[i];
        var want = good ? fl.fix : fl.opts.filter(function (o) { return o !== fl.fix; })[0];
        var chip = $$(card, '.picker .chip').filter(function (c) { return txt(c) === want; })[0];
        chip.click();
      });
      check(card);
    },
    trim: function (item, card, good) {
      var cuts = $$(card, '.cut');
      item.chunks.forEach(function (c, i) { if (good ? c.x : !c.x) cuts[i].click(); });
      check(card);
    },
    order: function (item, card, good) {
      /* bubble each row into place with the ↑ buttons */
      var target = item.steps.map(plain);
      if (!good) target = target.slice().reverse();
      for (var pass = 0; pass < 40; pass++) {
        var rows = $$(card, '.orow');
        var cur = rows.map(function (r) { return txt($(r, '.orow__t')); });
        var done = true;
        for (var i = 1; i < cur.length; i++) {
          if (target.indexOf(cur[i]) < target.indexOf(cur[i - 1])) { $$(rows[i], '.mv')[0].click(); done = false; break; }
        }
        if (done) break;
      }
      check(card);
    },
    gap: function (item, card, good) {
      var acc = []; item.text.replace(/\{\{([^}]+)\}\}/g, function (_, a) { acc.push(a.split('|')[0].trim()); return ''; });
      $$(card, 'input.gap').forEach(function (inp, i) { setInput(inp, good ? acc[i] : 'zzqx'); });
      check(card);
    },
    sort: function (item, card, good) {
      $$(card, '.srow').forEach(function (row) {
        var t = txt($(row, '.srow__t'));
        var it = item.items.filter(function (x) { return plain(x.t) === t; })[0];
        var k = good ? it.b : (it.b + 1) % item.bins.length;
        $$(row, '.seg__b')[k].click();
      });
      check(card);
    },
    mark: function (item, card, good) {
      $$(card, '.scheme__p input').forEach(function (cb, i) { cb.checked = good ? !!item.scheme[i].got : !item.scheme[i].got; cb.dispatchEvent(new Event('change', { bubbles: true })); });
      check(card);
    },
    kw: function (item, card, good) {
      if (item.input === 'choose') {
        var want = good ? item.key : item.opts.filter(function (o) { return T.norm(o) !== T.norm(item.key); })[0];
        var b = $$(card, '.kwopt').filter(function (x) { return txt(x) === want; })[0];
        b.click();
      } else {
        setInput($(card, 'input.gap'), good ? item.key : 'zzqx');
      }
      check(card);
    },
    exam: function (item, card, good) {
      /* think */
      $$(card, '.idea').forEach(function (li) {
        var t = txt($(li, 'label'));
        var idea = item.ideas.filter(function (x) { return plain(x.t) === t; })[0];
        $(li, 'input').checked = good ? !!idea.ok : !idea.ok;
      });
      check(card);
      if (!good) return;
      var go = function () { var b = $$(card, '.card__foot .btn--go').filter(function (x) { return !x.hidden; })[0]; if (b) b.click(); };
      /* next step → order (if shown) */
      go();
      if ($(card, '.olist')) { ANSWER.order({ steps: item.frames.map(function (f) { return f.replace(/\{\{([^}|]+)[^}]*\}\}/g, '$1'); }) }, card, true); go(); }
      /* write */
      var acc = []; item.frames.join(' ').replace(/\{\{([^}]+)\}\}/g, function (_, a) { acc.push(a.split('|')[0].trim()); return ''; });
      $$(card, 'input.gap').forEach(function (inp, i) { setInput(inp, acc[i]); });
      check(card);
    }
  };

  var n = 0, fails = [], log = [];
  Object.keys(AL.sets).forEach(function (sid) {
    var set = open(sid);
    set.items.forEach(function (item) {
      if (item.type === 'learn') return;
      n++;
      var where = sid + ' · ' + item.id + ' (' + item.type + ')';
      try {
        var res = [], card = draw(item, res);
        ANSWER[item.type](item, card, true);
        var v = verdict(card);
        var right = res.length && res[res.length - 1].ok;
        if (!right) fails.push(where + ': right answer NOT accepted — "' + v + '"');
        res = []; card = draw(item, res);
        ANSWER[item.type](item, card, false);
        var v2 = verdict(card);
        var wrongOk = res.length && res[res.length - 1].ok;
        if (wrongOk) fails.push(where + ': WRONG answer accepted — "' + v2 + '"');
        if (!res.length && !/Not yet|right|examiner|Not the/.test(v2)) fails.push(where + ': wrong answer gave no verdict — "' + v2 + '"');
      } catch (e) { fails.push(where + ': ' + (e && e.message || e)); }
    });
  });
  host.innerHTML = '';
  window.SELFTEST = { ok: !fails.length, n: n, fails: fails };
  document.getElementById('out').textContent = (fails.length ? '✗ ' + fails.length + ' of ' + n + ' questions fail:\n  ' + fails.join('\n  ') : '✓ all ' + n + ' questions mark right answers right and wrong answers wrong');
  document.title = fails.length ? 'SELFTEST FAIL' : 'SELFTEST OK';
})();
