// Корень приложения: авторизация по initData, онбординг-гейт, роутинг по роли.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { initTelegram, waitForInitData, tgDiag } from './tg.js';
import { Spinner } from './components.jsx';
import Onboarding from './screens/Onboarding.jsx';
import ClientCard from './screens/ClientCard.jsx';
import Barista from './screens/Barista.jsx';
import Owner from './screens/Owner.jsx';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [cfg, setCfg] = useState({ address: 'ул. Болотниковская, 36к5' });

  async function refresh() {
    try {
      const a = await api.auth();
      setMe(a.me);
      return a.me;
    } catch (e) { return null; }
  }

  useEffect(() => {
    initTelegram();
    (async () => {
      try {
        // initData может появиться с заметной задержкой (Telegram прогревает WebView).
        // НЕ сдаёмся раньше времени: ждём и ретраим ~30с, юзер видит спиннер, а не ошибку.
        await waitForInitData(10000);
        initTelegram();
        const c = await api.config().catch(() => cfg);
        if (c) setCfg(c);

        let lastErr = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          try {
            const a = await api.auth();
            setMe(a.me);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            // даже если initData пуст — ждём ещё: он часто приходит через пару секунд
            await waitForInitData(3500);
            initTelegram();
          }
        }
        if (lastErr) throw lastErr;
      } catch (e) {
        setError(e.message || 'Ошибка входа');
      } finally {
        setLoading(false);
      }
    })();

    // Перечитываем профиль, когда юзер возвращается в мини-апп
    // (например, поделился номером боту в чате и вернулся) — чтобы не спрашивать дважды.
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const wa = window.Telegram?.WebApp;
    try { wa?.onEvent?.('activated', refresh); } catch (e) {}
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      try { wa?.offEvent?.('activated', refresh); } catch (e) {}
    };
  }, []); // eslint-disable-line

  async function finishOnboarding(name, phone) {
    const r = await api.saveProfile(name, phone || me?.phone || '');
    setMe(r.me);
  }

  if (loading) {
    return <div className="app-screen"><Spinner /></div>;
  }

  if (error) {
    return (
      <div className="app-screen">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center', gap: 12 }}>
          <div style={{ width: 60, height: 60, border: '1.5px solid #C2A079', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2A079', fontWeight: 700, fontSize: 28 }}>R</div>
          <div style={{ color: '#F3EEE2', fontSize: 18, fontWeight: 700 }}>Radi coffee</div>
          <div style={{ color: '#8C857A', fontSize: 13.5, lineHeight: 1.5 }}>
            Не удалось открыть карту.<br />Нажмите «Повторить».
            <br /><span style={{ color: '#5A554C', fontSize: 12 }}>{error}</span>
          </div>
          <div onClick={() => location.reload()} style={{ marginTop: 8, padding: '11px 22px', borderRadius: 13, background: '#C2A079', color: '#1C1A15', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Повторить
          </div>
          {(() => { const d = tgDiag(); return (
            <div style={{ marginTop: 14, color: '#4A463E', fontSize: 10.5, fontFamily: 'monospace' }}>
              tg:{d.hasTg ? '1' : '0'} · init:{d.initLen} · {d.platform} · v{d.version} · u:{d.hasUnsafeUser ? '1' : '0'}
            </div>
          ); })()}
        </div>
      </div>
    );
  }

  let content;
  if (!me.onboarded) {
    content = <Onboarding phone={me.phone} onFinish={finishOnboarding} />;
  } else if (me.role === 'owner') {
    content = <Owner />;
  } else if (me.role === 'barista') {
    content = <Barista />;
  } else {
    content = <ClientCard me={me} address={cfg.address} />;
  }

  return <div className="app-screen">{content}</div>;
}
