/* ============================================================
   app.js — the pages, the progress, the sign-in.

   Pages (the address after # says which):
     #/            the front: why short answers score, the three methods, the topics
     #/y10         the front, open at one year group
     #/u/t7        one topic: its Keywords, Describe, Explain and Plan sets
     #/s/<set>     one set, question by question (#/s/<set>/4 opens question 4)
     #/hw/<id>     one piece of homework, for a signed-in student

   Progress lives in this browser under bio-english-lab.v1, keyed by each question's own
   fingerprint, so changing a question's wording resets that one question and nothing else.
   A signed-in student's progress is also sent to the teacher's spreadsheet (when the site
   has one — AL_CONFIG.submitUrl), which is what lets homework be set and checked.
   ============================================================ */
(function () {
  'use strict';
  var T = window.AText, E = window.AEngine, CFG = window.AL_CONFIG || {};
  var AL = window.AL || { meta: { years: [], units: {}, sets: {} }, sets: {} };
  var META = AL.meta;
  var main = document.getElementById('main');
  var STORE = 'bio-english-lab.v1';

  /* every keyword the site knows: a typed answer that lands on one of these is never
     forgiven as a spelling slip of another */
  T.know(META.known || []);

  /* ---------- the scrambled sets, opened only when needed ---------- */
  var opened = {};
  function openSet(id) {
    if (opened[id]) return opened[id];
    var raw = AL.sets[id];
    if (!raw) return null;
    try {
      var key = AL.k || '', bin = atob(raw), out = '';
      for (var i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      opened[id] = JSON.parse(decodeURIComponent(escape(out)));
    } catch (e) { opened[id] = null; }
    return opened[id];
  }

  /* ---------- progress ---------- */
  var P = load();
  function load() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.sets) return v; } catch (e) {}
    return { sets: {}, year: null };
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(P)); } catch (e) {} }
  function rec(setId) { return P.sets[setId] || (P.sets[setId] = { items: {} }); }
  function key(it) { return it.id + '@' + it.h; }
  function scored(set) { return set.items.filter(function (it) { return it.type !== 'learn'; }); }
  /* The numbers a set shows — worked out from META (no need to open the set) when possible */
  function tally(setId) {
    var m = META.sets[setId]; if (!m) return { done: 0, first: 0, total: 0 };
    var r = P.sets[setId], done = 0, first = 0;
    if (r) (m.keys || []).forEach(function (k) { var s = r.items[k]; if (s && (s.ok || s.shown)) done++; if (s && s.first) first++; });
    return { done: done, first: first, total: (m.keys || []).length };
  }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }

  /* ---------- small helpers ---------- */
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 4200);
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function unitOf(setId) { var m = META.sets[setId]; return m && META.units[m.unit]; }
  var KIND_NAME = { kw: 'Keywords', describe: 'Describe', explain: 'Explain', plan: 'Plan', method: 'Method' };
  var KIND_BLURB = {
    kw: 'The words the mark scheme is looking for. First choose them, then write them.',
    describe: 'Say what happens, never why. From theory: a process or a structure, step by step. From data: the trend, the numbers with units, the comparison.',
    explain: 'Give the reason. From theory: each feature linked to what it does, with “so” or “because”. From data: what the data shows, then why.',
    plan: 'A short method, like a mini lab report: the independent variable and its values, the dependent variable and how you measure it, the control variables, then the steps, repeats and safety.'
  };

  /* ============================================================
     THE FRONT PAGE
     ============================================================ */
  function viewHome(year) {
    main.innerHTML = '';
    var hero = META.hero;
    var top = h('section', 'hero wrap');
    top.innerHTML = '<p class="eyebrow">For Cambridge IGCSE Biology 0610</p>' +
      '<h1 class="hero__h">Write less. <em>Score more.</em></h1>' +
      '<p class="hero__p">Practice in writing exam answers. An examiner gives a mark for each idea, not for a long sentence: the right keyword, which way something changes, a comparison, a number. Here you learn to write answers like that, then practise them topic by topic, marked as you go.</p>';
    if (hero) {
      /* the example is framed and labelled as one, so nobody takes it for the first exercise */
      var ex = h('section', 'example');
      ex.setAttribute('aria-label', 'An example');
      ex.innerHTML = '<p class="example__tag">An example \u00b7 a real exam question, answered twice</p>' +
        '<p class="example__p">Every question on this site works like this: the question, an answer that scores little, and the same ideas written to score. <span class="waste">Red</span> is what scores nothing; <span class="example__tick">\u2713</span> is one mark.</p>';
      ex.appendChild(h('p', 'hero__q', T.tags(hero.q) + ' <span class="q__marks">[' + hero.marks + ']</span><small>' + T.esc(hero.src) + '</small>'));
      var sc = h('div', 'scripts');
      sc.appendChild(script('before', hero.before));
      sc.appendChild(script('after', hero.after));
      ex.appendChild(sc);
      if (hero.note) sc.lastChild.appendChild(h('p', 'script-card__note', T.tags(hero.note)));
      top.appendChild(ex);
    }
    main.appendChild(top);

    /* homework, for a signed-in student who has some */
    var hwHost = h('div', 'wrap'); main.appendChild(hwHost); paintHomework(hwHost);

    /* questions due for review */
    var due = dueList(0).length;
    if (due) {
      var rv = h('div', 'wrap');
      rv.innerHTML = '<a class="review" href="#/review"><b>Review · ' + Math.min(due, 12) + ' question' + (due === 1 ? '' : 's') + '</b><span>You got these wrong before. Try them again now, without help.</span><span class="review__go">Start →</span></a>';
      main.appendChild(rv);
    }

    /* the three methods */
    var band1 = h('section', 'band band--learn');
    var ms = h('div', 'sec wrap');
    band1.appendChild(ms);
    ms.innerHTML = '<p class="eyebrow"><span class="step">Step 1</span>Learn the method</p><h2 class="sec__h">Three kinds of question, three ways to answer</h2>' +
      '<p class="sec__p">Describe, explain and plan an investigation carry the most marks in a Biology paper, and they are where most marks are lost. Each answer has a shape. Learn the shape once here, then use it in every topic.</p>' +
      '<p class="rec" id="recLine" hidden></p>';
    var grid = h('div', 'methods');
    (META.methods || []).forEach(function (m, i) {
      var t = tally(m.set);
      var a = h('a', 'method');
      a.href = '#/s/' + m.set;
      a.innerHTML = '<span class="method__n">0' + (i + 1) + ' · ' + T.esc(m.when) + '</span><span class="method__h">' + T.esc(m.title) + '</span>' +
        '<p class="method__f">' + T.esc(m.formula) + '</p>' +
        ((m.kinds || []).length ? '<ul class="method__kinds">' + m.kinds.map(function (k) { return '<li><b>' + T.esc(k.k) + '</b> ' + T.esc(k.f) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="method__ex">' + T.tags(m.example) + '</p>' +
        '<span class="method__go">' + (t.done ? (t.done >= t.total ? 'Done — go again' : 'Carry on (' + t.done + '/' + t.total + ')') : 'Learn it') + ' →</span>';
      grid.appendChild(a);
    });
    ms.appendChild(grid);
    /* the rest, as cards a student will see rather than a row of links under the fold */
    var more = h('div', 'explore');
    more.innerHTML = '<p class="explore__h">Also worth knowing</p>';
    var grid2 = h('div', 'explore__g');
    var cards = [];
    if (META.guide) cards.push({ href: '#/commands', t: 'Every command word', b: 'State, suggest, compare, evaluate and the rest: what each one asks for, with a real example.' });
    (META.extras || []).forEach(function (x) { cards.push({ href: '#/s/' + x.set, t: x.title, b: x.blurb || '' }); });
    cards.forEach(function (c) {
      var a = h('a', 'explore__c'); a.href = c.href;
      a.innerHTML = '<span class="explore__t">' + T.esc(c.t) + '</span><span class="explore__b">' + T.esc(c.b) + '</span><span class="explore__go">Open \u2192</span>';
      grid2.appendChild(a);
    });
    more.appendChild(grid2);
    ms.appendChild(more);
    main.appendChild(band1);
    paintRecord();

    /* practise by topic */
    var band2 = h('section', 'band band--practise');
    var ts = h('div', 'sec wrap'); ts.id = 'topics';
    band2.appendChild(ts);
    ts.innerHTML = '<p class="eyebrow"><span class="step">Step 2</span>Practise by topic</p><h2 class="sec__h">Your year, topic by topic</h2>' +
      '<p class="sec__p">The topics each year group studies at NLCS. Every topic has keyword tests and its own describe, explain and plan questions, all marked as you go.</p>';
    var years = h('div', 'years'); years.setAttribute('role', 'tablist');
    var mineY = server && server.cls ? parseInt(String(server.cls).match(/\d+/) || '', 10) : null;
    var y = year || P.year || (META.years.some(function (Y) { return Y.y === mineY; }) ? mineY : null) || (META.years[0] && META.years[0].y);
    var ledger = h('div', 'ledger');
    META.years.forEach(function (Y) {
      var b = h('button', 'ytab' + (Y.y === y ? ' is-on' : ''), T.esc(Y.title));
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', Y.y === y ? 'true' : 'false');
      b.addEventListener('click', function () { P.year = Y.y; save(); history.replaceState(null, '', '#/y' + Y.y); years.querySelectorAll('.ytab').forEach(function (x) { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); }); paintLedger(ledger, Y.y); });
      years.appendChild(b);
    });
    ts.appendChild(years); ts.appendChild(ledger);
    paintLedger(ledger, y);
    main.appendChild(band2);
    if (year) setTimeout(function () { ts.scrollIntoView({ block: 'start' }); }, 0);
  }
  function script(kind, s) {
    var c = h('div', 'script-card script-card--' + kind);
    var marks = 0, words = 0;
    s.lines.forEach(function (l) { marks += l.m || 0; words += T.words(l.t.replace(/\[\[|\]\]/g, '')); });
    c.innerHTML = '<div class="script-card__head"><span>' + (kind === 'before' ? 'A typical answer' : 'The same ideas, written to score') + '</span><b>' + words + ' words · ' + marks + ' mark' + (marks === 1 ? '' : 's') + '</b></div>';
    var ol = h('ol', 'ruled');
    s.lines.forEach(function (l) {
      var txt = T.tags(l.t).replace(/\[\[([^\]]*)\]\]/g, '<span class="waste">$1</span>');
      ol.appendChild(h('li', '', '<span>' + txt + '</span><span class="margin' + (l.m ? '' : ' margin--none') + '">' + (l.m ? '✓' : '·') + '</span>'));
    });
    c.appendChild(ol);
    return c;
  }
  function paintLedger(host, y) {
    host.innerHTML = '';
    var Y = META.years.filter(function (x) { return x.y === y; })[0];
    if (!Y) return;
    Y.units.forEach(function (uid) {
      var u = META.units[uid]; if (!u) return;
      var a = h('a', 'unit' + (u.sets.length ? '' : ' is-soon'));
      a.href = '#/u/' + uid;
      var bars = '';
      ['kw', 'describe', 'explain', 'plan'].forEach(function (k) {
        var ids = u.sets.filter(function (s) { return META.sets[s] && META.sets[s].kind === k; });
        if (!ids.length) return;
        var d = 0, t = 0; ids.forEach(function (s) { var x = tally(s); d += x.done; t += x.total; });
        bars += '<span class="mini"><span class="mini__l">' + KIND_NAME[k] + '</span><span class="mini__b"><i style="width:' + pct(d, t) + '%"></i></span></span>';
      });
      a.innerHTML = '<span class="unit__n">' + T.esc(u.n) + '</span><span><span class="unit__t">' + T.esc(u.title) + '</span><span class="unit__s">' +
        (u.sets.length ? u.sets.length + ' sets · ' + u.count + ' questions' : 'Coming soon') + '</span></span><span class="unit__bars">' + bars + '</span>';
      host.appendChild(a);
    });
  }

  /* ============================================================
     ONE TOPIC
     ============================================================ */
  function viewUnit(uid) {
    var u = META.units[uid];
    if (!u) { go('#/'); return; }
    main.innerHTML = '';
    var w = h('div', 'wrap unitpage');
    var Y = u.year;
    w.appendChild(h('a', 'back', '← Year ' + Y + ' topics')).href = '#/y' + Y;
    var head = h('header', 'uhead');
    head.innerHTML = '<p class="eyebrow">Topic ' + T.esc(u.n) + ' · Year ' + Y + (u.syl ? ' · syllabus ' + T.esc(u.syl) : '') + '</p><h1 class="uhead__t">' + T.esc(u.title) + '</h1>';
    w.appendChild(head);
    var W = (META.words || {})[uid];
    var FR = (META.frames || {})[uid] || [];
    if (W && W.length) { var wl = h('p', 'sec__p', '<a class="wordslink" href="#/w/' + uid + '">All ' + W.length + ' keywords of this topic, with their definitions' +
      (FR.length ? ', and its ' + FR.length + ' sentence frames' : '') + ' →</a>'); w.appendChild(wl); }
    var kinds = h('div', 'kinds');
    ['kw', 'describe', 'explain', 'plan'].forEach(function (k) {
      var ids = u.sets.filter(function (s) { return META.sets[s] && META.sets[s].kind === k; });
      if (!ids.length) return;
      var sec = h('section', 'kind');
      sec.innerHTML = '<div class="kind__h"><h2>' + KIND_NAME[k] + '</h2></div><p class="kind__p">' + KIND_BLURB[k] + '</p>';
      ids.forEach(function (sid) {
        var m = META.sets[sid], t = tally(sid);
        var a = h('a', 'set'); a.href = '#/s/' + sid;
        var mo = m.modes && (m.modes.data || m.modes.theory) ? ' · ' + (m.modes.theory ? m.modes.theory + ' from theory' : '') + (m.modes.theory && m.modes.data ? ', ' : '') + (m.modes.data ? m.modes.data + ' from data' : '') : '';
        a.innerHTML = '<span><span class="set__t">' + T.esc(m.title) + '</span><br><span class="set__s">' + T.esc(m.blurb || '') + ' · ' + t.total + ' questions' + mo + '</span>' +
          '<span class="pbar"><i style="width:' + pct(t.done, t.total) + '%"></i></span></span><span class="set__go">' + (t.done ? (t.done >= t.total ? 'Again' : 'Carry on') : 'Start') + ' →</span>';
        sec.appendChild(a);
      });
      kinds.appendChild(sec);
    });
    if (!u.sets.length) kinds.appendChild(h('p', 'sec__p', 'The questions for this topic are being written.'));
    w.appendChild(kinds);
    main.appendChild(w);
  }

  /* ============================================================
     REVIEW — what you got wrong comes back: after a day, then after a week.
     A question answered right first time never comes back. One answered wrong, or whose answer
     was shown, is due again a day later; right then, a week later; right again, it is done.
     Wrong at a review sends it back to the start. (Spacing and retrieval: see docs/CONTENT.md.)
     ============================================================ */
  var DAY = 864e5;
  function dueList(max) {
    var now = Date.now(), out = [];
    Object.keys(P.sets).forEach(function (sid) {
      var m = META.sets[sid], r = P.sets[sid]; if (!m || !r) return;
      m.keys.forEach(function (k) {
        var s = r.items[k]; if (!s || s.first || !(s.t || s.shown)) return;
        var rv = s.rv || 0; if (rv >= 2) return;
        var since = s.rat || s.at || 0;
        if (now - since >= (rv ? 7 : 1) * DAY) out.push({ sid: sid, key: k, since: since });
      });
    });
    out.sort(function (a, b) { return a.since - b.since; });
    return max ? out.slice(0, max) : out;
  }
  function viewReview() {
    var list = dueList(12);
    main.innerHTML = '';
    var w = h('div', 'col player');
    w.appendChild(h('a', 'back', '← Front page')).href = '#/';
    w.appendChild(h('p', 'ptop__t', 'Review'));
    if (!list.length) { w.appendChild(h('p', 'sec__p', 'Nothing to review today. Questions you get wrong come back here a day later, then a week later.')); main.appendChild(w); return; }
    var stage = h('div', 'stage'), n = 0;
    var info = h('p', 'hint', list.length + ' question' + (list.length === 1 ? '' : 's') + ' from earlier sets. Answer each one without help.');
    w.appendChild(info); w.appendChild(stage); main.appendChild(w);
    function show(i) {
      stage.innerHTML = '';
      if (i >= list.length) { stage.appendChild(h('div', 'done', '<h2>Review done.</h2><p class="sec__p">What you got right will come back once more in a week, to make sure it stays.</p>')); return; }
      var x = list[i], set = openSet(x.sid), it = null;
      (set ? set.items : []).forEach(function (q) { if (key(q) === x.key) it = q; });
      if (!it) { show(i + 1); return; }
      var m = META.sets[x.sid], u = unitOf(x.sid);
      stage.appendChild(h('p', 'eyebrow', (i + 1) + ' of ' + list.length + ' · ' + (u ? 'Topic ' + T.esc(u.n) + ' · ' : '') + T.esc(m.title)));
      stage.appendChild(E.render(it, {
        onResult: function (res) {
          if (res.learn) return;
          var s = rec(x.sid).items[x.key] || (rec(x.sid).items[x.key] = {});
          if (res.ok && !res.shown) { s.rv = (s.rv || 0) + 1; s.ok = 1; } else { s.rv = 0; if (res.shown) s.shown = 1; }
          s.rat = Date.now(); save(); queueSync(x.sid);
        },
        onNext: function () { show(i + 1); window.scrollTo({ top: 0 }); }
      }));
    }
    show(0);
  }

  /* ============================================================
     COMMAND WORDS — what each question word asks for. The same guide as the "How to answer"
     tab of each student's dashboard: one master file builds both.
     ============================================================ */
  var CMD_GROUPS = [
    { title: 'Say it briefly', words: ['State', 'Name', 'Identify', 'Give', 'List', 'Choose', 'Complete', 'Define', 'Outline'] },
    { title: 'Describe', words: ['Describe', 'Compare', 'Distinguish', 'Use'] },
    { title: 'Explain', words: ['Explain', 'Suggest', 'Predict', 'Discuss', 'Evaluate', 'Deduce'] },
    { title: 'Practical and data', words: ['Plan', 'Investigate', 'Calculate', 'Determine', 'Estimate', 'Measure', 'Convert', 'Sketch', 'Draw', 'Plot', 'Prepare', 'Construct', 'Label', 'Classify'] }
  ];
  var METHOD_SET = { describe: 'm.describe', explain: 'm.explain', plan: 'm.plan' };
  function patternCard(p) {
    var h2 = '<div class="pat"><p class="pat__t">' + T.esc(p.title) + '</p>';
    if (p.strategy) h2 += '<p class="pat__s">' + T.esc(p.strategy) + '</p>';
    if (p.signature) h2 += '<p class="pat__sig"><span>Looks like</span> ' + T.esc(p.signature) + '</p>';
    if (p.steps.length) h2 += '<ol class="pat__steps">' + p.steps.map(function (x) { return '<li>' + T.esc(x) + '</li>'; }).join('') + '</ol>';
    if (p.pitfalls.length) h2 += '<p class="pat__h">Where marks are lost</p><ul class="pat__pit">' + p.pitfalls.map(function (x) { return '<li>' + T.esc(x) + '</li>'; }).join('') + '</ul>';
    var ex = p.example;
    if (ex) {
      h2 += '<div class="pat__ex"><p class="pat__h">A real question</p><p class="pat__stem">' + T.esc(ex.stem) + (ex.marks ? ' <b>[' + ex.marks + ']</b>' : '') + '</p>' +
        (ex.figureNote ? '<p class="pat__fig">' + T.esc(ex.figureNote) + '</p>' : '') + '<p class="pat__src">' + T.esc(ex.source) + '</p>';
      if (ex.scheme.length && CFG.showSchemes !== false) h2 += '<details class="pat__ms"><summary>What the mark scheme credits</summary><ul>' + ex.scheme.map(function (x) { return '<li>' + T.esc(x) + '</li>'; }).join('') + '</ul>' +
        (ex.guidance.length ? '<p class="pat__g">' + ex.guidance.map(T.esc).join('<br>') + '</p>' : '') + '</details>';
      if (ex.model) h2 += '<div class="pat__model"><span>Model answer</span>' + T.esc(ex.model) + '</div>';
      h2 += '</div>';
    }
    if (p.note) h2 += '<p class="pat__note">' + T.esc(p.note) + '</p>';
    return h2 + '</div>';
  }
  function viewGuide(open) {
    var G = META.guide; if (!G) { go('#/'); return; }
    main.innerHTML = '';
    var w = h('div', 'wrap guide');
    w.appendChild(h('a', 'back', '← Front page')).href = '#/';
    w.appendChild(h('header', 'uhead', '<p class="eyebrow">How to answer</p><h1 class="uhead__t">Command words</h1>'));
    /* the three that carry the marks come first, each a way into its method */
    var big = h('div', 'bigthree');
    [['Describe', 'm.describe', 'Say what happens, never why.'], ['Explain', 'm.explain', 'Give the reason.'], ['Plan', 'm.plan', 'A short method: the variables, then the steps.']].forEach(function (x) {
      var a = h('a', 'bigthree__c'); a.href = '#/s/' + x[1];
      a.innerHTML = '<span class="bigthree__w">' + x[0] + '</span><span class="bigthree__b">' + T.esc(x[2]) + '</span><span class="bigthree__go">Learn the method \u2192</span>';
      big.appendChild(a);
    });
    w.appendChild(h('p', 'sec__p', 'The first word of a question tells you what kind of answer scores. This is the same guide as the “How to answer” tab on your dashboard.'));
    var rl = h('p', 'rec'); rl.id = 'recLine'; rl.hidden = true; w.appendChild(rl);
    w.appendChild(h('p', 'sec__p bigthree__h', 'The three that carry the most marks:'));
    w.appendChild(big);
    w.appendChild(h('h2', 'guide__h guide__h--all', 'Every command word, in four groups. Open one for what it asks and a real example.'));
    /* the four signals, after the words: worth reading, not the first thing */
    var dec = h('section', 'dec');
    dec.innerHTML = '<h2 class="guide__h">Before you write: four signals</h2>' + '<ol class="dec__list">' + G.decoder.map(function (d) {
      return '<li><b>' + T.esc(d.name) + '</b><span>' + T.esc(d.what) + '</span><em>' + T.esc(d.cue) + '</em></li>'; }).join('') + '</ol>';
    var pById = {}; G.patterns.forEach(function (p) { pById[p.id] = p; });
    var cByWord = {}; G.commands.forEach(function (c) { cByWord[c.word] = c; });
    var groups = h('div', 'cmdgroups'); w.appendChild(groups);
    CMD_GROUPS.forEach(function (grp) {
      var sec = h('section', 'cgrp'); sec.appendChild(h('h2', 'guide__h', T.esc(grp.title)));
      grp.words.forEach(function (wd) {
        var c = cByWord[wd]; if (!c) return;
        var d = document.createElement('details'); d.className = 'cmd'; d.id = 'cmd-' + wd.toLowerCase();
        if (open && open.toLowerCase() === wd.toLowerCase()) d.open = true;
        var body = '<summary><span class="cmd__w">' + T.esc(c.word) + '</span><span class="cmd__p">' + T.esc(c.plain) + '</span></summary><div class="cmd__b">';
        if (c.official) body += '<p class="cmd__off"><span>Syllabus definition</span> ' + T.esc(c.official) + '</p>';
        if (c.shape) body += '<p><b>What the answer looks like.</b> ' + T.esc(c.shape) + '</p>';
        if (c.frame) body += '<p class="frame">' + T.esc(c.frame) + '</p>';
        if (c.note) body += '<p class="cmd__note">' + T.esc(c.note) + '</p>';
        if (c.method && METHOD_SET[c.method]) body += '<p><a class="wordslink" href="#/s/' + METHOD_SET[c.method] + '">Practise the ' + c.method + ' method →</a></p>';
        if (pById[c.pattern]) body += patternCard(pById[c.pattern]);
        d.innerHTML = body + '</div>';
        sec.appendChild(d);
      });
      groups.appendChild(sec);
    });
    w.appendChild(dec);
    var sy = h('section', 'cgrp');
    sy.innerHTML = '<h2 class="guide__h">Reading a mark scheme</h2><table class="fig__table syms"><thead><tr><th>Symbol</th><th>Means</th><th>In plain words</th></tr></thead><tbody>' +
      G.symbols.map(function (x) { return '<tr><td><b>' + T.esc(x.symbol) + '</b></td><td>' + T.esc(x.official) + '</td><td>' + T.esc(x.plain) + '</td></tr>'; }).join('') + '</tbody></table>';
    w.appendChild(sy);
    var mk = h('section', 'cgrp');
    mk.innerHTML = '<h2 class="guide__h">Mistakes examiners flag year after year</h2>' + G.mistakes.map(function (m) {
      return '<div class="mist"><p class="mist__t">' + T.esc(m.title) + '</p><p>' + T.esc(m.body) + '</p><p class="pat__src">' + T.esc(m.source) + '</p></div>'; }).join('');
    w.appendChild(mk);
    main.appendChild(w);
    paintRecord();
    if (open) { var el = document.getElementById('cmd-' + open.toLowerCase()); if (el) setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 0); }
  }

  /* ============================================================
     A TOPIC'S KEYWORDS — to read before a test (the same list as the flashcards)
     ============================================================ */
  function viewWords(uid) {
    var u = META.units[uid], W = (META.words || {})[uid];
    if (!u || !W) { go('#/'); return; }
    main.innerHTML = '';
    var w = h('div', 'wrap wordsp');
    w.appendChild(h('a', 'back', '← Topic ' + T.esc(u.n) + ': ' + T.esc(u.title))).href = '#/u/' + uid;
    w.appendChild(h('header', 'uhead', '<p class="eyebrow">Topic ' + T.esc(u.n) + ' · ' + W.length + ' keywords</p><h1 class="uhead__t">Keywords: ' + T.esc(u.title) + '</h1>'));
    w.appendChild(h('p', 'sec__p', 'Read them, cover the definition, say it, check. Then test yourself: the Keywords sets ask for every one of them. These are the same definitions as the flashcards on your dashboard.'));
    var dl = h('dl', 'words');
    W.forEach(function (x) {
      var g = h('div', 'words__i');   /* a word and its definition stay together across the columns */
      g.appendChild(h('dt', 'words__t', T.esc(x.t) + (x.sup ? ' <span class="words__sup">Supplement</span>' : '') + (x.ko && CFG.koreanGloss !== false ? ' <span class="words__ko" lang="ko">' + T.esc(x.ko) + '</span>' : '')));
      g.appendChild(h('dd', 'words__d', T.esc(x.d)));
      dl.appendChild(g);
    });
    w.appendChild(dl);
    /* The sentence frames this topic teaches, gathered from its own questions: the shapes to
       revise before a test. The same sentences the cards use, one after another. */
    var FR = (META.frames || {})[uid] || [];
    if (FR.length) {
      var KINDS = [['describe', 'Describe'], ['explain', 'Explain'], ['plan', 'Plan an investigation'], ['kw', 'Keywords']];
      w.appendChild(h('h2', 'sec__h2', 'Sentence frames'));
      w.appendChild(h('p', 'sec__p', 'Every sentence shape this topic practises, in one place. Read one, cover it, write it with your own topic words. Colour shows what each part does: ' +
        '<span class="pt pt--k">keyword</span>, <span class="pt pt--d">direction</span>, <span class="pt pt--c">comparison</span>, <span class="pt pt--n">data</span>, <span class="pt pt--l">link</span>.'));
      KINDS.forEach(function (k) {
        var mine = FR.filter(function (x) { return x.k === k[0]; });
        if (!mine.length) return;
        var box = h('section', 'frames');
        box.appendChild(h('h3', 'frames__h', T.esc(k[1]) + ' <span class="frames__n">' + mine.length + '</span>'));
        var ul = h('ul', 'frames__l');
        mine.forEach(function (x) {
          if (x.g) {
            var li = h('li', 'frame frame--set');
            li.innerHTML = '<span class="frame__k">A whole answer, one line one mark</span><ol class="frame__o">' +
              x.g.map(function (t) { return '<li>' + T.tags(t) + '</li>'; }).join('') + '</ol>';
            ul.appendChild(li);
          } else ul.appendChild(h('li', 'frame', T.tags(x.t)));
        });
        box.appendChild(ul);
        w.appendChild(box);
      });
    }
    main.appendChild(w);
  }

  /* ============================================================
     THE PLAYER — one set, question by question
     ============================================================ */
  function viewSet(sid, at) {
    var m = META.sets[sid], set = openSet(sid);
    if (!m || !set) { toast('That set could not be opened.'); go('#/'); return; }
    main.innerHTML = '';
    var w = h('div', 'col player');
    var u = unitOf(sid);
    var back = h('a', 'back', u ? '← Topic ' + T.esc(u.n) + ': ' + T.esc(u.title) : '← All topics');
    back.href = u ? '#/u/' + u.id : '#/';
    w.appendChild(back);
    var top = h('div', 'ptop');
    top.appendChild(h('p', 'ptop__t', T.esc(m.title)));
    w.appendChild(top);
    var dots = h('div', 'dots'); w.appendChild(dots);
    var stage = h('div', 'stage'); w.appendChild(stage);
    main.appendChild(w);
    var r = rec(sid);
    var items = set.items;
    var n = Math.max(0, Math.min(items.length, at == null ? firstOpen() : at));
    function firstOpen() {
      for (var i = 0; i < items.length; i++) { var s = r.items[key(items[i])]; if (!s || !(s.ok || s.shown || s.seen)) return i; }
      return items.length;     /* all done: the summary */
    }
    function paintDots() {
      dots.innerHTML = '';
      items.forEach(function (it, i) {
        var s = r.items[key(it)] || {};
        var b = h('button', 'dot' + (it.type === 'learn' ? ' is-learn' : '') + (i === n ? ' is-now' : '') +
          (s.first ? ' is-first' : s.ok ? ' is-ok' : s.shown ? ' is-shown' : s.seen && it.type === 'learn' ? ' is-ok' : ''), String(i + 1));
        b.type = 'button'; b.setAttribute('aria-label', 'Question ' + (i + 1) + (s.ok ? ', right' : s.shown ? ', answer shown' : ''));
        b.addEventListener('click', function () { show(i); });
        dots.appendChild(b);
      });
      var d = h('button', 'dot' + (n === items.length ? ' is-now' : ''), '✓'); d.type = 'button'; d.setAttribute('aria-label', 'Summary');
      d.addEventListener('click', function () { show(items.length); });
      dots.appendChild(d);
    }
    function show(i) {
      n = i;
      history.replaceState(null, '', '#/s/' + sid + '/' + (i + 1));
      paintDots();
      stage.innerHTML = '';
      if (i >= items.length) { stage.appendChild(summary()); return; }
      var it = items[i], k = key(it);
      var card = E.render(it, {
        state: r.items[k],
        onResult: function (res) {
          var s = r.items[k] || (r.items[k] = {});
          if (res.learn) { s.seen = 1; }
          else {
            s.t = (s.t || 0) + 1;
            if (res.ok) s.ok = 1;
            if (res.first && !s.shown && s.t === 1) s.first = 1;
            if (res.shown) s.shown = 1;
            s.at = Date.now();
          }
          r.at = Date.now(); save(); paintDots(); queueSync(sid);
        },
        onNext: function () { show(i + 1); window.scrollTo({ top: 0 }); }
      });
      stage.appendChild(card);
      var f = card.querySelector('input.gap, .opt, .slot, .tile, .kwopt');
      if (f && !matchMedia('(pointer: coarse)').matches && it.type !== 'learn') { try { f.focus({ preventScroll: true }); } catch (e) {} }
    }
    function summary() {
      var t = tally(sid);
      var d = h('div', 'done');
      d.innerHTML = '<p class="eyebrow">' + T.esc(m.title) + '</p><h2>' + (t.done >= t.total ? 'Set finished.' : 'Not finished yet.') + '</h2>' +
        '<div class="done__nums"><div>' + t.done + '/' + t.total + '<span>answered</span></div><div>' + t.first + '/' + t.total + '<span>right first time</span></div></div>';
      var row = h('div', 'card__foot');
      var again = h('button', 'btn', 'Start again'); again.type = 'button';
      again.addEventListener('click', function () { if (!confirm('Clear your answers for this set and start again?')) return; P.sets[sid] = { items: {} }; r = rec(sid); save(); queueSync(sid); show(0); });
      var next = nextSet(sid);
      if (next) { var nx = h('a', 'btn btn--go', 'Next set: ' + T.esc(META.sets[next].title) + ' →'); nx.href = '#/s/' + next; row.appendChild(nx); }
      var bk = h('a', 'btn', u ? 'Back to the topic' : 'Back to the front'); bk.href = u ? '#/u/' + u.id : '#/';
      row.appendChild(bk); row.appendChild(again);
      d.appendChild(row);
      if (t.done < t.total) d.appendChild(h('p', 'hint', 'Questions still open are shown as empty circles above.'));
      return d;
    }
    show(n);
  }
  function nextSet(sid) {
    var m = META.sets[sid], u = m && META.units[m.unit];
    var list = u ? u.sets : (META.methodOrder || []);
    var i = list.indexOf(sid);
    return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  }

  /* ============================================================
     SIGNING IN — one sign-in for the whole site (js/signin.js, shared)
     ============================================================ */
  var SI = window.SignIn || null, CID = CFG.googleClientId || '';
  var me = SI ? SI.who() : null;
  var server = null;     /* what the teacher's spreadsheet said about this student */
  function paintWho() {
    var btn = document.getElementById('signinBtn'), card = document.getElementById('whoCard');
    if (!SI || !CID) { btn.hidden = true; card.hidden = true; return; }
    if (me) {
      btn.hidden = true; card.hidden = false;
      card.innerHTML = '<span>Signed in as <b>' + T.esc((me.name || me.email).split(' ')[0]) + '</b></span>' +
        (server && server.teacher && server.teacherPage ? '<a class="who__t" href="' + T.esc(server.teacherPage) + '" target="_blank" rel="noopener">Teacher page</a>' : '');
      var out = h('button', 'who__out', 'Sign out'); out.type = 'button';
      out.addEventListener('click', function () { SI.out(); });
      card.appendChild(out);
    } else {
      card.hidden = true; btn.hidden = false; btn.innerHTML = '';
      SI.loaded(function (ok) {
        if (!ok || me) return;
        /* on a phone, Google's small round button: the full one would push the site's name onto two lines */
        var small = window.matchMedia && matchMedia('(max-width: 560px)').matches;
        SI.button(btn, CID, small ? { type: 'icon', theme: 'filled_black', size: 'large', shape: 'circle', locale: 'en-GB' }
                                  : { theme: 'filled_black', size: 'medium', text: 'signin_with', shape: 'pill', locale: 'en-GB' });
      }, 10000);
    }
  }
  if (SI) SI.on(function (v) { var was = me && me.email; me = v; paintWho(); if (v && v.email !== was) { server = null; record = null; fetchMine(); fetchRecord(); } if (!v) { server = null; record = null; route(); } });

  /* ---------- the student's own dashboard (the reflection system's record page) ----------
     Asked, never assumed: the labs' script says whether this student has reflected yet. */
  var REC = CFG.record || null, record = null;   /* null = not asked; {has:false} = nothing yet */
  function fetchRecord() {
    if (!REC || !REC.askUrl || !me || !SI) return;
    var live = SI.live();
    if (!live) { SI.renew(CID, function (v) { if (v) fetchRecord(); }); return; }
    fetch(REC.askUrl, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'record', token: live.token }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (!j.ok) { record = { has: false, why: j.why || '' }; }
        else {
          var reflected = Number(j.reflected != null ? j.reflected : j.count) || 0, unfinished = (j.unfinishedNames || []).length || Number(j.incomplete) || 0;
          record = { has: reflected + unfinished > 0, reflected: reflected, assessments: Number(j.assessments) || reflected, teacher: !!j.teacher };
        }
        paintRecord();
      }).catch(function () {});
  }
  function recordLine() {
    if (!REC || !me || !record) return '';
    if (record.why === 'not a school account') return 'Your dashboard needs your …' + T.esc(REC.domain || 'school') + ' account.';
    if (!record.has) return 'You do not have a dashboard yet: it appears after your first assessment reflection. Until then, start with the three methods below.';
    /* straight to the Commands tab, which is the one that says which command words cost marks */
    return 'Your dashboard shows which command words cost you the most marks' +
      (record.assessments ? ' (' + record.reflected + ' of ' + record.assessments + ' assessments reflected)' : '') +
      '. <a href="' + T.esc(REC.url + (REC.url.indexOf('?') >= 0 ? '&' : '?') + 'tab=commands') + '" target="_blank" rel="noopener">Open its Commands tab</a>, then practise those here first.';
  }
  function paintRecord() {
    var el = document.getElementById('recLine');
    if (el) { var t = recordLine(); el.innerHTML = t; el.hidden = !t; }
  }

  /* ---------- the teacher's spreadsheet ---------- */
  function syncOn() { return !!(CFG.submitUrl && SI); }
  function post(body) {
    return fetch(CFG.submitUrl, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  /* what a set looks like as one short string: per question 0 untouched, t tried, 1 right,
     f right first time, s answer shown */
  function snap(sid) {
    var m = META.sets[sid], r = P.sets[sid] || { items: {} };
    return (m.keys || []).map(function (k) { var s = r.items[k]; return !s ? '0' : s.first ? 'f' : s.ok ? '1' : s.shown ? 's' : s.t ? 't' : '0'; }).join('');
  }
  var pending = {}, syncTimer = null;
  function queueSync(sid) {
    if (!syncOn() || !me) return;
    pending[sid] = true;
    clearTimeout(syncTimer); syncTimer = setTimeout(flush, 2500);
  }
  function flush() {
    var ids = Object.keys(pending); if (!ids.length) return;
    var live = SI.live();
    if (!live) { SI.renew(CID, function (v) { if (v) flush(); }); return; }
    pending = {};
    var sets = {};
    ids.forEach(function (sid) { var t = tally(sid); sets[sid] = { done: t.done, first: t.first, total: t.total, snap: snap(sid), v: META.sets[sid].v }; });
    post({ action: 'english.save', token: live.token, sets: sets, at: new Date().toISOString() })
      .then(function (j) { if (!j || !j.ok) { ids.forEach(function (s) { pending[s] = true; }); if (j && j.why && j.why !== 'not signed in') toast('Your progress was not recorded: ' + j.why); } })
      .catch(function () { ids.forEach(function (s) { pending[s] = true; }); });
  }
  addEventListener('pagehide', function () { if (Object.keys(pending).length) flush(); });
  function fetchMine() {
    if (!syncOn() || !me) return;
    var live = SI.live();
    if (!live) { SI.renew(CID, function (v) { if (v) fetchMine(); }); return; }
    post({ action: 'english.mine', token: live.token }).then(function (j) {
      if (!j || !j.ok) return;
      server = j;
      paintWho();
      /* bring back progress made on another computer: only ever adds */
      var added = 0;
      Object.keys(j.sets || {}).forEach(function (sid) {
        var m = META.sets[sid], s = j.sets[sid]; if (!m || !s || !s.snap || s.v !== m.v) return;
        var r = rec(sid);
        m.keys.forEach(function (k, i) {
          var c = s.snap.charAt(i); if (!c || c === '0') return;
          var cur = r.items[k] || {};
          if (c === 'f' && !cur.first) { cur.first = 1; cur.ok = 1; added++; }
          else if (c === '1' && !cur.ok) { cur.ok = 1; added++; }
          else if (c === 's' && !cur.shown && !cur.ok) { cur.shown = 1; added++; }
          else if (c === 't' && !cur.t) { cur.t = 1; }
          r.items[k] = cur;
        });
      });
      if (added) { save(); toast('Your answers from another computer are back.'); }
      route();
    }).catch(function () {});
  }
  function paintHomework(host) {
    host.innerHTML = '';
    if (!server || !server.homework || !server.homework.length) return;
    var box = h('section', 'hw');
    box.appendChild(h('h2', 'hw__h', 'Your homework'));
    server.homework.forEach(function (hw) {
      var row = h('div', 'hw__row');
      var d = 0, t = 0;
      (hw.sets || []).forEach(function (s) { var x = tally(s); d += x.done; t += x.total; });
      row.innerHTML = '<a href="#/hw/' + encodeURIComponent(hw.id) + '"><b>' + T.esc(hw.title) + '</b></a><span class="hw__due">due ' + T.esc(hw.due || '') + '</span><span>' + d + '/' + t + ' done</span>';
      box.appendChild(row);
    });
    host.appendChild(box);
  }
  function viewHomework(id) {
    main.innerHTML = '';
    var w = h('div', 'wrap');
    w.appendChild(h('a', 'back', '← Front page')).href = '#/';
    var hw = server && (server.homework || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!me) { w.appendChild(h('p', 'sec__p', 'Sign in with your school Google account (top right) to see this homework.')); main.appendChild(w); return; }
    if (!hw) { w.appendChild(h('p', 'sec__p', server ? 'This homework was not found for your account.' : 'Loading your homework…')); main.appendChild(w); return; }
    w.appendChild(h('header', 'uhead', '<p class="eyebrow">Homework · due ' + T.esc(hw.due || '') + '</p><h1 class="uhead__t">' + T.esc(hw.title) + '</h1>'));
    var sec = h('section', 'kind');
    (hw.sets || []).forEach(function (sid) {
      var m = META.sets[sid]; if (!m) return;
      var t = tally(sid), u = META.units[m.unit];
      var a = h('a', 'set'); a.href = '#/s/' + sid;
      a.innerHTML = '<span><span class="set__t">' + (u ? 'Topic ' + T.esc(u.n) + ' · ' : '') + T.esc(m.title) + '</span><br><span class="set__s">' + t.total + ' questions</span><span class="pbar"><i style="width:' + pct(t.done, t.total) + '%"></i></span></span><span class="set__go">' + (t.done >= t.total ? 'Done' : t.done ? 'Carry on' : 'Start') + ' →</span>';
      sec.appendChild(a);
    });
    w.appendChild(sec); main.appendChild(w);
  }

  /* ============================================================
     ROUTING
     ============================================================ */
  function route() {
    var hs = location.hash.replace(/^#\/?/, '');
    var p = hs.split('/');
    document.title = 'Bio English Lab — write IGCSE Biology answers that score';
    if (p[0] === 'u' && p[1]) { viewUnit(p[1]); }
    else if (p[0] === 's' && p[1]) { viewSet(decodeURIComponent(p[1]), p[2] ? (parseInt(p[2], 10) - 1) : null); }
    else if (p[0] === 'hw' && p[1]) { viewHomework(decodeURIComponent(p[1])); }
    else if (p[0] === 'w' && p[1]) { viewWords(p[1]); }
    else if (p[0] === 'review') { viewReview(); }
    else if (p[0] === 'commands') { viewGuide(p[1] ? decodeURIComponent(p[1]) : ''); }
    else if (/^y\d+$/.test(p[0])) { viewHome(parseInt(p[0].slice(1), 10)); }
    else { viewHome(null); }
    if (p[0] !== 'y' && !/^y\d+$/.test(p[0])) window.scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  paintWho();
  route();
  if (me) { fetchMine(); fetchRecord(); }
})();
