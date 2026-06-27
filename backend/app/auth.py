"""Проверка Telegram WebApp initData (HMAC-SHA256) и нормализация телефона."""
import hashlib
import hmac
import json
import re
import time
from urllib.parse import parse_qsl

from .config import BOT_TOKEN, DEV_AUTH


class AuthError(Exception):
    pass


def _secret_key() -> bytes:
    # secret_key = HMAC_SHA256("WebAppData", bot_token)
    return hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()


def verify_init_data(init_data: str, max_age_sec: int = 7 * 86400) -> dict:
    """Проверяет подпись initData. Возвращает dict с полем user (dict)."""
    if not init_data:
        raise AuthError("empty initData")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise AuthError("no hash in initData")

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    calc = hmac.new(_secret_key(), data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc, received_hash):
        raise AuthError("bad initData signature")

    auth_date = int(pairs.get("auth_date", "0") or 0)
    if max_age_sec and auth_date and (time.time() - auth_date) > max_age_sec:
        raise AuthError("initData expired")

    user_raw = pairs.get("user")
    if not user_raw:
        raise AuthError("no user in initData")
    try:
        user = json.loads(user_raw)
    except Exception as e:
        raise AuthError("bad user json") from e

    return {"user": user, "auth_date": auth_date, "raw": pairs}


def parse_dev_init_data(init_data: str) -> dict:
    """DEV-режим: принимает initData без проверки подписи (только локально)."""
    if not DEV_AUTH:
        raise AuthError("dev auth disabled")
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    user_raw = pairs.get("user", "{}")
    try:
        user = json.loads(user_raw)
    except Exception:
        user = {}
    if not user.get("id"):
        raise AuthError("dev: no user id")
    return {"user": user, "auth_date": int(time.time()), "raw": pairs}


_PHONE_RE = re.compile(r"\D")


def normalize_phone(v: str) -> str:
    """Отбрасывает +,+7,7,8 в начале, оставляет 10 цифр нац. номера."""
    d = _PHONE_RE.sub("", v or "")
    while d and d[0] in ("7", "8"):
        d = d[1:]
    return d[:10]


_NAME_RE = re.compile(r"[^А-Яа-яЁё \-]")


def clean_name(v: str) -> str:
    """Только кириллица, пробел, дефис; схлопывает пробелы."""
    s = _NAME_RE.sub("", v or "")
    return re.sub(r"\s+", " ", s).strip()[:48]
