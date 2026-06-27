"""Конфигурация Radi Coffee. Все секреты — из окружения (.env на сервере)."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("RADI_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = Path(os.getenv("RADI_DB_PATH", DATA_DIR / "radi.db"))

# Токен Telegram-бота (проверка initData идёт по нему)
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Telegram user id владельцев (через запятую). Владелец = role owner.
_owner_raw = os.getenv("OWNER_TG_IDS", "")
OWNER_TG_IDS = {int(x) for x in _owner_raw.replace(" ", "").split(",") if x.strip().isdigit()}

# Адрес кофейни (выводится на карточке лояльности)
CAFE_ADDRESS = os.getenv("CAFE_ADDRESS", "ул. Болотниковская, 36к5")

# Сколько кофе в цикле до подарка (5 платных + 6-й бесплатный)
CYCLE = int(os.getenv("RADI_CYCLE", "5"))
BONUS_CAP = int(os.getenv("RADI_BONUS_CAP", "5"))

# Разрешить dev-вход без валидной initData (ТОЛЬКО для локальной отладки).
DEV_AUTH = os.getenv("RADI_DEV_AUTH", "0") == "1"

# CORS origins для локальной разработки (через запятую)
CORS_ORIGINS = [o for o in os.getenv("RADI_CORS", "").split(",") if o.strip()]
