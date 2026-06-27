// Режим владельца: нижняя навигация Статистика · Баристы · Гости.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { displayPhone, initial } from '../ui.js';
import { haptic } from '../tg.js';
import { Header, LogoR, ScanButton, SearchBar, ConfirmDialog, ScanOverlay } from '../components.jsx';
import GuestList from './GuestList.jsx';
import GuestCard from './GuestCard.jsx';
import { useGuests } from '../useGuests.js';

function StatsTab() {
  const [today, setToday] = useState(null);
  const [loyalty, setLoyalty] = useState([]);
  const guests = useGuests(); // для перехода в карточку гостя по клику в рейтинге

  useEffect(() => {
    api.statsToday().then(setToday).catch(() => {});
    api.statsLoyalty().then((r) => setLoyalty(r.loyalty)).catch(() => {});
  }, []);

  if (guests.screen === 'card' && guests.guest) {
    return (
      <>
        <GuestCard
          guest={guests.guest} undoLabel={guests.undoLabel}
          onBack={guests.back} onCup={guests.askCup} onRedeem={guests.askRedeem}
          onSkip={guests.askSkip} onBonus={guests.askBonus} onUndo={guests.undo}
        />
        <ConfirmDialog {...guests.confirmDialog} onConfirm={guests.confirm} onCancel={guests.cancel} />
      </>
    );
  }

  const max = Math.max(1, ...loyalty.map((g) => g.total));
  const s = today || { today: '–', guests: '–', gifts: '–', hot: '–', baristas: '–' };

  return (
    <>
      <Header title="Статистика" sub="РЕЖИМ ВЛАДЕЛЬЦА" subSpaced />
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 22px 22px' }}>
        <div style={{ background: 'linear-gradient(135deg,#2c281f,#23211b)', border: '1px solid rgba(194,160,121,0.28)', borderRadius: 20, padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#F3EEE2', fontSize: 46, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>{s.today}</div>
          <div style={{ color: '#9A9388', fontSize: 12.5, marginTop: 8, letterSpacing: '0.3px' }}>чашек отмечено сегодня</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <StatCell value={s.guests} label="гостей в базе" />
          <StatCell value={s.gifts} label="подарков выдано" />
          <StatCell value={s.hot} label="готовы к подарку" highlight />
          <StatCell value={s.baristas} label="барист" />
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={{ color: '#6E685E', fontSize: 10.5, fontWeight: 700, letterSpacing: '1.3px', padding: '0 2px 4px' }}>ДИНАМИКА ВОЗВРАЩЕНИЯ ГОСТЕЙ</div>
          <div style={{ color: '#5A554C', fontSize: 11, padding: '0 2px 14px' }}>кто покупает кофе чаще всего</div>
          {loyalty.map((g, i) => (
            <div key={g.id} onClick={() => guests.openGuest(g.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 2px', cursor: 'pointer' }}>
              <span style={{ color: '#6E685E', fontSize: 12, fontWeight: 700, width: 14, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#25231D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2A079', fontWeight: 600, fontSize: 13, flex: 'none' }}>{initial(g.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#ECE7DB', fontSize: 13.5, fontWeight: 600 }}>{g.name}</div>
                <div style={{ height: 6, background: 'rgba(218,213,198,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ width: Math.round((g.total / max) * 100) + '%', height: '100%', borderRadius: 3, background: i === 0 ? '#E7DFC9' : '#C2A079' }} />
                </div>
              </div>
              <span style={{ color: '#9A9388', fontSize: 12.5, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{g.total}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StatCell({ value, label, highlight }) {
  return (
    <div style={{ background: '#25231D', border: `1px solid ${highlight ? 'rgba(231,223,201,0.22)' : 'rgba(194,160,121,0.12)'}`, borderRadius: 16, padding: 18 }}>
      <div style={{ color: highlight ? '#E7DFC9' : '#ECE7DB', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      <div style={{ color: '#8C857A', fontSize: 11.5, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function BaristasTab() {
  const [mQuery, setMQuery] = useState('');
  const [baristas, setBaristas] = useState([]);
  const [search, setSearch] = useState([]);
  const [pending, setPending] = useState(null);

  const loadBaristas = useCallback(() => {
    api.baristas().then((r) => setBaristas(r.baristas)).catch(() => {});
  }, []);
  useEffect(() => { loadBaristas(); }, [loadBaristas]);

  useEffect(() => {
    if (!mQuery.trim()) { setSearch([]); return; }
    const t = setTimeout(() => {
      api.accounts(mQuery).then((r) => setSearch(r.accounts)).catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [mQuery]);

  const searching = mQuery.trim().length > 0;

  const askToggle = (a) => setPending({ id: a.id, name: a.name, toBarista: a.role !== 'barista' });
  const confirm = async () => {
    const p = pending; setPending(null);
    if (!p) return;
    try {
      await api.setRole(p.id, p.toBarista ? 'barista' : 'client');
      haptic('success');
      loadBaristas();
      if (mQuery.trim()) { const r = await api.accounts(mQuery); setSearch(r.accounts); }
    } catch (e) { haptic('error'); }
  };

  const row = (a) => {
    const isBarista = a.role === 'barista';
    return (
      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', borderBottom: '1px solid rgba(236,231,219,0.05)' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#25231D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2A079', fontWeight: 600, fontSize: 15, flex: 'none' }}>{initial(a.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: '#ECE7DB', fontSize: 14.5, fontWeight: 600 }}>{a.name}</span>
            {isBarista && <span style={{ color: '#1C1A15', background: '#C2A079', fontSize: 8.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, letterSpacing: '0.5px' }}>БАРИСТА</span>}
          </div>
          <div style={{ color: '#6E685E', fontSize: 11, fontFamily: 'monospace', marginTop: 3 }}>{displayPhone(a.phone)}</div>
        </div>
        {isBarista
          ? <div onClick={() => askToggle(a)} style={{ flex: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(217,138,106,0.45)', color: '#D98A6A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Уволить</div>
          : <div onClick={() => askToggle(a)} style={{ flex: 'none', padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(194,160,121,0.4)', color: '#C2A079', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Сделать&nbsp;баристой</div>}
      </div>
    );
  };

  let dialog = { open: false };
  if (pending) {
    dialog = {
      open: true,
      title: pending.toBarista ? 'Назначить баристой?' : 'Уволить баристу?',
      sub: pending.toBarista ? `${pending.name} получит доступ к отметке кофе` : `${pending.name} вернётся к обычному аккаунту`,
      cta: pending.toBarista ? 'Назначить' : 'Уволить',
      danger: !pending.toBarista,
    };
  }

  return (
    <>
      <Header title="Баристы" sub="РЕЖИМ ВЛАДЕЛЬЦА" subSpaced />
      <SearchBar value={mQuery} onChange={setMQuery} placeholder="Найти пользователя для назначения…" />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {searching ? (
          <>
            <div style={{ color: '#6E685E', fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', padding: '2px 22px 8px' }}>РЕЗУЛЬТАТЫ ПОИСКА</div>
            {search.map(row)}
            {search.length === 0 && <div style={{ padding: '34px 26px', textAlign: 'center', color: '#6E685E', fontSize: 13 }}>Никого не нашлось</div>}
          </>
        ) : (
          <>
            <div style={{ color: '#6E685E', fontSize: 10.5, fontWeight: 700, letterSpacing: '1.4px', padding: '2px 22px 8px' }}>ТЕКУЩИЕ БАРИСТЫ</div>
            {baristas.map(row)}
            {baristas.length === 0 && <div style={{ padding: '34px 26px', textAlign: 'center', color: '#6E685E', fontSize: 13, lineHeight: 1.5 }}>Баристов пока нет.<br /><span style={{ fontSize: 12 }}>Найдите пользователя через поиск выше.</span></div>}
          </>
        )}
      </div>
      <ConfirmDialog {...dialog} onConfirm={confirm} onCancel={() => setPending(null)} />
    </>
  );
}

function GuestsTab({ hideNav }) {
  const g = useGuests();
  useEffect(() => { hideNav(g.screen === 'card'); }, [g.screen, hideNav]);

  return (
    <>
      {g.screen === 'list' ? (
        <GuestList
          title="Гости" sub="РЕЖИМ ВЛАДЕЛЬЦА"
          accounts={g.accounts} query={g.query} onQuery={g.setQuery}
          onOpen={g.openGuest} onScan={g.startScan}
        />
      ) : (
        <GuestCard
          guest={g.guest} undoLabel={g.undoLabel}
          onBack={g.back} onCup={g.askCup} onRedeem={g.askRedeem}
          onSkip={g.askSkip} onBonus={g.askBonus} onUndo={g.undo}
        />
      )}
      <ScanOverlay open={g.scanning} onCancel={g.cancelScan} onResolve={g.resolveScanDemo} />
      <ConfirmDialog {...g.confirmDialog} onConfirm={g.confirm} onCancel={g.cancel} />
    </>
  );
}

export default function Owner() {
  const [tab, setTab] = useState('stats'); // 'stats' | 'baristas' | 'guests'
  const [navHidden, setNavHidden] = useState(false);

  const go = (t) => { haptic('light'); setNavHidden(false); setTab(t); };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'stats' && <StatsTab />}
        {tab === 'baristas' && <BaristasTab />}
        {tab === 'guests' && <GuestsTab hideNav={setNavHidden} />}
      </div>
      {!navHidden && (
        <div style={{ display: 'flex', borderTop: '1px solid rgba(236,231,219,0.08)', background: '#1C1A15', flex: 'none' }}>
          <NavItem active={tab === 'stats'} onClick={() => go('stats')} label="Статистика" />
          <NavItem active={tab === 'baristas'} onClick={() => go('baristas')} label="Баристы" />
          <NavItem active={tab === 'guests'} onClick={() => go('guests')} label="Гости" />
        </div>
      )}
    </div>
  );
}

function NavItem({ active, onClick, label }) {
  return (
    <div onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0 4px', cursor: 'pointer', color: active ? '#C2A079' : '#6E685E', fontSize: 11, fontWeight: active ? 700 : 500 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#C2A079' : 'transparent' }} />
      {label}
    </div>
  );
}
