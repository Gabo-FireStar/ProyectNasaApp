import { useState, useMemo } from 'react';
import {
  FaGamepad, FaPlay, FaStop, FaUserAstronaut, FaUser, FaCogs,
  FaSun, FaSatelliteDish, FaChevronDown, FaSpinner, FaExclamationTriangle,
} from 'react-icons/fa';

export default function GameWindow({ mission }) {
  // 'ready' | 'loading' | 'playing'
  const [phase, setPhase] = useState('ready');
  const [confirmStop, setConfirmStop] = useState(false);

  const storm = mission.solarStormActive;
  const accent = storm ? '#ef4444' : '#facc15';

  const stars = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      left: (i * 37) % 100,
      top: (i * 53) % 100,
      size: 1 + (i % 3),
      delay: (i % 7) * 0.4,
    })),
    []
  );

  const handlePlay = () => setPhase('loading');
  const handleIframeLoad = () => setTimeout(() => setPhase('playing'), 800);
  const handleStop = () => {
    setConfirmStop(false);
    setPhase('ready');
  };

  const chips = [
    { icon: <FaUser size={11} />, text: `Cmdte. ${mission.playerName}` },
    { icon: <FaCogs size={11} />, text: `Modo ${mission.mode}` },
    {
      icon: storm ? <FaExclamationTriangle size={11} /> : <FaSun size={11} />,
      text: storm ? 'Tormenta solar activa' : 'Clima solar nominal',
      color: storm ? '#ef4444' : '#facc15',
    },
    { icon: <FaSatelliteDish size={11} />, text: 'DONKI en línea' },
  ];

  return (
    <section
      style={{
        background: '#0f172a',
        borderRadius: '12px',
        border: `1px solid ${accent}55`,
        boxShadow: `0 0 18px ${accent}22`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color .4s, box-shadow .4s',
      }}
    >
      <style>{`
        @keyframes gw-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes gw-pulse { 0%,100% { box-shadow: 0 0 0 0 ${accent}55; } 50% { box-shadow: 0 0 0 16px ${accent}00; } }
        @keyframes gw-twinkle { 0%,100% { opacity: .15; } 50% { opacity: .9; } }
        @keyframes gw-spin { to { transform: rotate(360deg); } }
        @keyframes gw-load { 0% { width: 0%; } 100% { width: 92%; } }
        .gw-play:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .gw-play { transition: transform .15s, filter .15s; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: '#1e293b', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <b style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FaGamepad size={16} color={accent} />
          Ventana del Juego
        </b>

        {phase === 'playing' && (
          <button
            onClick={() => setConfirmStop(true)}
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FaStop size={10} /> Detener
          </button>
        )}
      </div>

      {/* ÁREA PRINCIPAL */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: '480px',
          background: `radial-gradient(circle at 50% 35%, ${storm ? '#7f1d1d55' : '#facc1526'} 0%, #1a1405 45%, #020617 100%)`,
          overflow: 'hidden',
          transition: 'background .4s',
        }}
      >
        {/* Estrellas */}
        {stars.map((s, i) => (
          <span
            key={i}
            style={{
              position: 'absolute', left: `${s.left}%`, top: `${s.top}%`,
              width: s.size, height: s.size, borderRadius: '50%',
              background: '#fef9c3', animation: `gw-twinkle 3s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* IFRAME (se monta al pulsar Jugar, queda debajo del overlay mientras carga) */}
        {phase !== 'ready' && (
          <iframe
            src="/godot/index.html"
            title="Godot Game"
            onLoad={handleIframeLoad}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#000' }}
          />
        )}

        {/* ESTADO: LISTO */}
        {phase === 'ready' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px', textAlign: 'center' }}>
            <div
              style={{
                width: '110px', height: '110px', borderRadius: '50%', marginBottom: '16px',
                background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
                border: `1px solid ${accent}66`,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                animation: 'gw-float 3s ease-in-out infinite, gw-pulse 2s ease-out infinite',
              }}
            >
              <FaUserAstronaut size={58} color={accent} />
            </div>

            <h2 style={{ margin: '0 0 6px', color: accent, fontSize: '22px' }}>Misión lista</h2>
            <p style={{ margin: '0 0 18px', color: '#cbd5e1', fontSize: '13px', maxWidth: '380px', lineHeight: 1.5 }}>
              Comandante {mission.playerName}, la base te espera. Revisa el estado y pulsa para iniciar.
            </p>

            {/* Chips de estado */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '24px', maxWidth: '460px' }}>
              {chips.map((c) => (
                <span
                  key={c.text}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '5px 10px', borderRadius: '999px', fontSize: '11px',
                    background: '#0f172acc', border: `1px solid ${(c.color || '#475569')}88`,
                    color: c.color || '#cbd5e1',
                  }}
                >
                  {c.icon} {c.text}
                </span>
              ))}
            </div>

            {/* Botón principal */}
            <button
              className="gw-play"
              onClick={handlePlay}
              style={{
                background: storm ? '#ef4444' : '#facc15',
                color: storm ? '#fff' : '#1a1405',
                border: 'none', padding: '14px 44px', borderRadius: '10px',
                fontSize: '17px', fontWeight: 'bold', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                boxShadow: `0 6px 22px ${accent}55`,
              }}
            >
              <FaPlay size={16} /> Jugar
            </button>

          </div>
        )}

        {/* ESTADO: CARGANDO */}
        {phase === 'loading' && (
          <div style={{ position: 'absolute', inset: 0, background: '#020617', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '14px', zIndex: 2 }}>
            <FaSpinner size={34} color={accent} style={{ animation: 'gw-spin 1s linear infinite' }} />
            <div style={{ color: accent, fontWeight: 'bold', fontSize: '15px' }}>Cargando misión...</div>
            <div style={{ width: '260px', height: '8px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: accent, borderRadius: '999px', animation: 'gw-load 6s ease-out forwards' }} />
            </div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Preparando motor del juego</div>
          </div>
        )}

        {/* CONFIRMAR SALIDA */}
        {confirmStop && (
          <div style={{ position: 'absolute', inset: 0, background: '#020617cc', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3 }}>
            <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '22px', textAlign: 'center', maxWidth: '320px' }}>
              <FaExclamationTriangle size={26} color="#facc15" />
              <h3 style={{ margin: '10px 0 6px', fontSize: '16px' }}>¿Salir de la partida?</h3>
              <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>
                Se perderá el progreso de esta sesión.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={() => setConfirmStop(false)} style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  Seguir jugando
                </button>
                <button onClick={handleStop} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  Salir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
