"""Telegram-бот Radi coffee: открывает мини-апп кнопкой и в меню.

Лёгкий aiogram-бот. Единственная задача — пускать пользователя в Web App.
Вся логика лояльности — в мини-аппе (FastAPI backend).

Запуск: BOT_TOKEN, WEBAPP_URL в окружении (.env). Опционально TG_PROXY
(http://user:pass@host:port) если api.telegram.org режется ТСПУ.
"""
import asyncio
import os

from dotenv import load_dotenv

load_dotenv()

from aiogram import Bot, Dispatcher, F
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.filters import CommandStart
from aiogram.types import (
    MenuButtonWebApp,
    Message,
    ReplyKeyboardRemove,
    WebAppInfo,
)

from app import service
from app.auth import normalize_phone
from app.db import init_db

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://radicoffee.consoleai.ru")
TG_PROXY = os.getenv("TG_PROXY", "")

WELCOME = (
    "☕️ <b>Radi coffee</b>\n\n"
    "Копите кофе и получайте каждый 6-й в подарок.\n"
    "Нажмите кнопку <b>«Карта»</b> слева от поля ввода, чтобы открыть свою карту лояльности."
)


def build_bot() -> Bot:
    session = AiohttpSession(proxy=TG_PROXY) if TG_PROXY else None
    return Bot(
        token=BOT_TOKEN,
        session=session,
        default=__import__("aiogram").client.default.DefaultBotProperties(parse_mode="HTML"),
    )


async def main():
    if not BOT_TOKEN:
        raise SystemExit("BOT_TOKEN не задан")

    init_db()
    bot = build_bot()
    dp = Dispatcher()

    web_app = WebAppInfo(url=WEBAPP_URL)

    @dp.message(CommandStart())
    async def start(m: Message):
        # привязываем аккаунт по tg_id (создаём при первом входе).
        # Номер НЕ просим здесь — его запросит сам мини-апп при первом входе (кнопкой «Карта»).
        fallback = (m.from_user.first_name or "").strip()
        service.get_or_create_by_tg(m.from_user.id, fallback)
        await m.answer(WELCOME, reply_markup=ReplyKeyboardRemove())

    @dp.message(F.contact)
    async def got_contact(m: Message):
        # НЕВИДИМЫЙ обработчик: когда мини-апп вызывает requestContact(), номер прилетает СЮДА.
        # Молча сохраняем его — мини-апп подхватит через /api/me.
        c = m.contact
        if c.user_id and c.user_id != m.from_user.id:
            return  # чужой пересланный контакт — игнор
        phone = normalize_phone(c.phone_number or "")
        acc = service.get_or_create_by_tg(m.from_user.id, (m.from_user.first_name or "").strip())
        if phone:
            service.set_phone(acc["id"], phone)  # только телефон, onboarded не трогаем
        # без сообщений — юзер в этот момент в мини-аппе, лишний текст в чате не нужен

    @dp.message(F.text == "/app")
    async def app_cmd(m: Message):
        await m.answer("Откройте карту кнопкой «Карта» слева от поля ввода.")

    # Кнопка-меню (слева от поля ввода) → сразу открывает мини-апп
    await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="Карта", web_app=web_app))

    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
