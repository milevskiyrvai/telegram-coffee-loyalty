// Хук управления гостями (поиск, карточка, действия, подтверждение, undo, скан).
// Общий для роли «бариста» и вкладки «Гости» владельца.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { haptic, scanQr, hasNativeScanner } from './tg.js';

export function useGuests() {
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [screen, setScreen] = useState('list'); // 'list' | 'card'
  const [guest, setGuest] = useState(null);
  const [undoLabel, setUndoLabel] = useState(null);
  const [pending, setPending] = useState(null);
  const [scanning, setScanning] = useState(false);
  const debRef = useRef(null);

  const reload = useCallback(async (q) => {
    try {
      const r = await api.accounts(q ?? query);
      setAccounts(r.accounts);
    } catch (e) { /* тихо: список просто не обновится */ }
  }, [query]);

  // дебаунс поиска
  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => reload(query), 220);
    return () => clearTimeout(debRef.current);
  }, [query]); // eslint-disable-line

  const openGuest = useCallback(async (id) => {
    try {
      const r = await api.account(id);
      setGuest(r.account);
      setUndoLabel(r.account.undoLabel || null);
      setScreen('card');
      setPending(null);
    } catch (e) {}
  }, []);

  const back = useCallback(() => {
    setScreen('list');
    setGuest(null);
    setPending(null);
    setUndoLabel(null);
    reload(query);
  }, [query, reload]);

  // подтверждаемые действия
  const ask = (kind) => setPending({ kind });
  const cancel = () => setPending(null);

  const confirm = useCallback(async () => {
    const p = pending;
    if (!p || !guest) return;
    setPending(null);
    try {
      const r = await api.action(guest.id, p.kind);
      setGuest(r.account);
      setUndoLabel(r.account.undoLabel || null);
      haptic('success');
    } catch (e) { haptic('error'); }
  }, [pending, guest]);

  const undo = useCallback(async () => {
    if (!guest) return;
    try {
      const r = await api.undo(guest.id);
      setGuest(r.account);
      setUndoLabel(r.account.undoLabel || null);
      haptic('light');
    } catch (e) {}
  }, [guest]);

  // сканирование QR гостя
  const startScan = useCallback(async () => {
    haptic('light');
    if (hasNativeScanner()) {
      const text = await scanQr();
      if (text) {
        const m = String(text).match(/radi:(\d+)/);
        if (m) openGuest(Number(m[1]));
      }
      return;
    }
    // браузерный фолбэк: показываем оверлей и берём первого подходящего (демо)
    setScanning(true);
  }, [openGuest]);

  const resolveScanDemo = useCallback(() => {
    setScanning(false);
    const pool = accounts.filter((a) => a.role !== 'barista');
    if (pool.length) openGuest(pool[Math.floor(Math.random() * pool.length)].id);
  }, [accounts, openGuest]);

  const cancelScan = () => setScanning(false);

  // тексты диалога подтверждения
  let confirmDialog = { open: false };
  if (pending && guest) {
    const d = guest;
    const dBonus = d.bonus || 0;
    if (pending.kind === 'cup') {
      confirmDialog = { open: true, title: 'Отметить кофе?', sub: `${d.name} · станет ${d.count + 1} из 5`, cta: 'Отметить кофе', danger: false };
    } else if (pending.kind === 'redeem') {
      confirmDialog = { open: true, title: 'Выдать 6-й кофе бесплатно?', sub: `${d.name} — подарок, прогресс обнулится`, cta: 'Выдать подарок', danger: false };
    } else if (pending.kind === 'skip') {
      confirmDialog = { open: true, title: 'Пропустить выдачу?', sub: dBonus >= 5 ? 'Запас уже полон (5). Прогресс обнулится без накопления.' : 'Гость оплатил кофе — бесплатный отложим в запас (макс 5).', cta: 'Пропустить', danger: false };
    } else if (pending.kind === 'bonus') {
      confirmDialog = { open: true, title: 'Выдать бесплатный из запаса?', sub: `${d.name} · в запасе ${dBonus}`, cta: 'Выдать бесплатный', danger: false };
    }
  }

  return {
    query, setQuery, accounts, screen, guest, undoLabel,
    openGuest, back,
    askCup: () => ask('cup'), askRedeem: () => ask('redeem'), askSkip: () => ask('skip'), askBonus: () => ask('bonus'),
    confirm, cancel, undo, confirmDialog,
    scanning, startScan, resolveScanDemo, cancelScan,
    reload,
  };
}
