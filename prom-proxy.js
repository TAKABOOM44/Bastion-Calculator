// Власний проксі для Prom.ua (заміна npx local-cors-proxy).
// Потрібен тому, що my.prom.ua не дозволяє прямі запити з браузера (CORS).
// Запусти цей файл (або start-prom-proxy-custom.bat) і залиш вікно відкритим,
// поки працюєш із сайтом Диспетчер замовлень.
//
// УВАГА: якщо стара версія проксі (npx local-cors-proxy) вже запущена на порту 8787 —
// спочатку закрий те вікно, інакше цей скрипт не зможе стартувати (порт зайнятий).

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8787;
const PROM_HOST = 'my.prom.ua';
const LOG_FILE = path.join(__dirname, 'prom-proxy.log');

function log(line){
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  try{ fs.appendFileSync(LOG_FILE, stamped + '\n'); }catch(e){}
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url.startsWith('/prom/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, description: 'Використовуй /prom/<шлях до api.prom.ua>' }));
    return;
  }

  const targetPath = req.url.replace('/prom', '');
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const headers = { 'Content-Type': req.headers['content-type'] || 'application/json' };
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    if (body.length) headers['Content-Length'] = body.length;

    log(`${req.method} ${targetPath}`);

    const proxyReq = https.request(
      { host: PROM_HOST, path: targetPath, method: req.method, headers },
      (proxyRes) => {
        const resChunks = [];
        proxyRes.on('data', (chunk) => resChunks.push(chunk));
        proxyRes.on('end', () => {
          const resBody = Buffer.concat(resChunks);
          log(`відповідь ${proxyRes.statusCode}: ${resBody.toString().slice(0, 500)}`);
          res.writeHead(proxyRes.statusCode, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
          res.end(resBody);
        });
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, description: err.message }));
    });

    if (body.length) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  log(`Prom.ua-проксі запущено: http://localhost:${PORT}`);
  log('Залиш це вікно відкритим, поки працюєш із сайтом Диспетчер замовлень.');
});
