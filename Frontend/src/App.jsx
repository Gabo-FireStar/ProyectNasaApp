// Frontend/src/App.jsx - Versión Completa (Movimiento Personaje + Mouse Virtual con Joystick ESP32)
import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = 'http://localhost:3001/api';

function App() {
  const [mission, setMission] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [selectedGender, setSelectedGender] = useState('BOY');
  const [showGodotIframe, setShowGodotIframe] = useState(true);

  // Posición en porcentaje (0% a 100%) del Puntero Virtual dentro de la ventana de Godot
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [isClicking, setIsClicking] = useState(false);

  const lastDirRef = useRef('STOP');
  const currentDirRef = useRef('STOP');
  const cursorPosRef = useRef({ x: 50, y: 50 });
  const gameContainerRef = useRef(null);

  // 1. Leer estado del Backend cada 90 ms
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/status`);
      const data = await res.json();
      setMission(data);
    } catch (err) {
      // Silencioso para no saturar consola
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 90);
    return () => clearInterval(interval);
  }, []);

  // Helper: Simula movimiento o clic de Mouse directamente sobre el <canvas> de Godot
  const dispatchGodotMouse = (type, percentX, percentY) => {
    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) return;

    const canvas = iframe.contentDocument.getElementById('canvas') || iframe.contentDocument.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + (rect.width * (percentX / 100));
    const clientY = rect.top + (rect.height * (percentY / 100));

    const eventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: iframe.contentWindow,
      clientX: clientX,
      clientY: clientY,
      screenX: clientX,
      screenY: clientY,
      button: 0,
      buttons: (type === 'mousedown' || type === 'pointerdown' || type === 'mousemove') ? 1 : 0
    };

    // Godot 4 en Web escucha tanto PointerEvents como MouseEvents
    if (type.startsWith('pointer')) {
      canvas.dispatchEvent(new PointerEvent(type, { ...eventInit, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
    } else {
      canvas.dispatchEvent(new MouseEvent(type, eventInit));
    }
  };

  // 2. Motor fluido a 60 FPS para mover el Cursor Virtual con el Joystick de la ESP32
  useEffect(() => {
    const moveCursorInterval = setInterval(() => {
      const dir = currentDirRef.current;
      if (!dir || dir === 'STOP') return;

      const speed = 1.3; // Velocidad del puntero en pantalla
      let { x, y } = cursorPosRef.current;

      if (dir === 'UP') y = Math.max(4, y - speed);
      if (dir === 'DOWN') y = Math.min(96, y + speed);
      if (dir === 'LEFT') x = Math.max(4, x - speed);
      if (dir === 'RIGHT') x = Math.min(96, x + speed);

      cursorPosRef.current = { x, y };
      setCursorPos({ x, y });

      // Avisar a Godot que el mouse se movió a esa coordenada (para hover de bloques/botones)
      dispatchGodotMouse('pointermove', x, y);
      dispatchGodotMouse('mousemove', x, y);
    }, 25);

    return () => clearInterval(moveCursorInterval);
  }, []);

  // 3. Puente de Teclado + Clic de Mouse al presionar el botón del Pin 32
  useEffect(() => {
    if (!mission || !mission.missionStarted) return;

    const currentDir = mission.joystickDir || 'STOP';
    currentDirRef.current = currentDir;

    const iframe = document.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) return;

    const canvas = iframe.contentDocument.getElementById('canvas') || iframe.contentDocument.querySelector('canvas');
    const target = canvas || iframe.contentWindow;

    const triggerGodotKey = (type, keyInfo) => {
      const evt = new KeyboardEvent(type, {
        key: keyInfo.key,
        code: keyInfo.code,
        keyCode: keyInfo.keyCode,
        which: keyInfo.keyCode,
        location: 0,
        repeat: false,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(evt);
    };

    const moveKeys = {
      UP: [
        { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        { key: 'w', code: 'KeyW', keyCode: 87 }
      ],
      DOWN: [
        { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        { key: 's', code: 'KeyS', keyCode: 83 }
      ],
      LEFT: [
        { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        { key: 'a', code: 'KeyA', keyCode: 65 }
      ],
      RIGHT: [
        { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        { key: 'd', code: 'KeyD', keyCode: 68 }
      ]
    };

    // A) Movimiento del personaje por teclado (solo cuando cambia de dirección)
    if (lastDirRef.current !== currentDir) {
      if (lastDirRef.current !== 'STOP' && moveKeys[lastDirRef.current]) {
        moveKeys[lastDirRef.current].forEach(k => triggerGodotKey('keyup', k));
      }

      if (currentDir !== 'STOP' && moveKeys[currentDir]) {
        if (canvas && iframe.contentDocument.activeElement !== canvas) {
          canvas.focus();
        }
        moveKeys[currentDir].forEach(k => triggerGodotKey('keydown', k));
      }

      lastDirRef.current = currentDir;
    }

    // B) BOTÓN PIN 32: Hace Clic Izquierdo de Mouse en los bloques + Teclas de recoger objeto
    if (mission.actionBtn) {
      if (canvas && iframe.contentDocument.activeElement !== canvas) {
        canvas.focus();
      }

      const { x, y } = cursorPosRef.current;
      setIsClicking(true);

      // 1. Disparar clic real de Mouse sobre las coordenadas del bloque en Godot
      dispatchGodotMouse('pointermove', x, y);
      dispatchGodotMouse('mousemove', x, y);
      dispatchGodotMouse('pointerdown', x, y);
      dispatchGodotMouse('mousedown', x, y);

      // 2. Disparar también teclas de interacción (E, Espacio, Enter)
      const pickupKeys = [
        { key: 'e', code: 'KeyE', keyCode: 69 },
        { key: ' ', code: 'Space', keyCode: 32 },
        { key: 'Enter', code: 'Enter', keyCode: 13 }
      ];
      pickupKeys.forEach(k => triggerGodotKey('keydown', k));

      setTimeout(() => {
        dispatchGodotMouse('pointerup', x, y);
        dispatchGodotMouse('mouseup', x, y);
        dispatchGodotMouse('click', x, y);
        pickupKeys.forEach(k => triggerGodotKey('keyup', k));
        setIsClicking(false);
      }, 110);
    }
  }, [mission?.joystickDir, mission?.actionBtn]);

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
  // VISTA 2: PORTAL COMPLETO (GODOT + MIRA VIRTUAL + BARRAS + OLED ESP32)
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
        
        {/* COLUMNA IZQUIERDA: VENTANA DEL JUEGO DE GODOT CON PUNTERO VIRTUAL */}
        <section style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <b>🎮 Ventana del Juego (Godot Engine - Novela Gráfica / RPG)</b>
            <button onClick={() => setShowGodotIframe(!showGodotIframe)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              {showGodotIframe ? 'Ocultar iframe' : 'Conectar public/godot/index.html'}
            </button>
          </div>

          <div
            ref={gameContainerRef}
            style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '10px', textAlign: 'center', background: '#020617' }}
          >
            {showGodotIframe ? (
              <>
                <iframe src="/godot/index.html" title="Godot Game" style={{ width: '100%', height: '100%', border: 'none', minHeight: '460px' }} />

                {/* PUNTERO / MIRA VIRTUAL CONTROLADA POR EL JOYSTICK FÍSICO DE LA ESP32 */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${cursorPos.x}%`,
                    top: `${cursorPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isClicking ? '28px' : '22px',
                    height: isClicking ? '28px' : '22px',
                    borderRadius: '50%',
                    border: isClicking ? '3px solid #fde047' : '2px solid #00ffcc',
                    backgroundColor: isClicking ? 'rgba(253, 224, 71, 0.35)' : 'rgba(0, 255, 204, 0.15)',
                    boxShadow: '0 0 10px rgba(0, 255, 204, 0.8)',
                    pointerEvents: 'none', // Deja pasar todos los clics hacia Godot
                    zIndex: 50,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'width 0.1s, height 0.1s'
                  }}
                >
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ffffff' }} />
                </div>
              </>
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
                🕹️ MANDO ESP32: <b>{mission.joystickDir || 'STOP'}</b> | BTN / CLIC: <b>{mission.actionBtn || isClicking ? 'CLIC ACTIVO' : 'OFF'}</b>
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