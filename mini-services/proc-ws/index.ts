// Process WebSocket mini-service.
// Receives process events from the main Next.js runner (via a small HTTP
// POST bridge), and forwards them to subscribed browser clients.
//
// Clients connect via io("/?XTransformPort=3003").
// They subscribe to a room per projectId: `join:project:<id>`.
//
// The main Next.js process calls POST /emit with a JSON event body when a
// log line, status change, or process exit occurs. (This keeps the WS service
// process isolated from the Prisma database.)

import { createServer } from 'node:http';
import { Server } from 'socket.io';

const PORT = 3003;

const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/emit')) {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      try {
        const ev = JSON.parse(body);
        // Broadcast to the per-project room.
        if (ev.projectId) io.to(`project:${ev.projectId}`).emit('event', ev);
        // Also broadcast a global stream for the dashboard "live" view.
        io.emit('event', ev);
      } catch (e) {
        console.error('emit parse failed:', e);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ service: 'cybercc-proc-ws', port: PORT }));
});

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  // Client sends `subscribe:project:<id>` to join a project room.
  socket.on('subscribe', (msg: any) => {
    if (!msg || typeof msg !== 'object') return;
    if (typeof msg.projectId === 'string' && /^[\w-]+$/.test(msg.projectId)) {
      socket.join(`project:${msg.projectId}`);
      socket.emit('subscribed', { projectId: msg.projectId });
    }
  });
  socket.emit('hello', { service: 'cybercc-proc-ws', port: PORT });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`cybercc-proc-ws listening on 127.0.0.1:${PORT}`);
});
