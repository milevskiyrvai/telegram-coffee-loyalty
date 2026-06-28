# ☕ Telegram Coffee Loyalty

A coffee‑shop loyalty program built as a **Telegram Mini App**: *every 6th coffee is free*.
It replaces paper stamp cards — a barista finds a guest by name / phone (or QR scan) and marks
a coffee in one tap. Running in production for a real café.

[![CI](https://github.com/milevskiyrvai/telegram-coffee-loyalty/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/milevskiyrvai/telegram-coffee-loyalty/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> One app, three roles — the screen is chosen by the account's role:
> **Client** (loyalty card + QR) · **Barista** (find guests, mark coffee) · **Owner** (stats, manage baristas).
>
> The UI is in Russian — it's built for a real Russian‑speaking café.

---

## 📱 Screenshots

| Onboarding | Client card | Guests (barista) |
|:---:|:---:|:---:|
| ![onboarding](docs/screenshots/onboarding.png) | ![client](docs/screenshots/client-card.png) | ![barista](docs/screenshots/barista-list.png) |

| Guest card | Owner stats | Baristas |
|:---:|:---:|:---:|
| ![guest](docs/screenshots/guest-card.png) | ![stats](docs/screenshots/owner-stats.png) | ![baristas](docs/screenshots/owner-baristas.png) |

*(phone numbers are demo seed data, blurred in screenshots)*

---

## ✨ Features

- **Telegram Mini App** with server‑side auth via **initData (HMAC‑SHA256)** — the client is never
  trusted; the signature is verified on the backend against the bot token.
- **Three roles** in a single app, routed by the account's role.
- **Loyalty logic** with carry‑over and undo:
  - `+1 coffee`, `redeem 6th free`, `skip` (defer the free coffee into a reserve, up to 5), `use reserve`;
  - every action goes through a confirmation; the last one can be **undone** (action journal).
- **Real scannable QR** in the brand style (encodes the account id); the barista scans via Telegram's native scanner.
- **Owner dashboard**: cups today, guests in base, gifts given, returning‑guests leaderboard.
- **Barista management**: assign / dismiss by search.
- Phone number comes from Telegram (`request_contact`) — never typed by hand.

---

## 🧱 Stack

- **Frontend** — React 18 + Vite, no UI framework (pixel‑perfect to the design), `qrcode` for QR generation.
- **Backend** — Python, FastAPI, SQLite (lightweight, no separate DBMS).
- **Bot** — aiogram 3 (polling), opens the Mini App via the chat menu button.
- **Deploy** — systemd + nginx + Let's Encrypt.

```
Telegram ──┬─ Mini App (React) ──→ FastAPI ──→ SQLite
           │       ▲  initData (HMAC-SHA256)
           └─ Bot (aiogram) ───────┘
```

---

## 🗂 Project layout

```
backend/
  app/
    main.py      # FastAPI: routes + auth dependencies
    auth.py      # Telegram initData verification (HMAC), phone/name normalization
    service.py   # loyalty domain logic (atomic, with an action journal)
    db.py        # SQLite layer (WAL, transactions)
    config.py    # config from environment
  bot.py         # Telegram bot (aiogram)
  seed.py        # demo data for local development
frontend/
  src/
    App.jsx      # auth, onboarding gate, role routing
    api.js       # API client (Authorization: tma <initData>)
    tg.js        # Telegram WebApp SDK wrapper
    screens/     # Onboarding, ClientCard, Barista, Owner, GuestList, GuestCard
    Qr.jsx       # branded QR generation
.github/workflows/ci.yml   # CI: ruff (backend) + eslint & build (frontend)
```

---

## 🚀 Local development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # set BOT_TOKEN, OWNER_TG_IDS
python seed.py                # demo data (20 guests)
RADI_DEV_AUTH=1 uvicorn app.main:app --port 8011    # DEV_AUTH=1 skips signature check — LOCAL ONLY
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5183, /api proxied to :8011
```

### Bot
```bash
cd backend
python bot.py                 # needs a valid BOT_TOKEN
```

---

## 🔐 Authentication

The client sends `Authorization: tma <initData>`. The backend:
1. parses `initData`, computes HMAC‑SHA256 with the secret `HMAC("WebAppData", bot_token)`;
2. compares it to `hash` and checks the `auth_date` freshness;
3. resolves/creates the account by `user.id` and applies the owner role from `OWNER_TG_IDS`.

In dev mode (`RADI_DEV_AUTH=1`) the signature is **not** verified — for local development only.

---

## 📦 API (brief)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth` | any | current user profile (created on first open) |
| POST | `/api/me/profile` | any | save name / phone (onboarding) |
| GET | `/api/accounts?query=` | staff | search guests |
| POST | `/api/accounts/:id/action` | staff | `cup` / `redeem` / `skip` / `bonus` |
| POST | `/api/accounts/:id/undo` | staff | undo the last action |
| POST | `/api/accounts/:id/role` | owner | assign / remove barista |
| GET | `/api/stats/today` · `/api/stats/loyalty` | owner | statistics |

---

## 🛠 Roadmap / tech debt

See [TODO.md](TODO.md) — e.g. the undo is currently unbounded (can walk the whole history back);
the desired limit is to be agreed with the café owner.

---

## 📄 License

[MIT](LICENSE) — free to use, modify and distribute.
