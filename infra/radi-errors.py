#!/opt/radicoffee/backend/.venv/bin/python3
"""Сбои у гостей — то, что приложение прислало само.

Запуск:  radi-errors.py           за последние сутки
         radi-errors.py 3h        за 3 часа

Показывает, у кого и на чём споткнулось приложение. Гость ничего не делает,
маячок уходит сам — раньше о таких сбоях узнавали только со слов человека
в кофейне, и разобрать успевали, только пока он не ушёл.
"""
import re
import sqlite3
import subprocess
import sys

DB = "/opt/radicoffee/backend/data/radi.db"
STEPS = {
    "auth": "вход не прошёл",
    "profile": "не сохранился профиль",
    "js": "приложение упало",
    "promise": "приложение упало",
}


def guests():
    try:
        conn = sqlite3.connect("file:%s?mode=ro" % DB, uri=True)
        conn.row_factory = sqlite3.Row
        return {
            r["tg_id"]: r for r in conn.execute(
                "SELECT tg_id, id, name, phone, onboarded FROM accounts")
        }
    except sqlite3.Error:
        return {}


def main():
    since = sys.argv[1] if len(sys.argv) > 1 else "24h"
    out = subprocess.run(
        ["journalctl", "-u", "radicoffee-backend", "--since", "-" + since, "--no-pager"],
        capture_output=True, text=True,
    ).stdout

    people = guests()
    rows = []
    for line in out.splitlines():
        if "CLIENT-ERROR" not in line:
            continue
        when = line[:15]
        f = dict(re.findall(r"(\w+)=(\S+)", line.split("CLIENT-ERROR", 1)[1]))
        msg = line.split("msg=", 1)[1] if "msg=" in line else ""
        rows.append((when, f, msg))

    if not rows:
        print("За %s сбоев у гостей нет." % since)
        return

    print("Сбоев за %s: %d\n" % (since, len(rows)))
    for when, f, msg in rows[-40:]:
        uid = f.get("uid", "")
        who = "неизвестный гость"
        if uid.isdigit() and int(uid) in people:
            g = people[int(uid)]
            phone = "+7" + g["phone"] if g["phone"] else "без номера"
            who = "%s (id=%s, %s)%s" % (
                g["name"] or "без имени", g["id"], phone,
                "" if g["onboarded"] else ", регистрация не закончена")
        step = STEPS.get(f.get("step", ""), f.get("step", "?"))
        print("  %s  %s" % (when, who))
        print("      что: %s | %s, Telegram %s, версия апа %s, initData %s символов"
              % (step, f.get("platform", "?"), f.get("tg", "?"),
                 f.get("app", "?"), f.get("init_len", "?")))
        if msg:
            print("      текст: %s" % msg.strip())
        print()


if __name__ == "__main__":
    main()
