// ── CONSTANTES ──────────────────────────────────────────
const CW = 1800, CH = 500;
const GROUND_Y    = 390;
const LTX = 105, RTX = 1695;
const TW  = 72,  TH  = 220;
const TOWER_MAX_HP = 1000;
const SPAWN_L = 210, SPAWN_R = 1590;
const ZONE_L  = { min: 255, max: 680 };
const ZONE_R  = { min: 1120, max: 1545 };
const AURA_RADIUS = 120;
const PAMPHLET_RANGE = 160;
const PAMPHLET_SPLASH = 80;

// ── FOTOS ────────────────────────────────────────────────
const PHOTO_CACHE = {};
function getPhoto(key) {
  if (!key) return null;
  if (PHOTO_CACHE[key]) return PHOTO_CACHE[key];
  const img = new Image();
  img.src = '/fotos/' + key;
  PHOTO_CACHE[key] = img;
  return img;
}

const SUBDEVOPS_PHOTOS = [
  'it/subdevops/Carlos-2-2.png',
  'it/subdevops/Iksvaku-1.png',
  'it/subdevops/Monica.jpg',
  'it/subdevops/Vicente.png',
];

// ── UNIT DEFS ────────────────────────────────────────────
// type: 'melee' | 'ranged' | 'aura' | 'devops' | 'convert' | 'pamphlet' | 'sub'
const UNIT_DEFS = {
  // ── I+D+I ──
  programador: {
    cost: 80,  hp: 65,  dmg: 12, spd: 70,  range: 38,  rate: 0.8,
    label: 'Programador', photo: 'it/programador.png',      action: '🗡️', type: 'melee',
  },
  serviciotec: {
    cost: 130, hp: 140, dmg: 24, spd: 45,  range: 38,  rate: 0.55,
    label: 'Serv. Téc.',  photo: 'it/serviciotecnico.jpg',  action: '🔨', type: 'melee',
  },
  manager_idi: {
    cost: 180, hp: 220, dmg: 8,  spd: 38,  range: 38,  rate: 0.45,
    label: 'Manager IT',  photo: 'it/manager.png',          action: '🛡️', type: 'melee', immune: true, flying: true,
  },
  devops: {
    cost: 210, hp: 65,  dmg: 10, spd: 55,  range: 38,  rate: 0.7,
    label: 'DevOps',      photo: 'it/devops.png',           action: '📦', type: 'devops',
  },
  ejecutivo_idi: {
    cost: 290, hp: 110, dmg: 16, spd: 35,  range: 100, rate: 0.6,
    label: 'Ejecutivo',   photo: 'it/ejecutivo.jpg',        action: '⚡', type: 'aura',
  },
  // ── MARKETING ──
  atendedor: {
    cost: 60,  hp: 18,  dmg: 6,  spd: 125, range: 38,  rate: 1.0,
    label: 'Atendedor',   photo: 'marketing/atentededor.png', action: '🗡️', type: 'melee',
  },
  comercial: {
    cost: 95,  hp: 48,  dmg: 20, spd: 88,  range: 115, rate: 0.85,
    label: 'Comercial',   photo: 'marketing/comercial.jpg',   action: '🏹', type: 'ranged',
  },
  vendedor: {
    cost: 170, hp: 60,  dmg: 28, spd: 55,  range: 125, rate: 0.7,
    label: 'Vendedor',    photo: 'marketing/vendedor.png',    action: '🎯', type: 'ranged',
  },
  manager_mkt: {
    cost: 200, hp: 260, dmg: 32, spd: 35,  range: 38,  rate: 0.4,
    label: 'Manager',     photo: 'marketing/manager.png',    action: '👑', type: 'convert', flying: true,
  },
  ejecutivo_mkt: {
    cost: 290, hp: 85,  dmg: 22, spd: 38,  range: 155, rate: 0.5,
    label: 'Ejecutivo',   photo: 'marketing/ejecutivo.png',  action: '📋', type: 'recruit',
  },
  // ── SUBDEVOPS (spawn de DevOps) ──
  subdevops: {
    cost: 0,   hp: 8,   dmg: 3,  spd: 145, range: 35,  rate: 1.2,
    label: 'SubDevOps',   photo: null,                       action: '🤖', type: 'sub',
  },
};

const DEPT_UNITS = {
  idi:       ['programador', 'serviciotec', 'manager_idi', 'devops', 'ejecutivo_idi'],
  marketing: ['atendedor',   'comercial',   'vendedor',    'manager_mkt', 'ejecutivo_mkt'],
};

const DEVICE_DEFS = {
  ltm: { cost: 100, income: 12, hp: 80,  label: 'LTM', color: '#27ae60', w: 48, h: 58 },
  lta: { cost: 220, income: 28, hp: 150, label: 'LTA', color: '#16a085', w: 56, h: 70 },
};

const DEPT = {
  marketing: { primary: '#e67e22', dark: '#b9580d', name: 'Marketing' },
  idi:       { primary: '#2980b9', dark: '#1a5276', name: 'I+D+I'     },
};

// ── UNIT CLASS ───────────────────────────────────────────
class Unit {
  constructor(id, type, team, x) {
    const d = UNIT_DEFS[type] || UNIT_DEFS.subdevops;
    this.id      = id;
    this.type    = type;
    this.team    = team;
    this.x       = x;
    this.flying  = d.flying || false;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.y       = this.flying ? GROUND_Y - 82 : GROUND_Y - 24;
    this.hp      = d.hp;
    this.maxHp   = d.hp;
    this.baseDmg = d.dmg;
    this.spd     = d.spd * (team === 'left' ? 1 : -1);
    this.range   = d.range;
    this.rate    = d.rate;
    this.immune  = d.immune || false;
    this.immuneUsed = false;
    this.atkTimer   = 0;
    this.state      = 'walk';
    this.deadTimer  = 0;
    this.radius     = type === 'subdevops' ? 14 : 22;
    // Habilidades
    this.kills       = 0;
    this.stunTimer   = 0;
    this.buffMul     = 1.0;
    this.photoKey    = null; // para subdevops
    this.atkFlash    = 0;    // lunge al atacar
    this.hitFlash    = 0;    // flash al recibir daño
  }

  get dmg() { return Math.round(this.baseDmg * this.buffMul); }
}

// ── DEVICE CLASS ─────────────────────────────────────────
class Device {
  constructor(id, type, team, x) {
    const d = DEVICE_DEFS[type];
    Object.assign(this, {
      id, type, team, x, y: GROUND_Y,
      hp: d.hp, maxHp: d.hp, income: d.income,
      label: d.label, color: d.color, w: d.w, h: d.h,
    });
  }
}

// ── JUEGO ────────────────────────────────────────────────
class LiftelGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._buildBg();
    this.reset();
    this.onSpawnUnit       = null;
    this.onDeployDevice    = null;
    this.onDeviceDestroyed = null;
    this.onTowerHit        = null;
    this.onConvertUnit     = null;
  }

  reset() {
    this.myTeam  = null; this.myDept  = null; this.opDept  = null;
    this.myName  = '';   this.opName  = '';
    this.gold    = 50;   this.goldAcc = 0;
    this.incomeMultiplier = 1;  this.lastMinute = 0;
    this.towerHP = { left: TOWER_MAX_HP, right: TOWER_MAX_HP };
    this.units   = []; this.devices = [];
    this.projs   = []; this.parts   = []; this.floatTexts = [];
    this.idN     = 0;   this.running  = false;
    this.elapsed = 0;   this.lastT    = 0;
    // Estado animación de ascensores (puertas)
    this.elevL = { open: 0, phase: 'closed', timer: 1.0 };
    this.elevR = { open: 0, phase: 'closed', timer: 2.5 };
  }

  _buildBg() {
    this.bgBuildings = [
      { x: 250, w: 60, h: 105 }, { x: 360, w: 75, h: 140 },
      { x: 480, w: 55, h:  90 }, { x: 590, w: 70, h: 125 },
      { x: 710, w: 85, h: 155 }, { x: 840, w: 60, h: 100 },
      { x: 960, w: 75, h: 135 }, { x: 1090, w: 55, h: 95 },
      { x: 1200, w: 80, h: 150 }, { x: 1330, w: 65, h: 110 },
      { x: 1450, w: 90, h: 160 }, { x: 1580, w: 60, h: 105 },
    ];
    this.bgBuildings.forEach(b => {
      b.windows = [];
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 2; c++)
          if (Math.random() > 0.3) b.windows.push({ x: 8 + c * 22, y: 14 + r * 24 });
    });
    // Precargar todas las fotos al inicio
    Object.values(UNIT_DEFS).forEach(d => { if (d.photo) getPhoto(d.photo); });
    SUBDEVOPS_PHOTOS.forEach(p => getPhoto(p));
    ['productos/ltm.png', 'productos/lta.png'].forEach(p => getPhoto(p));
  }

  genId() { return `${this.myTeam}-${++this.idN}`; }

  // ── ACCIONES ─────────────────────────────────────────
  trySpawnUnit(type) {
    if (!this.running) return;
    const def = UNIT_DEFS[type];
    if (!def || this.gold < def.cost) return;
    this.gold -= def.cost;
    const id = this.genId();
    const x  = this.myTeam === 'left' ? SPAWN_L : SPAWN_R;
    const u  = new Unit(id, type, this.myTeam, x);
    this.units.push(u);

    // DevOps: spawnear 2 subdevops
    if (type === 'devops') this._spawnSubdevops(x, true);

    if (this.onSpawnUnit) this.onSpawnUnit({ type, id });
    updateUI(this.gold);
  }

  _spawnSubdevops(x, emit) {
    for (let i = 0; i < 2; i++) {
      const sid  = this.genId();
      const pidx = Math.floor(Math.random() * SUBDEVOPS_PHOTOS.length);
      const su   = new Unit(sid, 'subdevops', this.myTeam, x + (i - 0.5) * 20);
      su.photoKey = SUBDEVOPS_PHOTOS[pidx];
      this.units.push(su);
      this._floatText('📦 Desplegando...', x, GROUND_Y - 60 - i * 22, '#56d364');
      if (emit && this.onSpawnUnit) this.onSpawnUnit({ type: 'subdevops', id: sid, photoIdx: pidx });
    }
  }

  tryDeployDevice(type) {
    if (!this.running) return;
    const def  = DEVICE_DEFS[type];
    if (!def || this.gold < def.cost) return;
    const zone = this.myTeam === 'left' ? ZONE_L : ZONE_R;
    const mine = this.devices.filter(d => d.team === this.myTeam);
    const x    = zone.min + mine.length * 52 + 35; // spacing reducido, se apilan si hay muchos
    this.gold -= def.cost;
    const id = this.genId();
    this.devices.push(new Device(id, type, this.myTeam, x));
    if (this.onDeployDevice) this.onDeployDevice({ type, id, position: x });
    updateUI(this.gold);
  }

  // ── RECIBIR RED ──────────────────────────────────────
  receiveSpawnUnit({ type, id, photoIdx }) {
    const team = this.myTeam === 'left' ? 'right' : 'left';
    const x    = team === 'left' ? SPAWN_L : SPAWN_R;
    const u    = new Unit(id, type, team, x);
    if (type === 'subdevops' && photoIdx !== undefined)
      u.photoKey = SUBDEVOPS_PHOTOS[photoIdx];
    this.units.push(u);
    if (type === 'devops') this._floatText('📦 Desplegando...', x, GROUND_Y - 55, '#56d364');
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
    this._burst(team === 'left' ? LTX : RTX, GROUND_Y - 80, '#e74c3c', 10);
    updateUI(this.gold);
  }

  receiveConvertUnit({ id }) {
    const u = this.units.find(u => u.id === id);
    if (u) { u.team = this.myTeam === 'left' ? 'right' : 'left'; u.spd = -u.spd; }
  }

  // ── LOOP ─────────────────────────────────────────────
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

  // ── UPDATE ───────────────────────────────────────────
  _update(dt) {
    // Oro — base se duplica cada minuto completo
    const curMin = Math.floor(this.elapsed / 60);
    if (curMin > this.lastMinute) {
      this.lastMinute = curMin;
      this.incomeMultiplier *= 2;
      this._floatText('📈 ¡Nuevas inversiones!', CW / 2, CH / 2 - 60, '#ffd700', 3.5, true);
    }
    const inc = 8 * this.incomeMultiplier + this.devices.filter(d => d.team === this.myTeam)
      .reduce((s, d) => s + d.income, 0);
    this.goldAcc += inc * dt;
    const earned = Math.floor(this.goldAcc);
    if (earned) { this.gold = Math.min(9999, this.gold + earned); this.goldAcc -= earned; updateUI(this.gold); }

    // Animación ascensores (puertas)
    for (const elev of [this.elevL, this.elevR]) {
      if (elev.phase === 'closed') {
        elev.timer -= dt;
        if (elev.timer <= 0) elev.phase = 'opening';
      } else if (elev.phase === 'opening') {
        elev.open = Math.min(1, elev.open + dt / 1.1);
        if (elev.open >= 1) { elev.phase = 'open'; elev.timer = 2.0; }
      } else if (elev.phase === 'open') {
        elev.timer -= dt;
        if (elev.timer <= 0) elev.phase = 'closing';
      } else if (elev.phase === 'closing') {
        elev.open = Math.max(0, elev.open - dt / 1.1);
        if (elev.open <= 0) { elev.phase = 'closed'; elev.timer = 1.2; }
      }
    }

    const alive = this.units.filter(u => u.state !== 'dead');

    // Aura del ejecutivo_idi: buffea aliados cercanos
    for (const u of alive) u.buffMul = 1.0;
    for (const e of alive.filter(u => u.type === 'ejecutivo_idi')) {
      for (const u of alive) {
        if (u.team === e.team && u !== e && Math.abs(u.x - e.x) <= AURA_RADIUS)
          u.buffMul = 1.3;
      }
    }

    // Timers de ataque, stun, animaciones y vuelo
    for (const u of alive) {
      u.atkTimer = Math.max(0, u.atkTimer - dt);
      u.atkFlash = Math.max(0, (u.atkFlash || 0) - dt);
      u.hitFlash = Math.max(0, (u.hitFlash || 0) - dt);
      if (u.flying) u.y = GROUND_Y - 82 + Math.sin(this.elapsed * 3.5 + u.bobPhase) * 5;
    }

    // Movimiento y combate
    for (const u of alive) {
      // Stun/retirada del panfleto
      if (u.stunTimer > 0) {
        u.stunTimer -= dt;
        u.x -= u.spd * 0.5 * dt; // retrocede
        u.state = 'walk';
        continue;
      }

      // Busca enemigo más cercano
      // Reglas de targeting aire/suelo:
      //   - Volador  → solo ataca a otros voladores (pasa de largo sobre el suelo)
      //   - Ranged   → puede atacar tanto suelo como voladores (anti-aéreo)
      //   - Melee    → solo ataca unidades de suelo
      let target = null, bestDist = Infinity;
      for (const e of alive) {
        if (e.team === u.team) continue;
        if (u.flying  && !e.flying)           continue; // volador ignora suelo
        if (!u.flying && e.flying && u.range < 65) continue; // melee no alcanza aire
        const d = Math.abs(e.x - u.x);
        if (d < bestDist) { bestDist = d; target = e; }
      }
      // Dispositivos: solo unidades de suelo los atacan
      if (!u.flying) {
        for (const dev of this.devices) {
          if (dev.team === u.team) continue;
          const d = Math.abs(dev.x - u.x);
          if (d < bestDist) { bestDist = d; target = dev; }
        }
      }

      const eTowerX = u.team === 'left' ? RTX : LTX;
      const tDist   = Math.abs(u.x - eTowerX);

      if (target && bestDist <= u.range) {
        u.state = 'attack';
        if (u.atkTimer <= 0) {
          this._hit(u, target);
          u.atkTimer = 1 / u.rate;
        }
      } else if (tDist <= TW / 2 + u.radius) {
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

    // Textos flotantes
    for (const t of this.floatTexts) { t.y -= 55 * dt; t.life -= dt; }
    this.floatTexts = this.floatTexts.filter(t => t.life > 0);
  }

  _hit(attacker, target) {
    if (target instanceof Device) {
      target.hp -= attacker.dmg;
      this._burst(target.x, target.y - target.h / 2, '#e67e22', 5);
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
      this._floatText('¡Bloqueado!', target.x, target.y - 30, '#f39c12');
      return;
    }

    // Proyectil visual para ranged
    if (['comercial', 'vendedor', 'ejecutivo_idi'].includes(attacker.type)) {
      this.projs.push({ x: attacker.x, y: attacker.y - 8,
        vx: attacker.team === 'left' ? 500 : -500, vy: -30, life: 0.2, color: '#f1c40f' });
    }
    // Proyectil especial del ejecutivo_mkt (papel/memo)
    if (attacker.type === 'ejecutivo_mkt') {
      this.projs.push({ x: attacker.x, y: attacker.y - 8,
        vx: attacker.team === 'left' ? 420 : -420, vy: -20, life: 0.3,
        color: '#27ae60', isPamphlet: true });
    }

    target.hp -= attacker.dmg;
    this._burst(target.x, target.y, '#e74c3c', 3);
    if (!(target instanceof Device)) target.hitFlash = 0.25;
    attacker.atkFlash = 0.15;

    if (target.hp <= 0) {
      // Manager_mkt: tras 8 kills, convierte el siguiente (mantiene tipo, cambia equipo)
      if (attacker.type === 'manager_mkt') {
        attacker.kills++;
        if (attacker.kills >= 8) {
          target.state = 'walk';
          target.hp    = Math.max(1, Math.floor(target.maxHp * 0.3));
          target.team  = attacker.team;
          target.spd   = -target.spd;
          this._floatText('¡Convertido! 🔄', target.x, target.y - 35, '#ffd700');
          this._burst(target.x, target.y, '#ffd700', 15);
          attacker.kills = 0;
          if (attacker.team === this.myTeam && this.onConvertUnit)
            this.onConvertUnit({ id: target.id });
          return;
        }
      }

      // Ejecutivo_mkt: tras 10 kills, recluta al décimo como Comercial
      if (attacker.type === 'ejecutivo_mkt') {
        attacker.kills++;
        if (attacker.kills >= 10) {
          const com = UNIT_DEFS.comercial;
          target.type     = 'comercial';
          target.state    = 'walk';
          target.hp       = com.hp;
          target.maxHp    = com.hp;
          target.baseDmg  = com.dmg;
          target.range    = com.range;
          target.rate     = com.rate;
          target.team     = attacker.team;
          target.spd      = Math.abs(com.spd) * (attacker.team === 'left' ? 1 : -1);
          target.atkTimer = 0;
          target.photoKey = null; // usa la foto por defecto del tipo
          this._floatText('¡Captado! 📋', target.x, target.y - 40, '#27ae60');
          this._burst(target.x, target.y, '#27ae60', 18);
          attacker.kills = 0;
          return;
        }
      }

      target.state    = 'dead';
      target.deadTimer = 0;
      this._burst(target.x, target.y, '#e74c3c', 16);
    }
  }

  _pamphletAttack(attacker, alive) {
    // Panfleto: stun + retroceso en área
    attacker.atkFlash = 0.2;
    const dir    = attacker.team === 'left' ? 1 : -1;
    const hitX   = attacker.x + dir * 100;
    let   anyHit = false;

    for (const e of alive) {
      if (e.team === attacker.team) continue;
      if (Math.abs(e.x - hitX) <= PAMPHLET_SPLASH) {
        e.stunTimer = 2.2;
        anyHit = true;
        this._floatText('¡Retirada! 📣', e.x, e.y - 35, '#e67e22');
      }
    }

    // Proyectil visual de panfleto
    this.projs.push({
      x: attacker.x, y: attacker.y - 12,
      vx: dir * 320, vy: -40,
      life: 0.45, color: '#e67e22', isPamphlet: true,
    });

    if (anyHit) this._burst(hitX, GROUND_Y - 50, '#e67e22', 12);
  }

  _floatText(text, x, y, color, life = 1.8, big = false) {
    this.floatTexts.push({ text, x, y, life, color, big });
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

  setGameOver(winner) {
    this.running = false;
    showGameOver(winner === this.myTeam);
  }

  // ── RENDER ───────────────────────────────────────────
  _render() {
    const ctx = this.ctx;

    // Cielo
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, '#090f1a'); sky.addColorStop(1, '#0f1f38');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, GROUND_Y);

    // Suelo
    const gnd = ctx.createLinearGradient(0, GROUND_Y, 0, CH);
    gnd.addColorStop(0, '#1a2e14'); gnd.addColorStop(1, '#0e1a0b');
    ctx.fillStyle = gnd; ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

    ctx.strokeStyle = '#3a6a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CW, GROUND_Y); ctx.stroke();

    // Edificios fondo
    for (const b of this.bgBuildings) {
      ctx.fillStyle = '#0d1b2a';
      ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
      ctx.fillStyle = 'rgba(255,215,0,0.6)';
      for (const w of b.windows)
        ctx.fillRect(b.x + w.x, GROUND_Y - b.h + w.y, 8, 10);
    }

    // Zona de dispositivos propia (tenue)
    if (this.myTeam) {
      const z = this.myTeam === 'left' ? ZONE_L : ZONE_R;
      ctx.fillStyle = 'rgba(39,174,96,0.04)';
      ctx.fillRect(z.min, 0, z.max - z.min, GROUND_Y);
    }

    // Dispositivos
    for (const d of this.devices) this._drawDevice(ctx, d);

    // Torres
    const lD = this.myTeam === 'left' ? this.myDept : this.opDept;
    const rD = this.myTeam === 'right' ? this.myDept : this.opDept;
    const lN = this.myTeam === 'left' ? this.myName : this.opName;
    const rN = this.myTeam === 'right' ? this.myName : this.opName;
    this._drawTower(ctx, LTX, lD, this.towerHP.left,  lN, this.elevL.open);
    this._drawTower(ctx, RTX, rD, this.towerHP.right, rN, this.elevR.open);

    // Aura visual de ejecutivo_idi
    for (const u of this.units.filter(u => u.state !== 'dead' && u.type === 'ejecutivo_idi')) {
      ctx.save();
      ctx.strokeStyle = 'rgba(88,166,255,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(u.x, u.y, AURA_RADIUS, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Unidades
    for (const u of this.units) this._drawUnit(ctx, u);

    // Proyectiles
    for (const p of this.projs) {
      if (p.isPamphlet) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.vx > 0 ? 0.3 : -0.3);
        ctx.fillStyle = p.color;
        ctx.fillRect(-8, -5, 16, 10);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.strokeRect(-8, -5, 16, 10);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Partículas
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life * 2.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Textos flotantes
    ctx.textAlign = 'center';
    for (const t of this.floatTexts) {
      ctx.font = t.big ? 'bold 22px sans-serif' : 'bold 13px sans-serif';
      ctx.globalAlpha = Math.min(1, t.life * (t.big ? 0.7 : 1.2));
      if (t.big) { ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8; }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // Timer
    if (this.running) {
      const m = String(Math.floor(this.elapsed / 60)).padStart(2, '0');
      const s = String(Math.floor(this.elapsed % 60)).padStart(2, '0');
      document.getElementById('timer').textContent = `${m}:${s}`;
    }
  }

  _drawTower(ctx, x, dept, hp, name, elevOpen = 0) {
    const th = DEPT[dept] || DEPT.marketing;
    const tx = x - TW / 2, ty = GROUND_Y - TH;

    // ── Sombra ──
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(tx + 7, ty + 7, TW, TH);

    // ── Estructura del hueco (shaft) ──
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(tx, ty, TW, TH);

    // Bordes laterales metálicos
    const metalGrad = ctx.createLinearGradient(tx, 0, tx + TW, 0);
    metalGrad.addColorStop(0,   '#333');
    metalGrad.addColorStop(0.1, '#666');
    metalGrad.addColorStop(0.9, '#666');
    metalGrad.addColorStop(1,   '#333');
    ctx.fillStyle = metalGrad;
    ctx.fillRect(tx,          ty, 6,  TH); // left rail
    ctx.fillRect(tx + TW - 6, ty, 6,  TH); // right rail
    ctx.fillRect(tx,          ty, TW, 6);  // top beam

    // Raíles verticales (líneas de guía)
    ctx.strokeStyle = th.primary + '55';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(tx + 10 + i * (TW - 20) / 2, ty + 6);
      ctx.lineTo(tx + 10 + i * (TW - 20) / 2, ty + TH);
      ctx.stroke();
    }

    // Panel indicador de piso (parte superior)
    ctx.fillStyle = '#111';
    ctx.fillRect(tx + 6, ty + 6, TW - 12, 28);
    ctx.strokeStyle = th.primary + '88'; ctx.lineWidth = 1;
    ctx.strokeRect(tx + 6, ty + 6, TW - 12, 28);

    // Número de piso / HP en display digital
    const hpPct  = Math.max(0, hp / TOWER_MAX_HP);
    const floors = Math.ceil(hpPct * 9) || 0;
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffaa00' : '#ff4444';
    ctx.fillText(`${floors > 0 ? floors : 'G'}`, x, ty + 25);

    // Flecha de puerta (▼ cerrando / ▲ abriendo / · parado)
    ctx.font = '9px monospace'; ctx.fillStyle = th.primary + 'cc';
    const arrow = elevOpen > 0.05 ? (elevOpen < 0.99 ? '◀▶' : '◀ ▶') : '▶◀';
    ctx.fillText(arrow, x, ty + 36);

    // ── Interior iluminado ──
    const doorAreaX = tx + 6;
    const doorAreaY = ty + 36;
    const doorAreaW = TW - 12;
    const doorAreaH = TH - 56;

    if (elevOpen > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(doorAreaX, doorAreaY, doorAreaW, doorAreaH); ctx.clip();

      // Luz interior cálida
      const intGrad = ctx.createLinearGradient(doorAreaX, doorAreaY, doorAreaX, doorAreaY + doorAreaH);
      intGrad.addColorStop(0, `rgba(255,230,140,${elevOpen * 0.95})`);
      intGrad.addColorStop(0.6, `rgba(210,160,70,${elevOpen * 0.85})`);
      intGrad.addColorStop(1,   `rgba(160,100,30,${elevOpen * 0.7})`);
      ctx.fillStyle = intGrad;
      ctx.fillRect(doorAreaX, doorAreaY, doorAreaW, doorAreaH);

      // Paneles decorativos del interior
      ctx.strokeStyle = `rgba(200,150,60,${elevOpen * 0.45})`;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const py = doorAreaY + doorAreaH * i / 4;
        ctx.beginPath(); ctx.moveTo(doorAreaX + 3, py); ctx.lineTo(doorAreaX + doorAreaW - 3, py); ctx.stroke();
      }
      // Línea central vertical
      ctx.beginPath(); ctx.moveTo(x, doorAreaY + 4); ctx.lineTo(x, doorAreaY + doorAreaH - 4); ctx.stroke();

      // Figura silueta cuando puerta abierta
      if (elevOpen > 0.7) {
        const alpha = (elevOpen - 0.7) / 0.3;
        ctx.globalAlpha = alpha * 0.75;
        ctx.fillStyle = 'rgba(80,40,10,0.9)';
        const hx = x, hy = doorAreaY + 18;
        // cabeza
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
        // cuerpo
        ctx.fillRect(hx - 6, hy + 7, 12, 20);
        // piernas
        ctx.fillRect(hx - 6, hy + 27, 5, 14);
        ctx.fillRect(hx + 1, hy + 27, 5, 14);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // ── Puertas metálicas ──
    const halfW    = doorAreaW / 2;
    const slideMax = halfW - 3;
    const slide    = slideMax * elevOpen;

    // Puerta izquierda
    const ldW = halfW - slide;
    if (ldW > 0) {
      const g = ctx.createLinearGradient(doorAreaX, 0, doorAreaX + ldW, 0);
      g.addColorStop(0,   th.dark);
      g.addColorStop(0.35, th.primary);
      g.addColorStop(0.7, '#ccc');
      g.addColorStop(1,   th.dark);
      ctx.fillStyle = g;
      ctx.fillRect(doorAreaX, doorAreaY, ldW, doorAreaH);
      // Ranura central de la puerta
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(doorAreaX + ldW * 0.5, doorAreaY + 8); ctx.lineTo(doorAreaX + ldW * 0.5, doorAreaY + doorAreaH - 8); ctx.stroke();
      // Borde de cierre (brillo)
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(doorAreaX + ldW - 2, doorAreaY, 2, doorAreaH);
    }

    // Puerta derecha
    const rdX = doorAreaX + halfW + slide;
    const rdW = halfW - slide;
    if (rdW > 0) {
      const g2 = ctx.createLinearGradient(rdX, 0, rdX + rdW, 0);
      g2.addColorStop(0,   th.dark);
      g2.addColorStop(0.3, '#ccc');
      g2.addColorStop(0.65, th.primary);
      g2.addColorStop(1,   th.dark);
      ctx.fillStyle = g2;
      ctx.fillRect(rdX, doorAreaY, rdW, doorAreaH);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rdX + rdW * 0.5, doorAreaY + 8); ctx.lineTo(rdX + rdW * 0.5, doorAreaY + doorAreaH - 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(rdX, doorAreaY, 2, doorAreaH);
    }

    // Línea de separación entre puertas
    if (ldW > 0 && rdW > 0) {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(doorAreaX + halfW, doorAreaY); ctx.lineTo(doorAreaX + halfW, doorAreaY + doorAreaH); ctx.stroke();
    }

    // ── Base ──
    ctx.fillStyle = metalGrad || '#555';
    ctx.fillRect(tx, ty + TH - 18, TW, 18);
    ctx.strokeStyle = th.primary + '88'; ctx.lineWidth = 1;
    ctx.strokeRect(tx, ty + TH - 18, TW, 18);

    // ── HP bar y nombre ──
    const bw = TW + 24, bx = x - bw / 2, by = ty - 18;
    ctx.fillStyle = '#111'; ctx.fillRect(bx, by, bw, 9);
    ctx.fillStyle = hpPct > .5 ? '#2ecc71' : hpPct > .25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(bx, by, bw * hpPct, 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 9);

    ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ccc'; ctx.fillText(`${Math.ceil(hp)} HP`, x, ty - 22);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = th.primary; ctx.fillText(name || '—', x, ty - 36);
  }

  _drawUnit(ctx, u) {
    const def  = UNIT_DEFS[u.type] || UNIT_DEFS.subdevops;
    const isMe = u.team === this.myTeam;
    const dept = isMe ? this.myDept : this.opDept;
    const col  = (DEPT[dept] || DEPT.marketing).primary;
    const a    = u.state === 'dead' ? Math.max(0, 1 - u.deadTimer * 1.8) : 1;
    const r    = u.radius;

    // Lunge al atacar: pequeño empujón hacia el enemigo
    const lunge = (u.atkFlash || 0) > 0
      ? (u.team === 'left' ? 1 : -1) * (u.atkFlash / 0.15) * 7 : 0;

    // ── Visual de vuelo (antes del save/translate) ──
    if (u.flying && u.state !== 'dead') {
      // Hilo punteado hasta el suelo
      ctx.save();
      ctx.globalAlpha = a * 0.3;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(u.x + lunge, u.y + r + 2); ctx.lineTo(u.x + lunge, GROUND_Y - 2); ctx.stroke();
      ctx.setLineDash([]);
      // Sombra en el suelo
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(u.x + lunge, GROUND_Y + 2, r * 0.7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Hélice giratoria encima
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      const angle = (performance.now() / 90) % (Math.PI * 2);
      ctx.translate(u.x + lunge, u.y - r - 5);
      ctx.rotate(angle);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-(r - 2), 0); ctx.lineTo(r - 2, 0);
      ctx.moveTo(0, -(r - 2)); ctx.lineTo(0, r - 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (lunge !== 0) ctx.translate(lunge, 0);
    ctx.globalAlpha = a;

    // Sombra (solo unidades en suelo)
    if (!u.flying) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(u.x, GROUND_Y + 2, r, 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Stun visual (borde parpadeante amarillo)
    if (u.stunTimer > 0) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(u.x, u.y, r + 3, 0, Math.PI * 2); ctx.stroke();
    }

    // Foto circular o color sólido
    const photoPath = u.photoKey || def.photo;
    const img = photoPath ? getPhoto(photoPath) : null;

    if (img && img.complete && img.naturalWidth > 0) {
      // Borde del color del equipo
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(u.x, u.y, r + 2, 0, Math.PI * 2); ctx.fill();
      // Foto recortada en círculo
      ctx.save();
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, u.x - r, u.y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      // Fallback: círculo de color + inicial
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${r + 2}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(def.action || '?', u.x, u.y);
      ctx.textBaseline = 'alphabetic';
    }

    // Borde de ataque
    ctx.strokeStyle = u.state === 'attack' ? '#fff' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = u.state === 'attack' ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(u.x, u.y, r, 0, Math.PI * 2); ctx.stroke();

    // Icono de acción pequeño (esquina)
    ctx.font = '10px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.action || '', u.x + r * 0.6, u.y - r * 0.7);
    ctx.textBaseline = 'alphabetic';

    // Barra HP si dañado
    if (u.hp < u.maxHp) {
      const bw = r * 2, bx = u.x - r, by = u.y - r - 7;
      ctx.fillStyle = '#111'; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = u.hp / u.maxHp > .5 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), 4);
    }

    // Contador de kills del manager_mkt y ejecutivo_mkt
    if ((u.type === 'manager_mkt' || u.type === 'ejecutivo_mkt') && u.kills > 0) {
      const icon  = u.type === 'manager_mkt' ? '👑' : '📋';
      const color = u.type === 'manager_mkt' ? '#ffd700' : '#27ae60';
      ctx.fillStyle = color;
      ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${u.kills}/10 ${icon}`, u.x, u.y - r - 12);
    }

    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    ctx.restore();

    // Flash de daño: overlay rojo encima
    if ((u.hitFlash || 0) > 0 && u.state !== 'dead') {
      ctx.save();
      ctx.globalAlpha = (u.hitFlash / 0.25) * 0.55 * a;
      ctx.fillStyle = '#ff3333';
      ctx.beginPath(); ctx.arc(u.x + lunge, u.y, r + 1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _drawDevice(ctx, d) {
    const x = d.x - d.w / 2, y = d.y - d.h;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + 4, y + 4, d.w, d.h);

    // Foto del producto como fondo
    const img = getPhoto(`productos/${d.type}.png`);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, d.w, d.h); ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, d.w, d.h);
      // Overlay oscuro para legibilidad
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, d.w, d.h);
    } else {
      ctx.fillStyle = d.color; ctx.fillRect(x, y, d.w, d.h);
    }
    ctx.restore();

    // Marco
    ctx.strokeStyle = d.color + 'bb'; ctx.lineWidth = 2; ctx.strokeRect(x, y, d.w, d.h);

    // Etiqueta
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
    ctx.fillText(d.label, d.x, y + d.h / 2 + 4);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText(`+${d.income}/s`, d.x, y + d.h - 5);
    ctx.shadowBlur = 0;

    // HP bar
    const hpPct = d.hp / d.maxHp;
    ctx.fillStyle = '#111'; ctx.fillRect(x, y - 6, d.w, 5);
    ctx.fillStyle = hpPct > .5 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(x, y - 6, d.w * hpPct, 5);
  }
}

// ── UI ───────────────────────────────────────────────────
let G = null;

function initGame() {
  const canvas = document.getElementById('gameCanvas');
  G = new LiftelGame(canvas);
  G._render();
}

function updateUI(gold) {
  if (gold === undefined || !G) return;
  document.getElementById('gold-val').textContent = gold;
  const myUnits = G.myDept ? DEPT_UNITS[G.myDept] : [];
  for (const t of myUnits) {
    const btn = document.getElementById(`btn-${t}`);
    if (btn) btn.disabled = gold < (UNIT_DEFS[t]?.cost || 9999);
  }
  for (const t of ['ltm', 'lta']) {
    const btn = document.getElementById(`btn-${t}`);
    if (btn) btn.disabled = gold < (DEVICE_DEFS[t]?.cost || 9999);
  }
}

function showGameUI(myTeam, myDept) {
  document.getElementById('game-ui').style.display = 'flex';
  const badge = document.getElementById('team-badge');
  badge.textContent = `${DEPT[myDept]?.name || myDept} — ${myTeam === 'left' ? '◀ Izquierda' : 'Derecha ▶'}`;
  badge.className = 'team-badge ' + (myTeam === 'left' ? 'team-left' : 'team-right');

  // Mostrar solo los botones del departamento elegido
  document.querySelectorAll('.dept-units').forEach(el => el.style.display = 'none');
  const el = document.getElementById(`units-${myDept}`);
  if (el) el.style.display = 'flex';
}

function showGameOver(iWon) {
  const el    = document.getElementById('gameover-overlay');
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
  document.getElementById('btn-dept-marketing').className =
    'dept-btn' + (dept === 'marketing' ? ' selected-marketing' : '');
  document.getElementById('btn-dept-idi').className =
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
  ['step-dept', 'step-room', 'step-waiting', 'step-loading'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('active', s === id);
  });
}

window.addEventListener('load', initGame);
