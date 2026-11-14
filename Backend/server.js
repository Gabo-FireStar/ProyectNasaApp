// Backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const NASA_API_KEY = 'DDPczBJ7mRhDqPqBmqpCtCKdP98NC6Q6GrCdrrfc';

// 1. ESTADO CENTRAL DE LA MISIÓN (Incluye datos del Jugador)
let missionState = {
  // Datos del jugador (Se llenan cuando da START en la web)
  missionStarted: false,
  playerName: "Cadete",
  playerGender: "BOY",           // 'BOY' | 'GIRL' | 'EXPLORER'

  // Recursos de la base
  sol: 1,
  power: 80,                     // Energía disponible (%)
  lifeSupport: 90,               // Soporte vital: O2 y Alimentos CSA (%)
  radiationShield: 30,           // Blindaje contra radiación (%)
  mode: 'BALANCED',              // 'SHIELD' | 'LIFE_SUPPORT' | 'POWER_SAVE' | 'BALANCED'
  
  // Datos reales NASA RadLab y DONKI
  doseRateMgyDay: 0.45,
  accumulatedDose: 0.0,
  solarStormActive: false,
  donkiLastEvent: "Consultando NASA DONKI...",
  donkiFlareCount: 0,
  donkiCmeCount: 0,
  statusText: "Sistemas estables en la base.",
  gameOver: false
};

// 2. CONEXIÓN A NASA DONKI API
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
      missionState.donkiLastEvent = `Erupción Solar Clase ${latestFlare.classType} (${latestFlare.beginTime}) | CMEs (30d): ${cmes.length}`;
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

// 3. SIMULACIÓN DE COMPENSACIONES (Solo corre si el niño ya dio START)
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
// 4. ENDPOINTS PARA REACT Y GODOT
// =========================================================

// A) NUEVO: Iniciar misión con Nombre y Género desde la pantalla START
app.post('/api/start-mission', (req, res) => {
  const { playerName, playerGender } = req.body;
  missionState.playerName = playerName && playerName.trim() !== "" ? playerName.trim() : "Cadete";
  missionState.playerGender = playerGender || "BOY";
  missionState.missionStarted = true;
  
  // Reiniciar valores limpios para el nuevo jugador
  missionState.sol = 1;
  missionState.power = 80;
  missionState.lifeSupport = 90;
  missionState.radiationShield = 30;
  missionState.mode = 'BALANCED';
  missionState.accumulatedDose = 0.0;
  missionState.gameOver = false;

  console.log(`👨‍🚀 Nueva misión iniciada por: ${missionState.playerName} (${missionState.playerGender})`);
  res.json(missionState);
});

// B) Leer estado (Godot lee aquí playerName y playerGender)
app.get('/api/status', (req, res) => {
  res.json(missionState);
});

// C) Diálogos estilo Persona / Pokémon personalizados con el nombre del jugador
app.get('/api/dialogue-event', (req, res) => {
  const titulo = missionState.playerGender === 'GIRL' ? 'Comandante' : 'Comandante';
  
  if (missionState.solarStormActive) {
    res.json({
      playerName: missionState.playerName,
      playerGender: missionState.playerGender,
      npcName: "ARIA (IA de la Base)",
      emotion: "ALERTA",
      dialogueText: `¡Atención ${titulo} ${missionState.playerName}! NASA DONKI reporta actividad solar (${missionState.donkiLastEvent}). La radiación subió a 4.50 mGy/día según RadLab. ¿Qué ordenas hacer?`,
      choices: [
        { id: "SHIELD", text: "Subir Escudo al máximo (-Energía, -O2)" },
        { id: "LIFE_SUPPORT", text: "Priorizar Invernadero CSA (Riesgo de radiación)" },
        { id: "POWER_SAVE", text: "Guardar energía en baterías" }
      ]
    });
  } else {
    res.json({
      playerName: missionState.playerName,
      playerGender: missionState.playerGender,
      npcName: "Dr. Kael (Médico OSDR)",
      emotion: "NORMAL",
      dialogueText: `Hola ${titulo} ${missionState.playerName}. El clima espacial está estable (Dosis RadLab: ${missionState.doseRateMgyDay} mGy/día). Energía al ${missionState.power}% y O2 al ${missionState.lifeSupport}%. ¿Cuál es el plan?`,
      choices: [
        { id: "LIFE_SUPPORT", text: "Impulsar cultivo de alimentos y O2 (+O2, -Energía)" },
        { id: "POWER_SAVE", text: "Recargar paneles solares (+Energía, -O2)" },
        { id: "BALANCED", text: "Mantener sistemas balanceados" }
      ]
    });
  }
});

// D) Decisiones en el juego
app.post('/api/decision', (req, res) => {
  const { mode, solarStormActive } = req.body;
  if (mode) missionState.mode = mode;
  if (solarStormActive !== undefined) missionState.solarStormActive = solarStormActive;
  res.json(missionState);
});

// E) Volver a la pantalla de inicio / Reset
app.post('/api/reset', (req, res) => {
  missionState.missionStarted = false;
  missionState.sol = 1;
  missionState.power = 80;
  missionState.lifeSupport = 90;
  missionState.radiationShield = 30;
  missionState.mode = 'BALANCED';
  missionState.accumulatedDose = 0.0;
  missionState.gameOver = false;
  res.json(missionState);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}/api/status`);
});