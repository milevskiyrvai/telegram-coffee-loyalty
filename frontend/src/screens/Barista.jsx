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
    </>
  );
}
