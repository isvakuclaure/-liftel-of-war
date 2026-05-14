// ── CONSTANTES ──────────────────────────────────────────
const CW = 1200, CH = 500;
const GROUND_Y    = 390;
const LTX = 85,  RTX = 1115;   // X centro de cada torre
const TW  = 72,  TH  = 220;    // ancho/alto torre
const TOWER_MAX_HP = 1000;
const SPAWN_L = 175, SPAWN_R = 1025;
const ZONE_L  = { min: 210, max: 470 };
const ZONE_R  = { min: 730, max: 990 };

const UNIT_DEFS = {
  becario:   { cost: 25,  hp: 20,  dmg: 6,  spd: 130, range: 38,  rate: 1.0, label: 'Becario',   emoji: '🧑‍💼' },
  tecnico:   { cost: 50,  hp: 60,  dmg: 10, spd: 70,  range: 38,  rate: 0.8, label: 'Técnico',   emoji: '🔧' },
  comercial: { cost: 80,  hp: 35,  dmg: 18, spd: 100, range: 38,  rate: 1.2, label: 'Comercial', emoji: '📊' },
  it:        { cost: 120, hp: 45,  dmg: 22, spd: 60,  range: 130, rate: 0.9, label: 'IT',        emoji: '💻' },
  manager:   { cost: 150, hp: 200, dmg: 6,  spd: 40,  range: 38,  rate: 0.5, label: 'Manager',   emoji: '👔', immune: true },
};

const DEVICE_DEFS = {
  ltm: { cost: 100, income: 12, hp: 80,  label: 'LTM', color: '#27ae60', w: 48, h: 58 },
  lta: { cost: 220, income: 28, hp: 150, label: 'LTA', color: '#16a085', w: 56, h: 70 },
};

const DEPT = {
  marketing: { primary: '#e67e22', dark: '#b9580d', name: 'Marketing' },
  idi:       { primary: '#2980b9', dark: '#1a5276', name: 'I+D+I'     },
};

// ── CLASES ──────────────────────────────────────────────
class Unit {
  constructor(id, type, team, x) {
    const d = UNIT_DEFS[type];
    Object.assign(this, {
      id, type, team, x,
      y: GROUND_Y - 24,
      hp: d.hp, maxHp: d.hp,
      dmg: d.dmg,
      spd: d.spd * (team === 'left' ? 1 : -1),
      range: d.range, rate: d.rate,
      immune: d.immune || false, immuneUsed: false,
      atkTimer: 0, state: 'walk',
      deadTimer: 0, radius: 22,
    });
  }
}

class Device {
  constructor(id, type, team, x) {
    const d = DEVICE_DEFS[type];
    Object.assign(this, {
      id, type, team, x,
      y: GROUND_Y,
      hp: d.hp, maxHp: d.hp,
      income: d.income, label: d.label, color: d.color,
      w: d.w, h: d.h,
    });
  }
}

// ── JUEGO PRINCIPAL ──────────────────────────────────────
class LiftelGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._buildBg();
    this.reset();
    // Callbacks para red (asignados por socket-client)
    this.onSpawnUnit = null;
    this.onDeployDevice = null;
    this.onDeviceDestroyed = null;
    this.onTowerHit = null;
  }

  reset() {
    this.myTeam = null; this.myDept = null; this.opDept = null;
    this.myName = ''; this.opName = '';
    this.gold = 150; this.goldAcc = 0;
    this.towerHP = { left: TOWER_MAX_HP, right: TOWER_MAX_HP };
    this.units = []; this.devices = [];
    this.projs = []; this.parts = [];
    this.idN = 0; this.running = false;
    this.elapsed = 0; this.lastT = 0;
  }

  // Construye el fondo una sola vez (evita parpadeo de ventanas aleatorias)
  _buildBg() {
    this.bgBuildings = [
      { x: 240, w: 65, h: 110 }, { x: 370, w: 80, h: 145 },
      { x: 500, w: 55, h: 95  }, { x: 620, w: 75, h: 130 },
      { x: 760, w: 90, h: 165 }, { x: 910, w: 60, h: 100 },
    ];
    // Ventanas pre-generadas
    this.bgBuildings.forEach(b => {
      b.windows = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 2; c++)
          if (Math.random() > 0.3)
            b.windows.push({ x: 8 + c * 22, y: 14 + r * 24 });
    });
  }

  genId() { return `${this.myTeam}-${++this.idN}`; }

  // ── ACCIONES DEL JUGADOR ────────────────────────────────
  trySpawnUnit(type) {
    if (!this.running) return;
    const def = UNIT_DEFS[type];
    if (this.gold < def.cost) return;
    this.gold -= def.cost;
    const id = this.genId();
    const x = this.myTeam === 'left' ? SPAWN_L : SPAWN_R;
    this.units.push(new Unit(id, type, this.myTeam, x));
    if (this.onSpawnUnit) this.onSpawnUnit({ type, id });
    updateUI(this.gold);
  }

  tryDeployDevice(type) {
    if (!this.running) return;
    const def = DEVICE_DEFS[type];
    if (this.gold < def.cost) return;
    const zone = this.myTeam === 'left' ? ZONE_L : ZONE_R;
    const mine = this.devices.filter(d => d.team === this.myTeam);
    const x = zone.min + mine.length * 78 + 35;
    if (x > zone.max) return;
    this.gold -= def.cost;
    const id = this.genId();
    this.devices.push(new Device(id, type, this.myTeam, x));
    if (this.onDeployDevice) this.onDeployDevice({ type, id, position: x });
    updateUI(this.gold);
  }

  // ── RECIBIR EVENTOS DE RED ──────────────────────────────
  receiveSpawnUnit({ type, id }) {
    const team = this.myTeam === 'left' ? 'right' : 'left';
    const x = team === 'left' ? SPAWN_L : SPAWN_R;
    this.units.push(new Unit(id, type, team, x));
  }

  receiveDeployDevice({ type, id, position }) {
    const team = this.myTeam === 'left' ? 'right' : 'left';
    this.devices.push(new Device(id, type, team, position));
  }

  receiveDeviceDestroyed({ id }) {
    const i = this.devices.findIndex(d => d.id === id);
    if (i !== -1) this.devices.splice(i, 1);
  }

  receiveTowerHP({ team, hp }) {
    this.towerHP[team] = hp;
    const tx = team === 'left' ? LTX : RTX;
    this._burst(tx, GROUND_Y - 80, '#e74c3c', 10);
    updateUI(this.gold);
  }

  // ── LOOP ────────────────────────────────────────────────
  start(myTeam, myDept, opDept, myName, opName) {
    this.myTeam = myTeam; this.myDept = myDept; this.opDept = opDept;
    this.myName = myName; this.opName = opName;
    this.running = true;
    this.lastT = performance.now();
    requestAnimationFrame(t => this._loop(t));
    updateUI(this.gold);
  }

  _loop(t) {
    if (!this.running) { this._render(); return; }
    const dt = Math.min((t - this.lastT) / 1000, 0.1);
    this.lastT = t;
    this.elapsed += dt;
    this._update(dt);
    this._render();
    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── UPDATE ──────────────────────────────────────────────
  _update(dt) {
    // Oro
    const inc = 20 + this.devices
      .filter(d => d.team === this.myTeam)
      .reduce((s, d) => s + d.income, 0);
    this.goldAcc += inc * dt;
    const earned = Math.floor(this.goldAcc);
    if (earned) { this.gold = Math.min(9999, this.gold + earned); this.goldAcc -= earned; updateUI(this.gold); }

    // Timers
    const alive = this.units.filter(u => u.state !== 'dead');
    for (const u of alive) { u.atkTimer = Math.max(0, u.atkTimer - dt); }

    // Mover / atacar unidades
    for (const u of alive) {
      // Busca enemigo más cercano (unidad o dispositivo)
      let target = null, bestDist = Infinity;
      for (const e of alive) {
        if (e.team === u.team) continue;
        const d = Math.abs(e.x - u.x);
        if (d < bestDist) { bestDist = d; target = e; }
      }
      for (const dev of this.devices) {
        if (dev.team === u.team) continue;
        const d = Math.abs(dev.x - u.x);
        if (d < bestDist) { bestDist = d; target = dev; }
      }

      // Torre enemiga también es objetivo
      const eTowerX = u.team === 'left' ? RTX : LTX;
      const tDist = Math.abs(u.x - eTowerX);

      if (target && bestDist <= u.range) {
        u.state = 'attack';
        if (u.atkTimer <= 0) { this._hit(u, target); u.atkTimer = 1 / u.rate; }
      } else if (tDist <= TW / 2 + u.radius) {
        // Golpea la torre
        u.state = 'attack';
        if (u.atkTimer <= 0 && u.team === this.myTeam) {
          if (this.onTowerHit) this.onTowerHit({ damage: u.dmg });
          this._burst(eTowerX, GROUND_Y - 80, '#e74c3c', 8);
          u.atkTimer = 1 / u.rate;
        }
      } else {
        u.state = 'walk';
        u.x += u.spd * dt;
      }
    }

    // Limpiar muertos
    for (const u of this.units) if (u.state === 'dead') u.deadTimer += dt;
    this.units = this.units.filter(u => u.state !== 'dead' || u.deadTimer < 0.6);

    // Proyectiles
    for (const p of this.projs) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.projs = this.projs.filter(p => p.life > 0);

    // Partículas
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 280 * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
  }

  _hit(attacker, target) {
    if (target instanceof Device) {
      target.hp -= attacker.dmg;
      this._burst(target.x, target.y - target.h / 2, '#e67e22', 6);
      if (target.hp <= 0) {
        if (attacker.team === this.myTeam && this.onDeviceDestroyed)
          this.onDeviceDestroyed({ id: target.id });
        const i = this.devices.indexOf(target);
        if (i !== -1) { this._burst(target.x, target.y - target.h, '#e74c3c', 14); this.devices.splice(i, 1); }
      }
      return;
    }
    if (target.immune && !target.immuneUsed) {
      target.immuneUsed = true;
      this._burst(target.x, target.y, '#f39c12', 5);
      return;
    }
    if (attacker.type === 'it') {
      this.projs.push({ x: attacker.x, y: attacker.y - 8,
        vx: attacker.team === 'left' ? 500 : -500, vy: 0,
        life: 0.25, color: '#f39c12' });
    }
    target.hp -= attacker.dmg;
    this._burst(target.x, target.y, '#e74c3c', 3);
    if (target.hp <= 0) { target.state = 'dead'; target.deadTimer = 0; this._burst(target.x, target.y, '#e74c3c', 16); }
  }

  _burst(x, y, color, n) {
    for (let i = 0; i < n; i++)
      this.parts.push({
        x, y,
        vx: (Math.random() - .5) * 170,
        vy: -Math.random() * 230 - 40,
        life: .35 + Math.random() * .3,
        color, size: 2 + Math.random() * 4,
      });
  }

  // ── RENDER ──────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;

    // Cielo
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#090f1a');
    sky.addColorStop(1, '#0f1f38');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CW, GROUND_Y);

    // Suelo
    const gnd = ctx.createLinearGradient(0, GROUND_Y, 0, CH);
    gnd.addColorStop(0, '#1a2e14');
    gnd.addColorStop(1, '#0e1a0b');
    ctx.fillStyle = gnd;
    ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

    // Línea de suelo
    ctx.strokeStyle = '#3a6a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CW, GROUND_Y); ctx.stroke();

    // Edificios de fondo
    for (const b of this.bgBuildings) {
      ctx.fillStyle = '#0d1b2a';
      ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(255,215,0,0.6)';
      for (const w of b.windows)
        ctx.fillRect(b.x + w.x, GROUND_Y - b.h + w.y, 8, 10);
    }

    // Zona de dispositivos (sutil)
    const myZone = this.myTeam === 'left' ? ZONE_L : ZONE_R;
    if (myZone) {
      ctx.fillStyle = 'rgba(39,174,96,0.04)';
      ctx.fillRect(myZone.min, 0, myZone.max - myZone.min, GROUND_Y);
    }

    // Dispositivos
    for (const d of this.devices) this._drawDevice(ctx, d);

    // Torres
    const lName = this.myTeam === 'left' ? this.myName : this.opName;
    const rName = this.myTeam === 'right' ? this.myName : this.opName;
    const lDept = this.myTeam === 'left' ? this.myDept : this.opDept;
    const rDept = this.myTeam === 'right' ? this.myDept : this.opDept;
    this._drawTower(ctx, LTX, lDept, this.towerHP.left, lName);
    this._drawTower(ctx, RTX, rDept, this.towerHP.right, rName);

    // Unidades
    for (const u of this.units) this._drawUnit(ctx, u);

    // Proyectiles
    for (const p of this.projs) {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Partículas
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life * 2.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Timer en canvas
    if (this.running) {
      const m = String(Math.floor(this.elapsed / 60)).padStart(2, '0');
      const s = String(Math.floor(this.elapsed % 60)).padStart(2, '0');
      document.getElementById('timer').textContent = `${m}:${s}`;
    }
  }

  _drawTower(ctx, x, dept, hp, name) {
    const th = DEPT[dept] || DEPT.marketing;
    const tx = x - TW / 2, ty = GROUND_Y - TH;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(tx + 6, ty + 6, TW, TH);

    // Cuerpo
    ctx.fillStyle = th.dark;
    ctx.fillRect(tx, ty, TW, TH);

    // Franja superior (color departamento)
    ctx.fillStyle = th.primary;
    ctx.fillRect(tx, ty, TW, 7);
    ctx.fillRect(tx, ty + 18, TW, 3);

    // Ventanas
    ctx.fillStyle = th.primary + '55';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(tx + 7,      ty + 30 + i * 28, 22, 16);
      ctx.fillRect(tx + TW - 29, ty + 30 + i * 28, 22, 16);
    }

    // Puerta ascensor
    ctx.fillStyle = '#aaa';
    ctx.fillRect(tx + TW / 2 - 18, ty + TH - 75, 36, 75);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, ty + TH - 75); ctx.lineTo(x, ty + TH); ctx.stroke();

    // Barra HP
    const hpPct = Math.max(0, hp / TOWER_MAX_HP);
    const bw = TW + 20, bx = x - bw / 2, by = ty - 18;
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(bx, by, bw, 9);
    ctx.fillStyle = hpPct > .5 ? '#2ecc71' : hpPct > .25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(bx, by, bw * hpPct, 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 9);

    // Texto
    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ccc'; ctx.fillText(`${Math.ceil(hp)} HP`, x, ty - 23);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = th.primary; ctx.fillText(name || '—', x, ty - 36);
  }

  _drawUnit(ctx, u) {
    const def  = UNIT_DEFS[u.type];
    const isMe = u.team === this.myTeam;
    const dept = isMe ? this.myDept : this.opDept;
    const col  = (DEPT[dept] || DEPT.marketing).primary;
    const a    = u.state === 'dead' ? Math.max(0, 1 - u.deadTimer * 1.8) : 1;
    ctx.globalAlpha = a;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(u.x, GROUND_Y + 2, u.radius, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Cuerpo
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2); ctx.fill();

    // Borde (parpadeante si ataca)
    ctx.strokeStyle = u.state === 'attack' ? '#fff' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth   = u.state === 'attack' ? 2.5 : 1.5;
    ctx.stroke();

    // Emoji
    ctx.font = `${u.radius + 2}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(def.emoji, u.x, u.y);

    // Barra HP (solo si dañado)
    if (u.hp < u.maxHp) {
      const bw = u.radius * 2, bx = u.x - u.radius, by = u.y - u.radius - 7;
      ctx.fillStyle = '#111'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = u.hp / u.maxHp > .5 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), 4);
    }

    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
  }

  _drawDevice(ctx, d) {
    const x = d.x - d.w / 2, y = d.y - d.h;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(x + 3, y + 3, d.w, d.h);

    ctx.fillStyle = d.color;
    ctx.fillRect(x, y, d.w, d.h);

    // Borde brillante
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, d.w, d.h);

    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(d.label, d.x, y + d.h / 2 + 4);
    ctx.fillStyle = '#ffd700'; ctx.font = '9px sans-serif';
    ctx.fillText(`+${d.income}/s`, d.x, y + d.h - 5);

    // Barra HP
    const hpPct = d.hp / d.maxHp;
    ctx.fillStyle = '#111'; ctx.fillRect(x, y - 5, d.w, 4);
    ctx.fillStyle = '#2ecc71'; ctx.fillRect(x, y - 5, d.w * hpPct, 4);
  }
}

// ── UI ───────────────────────────────────────────────────
let G = null;

function initGame() {
  const canvas = document.getElementById('gameCanvas');
  G = new LiftelGame(canvas);
  // Render idle (fondo)
  G._render();
}

function updateUI(gold) {
  if (gold === undefined) return;
  document.getElementById('gold-val').textContent = gold;

  // Habilitar/deshabilitar botones según oro
  const allUnits   = ['becario','tecnico','comercial','it','manager'];
  const allDevices = ['ltm','lta'];
  for (const t of allUnits) {
    const btn = document.getElementById(`btn-${t}`);
    if (btn) btn.disabled = gold < UNIT_DEFS[t].cost;
  }
  for (const t of allDevices) {
    const btn = document.getElementById(`btn-${t}`);
    if (btn) btn.disabled = gold < DEVICE_DEFS[t].cost;
  }
}

function showGameUI(myTeam, myDept) {
  document.getElementById('game-ui').style.display = 'flex';
  const badge = document.getElementById('team-badge');
  badge.textContent = `${DEPT[myDept]?.name || myDept} — ${myTeam === 'left' ? '◀ Izquierda' : 'Derecha ▶'}`;
  badge.className = 'team-badge ' + (myTeam === 'left' ? 'team-left' : 'team-right');
}

function showGameOver(iWon) {
  const el = document.getElementById('gameover-overlay');
  const title = document.getElementById('gameover-title');
  const sub   = document.getElementById('gameover-sub');
  title.textContent = iWon ? '¡Victoria! 🏆' : 'Derrota 💀';
  title.className   = iWon ? 'win' : 'lose';
  sub.textContent   = iWon ? 'Tu torre ha sobrevivido' : 'Tu torre ha caído';
  el.style.display  = 'flex';
}

// ── LOBBY ────────────────────────────────────────────────
let _selectedDept = null;
let _playerName   = '';

function selectDept(dept) {
  _selectedDept = dept;
  document.getElementById('btn-marketing').className =
    'dept-btn' + (dept === 'marketing' ? ' selected-marketing' : '');
  document.getElementById('btn-idi').className =
    'dept-btn' + (dept === 'idi' ? ' selected-idi' : '');
}

function goToRoomStep() {
  _playerName = document.getElementById('input-name').value.trim();
  if (!_playerName) return setError('Introduce tu nombre');
  if (!_selectedDept) return setError('Elige tu departamento');
  setError('');
  showStep('step-room');
}

function setError(msg) {
  document.getElementById('error-msg').textContent = msg;
}

function showStep(id) {
  ['step-dept','step-room','step-waiting'].forEach(s => {
    document.getElementById(s).classList.toggle('active', s === id);
  });
}

// Inicializar al cargar
window.addEventListener('load', initGame);
