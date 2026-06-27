// Карточка гостя: штампы, статус, кнопки начисления (+1 / выдать / пропустить / из запаса), undo.
import { displayPhone, initial } from '../ui.js';
import { Slots } from '../components.jsx';

export default function GuestCard({ guest, undoLabel, onBack, onCup, onRedeem, onSkip, onBonus, onUndo }) {
  const d = guest;
  const hot = d.count >= 5;
  const hasBonus = (d.bonus || 0) > 0;
  const cycle = hot ? 'Шестой кофе — в подарок' : `${d.count} из 5 до подарка`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', flex: 'none' }}>
        <div onClick={onBack} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(236,231,219,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9388', fontSize: 17, cursor: 'pointer' }}>‹</div>
        <span style={{ color: '#8C857A', fontSize: 13, fontWeight: 500 }}>Карточка гостя</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 26px 28px', overflowY: 'auto' }}>
        <div style={{ width: 74, height: 74, borderRadius: '50%', background: '#25231D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2A079', fontWeight: 700, fontSize: 31, marginBottom: 16 }}>{initial(d.name)}</div>
        <div style={{ color: '#F3EEE2', fontSize: 24, fontWeight: 700, letterSpacing: '-0.3px' }}>{d.name}</div>
        <div style={{ color: '#8C857A', fontSize: 13, fontFamily: 'monospace', marginTop: 5 }}>{displayPhone(d.phone)}</div>
        <div style={{ margin: '30px 0 18px' }}><Slots count={d.count} /></div>
        <div style={{ color: '#C2A079', fontSize: 13, fontWeight: 600 }}>{cycle}</div>
        <div style={{ flex: 1, minHeight: 24 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, color: '#6E685E', fontSize: 12, marginBottom: 16 }}>
          <span><span style={{ color: '#9A9388', fontWeight: 700 }}>{d.total}</span> чашек всего</span>
          <span><span style={{ color: '#9A9388', fontWeight: 700 }}>{d.freeGiven}</span> бесплатных</span>
          {hasBonus && <span><span style={{ color: '#E7DFC9', fontWeight: 700 }}>{d.bonus}</span> в запасе</span>}
        </div>

        {undoLabel && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', marginBottom: 12, background: '#25231D', border: '1px solid rgba(236,231,219,0.08)', borderRadius: 14 }}>
            <span style={{ color: '#9A9388', fontSize: 13 }}>{undoLabel}</span>
            <span onClick={onUndo} style={{ color: '#C2A079', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Отменить</span>
          </div>
        )}

        {hasBonus && (
          <div onClick={onBonus} style={{ width: '100%', padding: 14, borderRadius: 15, background: '#25231D', border: '1px solid rgba(231,223,201,0.3)', color: '#E7DFC9', fontSize: 14.5, fontWeight: 600, textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
            Выдать бесплатный из запаса · {d.bonus}
          </div>
        )}

        {hot ? (
          <>
            <div onClick={onSkip} style={{ width: '100%', padding: 15, borderRadius: 15, background: 'transparent', border: '1px solid rgba(236,231,219,0.18)', color: '#9A9388', fontSize: 15, fontWeight: 600, textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
              Пропустить выдачу
            </div>
            <div onClick={onRedeem} style={{ width: '100%', padding: 17, borderRadius: 16, background: '#E7DFC9', color: '#1C1A15', fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: 'pointer', boxShadow: '0 0 24px rgba(231,223,201,0.3)' }}>
              Выдать 6-й бесплатно ♥
            </div>
          </>
        ) : (
          <div onClick={onCup} style={{ width: '100%', padding: 17, borderRadius: 16, background: '#C2A079', color: '#1C1A15', fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: 'pointer' }}>
            +1 кофе
          </div>
        )}
      </div>
    </div>
  );
}
