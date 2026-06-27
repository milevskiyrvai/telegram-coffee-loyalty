// Экран клиента: карта лояльности + QR. Пиксель-в-пиксель из прототипа.
import { LogoR } from '../components.jsx';
import { buildCupSlots } from '../ui.js';
import { openLink } from '../tg.js';
import Qr from '../Qr.jsx';

export default function ClientCard({ me, address }) {
  const hot = me.count >= 5;
  const status = hot ? 'Заберите 6-й кофе бесплатно ♥' : `До подарка осталось: ${5 - me.count}`;
  const qrValue = 'radi:' + me.id;
  const cups = buildCupSlots(me.count);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 22px 18px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <LogoR />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ color: '#ECE7DB', fontSize: 14, fontWeight: 600 }}>{me.name}</span>
          <span style={{ color: '#8C857A', fontSize: 11 }}>ваша карта лояльности</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 0' }}>
        <div style={{ background: '#1C1A15', border: '1px solid rgba(194,160,121,0.42)', borderRadius: 22, padding: 22, boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
          <div style={{ color: '#D8D2C2', fontSize: 17, fontWeight: 600, textAlign: 'center', marginBottom: 20 }}>
            6-й кофе в подарок <span style={{ color: '#E7DFC9' }}>♥</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, justifyItems: 'center' }}>
            {cups.map((s) => <div key={s.key} style={s.style} />)}
          </div>
          <div style={{ color: '#8C857A', fontSize: 11, textAlign: 'center', marginTop: 20, letterSpacing: '0.3px' }}>{address}</div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, color: '#C2A079', fontSize: 14.5, fontWeight: 600 }}>{status}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8, color: '#6E685E', fontSize: 12 }}>
          <span><span style={{ color: '#9A9388', fontWeight: 700 }}>{me.total}</span> выпито</span>
          <span><span style={{ color: '#9A9388', fontWeight: 700 }}>{me.freeGiven}</span> бесплатных</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 'none', marginTop: -6 }}>
        <div style={{ color: '#6E685E', fontSize: 11, letterSpacing: '0.4px' }}>Покажите QR баристе</div>
        <Qr value={qrValue} />
        <div style={{ color: '#5A554C', fontSize: 9.5, letterSpacing: '0.4px', marginTop: 3 }}>
          Разработано студией{' '}
          <span
            onClick={() => openLink('https://consoleai.ru')}
            style={{ color: '#9A9388', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
          >consoleai.ru</span>
        </div>
      </div>
    </div>
  );
}
