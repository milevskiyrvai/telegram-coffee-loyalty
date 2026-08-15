"""Проверка Telegram WebApp initData (HMAC-SHA256) и нормализация телефона."""
import hashlib
import hmac
import json
import os
import re
import time
from urllib.parse import parse_qsl

from .config import BOT_TOKEN, DEV_AUTH

# Тестовый бот-зеркало (диагностика недоступности мини-аппа у части гостей):
# его initData подписан ЕГО токеном, поэтому подпись проверяем по обоим.
# Пусто — проверка идёт только по основному, как раньше.
TEST_BOT_TOKEN = os.getenv("RADI_TEST_BOT_TOKEN", "")


class AuthError(Exception):
    pass


def _secret_key(token: str) -> bytes:
    # secret_key = HMAC_SHA256("WebAppData", bot_token)
    return hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()


def verify_init_data(init_data: str, max_age_sec: int = 7 * 86400) -> dict:
    """Проверяет подпись initData. Возвращает dict с полем user (dict)."""
    if not init_data:
        raise AuthError("empty initData")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise AuthError("no hash in initData")

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    tokens = [t for t in (BOT_TOKEN, TEST_BOT_TOKEN) if t]
    for token in tokens:
        calc = hmac.new(_secret_key(token), data_check_string.encode(), hashlib.sha256).hexdigest()
        if hmac.compare_digest(calc, received_hash):
            break
    else:
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
    """Приводит номер к 10 цифрам национального формата.

    Срезаем ТОЛЬКО код страны — одну ведущую 7/8 и только если всего 11 цифр.
    Иначе съедали значащие цифры: +7 701 123-45-67 превращался в 011234567.
    """
    d = _PHONE_RE.sub("", v or "")
    if len(d) == 11 and d[0] in ("7", "8"):
        d = d[1:]
    return d[:10]


# Кириллица И латиница, пробел, дефис, апостроф. Раньше латиница вырезалась:
# гость вводил «Maria» и получал отказ «пустое имя» при заполненном поле, а
# «Anna Trыntrava» молча превращалась в одну букву «Ы». Цифры, эмодзи и символы
# по-прежнему отсекаем — от них в базе был мусор вроде «K@trin» и «Joana🧿».
_NAME_RE = re.compile(r"[^А-Яа-яЁёA-Za-z \-']")


def clean_name(v: str) -> str:
    """Буквы (кириллица/латиница), пробел, дефис, апостроф; схлопывает пробелы."""
    s = _NAME_RE.sub("", v or "")
    return re.sub(r"\s+", " ", s).strip()[:48]
