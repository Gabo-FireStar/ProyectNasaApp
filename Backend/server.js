// Backend/server.js - Eje X Normal, Eje Y Invertido + Pantalla START para Niños
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors()); // Permite peticiones desde React (5173), Godot HTML5 y ESP32
app.use(express.json());

// TU API KEY DE LA NASA
const NASA_API_KEY = 'DDPczBJ7mRhDqPqBmqpCtCKdP98NC6Q6GrCdrrfc';

// 1. ESTADO CENTRAL DE LA MISIÓN (Inicia en false para pedir el nombre del niño)
let missionState = {
  missionStarted: false,         // false = Muestra primero la pantalla de registro
  playerName: "",                // Vacío hasta que el niño escriba su nombre
  playerGender: "BOY",           // 'BOY' | 'GIRL'

  sol: 1,
  power: 80,                     // Energía disponible (%)
  lifeSupport: 90,               // Oxígeno y Alimentos CSA (%)
  radiationShield: 30,           // Blindaje contra radiación (%)
  mode: 'BALANCED',              // Solo cambia desde los botones del Portal Web

  // ESTADO EXCLUSIVO DEL MANDO FÍSICO ESP32 (Movimiento + Botón Recoger Objetos)
  joystickDir: 'STOP',           // 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'STOP'
  joystickX: 0,                  // -1 (Izquierda), 0 (Centro), 1 (Derecha)
  joystickY: 0,                  // -1 (Arriba), 0 (Centro), 1 (Abajo)
  actionBtn: false,              // true cuando se presiona el botón del Pin 32

  // Datos reales NASA RadLab y DONKI
  doseRateMgyDay: 0.45,
  accumulatedDose: 0.0,
  solarStormActive: false,
  donkiLastEvent: "Consultando NASA DONKI...",
  donkiFlareCount: 0,
  donkiCmeCount: 0,
  statusText: "Sistemas estables en la base.",
  gameOver: false,

  // Alias en español para compatibilidad directa con scripts de Godot
  get energia() { return this.power; },
  get alimentos() { return this.lifeSupport; },
  get oxigeno() { return this.lifeSupport; },
  get vida() { return this.lifeSupport; },
  get escudo() { return this.radiationShield; },
  get radiacion() { return this.solarStormActive; }
};

// 2. CONEXIÓN A NASA DONKI API (FLR y CME)
async function syncWithNasaApis() {
  try {
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 30);

    const endDate = today.toISOString().split('T')[0];
    const startDate = pastDate.toISOString().split('T')[0];

    const flrUrl = `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;
    const cmeUrl = `https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${NASA_API_KEY}`;

    const [flrRes, cmeRes] = await Promise.all([
      axios.get(flrUrl).catch(() => ({ data: [] })),
      axios.get(cmeUrl).catch(() => ({ data: [] }))
    ]);

    const flares = Array.isArray(flrRes.data) ? flrRes.data : [];
    const cmes = Array.isArray(cmeRes.data) ? cmeRes.data : [];

    missionState.donkiFlareCount = flares.length;
    missionState.donkiCmeCount = cmes.length;

    if (flares.length > 0) {
      const latestFlare = flares[flares.length - 1];
      missionState.donkiLastEvent = `Erupción Solar Clase ${latestFlare.classType} (${latestFlare.beginTime}) | CMEs: ${cmes.length}`;
      if (latestFlare.classType && (latestFlare.classType.startsWith('M') || latestFlare.classType.startsWith('X'))) {
        missionState.solarStormActive = true;
      }
    } else if (cmes.length > 0) {
      const latestCme = cmes[cmes.length - 1];
      missionState.donkiLastEvent = `CME registrada (${latestCme.startTime}) | Total CMEs: ${cmes.length}`;
    } else {
      missionState.donkiLastEvent = `Clima espacial nominal (${startDate} a ${endDate})`;
    }
  } catch (error) {
    missionState.donkiLastEvent = "Archivo NASA DONKI: Erupción Solar Clase M2.4";
  }
}
syncWithNasaApis();

// 3. SIMULACIÓN DE RECURSOS DE LA BASE (Solo corre cuando el niño ya inició la misión)
setInterval(() => {
  if (!missionState.missionStarted || missionState.gameOver) return;

  if (missionState.mode === 'SHIELD') {
    missionState.radiationShield = Math.min(100, missionState.radiationShield + 6);
    missionState.power = Math.max(0, missionState.power - 3);
    missionState.lifeSupport = Math.max(0, missionState.lifeSupport - 2);
  } else if (missionState.mode === 'LIFE_SUPPORT') {
    missionState.lifeSupport = Math.min(100, missionState.lifeSupport + 4);
    missionState.radiationShield = Math.max(10, missionState.radiationShield - 5);
    missionState.power = Math.max(0, missionState.power - 2);
  } else if (missionState.mode === 'POWER_SAVE') {
    missionState.power = Math.min(100, missionState.power + 5);
    missionState.lifeSupport = Math.max(0, missionState.lifeSupport - 2);
    missionState.radiationShield = Math.max(10, missionState.radiationShield - 3);
  } else {
    missionState.power = Math.max(0, missionState.power - 1);
    missionState.lifeSupport = Math.max(0, missionState.lifeSupport - 1);
  }

  const rawRadiation = missionState.solarStormActive ? 4.50 : 0.45;
  const shieldFactor = (100 - missionState.radiationShield) / 100;
  missionState.doseRateMgyDay = Number((rawRadiation * shieldFactor).toFixed(2));
  missionState.accumulatedDose = Number((missionState.accumulatedDose + (missionState.doseRateMgyDay / 30)).toFixed(2));

  if (missionState.power <= 0 || missionState.lifeSupport <= 0 || missionState.accumulatedDose >= 5.0) {
    missionState.gameOver = true;
  }
}, 2000);

// =========================================================
// 4. ENDPOINTS DE SINCRONIZACIÓN
// =========================================================

// A) GET /api/status -> Entrega estado completo a React, Godot y OLED
app.get('/api/status', (req, res) => {
  res.json(missionState);
  if (missionState.actionBtn) {
    missionState.actionBtn = false;
  }
});

// B) POST /api/joystick -> EJE X NORMAL Y EJE Y INVERTIDO (UP <-> DOWN)
app.post('/api/joystick', (req, res) => {
  const { dir, button } = req.body;

  if (dir !== undefined) {
    // Eje X normal (LEFT es LEFT, RIGHT es RIGHT)
    // Eje Y invertido (si llega UP pasa a DOWN, si llega DOWN pasa a UP)
    let correctedDir = dir;
    if (dir === 'UP') {
      correctedDir = 'DOWN';
    } else if (dir === 'DOWN') {
      correctedDir = 'UP';
    }

    missionState.joystickDir = correctedDir;
    missionState.joystickX = correctedDir === 'LEFT' ? -1 : (correctedDir === 'RIGHT' ? 1 : 0);
    missionState.joystickY = correctedDir === 'UP' ? -1 : (correctedDir === 'DOWN' ? 1 : 0);
  }

  if (button === true) {
    missionState.actionBtn = true;
  }

  res.json({
    joystickDir: missionState.joystickDir,
    joystickX: missionState.joystickX,
    joystickY: missionState.joystickY,
    actionBtn: missionState.actionBtn
  });
});

// C) POST /api/status -> Recibe cambios desde Godot
app.post('/api/status', (req, res) => {
  const {
    power, energia,
    lifeSupport, alimentos, oxigeno, vida,
    radiationShield, escudo,
    solarStormActive, radiacion,
    mode
  } = req.body;

  const newPower = power !== undefined ? power : energia;
  const newLife = lifeSupport !== undefined ? lifeSupport : (alimentos !== undefined ? alimentos : (oxigeno !== undefined ? oxigeno : vida));
  const newShield = radiationShield !== undefined ? radiationShield : escudo;
  const newStorm = solarStormActive !== undefined ? solarStormActive : radiacion;

  if (newPower !== undefined) missionState.power = Math.max(0, Math.min(100, Number(newPower)));
  if (newLife !== undefined) missionState.lifeSupport = Math.max(0, Math.min(100, Number(newLife)));
  if (newShield !== undefined) missionState.radiationShield = Math.max(0, Math.min(100, Number(newShield)));
  if (newStorm !== undefined) missionState.solarStormActive = Boolean(newStorm);
  if (mode !== undefined) missionState.mode = mode;

  if (missionState.power > 0 && missionState.lifeSupport > 0 && missionState.accumulatedDose < 5.0) {
    missionState.gameOver = false;
  }

  res.json(missionState);
});

// D) POST /api/start-mission -> Registra el nombre del niño e inicia el juego
app.post('/api/start-mission', (req, res) => {
  const { playerName, playerGender } = req.body;
  missionState.playerName = playerName && playerName.trim() !== "" ? playerName.trim() : "Cadete";
  missionState.playerGender = playerGender || "BOY";
  missionState.missionStarted = true;
  missionState.sol = 1;
  missionState.power = 80;
  missionState.lifeSupport = 90;
  missionState.radiationShield = 30;
  missionState.mode = 'BALANCED';
  missionState.joystickDir = 'STOP';
  missionState.actionBtn = false;
  missionState.accumulatedDose = 0.0;
  missionState.gameOver = false;

  res.json(missionState);
});

// E) POST /api/decision -> EXCLUSIVO PARA LOS BOTONES DEL PORTAL WEB
app.post('/api/decision', (req, res) => {
  const { mode, solarStormActive } = req.body;
  if (mode) missionState.mode = mode;
  if (solarStormActive !== undefined) missionState.solarStormActive = Boolean(solarStormActive);
  res.json(missionState);
});

// F) POST /api/reset -> Regresa a la pantalla de inicio para que otro niño ponga su nombre
app.post('/api/reset', (req, res) => {
  missionState.missionStarted = false;
  missionState.playerName = "";
  missionState.sol = 1;
  missionState.power = 80;
  missionState.lifeSupport = 90;
  missionState.radiationShield = 30;
  missionState.mode = 'BALANCED';
  missionState.joystickDir = 'STOP';
  missionState.actionBtn = false;
  missionState.accumulatedDose = 0.0;
  missionState.solarStormActive = false;
  missionState.gameOver = false;
  res.json(missionState);
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend Bidireccional corriendo en http://localhost:${PORT}/api/status`);
});