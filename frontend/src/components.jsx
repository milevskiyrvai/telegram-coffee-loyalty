// Переиспользуемые куски UI: шапка с логотипом, штампы, диалог, оверлей скана.
import { buildSlots } from './ui.js';

export function LogoR({ size = 30, fs = 15, radius = 8, bw = 1.5 }) {
  return (
    <div style={{
      width: size, height: size, border: `${bw}px solid #C2A079`, borderRadius: radius,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#C2A079', fontWeight: 700, fontSize: fs,
    }}>R</div>
  );
}

export function Header({ title, sub, subSpaced, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 22px 16px', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoR />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ color: '#ECE7DB', fontSize: 14, fontWeight: 600 }}>{title}</span>
          {sub && <span style={{ color: '#8C857A', fontSize: subSpaced ? 10 : 11, letterSpacing: subSpaced ? 1 : 0 }}>{sub}</span>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function ScanIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#C2A079" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 0 1 1-1h3" /><path d="M20 8V5a1 1 0 0 0-1-1h-3" />
      <path d="M4 16v3a1 1 0 0 0 1 1h3" /><path d="M20 16v3a1 1 0 0 0-1 1h-3" /><path d="M4 12h16" />
    </svg>
  );
}

export function ScanButton({ onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 38, height: 38, borderRadius: 11, background: '#25231D',
      border: '1px solid rgba(194,160,121,0.25)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer', flex: 'none',
    }}><ScanIcon /></div>
  );
}

export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, margin: '0 22px 14px', padding: '12px 14px',
      background: '#25231D', border: '1px solid rgba(194,160,121,0.18)', borderRadius: 14, flex: 'none',
    }}>
      <div style={{ width: 13, height: 13, border: '1.5px solid #8C857A', borderRadius: '50%', flex: 'none' }} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#ECE7DB', fontSize: 14, padding: 0 }}
      />
    </div>
  );
}

export function Slots({ count }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, justifyItems: 'center' }}>
      {buildSlots(count).map((s) => <div key={s.key} style={s.style}>{s.label}</div>)}
    </div>
  );
}

// Нижний sheet-диалог подтверждения.
export function ConfirmDialog({ open, title, sub, cta, danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,7,5,0.62)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 50 }}>
      <div onClick={onCancel} style={{ flex: 1 }} />
      <div style={{ background: '#221F19', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: '26px 24px 30px', borderTop: '1px solid rgba(194,160,121,0.18)' }}>
        <div style={{ color: '#F3EEE2', fontSize: 19, fontWeight: 700, textAlign: 'center' }}>{title}</div>
        <div style={{ color: '#8C857A', fontSize: 13.5, textAlign: 'center', marginTop: 8, lineHeight: 1.45 }}>{sub}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
          <div onClick={onConfirm} style={{
            width: '100%', padding: 16, borderRadius: 15, background: danger ? '#D98A6A' : '#C2A079',
            color: '#1C1A15', fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: 'pointer',
          }}>{cta}</div>
          <div onClick={onCancel} style={{
            width: '100%', padding: 16, borderRadius: 15, background: 'transparent',
            border: '1px solid rgba(236,231,219,0.16)', color: '#9A9388', fontSize: 16, fontWeight: 600,
            textAlign: 'center', cursor: 'pointer',
          }}>Отмена</div>
        </div>
      </div>
    </div>
  );
}

// Оверлей сканирования (для браузера/фолбэка без нативного сканера).
// onResolve (если задан) срабатывает по тапу на рамку — браузерный демо-фолбэк.
export function ScanOverlay({ open, onCancel, onResolve }) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,7,5,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, zIndex: 60 }}>
      <div style={{ color: '#ECE7DB', fontSize: 15, fontWeight: 600 }}>Наведите на QR гостя</div>
      <div onClick={onResolve} style={{ position: 'relative', width: 200, height: 200, cursor: onResolve ? 'pointer' : 'default' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 34, height: 34, borderTop: '3px solid #C2A079', borderLeft: '3px solid #C2A079', borderTopLeftRadius: 10 }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: 34, height: 34, borderTop: '3px solid #C2A079', borderRight: '3px solid #C2A079', borderTopRightRadius: 10 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 34, height: 34, borderBottom: '3px solid #C2A079', borderLeft: '3px solid #C2A079', borderBottomLeftRadius: 10 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 34, height: 34, borderBottom: '3px solid #C2A079', borderRight: '3px solid #C2A079', borderBottomRightRadius: 10 }} />
        <div style={{ position: 'absolute', left: 8, right: 8, height: 2, background: '#E7DFC9', boxShadow: '0 0 14px #E7DFC9', animation: 'scanline 1.2s ease-in-out infinite' }} />
      </div>
      <div onClick={onCancel} style={{ padding: '11px 24px', borderRadius: 13, border: '1px solid rgba(236,231,219,0.2)', color: '#9A9388', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Отмена</div>
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid rgba(194,160,121,0.25)', borderTopColor: '#C2A079', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}
