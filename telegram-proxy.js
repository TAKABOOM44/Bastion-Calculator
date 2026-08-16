// Локальний проксі для Telegram Bot API.
// Потрібен тому, що api.telegram.org не дозволяє прямі запити з браузера (CORS).
// Запусти цей файл (або start-telegram-proxy.bat) і залиш вікно відкритим,
// поки працюєш із сайтом Диспетчер замовлень.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8788;
const TELEGRAM_HOST = 'api.telegram.org';
const LOG_FILE = path.join(__dirname, 'telegram-proxy.log');

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

    // Не пишемо в лог сам токен — тільки назву методу (те, що після останнього "/")
    const methodName = targetPath.split('/').pop();
    log(`${req.method} ${methodName}`);

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
          const resBody = Buffer.concat(resChunks);
          // Логуємо повну відповідь тільки для getUpdates (там потрібен chat_id) — для інших методів коротко
          if (methodName === 'getUpdates') {
            log(`відповідь getUpdates: ${resBody.toString().slice(0, 3000)}`);
          } else {
            log(`відповідь ${methodName}: ${proxyRes.statusCode}`);
          }
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(resBody);
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
  log(`Telegram-проксі запущено: http://localhost:${PORT}`);
  log('Залиш це вікно відкритим, поки працюєш із сайтом Диспетчер замовлень.');
});
