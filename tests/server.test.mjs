import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('static server delivers root, all shell files, correct MIME and denies private paths', async () => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/serve.mjs', import.meta.url)), '0'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const address = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 5000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/localhost:\d+/); if (match) { clearTimeout(timeout); resolve(match[0]); } });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited: ${code}`)); });
    });
    const paths = ['/', '/index.html', '/css/styles.css', '/js/app.js', '/js/router.js', '/js/components.js', '/js/db.js', '/js/model.js', '/js/movies.js', '/js/tmdb.js', '/js/stats.js', '/js/settings.js', '/js/backup.js', '/js/pwa.js', '/sw.js', '/manifest.webmanifest', '/assets/icons/sprite.svg', '/assets/icons/icon.svg', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/icon-maskable-512.png', '/assets/icons/apple-touch-icon.png', '/assets/icons/tmdb.svg', '/assets/icons/poster-placeholder.svg'];
    for (const path of paths) {
      const response = await fetch(`${address}${path}`);
      assert.equal(response.status, 200, path); assert.ok((await response.arrayBuffer()).byteLength > 0, path);
    }
    assert.match((await fetch(`${address}/js/app.js`)).headers.get('content-type'), /text\/javascript/);
    assert.match((await fetch(`${address}/manifest.webmanifest`)).headers.get('content-type'), /application\/manifest\+json/);
    for (const path of ['/.git/config', '/.env', '/missing', '/%2eenv']) assert.ok(!(await fetch(`${address}${path}`)).ok, path);
    const head = await fetch(address, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await fetch(address, { method: 'POST' })).status, 405);
  } finally { child.kill(); }
});
