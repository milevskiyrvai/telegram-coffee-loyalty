// Режим баристы: список гостей ↔ карточка гостя с начислением.
import GuestList from './GuestList.jsx';
import GuestCard from './GuestCard.jsx';
import { ConfirmDialog, ScanOverlay } from '../components.jsx';
import { useGuests } from '../useGuests.js';

export default function Barista() {
  const g = useGuests();

  return (
    <>
      {g.screen === 'list' ? (
        <GuestList
          title="Гости" sub="РЕЖИМ БАРИСТЫ"
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
      <ErrorBar text={g.error} onClose={g.clearError} />
    </>
  );
}

// Плашка сбоя. Раньше ошибки глотались молча, и бариста видела мёртвую кнопку.
export function ErrorBar({ text, onClose }) {
  if (!text) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 14, zIndex: 60,
        background: '#2A211A', border: '1px solid rgba(194,160,121,0.55)', borderRadius: 14,
        padding: '13px 16px', color: '#ECE7DB', fontSize: 13.5, lineHeight: 1.45,
        boxShadow: '0 10px 30px rgba(0,0,0,0.45)', cursor: 'pointer',
      }}
    >
      {text}
      <div style={{ color: '#8C857A', fontSize: 11, marginTop: 6 }}>нажмите, чтобы скрыть</div>
    </div>
  );
}
