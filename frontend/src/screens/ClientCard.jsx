// Экран клиента: карта лояльности + QR. Пиксель-в-пиксель из прототипа.
import { useState } from 'react';
import { LogoR } from '../components.jsx';
import { buildCupSlots } from '../ui.js';
import { openLink, haptic } from '../tg.js';
import Qr from '../Qr.jsx';

export default function ClientCard({ me, address, onRename }) {
  const hot = me.count >= 5;
  const status = hot ? 'Заберите 6-й кофе бесплатно ♥' : `До подарка осталось: ${5 - me.count}`;
  const qrValue = 'radi:' + me.id;
  const cups = buildCupSlots(me.count);

  // Смена имени. Нужна тем, у кого после аварии 30.07 в карте осталось имя
  // из профиля Telegram (латиница, эмодзи) вместо выбранного самим гостем.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const canSave = draft.trim().length > 0 && !busy;

  function openEdit() {
    haptic('light');
    // в поле кладём только кириллическую часть текущего имени: латиницу сервер всё равно вырежет
    setDraft((me.name || '').replace(/[^А-Яа-яЁё -]/g, '').replace(/\s+/g, ' ').trim());
    setEditing(true);
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await onRename(draft.trim(), me.phone);
      haptic('success');
      setEditing(false);
    } catch (e) {
      // не удалось сохранить — оставляем окно открытым, чтобы гость мог повторить
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 22px 18px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <LogoR />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ color: '#ECE7DB', fontSize: 14, fontWeight: 600 }}>{me.name}</span>
          <span style={{ color: '#8C857A', fontSize: 11 }}>
            ваша карта лояльности
            {' · '}
            <span onClick={openEdit} style={{ color: '#C2A079', cursor: 'pointer' }}>изменить имя</span>
          </span>
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

      {editing && (
        <div
          onClick={() => !busy && setEditing(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 340, background: '#1C1A15', border: '1px solid rgba(194,160,121,0.42)', borderRadius: 22, padding: 22, boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}
          >
            <div style={{ color: '#D8D2C2', fontSize: 17, fontWeight: 600, textAlign: 'center' }}>Как вас представить в кофейне?</div>
            <input
              value={draft}
              autoFocus
              onChange={(e) => setDraft((e.target.value || '').replace(/[^А-Яа-яЁё -]/g, ''))}
              placeholder="Ваше имя"
              style={{ width: '100%', background: '#25231D', border: '1px solid rgba(194,160,121,0.2)', borderRadius: 16, outline: 'none', color: '#ECE7DB', fontSize: 18, textAlign: 'center', padding: 16, margin: '18px 0 0' }}
            />
            <div style={{ color: '#5A554C', fontSize: 11, marginTop: 10, textAlign: 'center' }}>Только русские буквы</div>
            <div
              onClick={save}
              style={{
                width: '100%', padding: 15, borderRadius: 16, marginTop: 16,
                background: canSave ? '#C2A079' : '#25231D',
                color: canSave ? '#1C1A15' : '#5A554C',
                fontSize: 15.5, fontWeight: 700, textAlign: 'center',
                cursor: canSave ? 'pointer' : 'default',
              }}
            >{busy ? 'Сохраняем…' : 'Сохранить'}</div>
            <div
              onClick={() => !busy && setEditing(false)}
              style={{ color: '#6E685E', fontSize: 13, textAlign: 'center', marginTop: 12, cursor: 'pointer' }}
            >Отмена</div>
          </div>
        </div>
      )}
    </div>
  );
}
