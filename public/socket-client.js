// ── SOCKET CLIENT ────────────────────────────────────────
const socket = io();
let _myTeam = null;

// ── LOBBY: ACCIONES ──────────────────────────────────────
function createRoom() {
  socket.emit('create_room', { name: _playerName, dept: _selectedDept });
}

function joinRoom() {
  const code = document.getElementById('input-code').value.trim().toUpperCase();
  if (!code) return setError('Introduce el código de sala');
  setError('');
  socket.emit('join_room', { name: _playerName, dept: _selectedDept, code });
}

// ── EVENTOS LOBBY ─────────────────────────────────────────
socket.on('room_created', ({ code, team }) => {
  _myTeam = team;
  showStep('step-waiting');
  document.getElementById('room-code-display').textContent = code;
  document.getElementById('waiting-msg').textContent = 'Comparte este código con tu rival';
});

socket.on('room_joined', ({ team, opponent }) => {
  _myTeam = team;
  showStep('step-loading');
  document.getElementById('loading-msg').textContent =
    `vs ${opponent.name} (${opponent.dept}) — Iniciando...`;
});

socket.on('opponent_joined', ({ name, dept }) => {
  document.getElementById('waiting-msg').textContent =
    `¡${name} (${dept}) se ha unido! Iniciando...`;
});

socket.on('room_error', (msg) => setError(msg));

socket.on('countdown', (n) => {
  const overlay = document.getElementById('countdown-overlay');
  const num     = document.getElementById('countdown-number');
  overlay.style.display = 'flex';
  num.textContent = n > 0 ? String(n) : '¡YA!';
  // Reiniciar animación CSS
  num.style.animation = 'none';
  num.offsetHeight; // fuerza reflow
  num.style.animation = '';
});

// ── INICIO DE PARTIDA ─────────────────────────────────────
socket.on('game_start', ({ left, right }) => {
  document.getElementById('lobby').style.display = 'none';
  setTimeout(() => {
    document.getElementById('countdown-overlay').style.display = 'none';
  }, 700);

  const opDept = _myTeam === 'left' ? right.dept : left.dept;
  const opName = _myTeam === 'left' ? right.name : left.name;

  showGameUI(_myTeam, _selectedDept);

  // Conectar callbacks de red
  G.onSpawnUnit       = (d) => socket.emit('spawn_unit',       d);
  G.onDeployDevice    = (d) => socket.emit('deploy_device',    d);
  G.onDeviceDestroyed = (d) => socket.emit('device_destroyed', d);
  G.onTowerHit        = (d) => socket.emit('tower_hit',        d);

  G.start(_myTeam, _selectedDept, opDept, _playerName, opName);
});

// ── EVENTOS EN JUEGO ──────────────────────────────────────

// HP autorizado por el servidor
socket.on('tower_hp', (data) => { if (G) G.receiveTowerHP(data); });

// Acciones del rival
socket.on('spawn_unit',       (d) => { if (G) G.receiveSpawnUnit(d); });
socket.on('deploy_device',    (d) => { if (G) G.receiveDeployDevice(d); });
socket.on('device_destroyed', (d) => { if (G) G.receiveDeviceDestroyed(d); });

socket.on('game_over', ({ winner }) => {
  if (!G) return;
  G.running = false;
  showGameOver(winner === _myTeam);
});

socket.on('opponent_disconnected', () => {
  if (G && G.running) {
    G.running = false;
    showGameOver(true);
    document.getElementById('gameover-sub').textContent = 'Tu rival se ha desconectado';
  }
});
