"""Доменная логика лояльности: начисление, откат, статистика. Атомарно через SQLite tx."""

from .config import BONUS_CAP, CYCLE, OWNER_TG_IDS
from .db import get_conn, tx

# ---------- сериализация ----------

def account_public(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "phone": row["phone"],
        "role": row["role"],
        "count": row["count"],
        "total": row["total"],
        "bonus": row["bonus"],
        "freeGiven": row["free_given"],
        "onboarded": bool(row["onboarded"]),
    }


def _row(account_id: int):
    return get_conn().execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()


# ---------- auth / upsert ----------

def get_or_create_by_tg(tg_id: int, fallback_name: str = "") -> dict:
    """Находит аккаунт по tg_id или создаёт новый. Применяет роль owner из конфига."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM accounts WHERE tg_id=?", (tg_id,)).fetchone()
    with tx():
        if row is None:
            role = "owner" if tg_id in OWNER_TG_IDS else "client"
            cur = conn.execute(
                "INSERT INTO accounts(tg_id, name, role) VALUES(?,?,?)",
                (tg_id, fallback_name, role),
            )
            account_id = cur.lastrowid
        else:
            account_id = row["id"]
            # владелец всегда owner (даже если когда-то был client)
            if tg_id in OWNER_TG_IDS and row["role"] != "owner":
                conn.execute("UPDATE accounts SET role='owner' WHERE id=?", (account_id,))
    return account_public(_row(account_id))


def set_profile(account_id: int, name: str, phone: str) -> dict:
    with tx():
        get_conn().execute(
            "UPDATE accounts SET name=?, phone=?, onboarded=1, updated_at=datetime('now') WHERE id=?",
            (name, phone, account_id),
        )
    return account_public(_row(account_id))


def set_phone(account_id: int, phone: str) -> dict:
    """Сохраняет только телефон, НЕ трогая имя и флаг onboarded.
    Нужен боту: номер получен по contact, а имя юзер ещё выберет в мини-аппе."""
    with tx():
        get_conn().execute(
            "UPDATE accounts SET phone=?, updated_at=datetime('now') WHERE id=?",
            (phone, account_id),
        )
    return account_public(_row(account_id))


# ---------- поиск ----------

def search_accounts(query: str, digits: str, limit: int = 60) -> list:
    conn = get_conn()
    q = (query or "").strip()
    if not q:
        rows = conn.execute(
            "SELECT * FROM accounts WHERE onboarded=1 ORDER BY name COLLATE NOCASE LIMIT ?",
            (limit,),
        ).fetchall()
    else:
        like = f"%{q}%"
        params = [like]
        sql = "SELECT * FROM accounts WHERE onboarded=1 AND (name LIKE ? COLLATE NOCASE"
        if digits:
            sql += " OR phone LIKE ?"
            params.append(f"%{digits}%")
        sql += ") ORDER BY name COLLATE NOCASE LIMIT ?"
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()
    return [account_public(r) for r in rows]


def list_baristas() -> list:
    rows = get_conn().execute(
        "SELECT * FROM accounts WHERE role='barista' ORDER BY name COLLATE NOCASE"
    ).fetchall()
    return [account_public(r) for r in rows]


# ---------- начисление кофе ----------

def apply_action(account_id: int, kind: str, actor_id: int | None) -> dict:
    """kind: cup|redeem|skip|bonus. Меняет счётчики атомарно, пишет в журнал."""
    conn = get_conn()
    with tx():
        row = conn.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()
        if row is None:
            raise ValueError("account not found")
        count, total, bonus, free = row["count"], row["total"], row["bonus"], row["free_given"]

        # снимок для отката
        conn.execute(
            "INSERT INTO actions(account_id, actor_id, kind, prev_count, prev_total, prev_bonus, prev_free)"
            " VALUES(?,?,?,?,?,?,?)",
            (account_id, actor_id, kind, count, total, bonus, free),
        )

        if kind == "cup":
            count += 1
            total += 1
        elif kind == "redeem":
            if count < CYCLE:
                raise ValueError("cycle not full")
            count = 0
            total += 1
            free += 1
        elif kind == "skip":
            if count < CYCLE:
                raise ValueError("cycle not full")
            count = 0
            total += 1
            bonus = min(BONUS_CAP, bonus + 1)
        elif kind == "bonus":
            if bonus <= 0:
                raise ValueError("no bonus")
            bonus -= 1
            total += 1
            free += 1
        else:
            raise ValueError("unknown action")

        conn.execute(
            "UPDATE accounts SET count=?, total=?, bonus=?, free_given=?, updated_at=datetime('now') WHERE id=?",
            (count, total, bonus, free, account_id),
        )
    return account_public(_row(account_id))


def undo_last(account_id: int) -> dict:
    """Откатывает последнее неотменённое действие по аккаунту."""
    conn = get_conn()
    with tx():
        act = conn.execute(
            "SELECT * FROM actions WHERE account_id=? AND undone=0 ORDER BY id DESC LIMIT 1",
            (account_id,),
        ).fetchone()
        if act is None:
            raise ValueError("nothing to undo")
        conn.execute(
            "UPDATE accounts SET count=?, total=?, bonus=?, free_given=?, updated_at=datetime('now') WHERE id=?",
            (act["prev_count"], act["prev_total"], act["prev_bonus"], act["prev_free"], account_id),
        )
        conn.execute("UPDATE actions SET undone=1 WHERE id=?", (act["id"],))
    return account_public(_row(account_id))


def last_action_label(account_id: int) -> str | None:
    act = get_conn().execute(
        "SELECT kind FROM actions WHERE account_id=? AND undone=0 ORDER BY id DESC LIMIT 1",
        (account_id,),
    ).fetchone()
    if not act:
        return None
    return {
        "cup": "Кофе отмечен",
        "redeem": "Подарок выдан",
        "skip": "Выдача пропущена",
        "bonus": "Бесплатный выдан",
    }.get(act["kind"])


# ---------- роли ----------

def set_role(account_id: int, to_barista: bool) -> dict:
    conn = get_conn()
    row = _row(account_id)
    if row is None:
        raise ValueError("account not found")
    if row["role"] == "owner":
        raise ValueError("cannot change owner role")
    new_role = "barista" if to_barista else "client"
    with tx():
        conn.execute("UPDATE accounts SET role=?, updated_at=datetime('now') WHERE id=?", (new_role, account_id))
    return account_public(_row(account_id))


# ---------- статистика ----------

def stats_today() -> dict:
    conn = get_conn()
    today_cups = conn.execute(
        "SELECT COUNT(*) c FROM actions WHERE undone=0 AND date(created_at)=date('now')"
    ).fetchone()["c"]
    agg = conn.execute(
        "SELECT COUNT(*) guests, COALESCE(SUM(total),0) cups, COALESCE(SUM(free_given),0) gifts,"
        " COALESCE(SUM(CASE WHEN count>=? THEN 1 ELSE 0 END),0) hot "
        "FROM accounts WHERE onboarded=1",
        (CYCLE,),
    ).fetchone()
    baristas = conn.execute("SELECT COUNT(*) c FROM accounts WHERE role='barista'").fetchone()["c"]
    return {
        "today": today_cups,
        "guests": agg["guests"],
        "gifts": agg["gifts"],
        "hot": agg["hot"],
        "baristas": baristas,
    }


def stats_loyalty(limit: int = 20) -> list:
    rows = get_conn().execute(
        "SELECT id, name, total FROM accounts WHERE onboarded=1 ORDER BY total DESC, name COLLATE NOCASE LIMIT ?",
        (limit,),
    ).fetchall()
    return [{"id": r["id"], "name": r["name"], "total": r["total"]} for r in rows]
