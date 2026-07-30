#!/opt/radicoffee/backend/.venv/bin/python3
"""Сторож Radi Coffee.

Ловит поломки раньше, чем их заметят в кофейне, и пишет владельцу в Telegram.
Следит именно за тем, что нас уже подводило: порча БД, пропажа данных,
мёртвый бот/бэкенд, протухший бэкап, истекающий сертификат.

Не спамит: повторный алерт по той же проблеме — не чаще раза в час.
Запускается из cron каждые 10 минут.
"""
import json
import os
import shlex
import sqlite3
import subprocess
import time
from datetime import datetime

APP = "/opt/radicoffee"
DB = f"{APP}/backend/data/radi.db"
BACKUPS = f"{APP}/backups"
ENV = f"{APP}/backend/.env"
STATE = "/var/lib/radi-watchdog.json"
CERT = "/etc/letsencrypt/live/radicoffee.consoleai.ru/fullchain.pem"


def sh(cmd, timeout=20):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except Exception:
        return ""


def load_env():
    cfg = {}
    try:
        for line in open(ENV):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                cfg[k] = v
    except Exception:
        pass
    return cfg


def notify(cfg, text):
    token = cfg.get("BOT_TOKEN", "")
    proxy = cfg.get("TG_PROXY", "")
    owners = [x.strip() for x in cfg.get("OWNER_TG_IDS", "").split(",") if x.strip()]
    if not token or not owners:
        return
    px = f"-x {shlex.quote(proxy)} " if proxy else ""
    for chat in owners:
        sh(
            f"curl -s -m15 {px}-X POST "
            f"https://api.telegram.org/bot{token}/sendMessage "
            f"-d chat_id={chat} --data-urlencode text={shlex.quote(text)}"
        )


def main():
    cfg = load_env()
    state = {}
    if os.path.exists(STATE):
        try:
            state = json.load(open(STATE))
        except Exception:
            state = {}
    problems = []

    # 1. сервисы живы
    for svc in ("radicoffee-backend", "radicoffee-bot", "nginx"):
        if sh(f"systemctl is-active {svc}") != "active":
            problems.append(f"сервис {svc} не работает")

    # 2. бэкенд отвечает
    if sh("curl -s -m8 -o /dev/null -w '%{http_code}' http://127.0.0.1:8014/api/health") != "200":
        problems.append("бэкенд не отвечает (health != 200)")

    # 3. база: цела и данные на месте
    accounts = cups = None
    try:
        conn = sqlite3.connect(DB, timeout=8)
        if conn.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            problems.append("БАЗА ПОВРЕЖДЕНА (integrity_check)")
        accounts = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        cups = conn.execute("SELECT COALESCE(SUM(total),0) FROM accounts").fetchone()[0]
        prev_a = state.get("accounts", 0)
        prev_c = state.get("cups", 0)
        # падение больше чем на 20% = данные пропали
        if prev_a > 10 and accounts < prev_a * 0.8:
            problems.append(f"ПРОПАЛИ ГОСТИ: было {prev_a}, стало {accounts}")
        if prev_c > 10 and cups < prev_c * 0.8:
            problems.append(f"ПРОПАЛИ ЧАШКИ: было {prev_c}, стало {cups}")
    except Exception as e:
        problems.append(f"база недоступна: {str(e)[:80]}")

    # 4. бэкап свежий
    try:
        files = [f for f in os.listdir(BACKUPS) if f.startswith("radi_") and f.endswith(".db")]
        if not files:
            problems.append("нет ни одного бэкапа")
        else:
            newest = max(files, key=lambda f: os.path.getmtime(os.path.join(BACKUPS, f)))
            age_h = (time.time() - os.path.getmtime(os.path.join(BACKUPS, newest))) / 3600
            if age_h > 3:
                problems.append(f"бэкап устарел ({age_h:.1f} ч назад)")
    except Exception:
        problems.append("папка бэкапов недоступна")

    # 5. диск
    try:
        used = int(sh("df / | tail -1 | awk '{print $5}'").replace("%", "") or 0)
        if used >= 90:
            problems.append(f"диск заполнен на {used}%")
    except Exception:
        pass

    # 6. сертификат не истекает
    exp = sh(f"openssl x509 -enddate -noout -in {CERT} 2>/dev/null | cut -d= -f2")
    if exp:
        try:
            left = (datetime.strptime(exp.strip(), "%b %d %H:%M:%S %Y %Z") - datetime.utcnow()).days
            if left < 10:
                problems.append(f"SSL истекает через {left} дн. — автопродление не сработало")
        except Exception:
            pass

    # 7. бот реально достаёт Telegram (у нас через прокси — легко отвалится)
    token = cfg.get("BOT_TOKEN", "")
    proxy = cfg.get("TG_PROXY", "")
    if token:
        px = f"-x {shlex.quote(proxy)} " if proxy else ""
        if '"ok":true' not in sh(f"curl -s -m12 {px}https://api.telegram.org/bot{token}/getMe"):
            problems.append("бот не достучится до Telegram (прокси или сеть)")

    # запоминаем максимумы, чтобы ловить именно падение
    if accounts is not None:
        state["accounts"] = max(accounts, state.get("accounts", 0))
    if cups is not None:
        state["cups"] = max(cups, state.get("cups", 0))

    now = time.time()
    if problems:
        key = "|".join(problems)
        if state.get("last_key") != key or now - state.get("last_sent", 0) > 3600:
            text = ("🚨 Radi Coffee — проблема:\n\n"
                    + "\n".join("• " + p for p in problems)
                    + f"\n\n{datetime.now().strftime('%d.%m %H:%M')}")
            notify(cfg, text)
            state["last_sent"] = now
            state["last_key"] = key
        print("ПРОБЛЕМЫ:", problems)
    else:
        if state.get("last_key"):
            notify(cfg, "✅ Radi Coffee: всё восстановилось, работает штатно")
            state["last_key"] = None
        print("ok")

    try:
        json.dump(state, open(STATE, "w"))
    except Exception:
        pass


if __name__ == "__main__":
    main()
