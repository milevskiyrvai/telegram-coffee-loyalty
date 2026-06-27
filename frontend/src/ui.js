// Утилиты отображения — перенесены 1:1 из прототипа (форматы, штампы, прогресс-бары).

export const CYCLE = 5;

export function normalizePhone(v) {
  let d = (v || '').replace(/\D/g, '');
  while (d.length && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
  return d.slice(0, 10);
}

export function formatNat(d) {
  d = d || '';
  const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6, 8), e = d.slice(8, 10);
  let s = a;
  if (b) s += ' ' + b;
  if (c) s += '-' + c;
  if (e) s += '-' + e;
  return s;
}

export function displayPhone(d) {
  const n = formatNat(d || '');
  return n ? '+7 ' + n : '+7';
}

export function initial(name) {
  return (name && name[0] ? name[0] : '?').toUpperCase();
}

// Штампы 5 кружков + 6-й «сердце-подарок».
export function buildSlots(count) {
  const base = {
    width: 48, height: 48, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 500,
  };
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const filled = i < count;
    slots.push({
      key: 's' + i, label: '', style: {
        ...base,
        background: filled ? '#DAD5C6' : 'transparent',
        border: filled ? 'none' : '1.5px solid rgba(218,213,198,0.22)',
      },
    });
  }
  const active = count >= 5;
  slots.push({
    key: 'g', label: '♥', style: {
      ...base,
      color: active ? '#1C1A15' : 'rgba(218,213,198,0.4)',
      background: active ? '#E7DFC9' : 'transparent',
      border: active ? 'none' : '1.5px dashed rgba(218,213,198,0.3)',
      boxShadow: active ? '0 0 16px rgba(231,223,201,0.45)' : 'none',
    },
  });
  return slots;
}

// Иконка кофейного стаканчика для карты клиента (пустой / полный / подарочный).
// SVG как data-URI — перенесено 1:1 из дизайн-прототипа.
function cupURI(kind) {
  // kind: 'empty' | 'full' | 'gift'
  const lidF = kind === 'empty' ? 'none' : (kind === 'gift' ? '%23C2A079' : '%23A9712F');
  const lidS = kind === 'empty' ? '%23736C60' : 'none';
  const bodyF = kind === 'empty' ? 'none' : (kind === 'gift' ? '%23E7DFC9' : '%23C2A079');
  const bodyS = kind === 'empty' ? '%23736C60' : 'none';
  const body = "M13 18 L35 18 L31.6 50 Q31.4 52 29.4 52 L18.6 52 Q16.6 52 16.4 50 Z";
  let steam = '';
  if (kind === 'gift') {
    steam = "<path d='M19 6 Q17 8 19 10' fill='none' stroke='%23C2A079' stroke-width='1.6' stroke-linecap='round'/>"
          + "<path d='M24 5 Q22 7 24 9' fill='none' stroke='%23C2A079' stroke-width='1.6' stroke-linecap='round'/>"
          + "<path d='M29 6 Q27 8 29 10' fill='none' stroke='%23C2A079' stroke-width='1.6' stroke-linecap='round'/>";
  }
  const heart = kind === 'gift'
    ? "<path d='M24 33 C22 30 18 31 18 34.5 C18 37.5 24 41 24 41 C24 41 30 37.5 30 34.5 C30 31 26 30 24 33 Z' fill='%231C1A15'/>"
    : '';
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 56'>"
    + steam
    + "<path d='" + body + "' fill='" + bodyF + "' stroke='" + bodyS + "' stroke-width='2'/>"
    + "<rect x='10.5' y='12' width='27' height='7.5' rx='3' fill='" + lidF + "' stroke='" + lidS + "' stroke-width='2'/>"
    + heart
    + "</svg>";
  return 'url("data:image/svg+xml,' + svg + '")';
}

export function buildCupSlots(count) {
  const base = { width: 48, height: 56, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain' };
  const slots = [];
  for (let i = 0; i < 5; i++) {
    slots.push({ key: 'c' + i, style: { ...base, backgroundImage: cupURI(i < count ? 'full' : 'empty') } });
  }
  slots.push({
    key: 'g', style: {
      ...base,
      backgroundImage: cupURI(count >= 5 ? 'gift' : 'empty'),
      filter: count >= 5 ? 'drop-shadow(0 0 10px rgba(231,223,201,0.5))' : 'none',
    },
  });
  return slots;
}

// Мини-бары прогресса в списке гостей (5 + 1 подарочный).
export function buildBars(count) {
  const bars = [];
  for (let i = 0; i < 5; i++) {
    bars.push({
      key: 'b' + i, style: {
        flex: 1, height: 4, borderRadius: 2,
        background: i < count ? '#C2A079' : 'rgba(218,213,198,0.14)',
      },
    });
  }
  const hot = count >= 5;
  bars.push({
    key: 'g', style: {
      flex: 1, height: 4, borderRadius: 2,
      background: hot ? '#E7DFC9' : 'rgba(218,213,198,0.14)',
      boxShadow: hot ? '0 0 6px rgba(231,223,201,0.7)' : 'none',
    },
  });
  return bars;
}

// Сортировка списка гостей: сначала «горячие», затем по имени.
export function sortGuests(list) {
  return list.slice().sort((a, b) => ((b.count >= 5) - (a.count >= 5)) || a.name.localeCompare(b.name, 'ru'));
}
