// Маячок сбоев: приложение само сообщает серверу, на чём споткнулось у гостя.
// Раньше о поломках мы узнавали только со слов человека в кофейне — и разбирать
// приходилось, пока он не ушёл. Гость маячка не видит и ничего не делает.

import { getUnsafeUser, tgDiag } from './tg.js';

let sent = 0; // один телефон не должен слать поток

export function reportProblem(step, err) {
  if (sent >= 5) return;
  sent += 1;
  try {
    const d = tgDiag();
    const body = JSON.stringify({
      step: String(step || ''),
      message: String((err && (err.message || err)) || '').slice(0, 200),
      platform: d.platform,
      tg_version: String(d.version),
      init_len: d.initLen,
      uid: getUnsafeUser()?.id ?? null,
      app_version: (location.search.match(/v=(\d+)/) || [])[1] || '',
    });
    // sendBeacon переживает закрытие приложения — гость часто закрывает его сразу
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/beacon', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/beacon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true,
    }).catch(() => {});
  } catch (e) {
    // маячок не имеет права ломать приложение — молчим
  }
}

// Ловит то, что убивает экран: необработанную ошибку JS и упавший промис.
export function installProblemReporter() {
  try {
    window.addEventListener('error', (e) => reportProblem('js', e?.error || e?.message));
    window.addEventListener('unhandledrejection', (e) => reportProblem('promise', e?.reason));
  } catch (e) {}
}
