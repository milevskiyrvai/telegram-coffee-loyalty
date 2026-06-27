"""Демо-наполнение БД (20 гостей) — как в прототипе. Только для локальной отладки."""
import random

from app.db import get_conn, init_db, tx

BASE = [
    ("Алексей", "9162854827", 5, 23, "barista"),
    ("Ольга", "9035118801", 5, 11, "client"),
    ("Дмитрий", "9257607634", 4, 16, "client"),
    ("Мария", "9991201290", 2, 8, "client"),
    ("Сергей", "9012333345", 3, 9, "client"),
    ("Иван", "9054422156", 1, 7, "client"),
    ("Анна", "9267000518", 0, 6, "client"),
    ("Екатерина", "9168809072", 4, 28, "client"),
    ("Михаил", "9031472050", 2, 41, "client"),
    ("Дарья", "9099912233", 5, 37, "client"),
    ("Роман", "9261114488", 1, 19, "client"),
    ("Наталья", "9165557701", 3, 25, "client"),
    ("Артём", "9037778812", 4, 33, "client"),
    ("Юлия", "9259994400", 0, 14, "client"),
    ("Павел", "9013336677", 2, 22, "client"),
    ("Елена", "9268882244", 5, 30, "client"),
    ("Никита", "9035551199", 1, 6, "client"),
    ("Татьяна", "9167773355", 3, 18, "client"),
    ("Андрей", "9099998800", 2, 12, "client"),
    ("Светлана", "9261239988", 4, 27, "client"),
]


def main():
    init_db()
    conn = get_conn()
    with tx():
        conn.execute("DELETE FROM actions")
        conn.execute("DELETE FROM accounts")
        for i, (name, phone, count, total, role) in enumerate(BASE, start=1):
            conn.execute(
                "INSERT INTO accounts(tg_id, name, phone, role, count, total, bonus, free_given, onboarded)"
                " VALUES(?,?,?,?,?,?,?,?,1)",
                (900000000 + i, name, phone, role, count, total, 0, total // 6),
            )
        # немного «сегодняшних» отметок для статистики
        ids = [r["id"] for r in conn.execute("SELECT id FROM accounts").fetchall()]
        for _ in range(23):
            aid = random.choice(ids)
            r = conn.execute("SELECT count,total,bonus,free_given FROM accounts WHERE id=?", (aid,)).fetchone()
            conn.execute(
                "INSERT INTO actions(account_id, actor_id, kind, prev_count, prev_total, prev_bonus, prev_free)"
                " VALUES(?,?,?,?,?,?,?)",
                (aid, 1, "cup", r["count"], r["total"], r["bonus"], r["free_given"]),
            )
    print("seeded 20 accounts + 23 today actions")


if __name__ == "__main__":
    main()
