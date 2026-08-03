"""Telegram-бот Radi coffee: открывает мини-апп кнопкой и в меню.

Лёгкий aiogram-бот. Единственная задача — пускать пользователя в Web App.
Вся логика лояльности — в мини-аппе (FastAPI backend).

Запуск: BOT_TOKEN, WEBAPP_URL в окружении (.env). Опционально TG_PROXY
(http://user:pass@host:port) если api.telegram.org режется ТСПУ.
"""
import asyncio
import logging
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
from app.auth import clean_name, normalize_phone
from app.db import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("radi.bot")

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
        # Имя из Telegram чистим: только кириллица (латиница/эмодзи/символы отбрасываются).
        # Если после чистки пусто — оставляем пустым, мини-апп спросит имя при онбординге.
        fallback = clean_name(m.from_user.first_name or "")
        acc = service.get_or_create_by_tg(m.from_user.id, fallback)
        log.info("START tg=%s -> аккаунт id=%s", m.from_user.id, acc["id"])
        await m.answer(WELCOME, reply_markup=ReplyKeyboardRemove())

    @dp.message(F.contact)
    async def got_contact(m: Message):
        # НЕВИДИМЫЙ обработчик: когда мини-апп вызывает requestContact(), номер прилетает СЮДА.
        # Молча сохраняем его — мини-апп подхватит через /api/me.
        c = m.contact
        # Логируем КАЖДУЮ ветку: без этого «гость поделился номером, а он не сохранился»
        # было невозможно разобрать — бот не оставлял о себе ни строчки.
        if c.user_id and c.user_id != m.from_user.id:
            log.warning("КОНТАКТ ЧУЖОЙ tg=%s прислал контакт user_id=%s — игнор",
                        m.from_user.id, c.user_id)
            return
        phone = normalize_phone(c.phone_number or "")
        acc = service.get_or_create_by_tg(m.from_user.id, clean_name(m.from_user.first_name or ""))
        if not phone:
            log.warning("КОНТАКТ ПУСТОЙ tg=%s аккаунт id=%s исходный=%r — номер не сохранён",
                        m.from_user.id, acc["id"], c.phone_number)
            return
        service.set_phone(acc["id"], phone)  # только телефон, onboarded не трогаем
        log.info("НОМЕР СОХРАНЁН tg=%s аккаунт id=%s номер=%s", m.from_user.id, acc["id"], phone)
        # без сообщений — юзер в этот момент в мини-аппе, лишний текст в чате не нужен

    @dp.message(F.text == "/app")
    async def app_cmd(m: Message):
        await m.answer("Откройте карту кнопкой «Карта» слева от поля ввода.")

    # Кнопка-меню (слева от поля ввода) → сразу открывает мини-апп
    await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="Карта", web_app=web_app))

    # НЕ выбрасываем накопленные сообщения. Раньше стояло drop_pending_updates=True,
    # и каждый перезапуск бота (в том числе при выкатке) безвозвратно уничтожал
    # контакты, отправленные в этот момент: гость жал «Поделиться номером»,
    # номер не сохранялся, приложение ждало впустую и гость видел ошибку.
    await bot.delete_webhook(drop_pending_updates=False)
    log.info("бот запущен, кнопка меню ведёт на %s", WEBAPP_URL)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
