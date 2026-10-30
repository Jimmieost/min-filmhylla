// Static local development server, using only Node's standard library.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.argv[2] || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const parts = pathname.split('/');
    if (parts.some(part => part.startsWith('.') || part.includes('\\'))) { response.writeHead(403); response.end('Forbidden'); return; }
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(root.endsWith(sep) ? root : `${root}${sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Filen finns inte.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Min Filmhylla: http://localhost:${server.address().port}`));
server.on('error', error => { console.error(`Kunde inte starta servern: ${error.message}`); process.exitCode = 1; });
