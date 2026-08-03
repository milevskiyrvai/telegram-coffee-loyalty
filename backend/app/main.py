"""Radi Coffee API — FastAPI + SQLite. Авторизация по Telegram WebApp initData."""

import logging
import time

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import service
from .auth import AuthError, clean_name, normalize_phone, parse_dev_init_data, verify_init_data
from .config import CAFE_ADDRESS, CORS_ORIGINS, CYCLE, DEV_AUTH
from .db import init_db

app = FastAPI(title="Radi Coffee API", version="1.0.0")

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("startup")
def _startup():
    init_db()


# ---------- авторизация (зависимость) ----------

_log = logging.getLogger("radi.auth")


def current_account(authorization: str | None = Header(default=None)) -> dict:
    """Достаёт initData из заголовка Authorization: tma <initData>, валидирует, отдаёт аккаунт."""
    if not authorization or not authorization.lower().startswith("tma "):
        _log.warning("auth 401: no/bad Authorization header (got=%r)", (authorization or "")[:24])
        raise HTTPException(401, "no auth")
    init_data = authorization[4:].strip()
    try:
        parsed = parse_dev_init_data(init_data) if DEV_AUTH else verify_init_data(init_data)
    except AuthError as e:
        # лог точной причины (без утечки полного initData — только хвост)
        _log.warning("auth 401: %s | initData_len=%d tail=%r", e, len(init_data), init_data[-40:])
        raise HTTPException(401, f"auth failed: {e}") from e
    user = parsed["user"]
    tg_id = int(user["id"])
    fallback = clean_name(f"{user.get('first_name','')} {user.get('last_name','')}")
    return service.get_or_create_by_tg(tg_id, fallback)


def require_staff(acc: dict = Depends(current_account)) -> dict:
    if acc["role"] not in ("barista", "owner"):
        raise HTTPException(403, "staff only")
    return acc


def require_owner(acc: dict = Depends(current_account)) -> dict:
    if acc["role"] != "owner":
        raise HTTPException(403, "owner only")
    return acc


# ---------- схемы ----------

class ProfileIn(BaseModel):
    name: str
    phone: str = ""


class ActionIn(BaseModel):
    type: str  # cup|redeem|skip|bonus


class BeaconIn(BaseModel):
    step: str = ""          # где споткнулось: auth | profile | js | promise
    message: str = ""
    platform: str = ""      # ios | android | tdesktop
    tg_version: str = ""
    init_len: int = 0
    uid: int | None = None  # tg_id гостя, если приложение успело его получить
    app_version: str = ""


class RoleIn(BaseModel):
    role: str  # barista|client


# ---------- эндпоинты ----------

@app.get("/api/config")
def get_config():
    return {"address": CAFE_ADDRESS, "cycle": CYCLE}


_client_log = logging.getLogger("radi.client")
_beacon_rate = [0, 0]  # [минута, счётчик] — предохранитель, чтобы поток не утопил журнал


@app.post("/api/beacon", status_code=204)
def beacon(body: BeaconIn):
    """Маячок с телефона гостя: приложение само сообщает, на чём споткнулось.

    Без авторизации намеренно — чаще всего ломается как раз она, и сообщение
    иначе бы не дошло. Раньше о сбоях мы узнавали только со слов гостя в кафе,
    и разбирать приходилось, пока человек не ушёл.
    """
    minute = int(time.time() // 60)
    if _beacon_rate[0] != minute:
        _beacon_rate[0], _beacon_rate[1] = minute, 0
    _beacon_rate[1] += 1
    if _beacon_rate[1] > 120:
        return None

    def cut(s: str) -> str:
        return (s or "").replace("\n", " ")[:160]

    _client_log.warning(
        "CLIENT-ERROR step=%s uid=%s platform=%s tg=%s app=%s init_len=%s msg=%s",
        cut(body.step), body.uid, cut(body.platform), cut(body.tg_version),
        cut(body.app_version), body.init_len, cut(body.message),
    )
    return None


@app.post("/api/auth")
def auth(me: dict = Depends(current_account)):
    """Возвращает профиль текущего пользователя (создаёт при первом входе)."""
    return {"me": me}


@app.post("/api/me/profile")
def save_profile(body: ProfileIn, me: dict = Depends(current_account)):
    name = clean_name(body.name)
    if not name:
        raise HTTPException(400, "empty name")
    phone = normalize_phone(body.phone) if body.phone else me["phone"]
    return {"me": service.set_profile(me["id"], name, phone)}


@app.get("/api/me")
def get_me(me: dict = Depends(current_account)):
    return {"me": me}


# --- бариста / владелец ---

@app.get("/api/accounts")
def accounts(query: str = "", staff: dict = Depends(require_staff)):
    digits = normalize_phone(query)
    return {"accounts": service.search_accounts(query, digits)}


@app.get("/api/accounts/{account_id}")
def account(account_id: int, staff: dict = Depends(require_staff)):
    row = service._row(account_id)
    if row is None:
        raise HTTPException(404, "not found")
    acc = service.account_public(row)
    acc["undoLabel"] = service.last_action_label(account_id)
    return {"account": acc}


@app.post("/api/accounts/{account_id}/action")
def do_action(account_id: int, body: ActionIn, staff: dict = Depends(require_staff)):
    if body.type not in ("cup", "redeem", "skip", "bonus"):
        raise HTTPException(400, "bad type")
    try:
        acc = service.apply_action(account_id, body.type, staff["id"])
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    acc["undoLabel"] = service.last_action_label(account_id)
    return {"account": acc}


@app.post("/api/accounts/{account_id}/undo")
def undo(account_id: int, staff: dict = Depends(require_staff)):
    try:
        acc = service.undo_last(account_id)
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    acc["undoLabel"] = service.last_action_label(account_id)
    return {"account": acc}


@app.post("/api/accounts/{account_id}/role")
def change_role(account_id: int, body: RoleIn, owner: dict = Depends(require_owner)):
    if body.role not in ("barista", "client"):
        raise HTTPException(400, "bad role")
    try:
        acc = service.set_role(account_id, body.role == "barista")
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    return {"account": acc}


@app.get("/api/baristas")
def baristas(owner: dict = Depends(require_owner)):
    return {"baristas": service.list_baristas()}


@app.get("/api/stats/today")
def stats_today(owner: dict = Depends(require_owner)):
    return service.stats_today()


@app.get("/api/stats/loyalty")
def stats_loyalty(owner: dict = Depends(require_owner)):
    return {"loyalty": service.stats_loyalty()}


@app.get("/api/health")
def health():
    return {"ok": True}
