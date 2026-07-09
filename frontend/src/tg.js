// Обёртка над Telegram WebApp SDK.
// ВАЖНО: НЕ кэшируем window.Telegram в константу при импорте — на медленном Android WebView
// SDK (telegram-web-app.js) может быть ещё не готов к моменту загрузки нашего бандла.
// Берём объект динамически каждый раз.
function tgApp() {
  return (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) || null;
}

// DEV-мок включается ТОЛЬКО при сборке с VITE_DEV_MOCK=1 — в прод-бандл не попадает.
const DEV_MOCK = import.meta.env.VITE_DEV_MOCK === '1';

export function initTelegram() {
  const tg = tgApp();
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#1C1A15');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#1C1A15');
    } catch (e) {}
  }
}

// Дождаться готовности SDK и непустой initData (Android иногда отдаёт их с задержкой).
export function waitForInitData(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const tg = tgApp();
      if (tg && tg.initData) { resolve(tg.initData); return; }
      if (Date.now() - t0 >= timeoutMs) { resolve(tg ? (tg.initData || '') : ''); return; }
      setTimeout(tick, 120);
    };
    tick();
  });
}

// initData для авторизации на бэке.
export function getInitData() {
  const tg = tgApp();
  if (tg) return tg.initData || '';
  // DEV-мок только в спец-сборке (VITE_DEV_MOCK=1), иначе — пусто (бэк ответит 401).
  if (DEV_MOCK) {
    const devId = localStorage.getItem('radi_dev_id') || '777000777';
    const user = encodeURIComponent(JSON.stringify({ id: Number(devId), first_name: 'Дев', last_name: '' }));
    return `user=${user}&auth_date=${Math.floor(Date.now() / 1000)}&hash=dev`;
  }
  return '';
}

// Есть ли валидная initData (открыто корректно как Telegram Mini App)
export function hasInitData() {
  const tg = tgApp();
  return !!(tg && tg.initData);
}

export function getUnsafeUser() {
  return tgApp()?.initDataUnsafe?.user || null;
}

// Открыть внешнюю ссылку. В Telegram — нативно (openLink), иначе — обычный переход.
export function openLink(url) {
  const tg = tgApp();
  try {
    if (tg && tg.openLink) { tg.openLink(url); return; }
  } catch (e) {}
  try { window.open(url, '_blank', 'noopener'); } catch (e) {}
}

export function haptic(kind = 'light') {
  try {
    const h = tgApp()?.HapticFeedback;
    if (!h) return;
    if (kind === 'success' || kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch (e) {}
}

// Запрос контакта (телефон) через нативную кнопку Telegram.
export function requestContact() {
  // Возвращает строку с номером телефона, либо true (поделился, но номер в ответе не пришёл),
  // либо null (отказался / нет API).
  const tg = tgApp();
  return new Promise((resolve) => {
    if (!tg || !tg.requestContact) { resolve(null); return; }
    try {
      tg.requestContact((ok, ev) => {
        if (!ok) { resolve(null); return; }
        // в разных клиентах/версиях номер лежит по-разному — пробуем все известные пути
        const c =
          ev?.responseUnsafe?.contact ||
          ev?.response?.contact ||
          ev?.contact ||
          null;
        let phone = c?.phone_number || c?.phoneNumber || null;
        // некоторые клиенты кладут весь ответ строкой query-string
        if (!phone && typeof ev?.response === 'string') {
          try {
            const p = new URLSearchParams(ev.response);
            const raw = p.get('contact');
            if (raw) phone = JSON.parse(raw)?.phone_number || null;
          } catch (e) {}
        }
        resolve(phone || true);
      });
    } catch (e) { resolve(null); }
  });
}

// Нативный сканер QR Telegram. Возвращает текст QR или null.
export function scanQr() {
  const tg = tgApp();
  return new Promise((resolve) => {
    if (!tg || !tg.showScanQrPopup) { resolve(null); return; }
    let done = false;
    try {
      tg.showScanQrPopup({ text: 'Наведите на QR гостя' }, (text) => {
        if (done) return true;
        done = true;
        try { tg.closeScanQrPopup(); } catch (e) {}
        resolve(text || null);
        return true;
      });
    } catch (e) { resolve(null); }
  });
}

export function hasNativeScanner() {
  const tg = tgApp();
  return !!(tg && tg.showScanQrPopup);
}

// Функция, а не константа — SDK может появиться позже загрузки модуля (Android).
export function isTelegram() {
  return !!tgApp();
}
