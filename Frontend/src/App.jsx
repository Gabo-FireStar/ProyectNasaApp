// Frontend/src/App.jsx - Versión Completa con Pantalla de Registro para Niños
import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'http://localhost:3001/api';

function App() {
  const [mission, setMission] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedGender, setSelectedGender] = useState('BOY');
  const [showGodotIframe, setShowGodotIframe] = useState(true);

  // Leer datos del Backend cada 200 ms para respuesta fluida del Joystick y OLED
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

  // Puente directo al motor HTML5 (<canvas>) de Godot (Movimiento + Botón Pin 32 Recoger Objetos)
  useEffect(() => {
    if (!mission || !mission.missionStarted) return;
    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) return;

    const canvas = iframe.contentDocument.getElementById('canvas') || iframe.contentDocument.querySelector('canvas');
    const targets = [iframe.contentWindow, iframe.contentDocument, canvas].filter(Boolean);

    if (canvas && iframe.contentDocument.activeElement !== canvas) {
      canvas.focus();
    }

    const triggerGodotKey = (type, keyInfo) => {
      targets.forEach(target => {
        const evt = new KeyboardEvent(type, {
          key: keyInfo.key,
          code: keyInfo.code,
          keyCode: keyInfo.keyCode,
          which: keyInfo.keyCode,
          bubbles: true,
          cancelable: true,
          composed: true
        });
        target.dispatchEvent(evt);
      });
    };

    const moveKeys = {
      UP: [
        { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        { key: 'w', code: 'KeyW', keyCode: 87 },
        { key: 'W', code: 'KeyW', keyCode: 87 }
      ],
      DOWN: [
        { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        { key: 's', code: 'KeyS', keyCode: 83 },
        { key: 'S', code: 'KeyS', keyCode: 83 }
      ],
      LEFT: [
        { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        { key: 'a', code: 'KeyA', keyCode: 65 },
        { key: 'A', code: 'KeyA', keyCode: 65 }
      ],
      RIGHT: [
        { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        { key: 'd', code: 'KeyD', keyCode: 68 },
        { key: 'D', code: 'KeyD', keyCode: 68 }
      ]
    };

    // 1. Si el joystick está en el centro (STOP), soltar todas las teclas de dirección
    if (!mission.joystickDir || mission.joystickDir === 'STOP') {
      Object.values(moveKeys).flat().forEach(k => triggerGodotKey('keyup', k));
    } else if (moveKeys[mission.joystickDir]) {
      // 2. Soltar las demás direcciones y mantener presionada la dirección actual
      Object.keys(moveKeys).forEach(dir => {
        if (dir !== mission.joystickDir) {
          moveKeys[dir].forEach(k => triggerGodotKey('keyup', k));
        }
      });
      moveKeys[mission.joystickDir].forEach(k => triggerGodotKey('keydown', k));
    }

    // 3. BOTÓN PIN 32: Recoger objetos / Interactuar (Simula 'E', 'Espacio' y 'Enter')
    if (mission.actionBtn) {
      const pickupKeys = [
        { key: 'e', code: 'KeyE', keyCode: 69 },
        { key: 'E', code: 'KeyE', keyCode: 69 },
        { key: ' ', code: 'Space', keyCode: 32 },
        { key: 'Enter', code: 'Enter', keyCode: 13 }
      ];

      pickupKeys.forEach(k => triggerGodotKey('keydown', k));

      setTimeout(() => {
        pickupKeys.forEach(k => triggerGodotKey('keyup', k));
      }, 150);
    }
  }, [mission]);

  // Iniciar misión cuando el niño escribe su nombre y presiona START MISSION
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

  // Botones exclusivos del Portal Web para cambiar prioridad de la base
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

  // Regresar a la pantalla inicial y limpiar el nombre para el siguiente niño
  const handleReset = async () => {
    setNameInput('');
    await fetch(`${API_URL}/reset`, { method: 'POST' });
    fetchStatus();
  };

  // =========================================================================
  // VISTA 1: PANTALLA DE INICIO (OBLIGATORIA HASTA QUE EL NIÑO PONGA SU NOMBRE)
  // =========================================================================
  if (!mission || !mission.missionStarted) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(circle at center, #1e293b 0%, #070b14 100%)', color: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <form onSubmit={handleStartMission} style={{ background: '#0f172a', padding: '32px', borderRadius: '16px', border: '2px solid #38bdf8', width: '90%', maxWidth: '420px', textAlign: 'center', boxShadow: '0 0 30px rgba(56, 189, 248, 0.2)' }}>
          <div style={{ fontSize: '40px' }}>🚀</div>
          <h1 style={{ margin: '5px 0', color: '#38bdf8', fontSize: '22px' }}>Junior Astronaut Trainer</h1>
          <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '13px' }}>
            ¡Bienvenido! Escribe tu nombre para iniciar la misión espacial
          </p>

          <div style={{ textAlign: 'left', marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 'bold' }}>
              1. ¿Cómo te llamas, Comandante?
            </label>
            <input
              type="text"
              placeholder="Escribe tu nombre aquí..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={18}
              required
              autoFocus
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff', fontSize: '15px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px', fontWeight: 'bold' }}>
              2. Selecciona tu Astronauta:
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

  // =========================================================================
  // VISTA 2: PORTAL COMPLETO (GODOT + BARRAS + PANTALLA OLED ESP32 + BOTONES WEB)
  // =========================================================================
  return (
    <div style={{ background: '#070b14', color: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* BARRA SUPERIOR */}
      <header style={{ background: '#0f172a', padding: '10px 20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>{mission.playerGender === 'GIRL' ? '👩‍🚀' : '👨‍🚀'}</span>
          <strong style={{ color: '#38bdf8', fontSize: '16px' }}>Comandante {mission.playerName}</strong>
          <span style={{ color: '#475569' }}>|</span>
          <span style={{ fontSize: '13px', color: '#cbd5e1' }}>📡 <b>DONKI:</b> {mission.donkiLastEvent}</span>
        </div>

        <button onClick={handleReset} style={{ background: '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
          🔄 Cambiar Jugador / Reiniciar
        </button>
      </header>

      {/* CONTENIDO EN 2 COLUMNAS: IZQUIERDA (GODOT) | DERECHA (OLED + BARRAS + BOTONES BASE) */}
      <main style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px', padding: '16px', flex: 1 }}>
        
        {/* COLUMNA IZQUIERDA: VENTANA DEL JUEGO DE GODOT */}
        <section style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <b>🎮 Ventana del Juego (Godot Engine - Novela Gráfica / RPG)</b>
            <button onClick={() => setShowGodotIframe(!showGodotIframe)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              {showGodotIframe ? 'Ocultar iframe' : 'Conectar public/godot/index.html'}
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '10px', textAlign: 'center', background: '#020617' }}>
            {showGodotIframe ? (
              <iframe src="/godot/index.html" title="Godot Game" style={{ width: '100%', height: '100%', border: 'none', minHeight: '460px' }} />
            ) : (
              <div style={{ maxWidth: '420px' }}>
                <div style={{ fontSize: '45px', marginBottom: '10px' }}>🪐</div>
                <h3 style={{ color: '#38bdf8', margin: '0 0 8px 0' }}>Juego en pausa</h3>
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>
                  Presiona el botón azul superior para mostrar la ventana de Godot.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* COLUMNA DERECHA: PANTALLA OLED + BARRAS DE RECURSOS + BOTONES DEL ENTORNO */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 1. PANTALLA OLED 128x64 (DATOS ENVIADOS AL ESP32) */}
          <div style={{ background: '#000000', color: '#00ffcc', padding: '14px', borderRadius: '10px', border: '3px solid #334155', fontFamily: 'monospace', boxShadow: '0 0 12px rgba(0,255,204,0.15)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px', borderBottom: '1px dashed #334155', paddingBottom: '4px' }}>
              📟 PANTALLA OLED 128x64 (DATOS ENVIADOS AL ESP32):
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
              <div>CMD: {mission.playerName} | MODE: {mission.mode}</div>
              <div>O2 : {mission.lifeSupport}% | PWR: {mission.power}%</div>
              <div>SHD: {mission.radiationShield}% | RAD: {mission.doseRateMgyDay} mGy/d</div>
              <div style={{ color: mission.solarStormActive ? '#ff4444' : '#00ffcc', fontWeight: 'bold' }}>
                {mission.solarStormActive ? '!! ALERTA CME DONKI !!' : 'CLIMA SOLAR: NOMINAL'}
              </div>
              <div style={{ color: '#fde047', marginTop: '6px', paddingTop: '4px', borderTop: '1px dotted #334155', fontSize: '12px' }}>
                🕹️ MANDO ESP32: <b>{mission.joystickDir || 'STOP'}</b> | BTN RECOGER: <b>{mission.actionBtn ? 'ACTIVO' : 'OFF'}</b>
              </div>
            </div>
          </div>

          {/* 2. BARRAS DE RECURSOS VITALES */}
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#fde047', fontSize: '14px' }}>📊 Monitor de Soporte Vital y Recursos</h4>

            <div style={{ marginBottom: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🌱 Oxígeno y Alimentos (CSA)</span>
                <b>{mission.lifeSupport}%</b>
              </div>
              <div style={{ background: '#1e293b', height: '14px', borderRadius: '6px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ background: '#10b981', width: `${mission.lifeSupport}%`, height: '100%', transition: '0.3s' }} />
              </div>
            </div>

            <div style={{ marginBottom: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>⚡ Energía de la Base</span>
                <b>{mission.power}%</b>
              </div>
              <div style={{ background: '#1e293b', height: '14px', borderRadius: '6px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ background: '#f59e0b', width: `${mission.power}%`, height: '100%', transition: '0.3s' }} />
              </div>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>🛡️ Escudo contra Radiación</span>
                <b>{mission.radiationShield}%</b>
              </div>
              <div style={{ background: '#1e293b', height: '14px', borderRadius: '6px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ background: '#3b82f6', width: `${mission.radiationShield}%`, height: '100%', transition: '0.3s' }} />
              </div>
            </div>

            <div style={{ background: '#1e293b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', borderLeft: '3px solid #ef4444' }}>
              ☢️ <b>Dosis RadLab:</b> {mission.doseRateMgyDay} mGy/día | <b>Acumulada:</b> {mission.accumulatedDose} / 5.0 mGy
            </div>
          </div>

          {/* 3. BOTONES DEL PORTAL WEB PARA ESCUDOS Y RECURSOS */}
          <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#38bdf8' }}>🕹️ Control de Decisiones (Portal Web)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              <button onClick={() => sendCommand('SHIELD')} style={{ padding: '9px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                ⬆️ Subir Escudo (-PWR -O2)
              </button>
              <button onClick={() => sendCommand('LIFE_SUPPORT')} style={{ padding: '9px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                ⬇️ Subir Oxígeno (-SHD)
              </button>
              <button onClick={() => sendCommand('POWER_SAVE')} style={{ padding: '9px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                ⬅️ Cargar Energía (-O2)
              </button>
              <button onClick={() => sendCommand('BALANCED')} style={{ padding: '9px', background: '#475569', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                ⏺️ Centro: Balanceado
              </button>
            </div>

            <button onClick={toggleSolarStorm} style={{ width: '100%', padding: '9px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              ☀️ Activar / Desactivar Tormenta Solar (DONKI)
            </button>
          </div>

        </aside>
      </main>
    </div>
  )
}

export default App