// API-клиент Radi Coffee. Авторизация — заголовок Authorization: tma <initData>.
import { getInitData } from './tg.js';

const BASE = import.meta.env.VITE_API_BASE || '';

async function req(method, path, body) {
  const headers = { Authorization: 'tma ' + getInitData() };
  const opts = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  // Таймаут, чтобы запрос не висел вечно на нестабильной сети/VPN.
  // AbortController есть не везде: на iOS 11-12 и старых Android WebView его нет,
  // и `new AbortController()` бросал ReferenceError ДО первого запроса — приложение
  // открывалось, но войти было нельзя никогда. Поэтому работаем и без него.
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; if (ctl) ctl.abort(); }, 15000);
  if (ctl) opts.signal = ctl.signal;

  const fail = (e) => {
    clearTimeout(t);
    const err = new Error(
      (timedOut || e?.name === 'AbortError') ? 'Превышено время ожидания сети' : 'Нет связи с сервером',
    );
    err.status = 0;
    return err;
  };

  let r;
  try {
    r = await fetch(BASE + path, opts);
  } catch (e) {
    throw fail(e);
  }
  if (!r.ok) {
    let detail = r.statusText;
    try { detail = (await r.json()).detail || detail; } catch (e) {}
    clearTimeout(t);
    const err = new Error(detail);
    err.status = r.status;
    throw err;
  }
  if (r.status === 204) { clearTimeout(t); return null; }
  // ВАЖНО: таймер снимаем только ПОСЛЕ чтения тела. Раньше clearTimeout стоял до
  // r.json(), и если связь рвалась на середине ответа, приложение висело вечно —
  // тот самый «бесконечный спиннер».
  try {
    const data = await r.json();
    clearTimeout(t);
    return data;
  } catch (e) {
    throw fail(e);
  }
}

export const api = {
  config: () => req('GET', '/api/config'),
  auth: () => req('POST', '/api/auth'),
  saveProfile: (name, phone) => req('POST', '/api/me/profile', { name, phone }),
  me: () => req('GET', '/api/me'),
  accounts: (query) => req('GET', '/api/accounts?query=' + encodeURIComponent(query || '')),
  account: (id) => req('GET', '/api/accounts/' + id),
  action: (id, type) => req('POST', `/api/accounts/${id}/action`, { type }),
  undo: (id) => req('POST', `/api/accounts/${id}/undo`),
  setRole: (id, role) => req('POST', `/api/accounts/${id}/role`, { role }),
  baristas: () => req('GET', '/api/baristas'),
  statsToday: () => req('GET', '/api/stats/today'),
  statsLoyalty: () => req('GET', '/api/stats/loyalty'),
};
