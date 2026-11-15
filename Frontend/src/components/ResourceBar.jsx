export default function ResourceBar({ icon, label, value, color }) {
  return (
    <div style={{ marginBottom: '12px', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color, display: 'flex' }}>{icon}</span>
          {label}
        </span>
        <b>{value}%</b>
      </div>
      <div style={{ background: '#2a2110', height: '14px', borderRadius: '6px', overflow: 'hidden', marginTop: '4px' }}>
        <div style={{ background: color, width: `${value}%`, height: '100%', transition: '0.3s' }} />
      </div>
    </div>
  );
}