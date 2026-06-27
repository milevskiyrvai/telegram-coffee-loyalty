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
  // таймаут, чтобы запрос не висел вечно на нестабильной сети/VPN
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  opts.signal = ctl.signal;
  let r;
  try {
    r = await fetch(BASE + path, opts);
  } catch (e) {
    clearTimeout(t);
    const err = new Error(e.name === 'AbortError' ? 'Превышено время ожидания сети' : 'Нет связи с сервером');
    err.status = 0;
    throw err;
  }
  clearTimeout(t);
  if (!r.ok) {
    let detail = r.statusText;
    try { detail = (await r.json()).detail || detail; } catch (e) {}
    const err = new Error(detail);
    err.status = r.status;
    throw err;
  }
  if (r.status === 204) return null;
  return r.json();
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
