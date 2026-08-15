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
  const [error, setError] = useState('');   // текст сбоя для баристы
  const debRef = useRef(null);
  // Защита от повторной отправки: React обновляет состояние не мгновенно, поэтому
  // два быстрых тапа успевали прочитать одно и то же pending и уходили в сеть оба —
  // гостю начислялись две чашки. Ref меняется сразу, ещё до перерисовки.
  const inFlight = useRef(false);

  const reload = useCallback(async (q) => {
    try {
      const r = await api.accounts(q ?? query);
      setAccounts(r.accounts);
      setError('');
    } catch (e) {
      setError('Не удалось загрузить список гостей. Проверьте связь.');
    }
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
      setError('');
    } catch (e) {
      setError('Не удалось открыть карточку гостя. Попробуйте ещё раз.');
    }
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
    if (!p || !guest || inFlight.current) return;
    inFlight.current = true;
    setPending(null);
    setError('');
    try {
      const r = await api.action(guest.id, p.kind);
      setGuest(r.account);
      setUndoLabel(r.account.undoLabel || null);
      haptic('success');
    } catch (e) {
      haptic('error');
      // Раньше сбой глотался молча: бариста видела прежнюю цифру и жала снова,
      // а когда связь возвращалась — прилетали все накопленные нажатия сразу.
      setError('Кофе НЕ отмечен: ' + (e.message || 'нет связи') + '. Повторите.');
    } finally {
      inFlight.current = false;
    }
  }, [pending, guest]);

  const undo = useCallback(async () => {
    if (!guest || inFlight.current) return;
    inFlight.current = true;
    setError('');
    try {
      const r = await api.undo(guest.id);
      setGuest(r.account);
      setUndoLabel(r.account.undoLabel || null);
      haptic('light');
    } catch (e) {
      haptic('error');
      setError('Отменить не получилось: ' + (e.message || 'нет связи'));
    } finally {
      inFlight.current = false;
    }
  }, [guest]);

  // сканирование QR гостя
  const startScan = useCallback(async () => {
    haptic('light');
    if (!hasNativeScanner()) {
      // Раньше здесь открывался СЛУЧАЙНЫЙ гость из списка (заглушка из прототипа) —
      // бариста могла отметить кофе не тому человеку. Теперь честно говорим правду.
      setError('Сканер недоступен на этом устройстве. Найдите гостя по имени или номеру.');
      return;
    }
    const text = await scanQr();
    if (!text) return;                       // гость закрыл сканер — это не ошибка
    const m = String(text).match(/radi:(\d+)/);
    if (!m) {
      setError('Это не карта Radi Coffee. Попросите гостя открыть карту в приложении.');
      return;
    }
    openGuest(Number(m[1]));
  }, [openGuest]);

  const resolveScanDemo = useCallback(() => setScanning(false), []);

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
    error, clearError: () => setError(''),
  };
}
