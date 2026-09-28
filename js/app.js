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

  /* ---------- goes (September 2026) ----------
     Start again clears the PAGE, never the record (the labs' model, labs-shared/engine/sync.js). A set on
     its 2nd go or later keeps `go`, its FIRST go as it stood when go 2 began (`g1`) and the best each
     question has ever been (`best`): both keyed by question, like `items`, so a rebuilt set keeps them for
     every question that did not change. Letters: 0 untouched · t tried · s answer shown · 1 right ·
     f right first time. The lists, the topic and year bars and homework show the best ever; a set's own
     page shows the go it is on. Students read "round" (Round 2), never "go": one word, the same in every lab. */
  var EN_RANK = { '0': 0, t: 1, s: 2, '1': 3, f: 4 };
  function letter(st) { return !st ? '0' : st.first ? 'f' : st.ok ? '1' : st.shown ? 's' : st.t ? 't' : '0'; }
  function goOf(r) { return r && r.go > 1 ? Math.floor(r.go) : 1; }
  function better(a, b) { return (EN_RANK[b] || 0) > (EN_RANK[a] || 0) ? b : a; }
  function recordsOf(sid) {
    var m = META.sets[sid], r = P.sets[sid] || { items: {} }, g = goOf(r), here = {}, first = {}, best = {};
    ((m && m.keys) || []).forEach(function (k) {
      var h0 = letter(r.items[k]), f0 = g === 1 ? h0 : ((r.g1 || {})[k] || '0');
      here[k] = h0; first[k] = f0; best[k] = better(better(h0, f0), (r.best || {})[k] || '0');
    });
    return { go: g, here: here, first: first, best: best };
  }
  function lettersOf(sid, map) { return ((META.sets[sid] || {}).keys || []).map(function (k) { return map[k] || '0'; }).join(''); }
  function tallyBest(setId) {
    var m = META.sets[setId]; if (!m) return { done: 0, first: 0, firstTried: 0, here: 0, total: 0, go: 1 };
    var R = recordsOf(setId), done = 0, first = 0, firstTried = 0, here = 0;
    (m.keys || []).forEach(function (k) {
      var b = R.best[k]; if (b === 'f' || b === '1' || b === 's') done++;
      if (R.first[k] === 'f') first++;
      if (R.first[k] !== '0') firstTried++;
      if (R.here[k] !== '0') here++;
    });
    /* firstTried: questions answered in the first round; here: questions touched in this round */
    return { done: done, first: first, firstTried: firstTried, here: here, total: (m.keys || []).length, go: R.go };
  }
  /* Start again: only a set with something answered on this go moves on */
  function newGo(sid) {
    var r = P.sets[sid], m = META.sets[sid]; if (!r || !m) return false;
    var R = recordsOf(sid), any = false, g1 = {}, best = {};
    (m.keys || []).forEach(function (k) {
      if (R.here[k] !== '0') any = true;
      if (R.first[k] !== '0') g1[k] = R.first[k];
      if (R.best[k] !== '0') best[k] = R.best[k];
    });
    if (!any) return false;
    r.g1 = g1; r.best = best; r.items = {}; r.go = R.go + 1;
    return true;
  }
  /* the records' letters (key order of the set as it is now) folded into one of this browser's maps: adds only */
  function foldLetters(sid, map, letters) {
    var keys = (META.sets[sid] || {}).keys || [], n = 0;
    keys.forEach(function (k, i) { var c = String(letters || '').charAt(i); if (!c || c === '0' || EN_RANK[c] == null) return; var was = map[k] || '0'; if (better(was, c) !== was) { map[k] = c; n++; } });
    return n;
  }
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
  /* how far a student is through a topic, or a whole year: answered, out of all its questions */
  function unitTally(uid) { var u = META.units[uid], d = 0, t = 0; if (u) u.sets.forEach(function (s) { var x = tallyBest(s); d += x.done; t += x.total; }); return { done: d, total: t }; }
  function yearTally(Y) { var d = 0, t = 0; (Y.units || []).forEach(function (uid) { var x = unitTally(uid); d += x.done; t += x.total; }); return { done: d, total: t }; }

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
      var t = tallyBest(m.set);
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
    /* the class in the teacher's spreadsheet says whose exams are when: the labs and the hub read the same key */
    if (mineY >= 9 && mineY <= 11) { try { localStorage.setItem('labs.examYear', String(examYearOf(mineY))); } catch (e) {} }
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
  /* Each year group's IGCSE exams, and so its syllabus (Daniel, 28 Sep 2026: "make very clear ... which syllabus is
     for what year"). The school year turns over on 1 August, so 2026–27 ends with the June 2027 exams. A student is
     kept as the year of their exams ('labs.examYear', shared with the hub and the labs' IGCSE 0610 badge), so next
     August a Year 9 becomes a Year 10 by itself. */
  function schoolYearEnd() { var d = new Date(); return d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear(); }
  function examYearOf(g) { return schoolYearEnd() + (11 - g); }
  function examLine(g) {
    var e = examYearOf(g), L = META.sylYears || [], hit = null, newest = null;
    L.forEach(function (v) {
      var m = /^(\d{4})(?:-(\d{4}))?$/.exec(v.id); if (!m) return;
      var a = +m[1], b = +(m[2] || m[1]);
      if (e >= a && e <= b) hit = v;
      if (!newest || b > newest.b) newest = { v: v, b: b };
    });
    var lab = function (id) { return String(id).replace('-', '\u2013'); };
    var s = 'Year ' + g + ' in ' + (schoolYearEnd() - 1) + '\u2013' + String(schoolYearEnd()).slice(2) + ': IGCSE exams in ' + e;
    if (hit) return s + ' \u2192 the syllabus for ' + lab(hit.id) + (hit.same ? ', word for word the same as ' + lab(hit.same) : '') + '.';
    return s + (newest ? ' \u2192 Cambridge has not published that syllabus yet; until it does, the newest is for ' + lab(newest.v.id) + '.' : '.');
  }
  function paintLedger(host, y) {
    host.innerHTML = '';
    var Y = META.years.filter(function (x) { return x.y === y; })[0];
    if (!Y) return;
    host.appendChild(h('p', 'ledger__exam', T.esc(examLine(Y.y))));
    var yt = yearTally(Y);
    host.appendChild(h('p', 'ledger__sum', '<b>' + T.esc(Y.title) + ':</b> ' + yt.done + ' of ' + yt.total + ' questions answered (' + pct(yt.done, yt.total) + '%)' +
      (me ? '' : ' \u00b7 <span class="ledger__note">Kept in this browser. Sign in with your school account and it is recorded for your teacher.' +
        (hasWork() ? ' Not your work? <button type="button" class="ledger__clear">Clear this computer</button>' : '') + '</span>')));
    var clr = host.querySelector('.ledger__clear');
    if (clr) clr.addEventListener('click', function () {
      if (!confirm('Clear this computer?\n\nThe answers kept in this browser are removed. Nothing in anybody\u2019s record changes.')) return;
      clearHere();
      try { localStorage.removeItem(OWNER_KEY); } catch (e) {}
      route();
      toast('Cleared. This computer keeps no answers now.');
    });
    Y.units.forEach(function (uid) {
      var u = META.units[uid]; if (!u) return;
      var a = h('a', 'unit' + (u.sets.length ? '' : ' is-soon'));
      a.href = '#/u/' + uid;
      var bars = '';
      ['kw', 'describe', 'explain', 'plan'].forEach(function (k) {
        var ids = u.sets.filter(function (s) { return META.sets[s] && META.sets[s].kind === k; });
        if (!ids.length) return;
        var d = 0, t = 0; ids.forEach(function (s) { var x = tallyBest(s); d += x.done; t += x.total; });
        bars += '<span class="mini mini--' + k + '"><span class="mini__l">' + KIND_NAME[k] + '</span><span class="mini__b"><i style="width:' + pct(d, t) + '%"></i></span></span>';
      });
      var ut = unitTally(uid);
      a.innerHTML = '<span class="unit__n">' + T.esc(u.n) + '</span><span><span class="unit__t">' + T.esc(u.title) + '</span><span class="unit__s">' +
        (u.sets.length ? u.sets.length + ' sets · ' + u.count + ' questions' : 'Coming soon') + '</span></span>' +
        '<span class="unit__bars">' + bars + '<span class="unit__pct">' + (ut.done ? ut.done + ' of ' + ut.total + ' · ' + pct(ut.done, ut.total) + '%' : 'Not started') + '</span></span>';
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
    var ut = unitTally(uid);
    if (ut.total) head.appendChild(h('p', 'uprog', '<span class="pbar pbar--big"><i style="width:' + pct(ut.done, ut.total) + '%"></i></span><b>' + ut.done + ' of ' + ut.total + '</b> questions answered in this topic · ' + pct(ut.done, ut.total) + '%'));
    w.appendChild(head);
    var W = (META.words || {})[uid];
    var FR = (META.frames || {})[uid] || [];
    if (W && W.length) { var wl = h('p', 'sec__p', '<a class="wordslink" href="#/w/' + uid + '">All ' + W.length + ' keywords of this topic, with their definitions' +
      (FR.length ? ', and its ' + FR.length + ' sentence frames' : '') + ' →</a>'); w.appendChild(wl); }
    var kinds = h('div', 'kinds');
    ['kw', 'describe', 'explain', 'plan'].forEach(function (k) {
      var ids = u.sets.filter(function (s) { return META.sets[s] && META.sets[s].kind === k; });
      if (!ids.length) return;
      var sec = h('section', 'kind kind--' + k);   /* one colour per kind, the same on every topic */
      sec.innerHTML = '<div class="kind__h"><h2>' + KIND_NAME[k] + '</h2></div><p class="kind__p">' + KIND_BLURB[k] + '</p>';
      ids.forEach(function (sid) {
        var m = META.sets[sid], t = tallyBest(sid), now = t.go > 1 ? tally(sid) : null;
        var a = h('a', 'set'); a.href = '#/s/' + sid;
        /* two rows: what the set is; then how big it is and how far you are */
        var mo = m.modes && (m.modes.data || m.modes.theory) ? (m.modes.theory ? ' · ' + m.modes.theory + ' from theory' : '') + (m.modes.data ? ' · ' + m.modes.data + ' from data' : '') : '';
        a.innerHTML = '<span class="set__main"><span class="set__t">' + T.esc(m.title) + '</span>' +
          (m.blurb ? '<span class="set__s">' + T.esc(m.blurb) + '</span>' : '') +
          '<span class="set__meta"><span class="set__n">' + t.total + ' questions' + mo + '</span>' +
          '<span class="set__bar"><span class="pbar"><i style="width:' + pct(t.done, t.total) + '%"></i></span><span class="set__pct">' + (t.done ? t.done + ' of ' + t.total + ' · ' + pct(t.done, t.total) + '%' : 'not started') + (now ? ' · round ' + t.go + ': ' + now.done + ' of ' + now.total : '') + '</span></span></span></span>' +
          '<span class="set__go">' + (t.done ? (t.done >= t.total ? 'Again' : 'Carry on') : 'Start') + ' →</span>';
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
    /* two columns that flow on their own: groups 1 and 3 on the left, 2 and 4 on the right, so a short
       group never leaves a hole under itself; --o keeps the reading order when they fold into one */
    var groups = h('div', 'cmdgroups'); w.appendChild(groups);
    var cols = [h('div', 'cmdcol'), h('div', 'cmdcol')]; cols.forEach(function (c) { groups.appendChild(c); });
    CMD_GROUPS.forEach(function (grp, gi) {
      var sec = h('section', 'cgrp'); sec.style.setProperty('--o', gi); sec.appendChild(h('h2', 'guide__h', T.esc(grp.title)));
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
      cols[gi % 2].appendChild(sec);
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
      /* a word the 2026–2029 syllabus does not name: its chip opens a line saying which syllabus had it, or that the idea
         is in the syllabus in other words (meta.past; a button, because a hover tip reaches no phone and no keyboard) */
      var p = E.pastOfId ? E.pastOfId(x.id) : null;
      var chip = !p ? '' : ' <button type="button" class="words__past words__past--' + (p.old ? 'old' : p.beyond ? 'beyond' : 'word') + '" aria-expanded="false">' +
        (p.old ? 'old syllabus \u00b7 until ' + T.esc(((META.past.st || {})[p.old] || {}).until || '') : p.beyond ? 'beyond 0610' : 'word not in 0610') + '</button>';
      g.appendChild(h('dt', 'words__t', T.esc(x.t) + (x.sup ? ' <span class="words__sup">Supplement</span>' : '') + chip + (x.ko && CFG.koreanGloss !== false ? ' <span class="words__ko" lang="ko">' + T.esc(x.ko) + '</span>' : '')));
      g.appendChild(h('dd', 'words__d', T.esc(x.d) + (p ? '<span class="words__pnote' + (p.old ? '' : ' words__pnote--plain') + '" hidden>' + E.pastText(p) + '</span>' : '')));
      dl.appendChild(g);
    });
    dl.addEventListener('click', function (e) {
      var b = e.target.closest('.words__past'); if (!b) return;
      var n = b.closest('.words__i').querySelector('.words__pnote'); if (!n) return;
      n.hidden = !n.hidden; b.setAttribute('aria-expanded', n.hidden ? 'false' : 'true');
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
    var w = h('div', 'col player player--' + (m.kind || 'method'));
    var u = unitOf(sid);
    var back = h('a', 'back', u ? '← Topic ' + T.esc(u.n) + ': ' + T.esc(u.title) : '← All topics');
    back.href = u ? '#/u/' + u.id : '#/';
    w.appendChild(back);
    var top = h('div', 'ptop');
    top.appendChild(h('p', 'ptop__t', T.esc(m.title)));
    var prog = h('p', 'ptop__p'); top.appendChild(prog);
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
      var pt = tally(sid), pb = tallyBest(sid);
      /* from round 2 on, right first time is round 1's, out of the questions answered in round 1: this round's
         would count questions already seen */
      prog.innerHTML = (pb.go > 1 ? 'Round ' + pb.go + ' · ' : '') + '<b>' + pt.done + ' of ' + pt.total + '</b> answered' +
        (pb.go === 1 && pt.first ? ' · ' + pt.first + ' right first time' : '') + ' · ' + pct(pt.done, pt.total) + '%' +
        (pb.go > 1 && pb.firstTried ? ' · round 1: ' + pb.first + ' of ' + pb.firstTried + ' right first time' : '');
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
      var t = tally(sid), tb = tallyBest(sid);
      if (t.done >= t.total) queueSync(sid, true);   /* finished: the records hear at once */
      var d = h('div', 'done');
      var firstNums = tb.go > 1
        ? (tb.firstTried ? '<div>' + tb.first + '/' + tb.firstTried + '<span>right first time in round 1</span></div>' : '')
        : '<div>' + t.first + '/' + t.total + '<span>right first time</span></div>';
      d.innerHTML = '<p class="eyebrow">' + T.esc(m.title) + (tb.go > 1 ? ' \u00b7 round ' + tb.go : '') + '</p><h2>' + (t.done >= t.total ? 'Set finished.' : 'Not finished yet.') + '</h2>' +
        '<div class="done__nums"><div>' + t.done + '/' + t.total + '<span>answered</span></div>' + firstNums + '</div>';
      var row = h('div', 'card__foot');
      /* only a round with answers in it can be started again */
      var again = tb.here ? h('button', 'btn', 'Start again') : null;
      if (again) {
        again.type = 'button';
        again.addEventListener('click', function () {
          if (!confirm('Start this set again?\n\nYour answers will be cleared from this page, so you can practise the questions again. Your record keeps everything you have already done.')) return;
          if (!newGo(sid)) return;
          r = rec(sid); save(); queueSync(sid, true); show(0);
          toast('Round ' + goOf(r) + ' has started. Your record keeps everything you did before.');
        });
      }
      var next = nextSet(sid);
      if (next) { var nx = h('a', 'btn btn--go', 'Next set: ' + T.esc(META.sets[next].title) + ' →'); nx.href = '#/s/' + next; row.appendChild(nx); }
      var bk = h('a', 'btn', u ? 'Back to the topic' : 'Back to the front'); bk.href = u ? '#/u/' + u.id : '#/';
      row.appendChild(bk); if (again) row.appendChild(again);
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
      card.innerHTML = '<span>Signed in as <b>' + T.esc((me.name || me.email).split(' ')[0]) + '</b></span><span class="who__sync" id="syncState">' + T.esc(syncText()) + '</span>' +
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
  /* ---------- a shared computer ----------
     This browser's work belongs to the account it was last saved for. Another account signing in must not
     have it pushed into THEIR record (it is safe in its owner's already), so it leaves this browser first.
     Work done signed out, before anybody signed in here, has no owner yet and goes to the first account
     that signs in. "Clear this computer" (the front page, signed out) empties the browser by hand. */
  var OWNER_KEY = 'bio-english-lab.owner';
  function hasWork() { return Object.keys(P.sets).some(function (sid) { var r = P.sets[sid]; return r && ((r.items && Object.keys(r.items).length) || goOf(r) > 1); }); }
  function clearHere() { P = { sets: {}, year: P.year }; save(); pending = {}; }
  function claimFor(email) {
    var was = '';
    try { was = localStorage.getItem(OWNER_KEY) || ''; } catch (e) {}
    if (was && email && was !== email && hasWork()) {
      clearHere();
      toast('This computer had another student\u2019s work. It stays in their record; it was not added to yours.');
    }
    try { if (email) localStorage.setItem(OWNER_KEY, email); } catch (e) {}
  }
  if (SI) SI.on(function (v) { var was = me && me.email; me = v; paintWho(); if (v && v.email !== was) { server = null; record = null; claimFor(v.email); fetchMine(); fetchRecord(); } if (!v) { server = null; record = null; route(); } });

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
          record = { has: reflected + unfinished > 0, reflected: reflected, assessments: Number(j.assessments) || reflected, teacher: !!j.teacher,
                     practice: !!j.practice };
        }
        paintRecord();
      }).catch(function () {});
  }
  function recordLine() {
    if (!REC || !me || !record) return '';
    if (record.why === 'not a school account') return 'Your dashboard needs your …' + T.esc(REC.domain || 'school') + ' account.';
    /* practice (the labs, and this site) shows on the dashboard before any reflection (Sept 2026) */
    if (!record.has && record.practice) return 'Your practice so far is on <a href="' + T.esc(REC.url) + '" target="_blank" rel="noopener">your dashboard</a>. After your first assessment reflection, it also shows which command words cost you marks.';
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
  function post(body, leaving) {
    var opts = { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) };
    if (leaving) opts.keepalive = true;          /* the page is going: let the request outlive it */
    return fetch(CFG.submitUrl, opts)
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  /* what a set looks like as one short string: per question 0 untouched, t tried, 1 right,
     f right first time, s answer shown */
  function snap(sid) {
    var m = META.sets[sid], r = P.sets[sid] || { items: {} };
    return (m.keys || []).map(function (k) { var s = r.items[k]; return !s ? '0' : s.first ? 'f' : s.ok ? '1' : s.shown ? 's' : s.t ? 't' : '0'; }).join('');
  }
  var pending = {}, syncTimer = null;
  /* what the sign-in card says about recording: a student must be able to see that their work
     reaches their teacher — there is no hand-in button, saving is automatic */
  var syncState = 'idle';   /* idle · saving · saved · failed · off */
  function syncText() {
    if (!syncOn()) return 'progress kept in this browser';
    if (!server) return 'recording…';
    if (!server.onList) return 'not on a class list yet — kept in this browser';
    return syncState === 'saving' ? 'saving…' : syncState === 'failed' ? 'could not save — will retry' : 'saved for your teacher \u2713';
  }
  function setSync(st) { syncState = st; var el = document.getElementById('syncState'); if (el) el.textContent = syncText(); }
  /* Two minutes after the last answer, one save carries everything since (`now` sends at once:
     a set finished, a sign-in, the page being left). Forty pupils on one script is comfortable
     at that pace; a save the records could not take goes again a minute later. */
  var SAVE_AFTER = 120000;
  function queueSync(sid, now) {
    if (!syncOn() || !me) return;
    pending[sid] = true;
    if (now) { clearTimeout(syncTimer); syncTimer = null; flush(); return; }
    if (!syncTimer) syncTimer = setTimeout(function () { syncTimer = null; flush(); }, SAVE_AFTER);
  }
  function flush(leaving) {
    var ids = Object.keys(pending); if (!ids.length) return;
    var live = SI.live();
    if (!live) { SI.renew(CID, function (v) { if (v) flush(); }); return; }
    pending = {};
    setSync('saving');
    var sets = {};
    /* this go's letters (snap) with its go, the first go (snap1) and the best ever: the records keep all three */
    ids.forEach(function (sid) {
      var t = tallyBest(sid), R = recordsOf(sid);
      sets[sid] = { done: t.done, first: t.first, total: t.total, snap: snap(sid), v: META.sets[sid].v,
                    go: R.go, snap1: lettersOf(sid, R.first), best: lettersOf(sid, R.best) };
    });
    post({ action: 'english.save', token: live.token, sets: sets, at: new Date().toISOString() }, leaving)
      .then(function (j) { if (!j || !j.ok) { ids.forEach(function (s) { pending[s] = true; }); setSync('failed'); clearTimeout(syncTimer); syncTimer = setTimeout(function () { syncTimer = null; flush(); }, 60000); if (j && j.why && j.why !== 'not signed in') toast('Your progress was not recorded: ' + j.why); } else setSync('saved'); })
      .catch(function () { ids.forEach(function (s) { pending[s] = true; }); setSync('failed'); });
  }
  addEventListener('pagehide', function () { if (Object.keys(pending).length) flush(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && Object.keys(pending).length) flush(true); });
  function fetchMine() {
    if (!syncOn() || !me) return;
    var live = SI.live();
    if (!live) { SI.renew(CID, function (v) { if (v) fetchMine(); }); return; }
    post({ action: 'english.mine', token: live.token }).then(function (j) {
      if (!j || !j.ok) { setSync('failed'); return; }
      server = j;
      setSync(syncState === 'saving' ? 'saving' : 'saved');
      paintWho();
      /* bring back progress made on another computer: only ever adds. A set the records hold on a NEWER
         go was started again elsewhere: this browser moves on too, keeping what it had in its first go and
         best. An OLDER go (or an older script that knows no goes) never reaches the page — its answers
         still count for the first go and the best. */
      var added = 0, newer = 0;
      Object.keys(j.sets || {}).forEach(function (sid) {
        var m = META.sets[sid], s = j.sets[sid]; if (!m || !s || s.v !== m.v) return;
        var r = rec(sid), sg = s.go > 1 ? Math.floor(s.go) : 1, lg = goOf(r);
        if (sg > lg) {
          var R0 = recordsOf(sid), g1 = {}, bst = {};
          m.keys.forEach(function (k) { if (R0.first[k] !== '0') g1[k] = R0.first[k]; if (R0.best[k] !== '0') bst[k] = R0.best[k]; });
          r.g1 = g1; r.best = bst; r.items = {}; r.go = sg; lg = sg; newer++;
        }
        r.best = r.best || {};
        if (s.best) foldLetters(sid, r.best, s.best);
        var here = s.here != null ? String(s.here) : String(s.snap || '');   /* this round */
        if (s.snap1) { if (lg > 1) { r.g1 = r.g1 || {}; foldLetters(sid, r.g1, s.snap1); } else foldLetters(sid, r.best, s.snap1); }
        /* an older round's letters count for the best only: only snap1 is ever the first round (the lab's rule too) */
        if (sg < lg) { foldLetters(sid, r.best, here); return; }
        if (!here) return;
        m.keys.forEach(function (k, i) {
          var c = here.charAt(i); if (!c || c === '0') return;
          var cur = r.items[k] || {};
          if (c === 'f' && !cur.first) { cur.first = 1; cur.ok = 1; added++; }
          else if (c === '1' && !cur.ok) { cur.ok = 1; added++; }
          else if (c === 's' && !cur.shown && !cur.ok) { cur.shown = 1; added++; }
          else if (c === 't' && !cur.t) { cur.t = 1; }
          r.items[k] = cur;
        });
      });
      if (added || newer) { save(); toast(newer ? 'Your record is back. A set was started again on another computer, so it is on its new round here too.' : 'Your answers from another computer are back.'); }
      else save();
      /* and the other way: work done in this browser before signing in has never been sent —
         queue every set with an answer in it (the server merge only ever adds, so nothing is lost) */
      var toSend = Object.keys(P.sets).filter(function (sid) { var r = P.sets[sid]; return META.sets[sid] && r && ((r.items && Object.keys(r.items).length) || goOf(r) > 1); });
      toSend.forEach(function (sid, i) { queueSync(sid, i === toSend.length - 1); });
      route();
    }).catch(function () {});
  }
  function paintHomework(host) {
    host.innerHTML = '';
    if (!server || !server.homework || !server.homework.length) return;
    var box = h('section', 'hw');
    box.appendChild(h('h2', 'hw__h', 'Your homework'));
    box.appendChild(h('p', 'hw__p', 'Your answers are saved for your teacher as you go. There is nothing to hand in: when a set reaches 100%, it is done.'));
    server.homework.forEach(function (hw) {
      var row = h('div', 'hw__row');
      var d = 0, t = 0;
      (hw.sets || []).forEach(function (s) { var x = tallyBest(s); d += x.done; t += x.total; });
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
      var t = tallyBest(sid), u = META.units[m.unit];
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
  if (me) { claimFor(me.email); fetchMine(); fetchRecord(); }
})();
