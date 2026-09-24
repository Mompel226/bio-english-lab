/* ============================================================
   signin.js — one Google sign-in for every page on the site.
   SHARED: labs-shared/signin.js is the source. Each lab's tools/build.mjs and each hub's
   tools/stamp.mjs copy it in as js/signin.js, so never edit a copy.

   Every hub and lab is served from one origin, nlcsbiology.com, so they share one
   localStorage — and so one sign-in can serve them all. Sign in on the Biology Hub and every
   lab already knows whose work it is; sign in inside a lab and the hub knows too. Until
   17 Sep 2026 each page kept its own, and a student who had just signed in on the front door
   was asked again at the first lab they opened.

   Google's sign-in is an ID token that lasts an hour. What a student means by "signed in"
   lasts until they sign out. So two questions are kept apart:

     SignIn.who()    who signed in on this browser and has not signed out since. Kept after
                     the token runs out, so a page can still greet them and renew it.
     SignIn.live()   the same, but only while the token has more than a minute left — the
                     only thing ever worth sending to a server.

   SignIn.renew() asks Google for a new token for THAT SAME account, without a click when it
   can: Google gives one at once to somebody still signed in to Google in this browser who has
   signed in here before. Otherwise it may show its own "Continue as …" prompt, or nothing, and
   the page offers its sign-in button exactly as before. It never swaps one student for another
   on a shared computer: the account it asks for is the one remembered.

   Nothing here is trusted by a server. The token is opened only to show a name and to know
   when it runs out; the labs script asks Google to check its signature before it reads a word.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'biology.signin';
  var MARGIN = 60 * 1000;               /* a token with less than a minute left is treated as spent */

  /* Where sign-ins were kept before this file. Ours are folded in once and then removed; the
     Veterinary Society page keeps its own and is only ever read, never tidied away. */
  var OURS = /^(biology-hub|[a-z0-9-]+-lab)\.signin$/;
  var THEIRS = ['vetsoc.signin'];

  var cid = '', listeners = [], waiting = null, waitTimer = null;

  function store() { try { return global.localStorage || null; } catch (e) { return null; } }
  function get(k) {
    var s = store(); if (!s) return null;
    try { return JSON.parse(s.getItem(k) || 'null'); } catch (e) { return null; }
  }
  /* only something with the shape of a sign-in counts — never a half-written or foreign value */
  function shape(v) {
    if (!v || typeof v !== 'object' || typeof v.token !== 'string' || !v.token ||
        typeof v.email !== 'string' || !v.email || !isFinite(+v.exp)) return null;
    return { token: v.token, name: String(v.name || v.email), email: v.email, exp: +v.exp };
  }
  function fresh(v, within) { return !!(v && v.token && v.exp * 1000 > Date.now() + (within || MARGIN)); }
  function who() { return shape(get(KEY)); }
  function live() { var v = who(); return fresh(v) ? v : null; }

  /* The token's middle part, decoded: a name to show and the time it runs out. */
  function parse(jwt) {
    try {
      var b = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var j = JSON.parse(decodeURIComponent(escape(atob(b))));
      return shape({ token: String(jwt), name: j.name || j.email || '', email: j.email || '', exp: j.exp || 0 });
    } catch (e) { return null; }
  }

  /* ---------- once per page: fold in a sign-in kept the old way ---------- */
  (function adopt() {
    var s = store(); if (!s) return;
    var ours = [];
    try { for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && OURS.test(k)) ours.push(k); } }
    catch (e) { return; }
    if (!who()) {
      var best = null;
      ours.concat(THEIRS).forEach(function (k) { var v = shape(get(k)); if (v && (!best || v.exp > best.exp)) best = v; });
      if (best) { try { s.setItem(KEY, JSON.stringify(best)); } catch (e) {} }
    }
    ours.forEach(function (k) { try { s.removeItem(k); } catch (e) {} });
  })();

  /* ---------- telling the page ---------- */
  function tell(v, here) {
    listeners.slice().forEach(function (fn) { try { fn(v, here); } catch (e) {} });
  }
  function on(fn) { if (typeof fn === 'function') listeners.push(fn); }

  /* Another tab of this site signed in, renewed, or signed out. `storage` fires only in the
     OTHER tabs, so this page's own changes are told directly. */
  try {
    global.addEventListener('storage', function (e) {
      if (e.key !== KEY && e.key !== null) return;
      var v = who();
      if (waiting && fresh(v)) settle(v, '');
      tell(v, false);
    });
  } catch (e) {}

  /* ---------- Google's script ---------- */
  function gis() { return !!(global.google && global.google.accounts && global.google.accounts.id); }

  /* It arrives on its own time, and a school filter may block it: fn(true) once it is here,
     fn(false) after `ms` without it. */
  function loaded(fn, ms) {
    if (gis()) { fn(true); return; }
    var t0 = Date.now();
    (function wait() {
      if (gis()) { fn(true); return; }
      if (Date.now() - t0 > (ms || 10000)) { fn(false); return; }
      setTimeout(wait, 150);
    })();
  }

  /* One configuration for the whole page, whoever asks. `hint` is set only while renewing, so
     that Google renews the remembered account; a button pressed on purpose must be free to
     choose any account, which is why every button and every sign-out sets it again without. */
  function init(hint) {
    var cfg = { client_id: cid, callback: got, auto_select: true };
    if (hint) cfg.login_hint = hint;
    google.accounts.id.initialize(cfg);
  }
  function setUp(clientId) {
    if (clientId) cid = String(clientId);
    if (!cid || !gis()) return false;
    /* not while a renewal is out: that would take the hint away from the prompt on screen */
    if (!waiting) { try { init(''); } catch (e) { return false; } }
    return true;
  }
  function button(el, clientId, look) {
    if (!el || !setUp(clientId)) return false;
    try { google.accounts.id.renderButton(el, look || {}); return true; } catch (e) { return false; }
  }

  function got(res) {
    var v = res && res.credential ? parse(res.credential) : null;
    if (!v) return;
    var s = store();
    try { if (s) s.setItem(KEY, JSON.stringify(v)); } catch (e) {}
    tell(v, true);          /* first, so every page's own state is current … */
    settle(v, '');          /* … before anything that was waiting carries on */
  }

  /* ---------- renewing ---------- */
  function settle(v, why) {
    clearTimeout(waitTimer);
    var w = waiting; waiting = null;
    (w || []).forEach(function (fn) { try { fn(v, why); } catch (e) {} });
  }
  /* done(who) with a token good for at least `within` ms (a minute unless told otherwise), or
     done(null, why). With nobody remembered this is an ordinary One Tap prompt, which is what
     pressing Sync while signed out has always done. */
  function renew(clientId, done, within) {
    if (clientId) cid = String(clientId);
    var have = who();
    if (fresh(have, within)) { if (done) done(have, ''); return; }
    if (waiting) { if (done) waiting.push(done); return; }
    waiting = done ? [done] : [];
    var hint = have ? have.email : '';
    loaded(function (ok) {
      if (!waiting) return;                                /* settled meanwhile, from another tab */
      if (!ok || !cid) { settle(null, 'unavailable'); return; }
      try {
        init(hint);
        google.accounts.id.prompt(function (n) {
          if (!n || !waiting) return;
          if (n.isSkippedMoment && n.isSkippedMoment()) settle(null, 'skipped');
          else if (n.isDismissedMoment && n.isDismissedMoment()) {
            if (!(n.getDismissedReason && n.getDismissedReason() === 'credential_returned')) settle(null, 'dismissed');
          }
          else if (n.isNotDisplayed && n.isNotDisplayed()) settle(null, 'not shown');
        });
      } catch (e) { settle(null, 'unavailable'); return; }
      clearTimeout(waitTimer);
      waitTimer = setTimeout(function () { settle(null, 'no answer'); }, 60000);
    });
  }

  /* ---------- signing out, everywhere ---------- */
  function out() {
    var s = store();
    if (s) {
      try { s.removeItem(KEY); } catch (e) {}
      THEIRS.forEach(function (k) { try { s.removeItem(k); } catch (e) {} });
    }
    try { if (gis()) { google.accounts.id.disableAutoSelect(); if (cid) init(''); } } catch (e) {}
    settle(null, 'signed out');
    tell(null, true);
  }

  global.SignIn = { KEY: KEY, who: who, live: live, fresh: fresh, setUp: setUp, loaded: loaded,
                    button: button, renew: renew, out: out, on: on };
})(window);
