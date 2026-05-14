const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3067;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function genCode() {
  const words = ['LIFT', 'ELEV', 'CTRL', 'MKTG', 'IDI'];
  return words[Math.floor(Math.random() * words.length)] + '-' + (Math.floor(Math.random() * 90) + 10);
}

io.on('connection', (socket) => {
  console.log(`+ Conectado: ${socket.id}`);

  socket.on('create_room', ({ name, dept }) => {
    let code;
    do { code = genCode(); } while (rooms.has(code));

    rooms.set(code, {
      code,
      towerHP: { left: 1000, right: 1000 },
      players: [{ id: socket.id, name, dept, team: 'left' }]
    });
    socket.roomCode = code;
    socket.join(code);
    socket.emit('room_created', { code, team: 'left' });
    console.log(`  Sala ${code} creada por ${name} (${dept})`);
  });

  socket.on('join_room', ({ name, dept, code }) => {
    const room = rooms.get(code.toUpperCase());
    if (!room) return socket.emit('room_error', 'Sala no encontrada');
    if (room.players.length >= 2) return socket.emit('room_error', 'Sala llena');

    room.players.push({ id: socket.id, name, dept, team: 'right' });
    socket.roomCode = code.toUpperCase();
    socket.join(code.toUpperCase());

    const [p1, p2] = room.players;
    socket.emit('room_joined', {
      team: 'right',
      opponent: { name: p1.name, dept: p1.dept }
    });
    io.to(p1.id).emit('opponent_joined', { name: p2.name, dept: p2.dept });

    console.log(`  ${p1.name} vs ${p2.name} en sala ${room.code}`);

    // Countdown 3-2-1 y luego game_start
    let count = 3;
    const interval = setInterval(() => {
      io.to(room.code).emit('countdown', count);
      count--;
      if (count < 0) {
        clearInterval(interval);
        setTimeout(() => io.to(room.code).emit('game_start', {
          left: { name: p1.name, dept: p1.dept },
          right: { name: p2.name, dept: p2.dept }
        }), 500);
      }
    }, 1000);
  });

  // Relay de eventos de juego
  socket.on('spawn_unit', (data) => socket.to(socket.roomCode).emit('spawn_unit', data));
  socket.on('deploy_device', (data) => socket.to(socket.roomCode).emit('deploy_device', data));
  socket.on('device_destroyed', (data) => socket.to(socket.roomCode).emit('device_destroyed', data));

  socket.on('tower_hit', ({ damage }) => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const target = player.team === 'left' ? 'right' : 'left';
    room.towerHP[target] = Math.max(0, room.towerHP[target] - damage);

    // Broadcast HP actualizado a ambos
    io.to(room.code).emit('tower_hp', { team: target, hp: room.towerHP[target] });

    if (room.towerHP[target] <= 0) {
      io.to(room.code).emit('game_over', { winner: player.team });
      rooms.delete(room.code);
      console.log(`  Partida terminada: gana ${player.team} en sala ${room.code}`);
    }
  });

  socket.on('disconnect', () => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit('opponent_disconnected');
      rooms.delete(socket.roomCode);
    }
    console.log(`- Desconectado: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) localIP = net.address;
    }
  }
  console.log(`\n🏢  LIFTEL OF WAR`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Oficina: http://${localIP}:${PORT}\n`);
});
