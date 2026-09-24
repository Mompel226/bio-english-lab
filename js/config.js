/* ============================================================
   config.js — the settings Dr Mompel changes by hand. Nothing here is generated.
   ============================================================ */
window.AL_CONFIG = {

  /* Where a signed-in student's progress is saved, and where their homework is read from: the
     labs' own Apps Script, the same /exec address as the Biology Hub's js/local.js. One spreadsheet,
     one teacher page and one homework list serve the labs and this site together (Daniel's choice,
     19 Sep 2026); this site's work lands in its "✍️ Bio English" tab. Leave it empty and the site
     still works: progress stays in the browser and no homework is shown. */
  submitUrl: 'https://script.google.com/macros/s/AKfycbzwjMHaa88OL_GzR8wZ2mV6a8rs1CKYahbW5iOTQPyzWzCGIrAZPApGsP2oujK34tRc/exec',

  /* The same Google sign-in as the Biology Hub and every lab, so a student signed in there is
     signed in here. A Client ID is a name-tag for the app, not a secret. */
  googleClientId: '749068441640-jgh9s0rbg8ed9hl14mtv6kdhg5jg6ddf.apps.googleusercontent.com',

  /* Each student's own dashboard (the Assessment Reflection System's record page). It shows how
     they did on every command word and topic, so it is where a student decides what to practise
     here. There is one address for everyone: the page knows who is looking from their school
     Google sign-in. Before offering the link the site asks the labs' script — the same `record`
     question the Biology Hub asks — whether this student has reflected yet: a student who has not
     done a first reflection is told so, instead of being sent to an empty page. The same two
     addresses as the hub's js/local.js. Delete this block and the link never appears. */
  record: {
    askUrl: 'https://script.google.com/macros/s/AKfycbzwjMHaa88OL_GzR8wZ2mV6a8rs1CKYahbW5iOTQPyzWzCGIrAZPApGsP2oujK34tRc/exec',
    url: 'https://script.google.com/a/macros/nlcsjeju.kr/s/AKfycbwAAX9kcTatrOrUcKF3uvhYHrTULe4xQvQ4oE7nAzKW5L-7-Z7A1mQ8Tt3LWap3ONic/exec?page=student',
    domain: 'nlcsjeju.kr'
  },

  /* Show the Korean name of a keyword under its English one, after it has been answered.
     The translations come from the keyword list shared with the reflection system. */
  koreanGloss: true
};
