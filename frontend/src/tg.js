// Обёртка над Telegram WebApp SDK. В браузере (dev) даёт мок.
const tg = window.Telegram?.WebApp;

export function initTelegram() {
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      // тёмная тема приложения
      if (tg.setHeaderColor) tg.setHeaderColor('#1C1A15');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#1C1A15');
    } catch (e) {}
  }
}

// initData для авторизации на бэке.
export function getInitData() {
  // Внутри Telegram — всегда отдаём настоящую initData (даже если пустую:
  // тогда бэк честно ответит 401, а UI покажет «откройте через бота», без dev-подмены).
  if (tg) return tg.initData || '';
  // DEV-режим (запуск в обычном браузере, без Telegram) — мок. Работает только если
  // бэкенд поднят с RADI_DEV_AUTH=1 (в проде это выключено, мок отвергается).
  const devId = localStorage.getItem('radi_dev_id') || '777000777';
  const user = encodeURIComponent(JSON.stringify({ id: Number(devId), first_name: 'Дев', last_name: '' }));
  return `user=${user}&auth_date=${Math.floor(Date.now() / 1000)}&hash=dev`;
}

// Есть ли валидная initData (открыто корректно как Telegram Mini App)
export function hasInitData() {
  return !!(tg && tg.initData);
}

export function getUnsafeUser() {
  return tg?.initDataUnsafe?.user || null;
}

// Открыть внешнюю ссылку. В Telegram — нативно (openLink), иначе — обычный переход.
export function openLink(url) {
  try {
    if (tg && tg.openLink) { tg.openLink(url); return; }
  } catch (e) {}
  try { window.open(url, '_blank', 'noopener'); } catch (e) {}
}

export function haptic(kind = 'light') {
  try {
    const h = tg?.HapticFeedback;
    if (!h) return;
    if (kind === 'success' || kind === 'error' || kind === 'warning') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch (e) {}
}

// Запрос контакта (телефон) через нативную кнопку Telegram.
export function requestContact() {
  // Возвращает строку с номером телефона, либо true (поделился, но номер в ответе не пришёл),
  // либо null (отказался / нет API).
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
  return !!(tg && tg.showScanQrPopup);
}

export const isTelegram = !!tg;
