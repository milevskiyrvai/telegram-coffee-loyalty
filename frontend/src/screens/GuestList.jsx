// Список гостей с поиском и прогресс-барами. Используется баристой и владельцем.
import { displayPhone, initial, buildBars, sortGuests } from '../ui.js';
import { Header, ScanButton, SearchBar } from '../components.jsx';

export default function GuestList({ title, sub, accounts, query, onQuery, onOpen, onScan }) {
  const sorted = sortGuests(accounts);
  const notFound = query.trim().length > 0 && sorted.length === 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title={title} sub={sub} subSpaced right={<ScanButton onClick={onScan} />} />
      <SearchBar value={query} onChange={onQuery} placeholder="Имя или номер телефона…" />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map((c) => {
          const hot = c.count >= 5;
          return (
            <div key={c.id} onClick={() => onOpen(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: '1px solid rgba(236,231,219,0.05)', cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#25231D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2A079', fontWeight: 600, fontSize: 15, flex: 'none' }}>{initial(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#ECE7DB', fontSize: 14.5, fontWeight: 600 }}>{c.name}</span>
                  <span style={{ color: '#6E685E', fontSize: 11, fontFamily: 'monospace' }}>{displayPhone(c.phone)}</span>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {buildBars(c.count).map((b) => <div key={b.key} style={b.style} />)}
                </div>
              </div>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ color: '#9A9388', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{c.count}/6</span>
                {hot && <span style={{ color: '#1C1A15', background: '#E7DFC9', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, letterSpacing: '0.4px' }}>ПОДАРОК</span>}
              </div>
            </div>
          );
        })}
        {notFound && (
          <div style={{ padding: '40px 26px', textAlign: 'center', color: '#6E685E', fontSize: 14 }}>
            Гость не найден.<br /><span style={{ fontSize: 12 }}>Попросите его открыть бота Radi coffee.</span>
          </div>
        )}
      </div>
    </div>
  );
}
