// Frontend/src/App.jsx - Versión Completa (START + Barras + OLED ESP32 + Joystick + Godot)
import { useState, useEffect } from 'react'
import './App.css'
import GameWindow from './godot/GameWindows';
import {
  FaUserAstronaut, FaSatelliteDish, FaSyncAlt, FaMicrochip, FaChartBar,
  FaSeedling, FaBolt, FaShieldAlt, FaRadiation, FaSlidersH,
  FaArrowUp, FaArrowDown, FaArrowLeft, FaDotCircle, FaSun,FaGamepad,FaPlayCircle
} from 'react-icons/fa';
import ResourceBar from './components/ResourceBar';
import ControlButton from './components/ControlButton';
const API_URL = 'http://localhost:3001/api';

function App() {
  const [mission, setMission] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedGender, setSelectedGender] = useState('BOY');

  const frases = [
  'Día 1 · La tormenta cubre los paneles. Sin energía no hay oxígeno.',
  'Día 2 · -80 °C. Solo interferencia en la radio. Racionar o morir.',
  'Día 3 · Una señal débil: «Aguanta... voy por ti».',
  'En Marte no hay reabastecimiento. Todo recurso importa.',
];

// dentro de tu componente
const [i, setI] = useState(0);
useEffect(() => {
  const t = setInterval(() => setI((p) => (p + 1) % frases.length), 4000);
  return () => clearInterval(t);
}, []);
  // Leer datos del Backend cada 1 segundo (Estos mismos datos los leerá el ESP32)
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      setMission(data);
    } catch (err) {
      console.error("Esperando conexión con Backend en puerto 3001...");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 200);
    return () => clearInterval(interval);
  }, []);
  // Puente al motor HTML5 de Godot (movimiento + botón pin 32 para recoger objetos)
  useEffect(() => {
    if (!mission || !mission.missionStarted) return;
    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) return;

    const canvas = iframe.contentDocument.getElementById('canvas') || iframe.contentDocument.querySelector('canvas');
    const targets = [iframe.contentWindow, iframe.contentDocument, canvas].filter(Boolean);

    if (canvas && iframe.contentDocument.activeElement !== canvas) canvas.focus();

    const triggerGodotKey = (type, k) => {
      targets.forEach((target) => {
        target.dispatchEvent(new KeyboardEvent(type, {
          key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode,
          bubbles: true, cancelable: true, composed: true,
        }));
      });
    };

    const moveKeys = {
      UP:    [{ key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }, { key: 'w', code: 'KeyW', keyCode: 87 }, { key: 'W', code: 'KeyW', keyCode: 87 }],
      DOWN:  [{ key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }, { key: 's', code: 'KeyS', keyCode: 83 }, { key: 'S', code: 'KeyS', keyCode: 83 }],
      LEFT:  [{ key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }, { key: 'a', code: 'KeyA', keyCode: 65 }, { key: 'A', code: 'KeyA', keyCode: 65 }],
      RIGHT: [{ key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }, { key: 'd', code: 'KeyD', keyCode: 68 }, { key: 'D', code: 'KeyD', keyCode: 68 }],
    };

    // Joystick al centro: soltar todas las direcciones
    if (!mission.joystickDir || mission.joystickDir === 'STOP') {
      Object.values(moveKeys).flat().forEach((k) => triggerGodotKey('keyup', k));
    } else if (moveKeys[mission.joystickDir]) {
      // Soltar las demás y mantener la actual
      Object.keys(moveKeys).forEach((dir) => {
        if (dir !== mission.joystickDir) moveKeys[dir].forEach((k) => triggerGodotKey('keyup', k));
      });
      moveKeys[mission.joystickDir].forEach((k) => triggerGodotKey('keydown', k));
    }

    // Botón pin 32: recoger objetos / interactuar (E, Espacio, Enter)
    if (mission.actionBtn) {
        const pickupKeys = [
          { key: 'e', code: 'KeyE', keyCode: 69 },
          { key: 'E', code: 'KeyE', keyCode: 69 },
          { key: ' ', code: 'Space', keyCode: 32 },
          { key: 'Enter', code: 'Enter', keyCode: 13 },
        ];
        pickupKeys.forEach((k) => triggerGodotKey('keydown', k));
        setTimeout(() => pickupKeys.forEach((k) => triggerGodotKey('keyup', k)), 150);
      }
    }, [mission]);

  // Iniciar misión desde la pantalla START
  const handleStartMission = async (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    try {
      const res = await fetch(`${API_URL}/start-mission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: nameInput.trim(),
          playerGender: selectedGender
        })
      });
      const data = await res.json();
      setMission(data);
    } catch (err) {
      alert("Verifica que node server.js esté corriendo en la terminal del Backend");
    }
  };

  // Enviar comando del Joystick / Decisiones
  const sendCommand = async (mode) => {
    await fetch(`${API_URL}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    fetchStatus();
  };

  const toggleSolarStorm = async () => {
    if (!mission) return;
    await fetch(`${API_URL}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solarStormActive: !mission.solarStormActive })
    });
    fetchStatus();
  };

  const handleReset = async () => {
    setNameInput('');
    await fetch(`${API_URL}/reset`, { method: 'POST' });
    fetchStatus();
  };

  

  // =========================================================================
  // VISTA 1: PANTALLA DE INICIO (START + NOMBRE + GÉNERO)
  // =========================================================================
  if (!mission || !mission.missionStarted) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at center, #1e293b 0%, #070b14 100%)', color: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <form onSubmit={handleStartMission} style={{ background: '#0f172a', padding: '32px', borderRadius: '16px', border: '2px solid #38bdf8', width: '90%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 0 30px rgba(56, 189, 248, 0.2)' }}>
          <div style={{ fontSize: '40px' }}>🚀</div>
          <h1 style={{ margin: '5px 0', color: '#38bdf8', fontSize: '22px' }}>Junior Astronaut Trainer</h1>
          <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '13px' }}>
            Ingresa tus datos para iniciar la misión y activar la telemetría OLED
          </p>

          <div style={{ textAlign: 'left', marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold' }}>
              1. Nombre o Apodo de Comandante:
            </label>
            <input
              type="text"
              placeholder="Ej: Julio..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={18}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px', fontWeight: 'bold' }}>
              2. Selecciona tu Género / Avatar:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div
                onClick={() => setSelectedGender('BOY')}
                style={{ padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center', background: selectedGender === 'BOY' ? '#1d4ed8' : '#1e293b', border: selectedGender === 'BOY' ? '2px solid #60a5fa' : '2px solid #334155' }}
              >
                <div style={{ fontSize: '30px' }}>👨‍🚀</div>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Astronauta (Chico)</div>
              </div>

              <div
                onClick={() => setSelectedGender('GIRL')}
                style={{ padding: '12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center', background: selectedGender === 'GIRL' ? '#be185d' : '#1e293b', border: selectedGender === 'GIRL' ? '2px solid #f472b6' : '2px solid #334155' }}
              >
                <div style={{ fontSize: '30px' }}>👩‍🚀</div>
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Astronauta (Chica)</div>
              </div>
            </div>
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', background: '#10b981', color: '#052e16', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>
            ▶ START MISSION
          </button>
        </form>
      </div>
    );
  }
  const storm = mission.solarStormActive;
  const accent = storm ? '#ef4444' : '#facc15';

  const card = {
    background: '#17120a',
    padding: '16px',
    borderRadius: '10px',
    border: `1px solid ${storm ? '#7f1d1d' : '#3a2f10'}`,
    transition: 'border-color .4s',
  };

  // =========================================================================
  // VISTA 2: PORTAL COMPLETO (GODOT + BARRAS + PANTALLA OLED ESP32 + JOYSTICK)
  // =========================================================================
  return (
  <div
    style={{
      background: `radial-gradient(circle at 50% 0%, ${storm ? '#7f1d1d33' : '#facc1518'} 0%, #0d0a02 60%)`,
      backgroundColor: '#0d0a02',
      color: '#f8fafc',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
      transition: 'background .4s',
    }}
  >
    {/* BARRA SUPERIOR */}
    <header style={{ background: '#17120a', padding: '10px 20px', borderBottom: `1px solid ${storm ? '#7f1d1d' : '#3a2f10'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FaUserAstronaut size={20} color={accent} />
        <strong style={{ color: accent, fontSize: '16px' }}>Comandante {mission.playerName}</strong>
        <span style={{ color: '#57481f' }}>|</span>
        <span style={{ fontSize: '13px', color: '#d6cfb8', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FaSatelliteDish size={13} color={accent} />
          <b>DONKI:</b> {mission.donkiLastEvent}
        </span>
      </div>

      <button onClick={handleReset} style={{ background: '#3a2f10', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <FaSyncAlt size={11} /> Cambiar Jugador / Reiniciar
      </button>
    </header>

    {/* CONTENIDO EN 2 COLUMNAS */}
    <main style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px', padding: '16px', flex: 1 }}>

      {/* COLUMNA IZQUIERDA: JUEGO */}
      <GameWindow mission={mission} />

      {/* COLUMNA DERECHA */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 1. PANTALLA OLED */}
        <div style={{ background: '#000000', color: storm ? '#ff4444' : '#00ffcc', padding: '14px', borderRadius: '10px', border: '3px solid #3a2f10', fontFamily: 'monospace', boxShadow: `0 0 12px ${storm ? 'rgba(255,68,68,0.2)' : 'rgba(0,255,204,0.15)'}` }}>
          <div style={{ fontSize: '11px', color: '#a8a08a', marginBottom: '6px', borderBottom: '1px dashed #3a2f10', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FaMicrochip size={12} /> PANTALLA OLED 128x64 (DATOS ENVIADOS AL ESP32):
          </div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            <div>CMD: {mission.playerName} | MODE: {mission.mode}</div>
            <div>O2 : {mission.lifeSupport}% | PWR: {mission.power}%</div>
            <div>SHD: {mission.radiationShield}% | RAD: {mission.doseRateMgyDay} mGy/d</div>
            <div style={{ fontWeight: 'bold' }}>
              {storm ? '!! ALERTA CME DONKI !!' : 'CLIMA SOLAR: NOMINAL'}
            </div>
          </div>

            <div style={{ color: '#fde047', marginTop: '6px', paddingTop: '4px', borderTop: '1px dotted #3a2f10', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaGamepad size={12} /> MANDO ESP32: <b>{mission.joystickDir || 'STOP'}</b> | BTN RECOGER: <b>{mission.actionBtn ? 'ACTIVO' : 'OFF'}</b>
            </div>


        </div>

        {/* 2. como jugar */}
        <div style={card}>
          <h4 style={{ margin: '0 0 14px 0', color: accent, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaPlayCircle size={14} /> Como Jugar
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Moverse con flechas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src="/assets/Fechas.png"
                alt="Teclas de flechas"
                style={{ width: '90px', height: 'auto', flexShrink: 0 }}
              />
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>
                Usa las <strong>flechas</strong> del teclado para mover a tu astronauta por la base.
              </p>
            </div>
          </div>

          {/* Recoger objetos con E */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/assets/LetraE.png"
              alt="Tecla E"
              style={{ width: '90px', height: 'auto', flexShrink: 0 }}
            />
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>
              Presiona la tecla <strong>E</strong> para recoger objetos y usar las zonas de la base.
            </p>
          </div>
          <br></br>

                    {/* 3. panel */}
          <div style={card}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: accent, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaSlidersH size={14} /> Misión: Sobrevive 3 días
            </h4>

            <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, opacity: 0.9 }}>
              {frases[i]}
            </p>
          </div>

        </div>




      </aside>
    </main>
  </div>
);
}

export default App