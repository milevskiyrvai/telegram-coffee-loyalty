#!/opt/radicoffee/backend/.venv/bin/python3
"""Автовосстановление после сбоя 30.07.

1) Роли (владелец/бариста) — по таблице known_roles, если человек перерегистрировался.
2) Чашки — по заявкам restore_claims, собранным из nginx-логов:
   kind='phone' — фрагмент номера, который бариста набирал в поиске;
   kind='name'  — имя, по которому бариста искал гостя.
Начисляем ТОЛЬКО при однозначном совпадении: если под заявку подходит
несколько аккаунтов — пропускаем и ждём (лучше не начислить, чем начислить не тому).

Запускается из cron каждую минуту.
"""
import sqlite3

DB = "/opt/radicoffee/backend/data/radi.db"


def main():
    conn = sqlite3.connect(DB, timeout=10)
    conn.execute("PRAGMA busy_timeout=8000")

    # --- роли ---
    roles = 0
    try:
        for tg_id, role in conn.execute("SELECT tg_id, role FROM known_roles").fetchall():
            cur = conn.execute("SELECT role FROM accounts WHERE tg_id=?", (tg_id,)).fetchone()
            if cur and cur[0] != role:
                conn.execute(
                    "UPDATE accounts SET role=?, onboarded=1 WHERE tg_id=?", (role, tg_id)
                )
                roles += 1
    except sqlite3.OperationalError:
        pass  # таблицы known_roles ещё нет

    # --- чашки ---
    claims = conn.execute(
        "SELECT id, frag, cups, COALESCE(kind,'phone') FROM restore_claims "
        "WHERE claimed_account_id IS NULL"
    ).fetchall()
    # телефон надёжен всегда (его сохраняет бот), имя — только после онбординга,
    # когда гость ввёл его сам
    accounts = conn.execute("SELECT id, name, phone, onboarded FROM accounts").fetchall()

    issued = 0
    for claim_id, frag, cups, kind in claims:
        if not frag:
            continue
        if kind == "name":
            needle = frag.strip().lower()
            match = [
                a for a, name, _, onboarded in accounts
                if onboarded and name and needle in name.strip().lower()
            ]
        else:
            match = [a for a, _, phone, _ in accounts if phone and frag in phone]

        if len(match) != 1:
            continue  # пусто или неоднозначно — ждём

        acc_id = match[0]
        row = conn.execute("SELECT total FROM accounts WHERE id=?", (acc_id,)).fetchone()
        if not row:
            continue
        total = row[0] + cups
        conn.execute(
            "UPDATE accounts SET total=?, count=?, free_given=? WHERE id=?",
            (total, total % 6, total // 6, acc_id),
        )
        conn.execute(
            "UPDATE restore_claims SET claimed_account_id=?, claimed_at=datetime('now') "
            "WHERE id=?",
            (acc_id, claim_id),
        )
        issued += 1

    if roles or issued:
        conn.commit()
    print(f"ролей восстановлено: {roles} | заявок выдано: {issued}")


if __name__ == "__main__":
    main()
