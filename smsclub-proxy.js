// Локальний проксі для SMS Club API.
// Потрібен тому, що im.smsclub.mobi не дозволяє прямі запити з браузера (CORS).
// Запусти цей файл (або start-smsclub-proxy.bat) і залиш вікно відкритим,
// поки працюєш із сайтом Диспетчер замовлень.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8789;
const SMSCLUB_HOST = 'im.smsclub.mobi';
const LOG_FILE = path.join(__dirname, 'smsclub-proxy.log');

function log(line){
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  try{ fs.appendFileSync(LOG_FILE, stamped + '\n'); }catch(e){}
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url.startsWith('/sms/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Використовуй /sms/<метод>, напр. /sms/send' }));
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const headers = { 'Content-Type': 'application/json' };
    if (req.headers['authorization']) headers['Authorization'] = req.headers['authorization'];
    if (body.length) headers['Content-Length'] = body.length;

    log(`${req.method} ${req.url}`);

    const proxyReq = https.request(
      { host: SMSCLUB_HOST, path: req.url, method: req.method, headers },
      (proxyRes) => {
        const resChunks = [];
        proxyRes.on('data', (chunk) => resChunks.push(chunk));
        proxyRes.on('end', () => {
          const resBody = Buffer.concat(resChunks);
          log(`відповідь ${proxyRes.statusCode}: ${resBody.toString().slice(0, 500)}`);
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(resBody);
        });
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    if (body.length) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  log(`SMS Club-проксі запущено: http://localhost:${PORT}`);
  log('Залиш це вікно відкритим, поки працюєш із сайтом Диспетчер замовлень.');
});
