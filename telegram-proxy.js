// Локальний проксі для Telegram Bot API.
// Потрібен тому, що api.telegram.org не дозволяє прямі запити з браузера (CORS).
// Запусти цей файл (або start-telegram-proxy.bat) і залиш вікно відкритим,
// поки працюєш із сайтом Диспетчер замовлень.

const http = require('http');
const https = require('https');

const PORT = 8788;
const TELEGRAM_HOST = 'api.telegram.org';

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url.startsWith('/telegram/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, description: 'Використовуй /telegram/bot<TOKEN>/sendMessage' }));
    return;
  }

  const targetPath = req.url.replace('/telegram', '');
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    const proxyReq = https.request(
      {
        host: TELEGRAM_HOST,
        path: targetPath,
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
      },
      (proxyRes) => {
        const resChunks = [];
        proxyRes.on('data', (chunk) => resChunks.push(chunk));
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(Buffer.concat(resChunks));
        });
      }
    );

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, description: err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`Telegram-проксі запущено: http://localhost:${PORT}`);
  console.log('Залиш це вікно відкритим, поки працюєш із сайтом Диспетчер замовлень.');
});
