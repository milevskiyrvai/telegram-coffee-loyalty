"""SQLite-слой Radi Coffee. Лёгкая БД под слабую машину (1 vCPU / 955MB)."""
import sqlite3
import threading
from contextlib import contextmanager

from .config import DB_PATH

_local = threading.local()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=4000;")
    return conn


def get_conn() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = _connect()
        _local.conn = conn
    return conn


@contextmanager
def tx():
    """Транзакция: коммит при успехе, откат при ошибке."""
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id      INTEGER UNIQUE,            -- telegram user id (NULL до привязки)
    max_id     INTEGER UNIQUE,            -- max user id (на будущее)
    name       TEXT NOT NULL DEFAULT '',  -- имя для отображения (кириллица/пробел/дефис)
    phone      TEXT NOT NULL DEFAULT '',  -- 10 цифр нац. номера
    role       TEXT NOT NULL DEFAULT 'client',  -- 'client' | 'barista' | 'owner'
    count      INTEGER NOT NULL DEFAULT 0,       -- прогресс цикла 0..CYCLE
    total      INTEGER NOT NULL DEFAULT 0,       -- всего чашек за всё время
    bonus      INTEGER NOT NULL DEFAULT 0,       -- отложенных бесплатных, 0..BONUS_CAP
    free_given INTEGER NOT NULL DEFAULT 0,       -- сколько бесплатных уже выдано
    onboarded  INTEGER NOT NULL DEFAULT 0,       -- прошёл онбординг (есть имя)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_name  ON accounts(name);
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON accounts(phone);
CREATE INDEX IF NOT EXISTS idx_accounts_role  ON accounts(role);

-- журнал действий: нужен для «сегодня» и для отката последнего действия
CREATE TABLE IF NOT EXISTS actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    actor_id     INTEGER,                  -- кто отметил (бариста/владелец)
    kind         TEXT NOT NULL,            -- cup|redeem|skip|bonus
    prev_count   INTEGER NOT NULL,
    prev_total   INTEGER NOT NULL,
    prev_bonus   INTEGER NOT NULL,
    prev_free    INTEGER NOT NULL,
    undone       INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_actions_account ON actions(account_id, id);
CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at);
"""


def init_db() -> None:
    conn = get_conn()
    conn.executescript(SCHEMA)
    conn.commit()
