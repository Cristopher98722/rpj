const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const root = __dirname;
const port = process.env.PORT || 8123;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(root, path.normalize(urlPath));
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- WebSocket
function wsAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function sendFrame(socket, opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function wsSend(conn, obj) {
  try {
    sendFrame(conn.socket, 1, Buffer.from(JSON.stringify(obj)));
  } catch (e) {}
}

function parseFrames(buffer) {
  let i = 0;
  const msgs = [];
  while (buffer.length - i >= 2) {
    const b0 = buffer[i];
    const b1 = buffer[i + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;
    if (len === 126) {
      if (buffer.length - i < 4) break;
      len = buffer.readUInt16BE(i + 2);
      off = 4;
    } else if (len === 127) {
      if (buffer.length - i < 10) break;
      len = Number(buffer.readBigUInt64BE(i + 2));
      off = 10;
    }
    if (!masked) {
      return { msgs: [{ error: 'unmasked' }], remaining: Buffer.alloc(0) };
    }
    if (buffer.length - i < off + 4 + len) break;
    const mask = buffer.slice(i + off, i + off + 4);
    const data = Buffer.alloc(len);
    for (let j = 0; j < len; j++) data[j] = buffer[i + off + 4 + j] ^ mask[j & 3];
    i += off + 4 + len;
    if (opcode === 1) msgs.push(data.toString('utf8'));
    else if (opcode === 8) msgs.push('__CLOSE__');
    else if (opcode === 9) sendFrame(conn.socket, 10, data);
  }
  return { msgs, remaining: buffer.slice(i) };
}

// ---------------------------------------------------------------- Salas
const rooms = new Map();

function roomOf(conn) {
  return rooms.get(conn.room);
}

function leave(conn) {
  const room = roomOf(conn);
  if (!room) return;
  room.players = room.players.filter((p) => p !== conn);
  conn.room = null;
  for (const p of room.players) wsSend(p, { t: 'peerLeave' });
  if (room.players.length === 0) rooms.delete(room.code);
}

function handleMessage(conn, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'join') {
    const code = String(msg.room || '').trim().toUpperCase();
    if (!code || !/^[0-9A-Z]{4}$/.test(code)) {
      wsSend(conn, { t: 'error', msg: 'Código de sala inválido' });
      return;
    }
    let room = rooms.get(code);
    if (!room) {
      room = { code, players: [] };
      rooms.set(code, room);
    }
    if (room.players.length >= 2) {
      wsSend(conn, { t: 'error', msg: 'Sala llena' });
      return;
    }
    conn.room = code;
    conn.name = String(msg.name || 'Jugador').slice(0, 16);
    conn.hero = String(msg.hero || 'gato');
    room.players.push(conn);
    wsSend(conn, { t: 'join', ok: true, room: code, idx: room.players.length });
    for (const p of room.players) {
      if (p !== conn) wsSend(p, { t: 'peerJoin', name: conn.name, hero: conn.hero });
    }
    if (room.players.length === 2) {
      for (const p of room.players) wsSend(p, { t: 'full' });
    }
    return;
  }
  if (msg.t === 'leave' || msg.t === 'exit') {
    leave(conn);
    return;
  }
  if (msg.t === 'state' || msg.t === 'kill' || msg.t === 'cleared' || msg.t === 'next' ||
      msg.t === 'atk' || msg.t === 'skill' || msg.t === 'ready' || msg.t === 'laugh') {
    const room = roomOf(conn);
    if (!room) return;
    for (const p of room.players) {
      if (p !== conn) wsSend(p, msg);
    }
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  const url = (req.url || '').split('?')[0];
  if (!key || url !== '/ws') {
    socket.destroy();
    return;
  }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + wsAccept(key) + '\r\n\r\n'
  );

  const conn = { socket, room: null, name: 'Jugador', hero: 'gato', buf: null };
  socket.on('data', (chunk) => {
    conn.buf = conn.buf ? Buffer.concat([conn.buf, chunk]) : chunk;
    const r = parseFrames(conn.buf);
    conn.buf = r.remaining;
    for (const m of r.msgs) {
      if (m === '__CLOSE__') {
        leave(conn);
        socket.end();
        return;
      }
      if (m && m.error) {
        leave(conn);
        socket.destroy();
        return;
      }
      try {
        handleMessage(conn, JSON.parse(m));
      } catch (e) {}
    }
  });
  socket.on('close', () => leave(conn));
  socket.on('error', () => {});
});

server.listen(port, '0.0.0.0', () => {
  console.log('Juego listo en tu PC:     http://localhost:' + port);
  const ip = lanIP();
  if (ip !== 'localhost') {
    console.log('Juega desde tu Android:  http://' + ip + ':' + port + '   (misma red WiFi)');
    console.log('Multijugador online:     ws://' + ip + ':' + port + '/ws');
  } else {
    console.log('Conecta el Android a la MISMA red WiFi y entra en http://<IP-de-este-PC>:' + port);
  }
});

function lanIP() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) return net.address;
      }
    }
  } catch (err) {}
  return 'localhost';
}
