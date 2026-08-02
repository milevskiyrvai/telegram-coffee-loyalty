#!/opt/radicoffee/backend/.venv/bin/python3
"""Диагностика гостя по номеру телефона.

Запуск:  radi-check.py 9250250757   (можно часть номера: 0757)

Показывает всё, что нужно для точечного разбора:
состояние аккаунта, ждут ли его чашки, и что делало его устройство по логам.
"""
import glob
import gzip
import re
import sqlite3
import sys

DB = "/opt/radicoffee/backend/data/radi.db"


def find_accounts(conn, needle):
    rows = conn.execute(
        "SELECT id, tg_id, name, phone, role, count, total, free_given, onboarded,"
        " created_at, updated_at FROM accounts WHERE phone LIKE ? OR name LIKE ?",
        (f"%{needle}%", f"%{needle}%"),
    ).fetchall()
    return rows


def sessions_for(account_id, limit=25):
    """Запросы к карточке этого гостя (их делает бариста) — видно, отмечали ли кофе."""
    pat = re.compile(rf"/api/accounts/{account_id}(/action|/undo)? ")
    out = []
    for f in sorted(glob.glob("/var/log/nginx/radicoffee.access.log*")):
        op = gzip.open if f.endswith(".gz") else open
        try:
            with op(f, "rt", errors="replace") as fh:
                for line in fh:
                    if pat.search(line):
                        m = re.search(r"\[([^\]]+)\].*\"(\w+) ([^ ]+)[^\"]*\" (\d{3})", line)
                        if m:
                            out.append((m.group(1)[:20], m.group(4), m.group(3)))
        except OSError:
            continue
    return out[-limit:]


def main():
    if len(sys.argv) < 2:
        print("нужен номер: radi-check.py 9250250757")
        return
    needle = "".join(ch for ch in sys.argv[1] if ch.isdigit()) or sys.argv[1]
    conn = sqlite3.connect(DB, timeout=8)
    conn.row_factory = sqlite3.Row

    rows = find_accounts(conn, needle)
    if not rows:
        print(f"❌ Аккаунт с «{needle}» НЕ НАЙДЕН — гость ещё не регистрировался")
    for r in rows:
        status = "✅ готов" if r["onboarded"] else "⚠️ НЕ завершил регистрацию (не ввёл имя)"
        print(f"=== id={r['id']}  {r['name'] or '(без имени)'}  +7{r['phone']} ===")
        print(f"  состояние: {status}")
        print(f"  роль: {r['role']}")
        print(f"  чашек всего: {r['total']} | прогресс к подарку: {r['count']}/5 | подарков: {r['free_given']}")
        print(f"  создан: {r['created_at']} | изменён: {r['updated_at']}")

        try:
            waiting = conn.execute(
                "SELECT COALESCE(SUM(cups),0) FROM restore_claims "
                "WHERE claimed_account_id IS NULL AND kind='phone' AND ? LIKE '%'||frag||'%'",
                (r["phone"],),
            ).fetchone()[0]
            if waiting:
                print(f"  ⏳ ждут возврата после сбоя: {waiting} чашек (придут при входе)")
        except sqlite3.OperationalError:
            pass

        acts = sessions_for(r["id"])
        if acts:
            print("  последние действия баристы с его карточкой:")
            for t, code, path in acts[-8:]:
                what = "отметка кофе" if "/action" in path else ("отмена" if "/undo" in path else "открытие карточки")
                print(f"    {t}  {code}  {what}")
        else:
            print("  действий баристы в логах нет")
        print()


if __name__ == "__main__":
    main()
