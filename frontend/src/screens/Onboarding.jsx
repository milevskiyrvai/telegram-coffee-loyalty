// Онбординг: шаг 1 — поделиться номером, шаг 2 — ввести имя. Пиксель-в-пиксель из прототипа.
import { useState } from 'react';
import { displayPhone } from '../ui.js';
import { requestContact, haptic } from '../tg.js';
import { api } from '../api.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Onboarding({ phone, onFinish }) {
  // Если номер уже есть — сразу шаг имени. Иначе просим поделиться (работает и на Android, и на iPhone).
  const [step, setStep] = useState(phone ? 'name' : 'phone'); // 'phone' | 'name'
  const [name, setName] = useState('');
  const [sharedPhone, setSharedPhone] = useState(phone || '');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false); // ждём номер после «поделиться»

  const canFinish = name.trim().length > 0;

  async function share() {
    if (waiting) return;
    haptic('light');
    setWaiting(true);
    try {
      // 1) нативный запрос контакта. Telegram отдаёт номер БОТУ (message.contact);
      //    часть клиентов возвращает его и в апп — тогда возьмём сразу.
      const res = await requestContact();
      if (typeof res === 'string' && res) {
        setSharedPhone(res);
        setStep('name');
        return;
      }
      if (res === null) {
        // отказался или API недоступен — остаёмся на шаге номера
        return;
      }
      // 2) res === true: юзер поделился, но номер пришёл боту, не в апп.
      //    Опрашиваем сервер, пока бот сохранит номер (одинаково на всех платформах).
      for (let i = 0; i < 12; i++) {
        await sleep(700);
        try {
          const r = await api.me();
          if (r?.me?.phone) { setSharedPhone(r.me.phone); setStep('name'); return; }
        } catch (e) { /* сеть моргнула — пробуем ещё */ }
      }
      // номер за ~8с так и не сохранился — всё равно пускаем к имени,
      // номер подтянется позже (бот сохранит, App перечитает при возврате фокуса).
      setStep('name');
    } finally {
      setWaiting(false);
    }
  }

  function changeName(v) {
    setName((v || '').replace(/[^А-Яа-яЁё -]/g, ''));
  }

  async function finish() {
    if (!canFinish || busy) return;
    setBusy(true);
    haptic('success');
    try {
      await onFinish(name.trim(), sharedPhone);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 30px' }}>
      <div style={{ width: 60, height: 60, border: '1.5px solid #C2A079', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2A079', fontWeight: 700, fontSize: 28, marginBottom: 18 }}>R</div>
      <div style={{ color: '#F3EEE2', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>Radi coffee</div>

      {step === 'phone' && (
        <>
          <div style={{ color: '#8C857A', fontSize: 13.5, marginTop: 10, textAlign: 'center', lineHeight: 1.55 }}>
            Копите кофе и получайте каждый<br />6-й в подарок. Для начала поделитесь<br />номером телефона.
          </div>
          <div style={{ flex: 1, maxHeight: 60 }} />
          <div onClick={share} style={{ width: '100%', padding: 17, borderRadius: 16, background: '#C2A079', color: '#1C1A15', fontSize: 16, fontWeight: 700, textAlign: 'center', cursor: waiting ? 'default' : 'pointer', opacity: waiting ? 0.7 : 1 }}>
            {waiting ? 'Подтверждаем…' : 'Поделиться номером'}
          </div>
          <div style={{ color: '#5A554C', fontSize: 11, marginTop: 14, textAlign: 'center', lineHeight: 1.5 }}>
            Номер берётся из Telegram —<br />вводить вручную не нужно
          </div>
        </>
      )}

      {step === 'name' && (
        <>
          <div style={{ color: '#8C857A', fontSize: 13.5, marginTop: 10, textAlign: 'center' }}>Как вас представить в кофейне?</div>
          {sharedPhone ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, color: '#9A9388', fontSize: 13, fontFamily: 'monospace' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5BBF7B' }} />{displayPhone(sharedPhone)}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, color: '#9A9388', fontSize: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5BBF7B' }} />номер подтверждён
            </div>
          )}
          <input
            value={name}
            onChange={(e) => changeName(e.target.value)}
            placeholder="Ваше имя"
            style={{ width: '100%', background: '#25231D', border: '1px solid rgba(194,160,121,0.2)', borderRadius: 16, outline: 'none', color: '#ECE7DB', fontSize: 18, textAlign: 'center', padding: 16, margin: '24px 0 0' }}
          />
          <div style={{ flex: 1, maxHeight: 60 }} />
          <div
            onClick={finish}
            style={{
              width: '100%', padding: 17, borderRadius: 16,
              background: canFinish ? '#C2A079' : '#25231D',
              color: canFinish ? '#1C1A15' : '#5A554C',
              fontSize: 16, fontWeight: 700, textAlign: 'center',
              cursor: canFinish ? 'pointer' : 'default',
            }}
          >Начать копить</div>
        </>
      )}
    </div>
  );
}
