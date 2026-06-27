// Настоящий сканируемый QR в фирменном стиле Radi coffee.
// Кодирует id аккаунта (формат "radi:<id>"), кремовый фон, тёмные модули,
// центральный логотип — кофейное зерно (косметика из брифа).
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

const CREAM = '#EDE6D6';
const DARK = '#1C1A15';
const ACCENT = '#A9712F';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBean(ctx, cx, cy, r, color, bg) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.62, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bg;
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.78);
  ctx.quadraticCurveTo(r * 0.5, 0, 0, r * 0.78);
  ctx.stroke();
  ctx.restore();
}

export default function Qr({ value, size = 189 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !value) return;

    // Генерируем матрицу QR (надёжный уровень коррекции H — переживает логотип в центре).
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const N = qr.modules.size;
    const data = qr.modules.data;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const mod = Math.floor((size * dpr) / N);
    const px = mod * N;
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, px, px);

    // зона центрального логотипа (≈ 22% по центру) — модули там не критичны при ECC=H
    const logoFrac = 0.22;
    const lo = Math.floor(N * (0.5 - logoFrac / 2));
    const hi = Math.ceil(N * (0.5 + logoFrac / 2));
    const inLogo = (x, y) => x >= lo && x < hi && y >= lo && y < hi;

    // финдеры (7×7 по трём углам) рисуем фирменно скруглённо
    const inFinder = (x, y) => {
      const f = (fx, fy) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
      return f(0, 0) || f(N - 7, 0) || f(0, N - 7);
    };

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (inFinder(x, y) || inLogo(x, y)) continue;
        if (data[y * N + x]) {
          ctx.fillStyle = DARK;
          ctx.fillRect(x * mod, y * mod, mod, mod);
        }
      }
    }

    // скруглённые финдеры
    const fp = (fx, fy) => {
      const X = fx * mod, Y = fy * mod;
      ctx.fillStyle = DARK; rr(ctx, X, Y, 7 * mod, 7 * mod, mod * 1.6); ctx.fill();
      ctx.fillStyle = CREAM; rr(ctx, X + mod, Y + mod, 5 * mod, 5 * mod, mod * 1.1); ctx.fill();
      ctx.fillStyle = DARK; rr(ctx, X + 2 * mod, Y + 2 * mod, 3 * mod, 3 * mod, mod * 0.8); ctx.fill();
    };
    fp(0, 0); fp(N - 7, 0); fp(0, N - 7);

    // центральный логотип — кофейное зерно на кремовой подложке
    const L = lo * mod, S = (hi - lo) * mod;
    ctx.fillStyle = CREAM; rr(ctx, L - mod * 0.4, L - mod * 0.4, S + mod * 0.8, S + mod * 0.8, mod); ctx.fill();
    drawBean(ctx, L + S / 2, L + S / 2, S * 0.4, DARK, CREAM);
  }, [value, size]);

  return (
    <div style={{ background: CREAM, padding: 11, borderRadius: 18, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
      <canvas ref={ref} style={{ display: 'block', width: size, height: size }} />
    </div>
  );
}
