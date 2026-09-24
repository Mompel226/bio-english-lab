#!/usr/bin/env node
/* Runs _selftest.html in headless Chrome and prints its verdict. Exit 1 on any failure.
   Needs the static server: python3 -m http.server 8799 --bind 127.0.0.1 (from Biology Hub/). */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ci = process.argv.indexOf('--content');
const url = 'http://127.0.0.1:8799/labs/bio-english-lab/_selftest.html' + (ci > 0 ? '?content=' + encodeURIComponent(process.argv[ci + 1]) : '');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alst-'));
let dom = '';
/* headless Chrome now and then hangs on start-up: try up to three times, each with its own profile */
for (let attempt = 1; attempt <= 3 && !/<pre id="out">[✓✗]/.test(dom); attempt++) {
  try {
    dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--user-data-dir=' + fs.mkdtempSync(path.join(os.tmpdir(), 'alst-')), '--timeout=20000', '--dump-dom', url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()],
      { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { dom = String((e && e.stdout) || ''); if (attempt === 3 && !dom) { console.error('Chrome did not run: ' + e.message); process.exit(2); } }
}
const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
const out = m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"') : '(no result)';
console.log(out);
process.exit(/^✓/.test(out) ? 0 : 1);
