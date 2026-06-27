#!/usr/bin/env bash
# Деплой Radi Coffee на VPS-72 (72.56.250.136, Москва).
# Фронт собирается локально, на сервер едет статика (dist) + backend.
# Запуск из git-bash: bash infra/deploy.sh
set -euo pipefail

SERVER=root@72.56.250.136
APP=/opt/radicoffee
HERE="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 1/5 Сборка фронта"
cd "$HERE/frontend"
npm install --no-audit --no-fund
npm run build

echo "==> 2/5 Упаковка"
TMP=$(mktemp -d)
mkdir -p "$TMP/backend" "$TMP/frontend"
# backend без venv/data/__pycache__
tar -C "$HERE/backend" \
    --exclude='.venv' --exclude='data' --exclude='__pycache__' --exclude='*.pyc' \
    -czf "$TMP/backend.tar.gz" .
tar -C "$HERE/frontend/dist" -czf "$TMP/frontend.tar.gz" .
tar -C "$HERE/infra" -czf "$TMP/infra.tar.gz" \
    radicoffee-backend.service radicoffee-bot.service nginx-radicoffee.conf

echo "==> 3/5 Заливка"
scp -q "$TMP/backend.tar.gz" "$TMP/frontend.tar.gz" "$TMP/infra.tar.gz" "$SERVER:/tmp/"

echo "==> 4/5 Распаковка + сервисы на сервере"
ssh "$SERVER" "bash -s" <<'REMOTE'
set -euo pipefail
APP=/opt/radicoffee
mkdir -p $APP/backend $APP/frontend/dist $APP/backend/data

# backend
tar -xzf /tmp/backend.tar.gz -C $APP/backend
# frontend dist
rm -rf $APP/frontend/dist/*
tar -xzf /tmp/frontend.tar.gz -C $APP/frontend/dist

# venv (создаём один раз)
if [ ! -x $APP/backend/.venv/bin/python ]; then
  python3 -m venv $APP/backend/.venv
fi
$APP/backend/.venv/bin/pip -q install --upgrade pip
$APP/backend/.venv/bin/pip -q install -r $APP/backend/requirements.txt

# .env (создаём из примера, если ещё нет — секреты не перетираем)
if [ ! -f $APP/backend/.env ]; then
  cp $APP/backend/.env.example $APP/backend/.env
  echo "  [!] создан $APP/backend/.env из примера — проверь токены"
fi
# зафиксируем путь к БД в /opt
grep -q '^RADI_DB_PATH=' $APP/backend/.env || echo 'RADI_DB_PATH=/opt/radicoffee/backend/data/radi.db' >> $APP/backend/.env

# systemd
tar -xzf /tmp/infra.tar.gz -C /tmp
cp /tmp/radicoffee-backend.service /etc/systemd/system/
cp /tmp/radicoffee-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable radicoffee-backend >/dev/null 2>&1 || true
systemctl restart radicoffee-backend
sleep 2
curl -s -o /dev/null -w "  backend health: %{http_code}\n" http://127.0.0.1:8014/api/health || true

# nginx vhost (если ещё не стоит)
if [ ! -f /etc/nginx/sites-available/radicoffee ]; then
  cp /tmp/nginx-radicoffee.conf /etc/nginx/sites-available/radicoffee
  ln -sf /etc/nginx/sites-available/radicoffee /etc/nginx/sites-enabled/radicoffee
  nginx -t && systemctl reload nginx
  echo "  nginx vhost установлен (HTTP). SSL — отдельной командой после A-записи."
fi

rm -f /tmp/backend.tar.gz /tmp/frontend.tar.gz /tmp/infra.tar.gz \
      /tmp/radicoffee-backend.service /tmp/radicoffee-bot.service /tmp/nginx-radicoffee.conf
echo "  готово на сервере."
REMOTE

rm -rf "$TMP"
echo "==> 5/5 Деплой завершён."
echo "Дальше (после A-записи radicoffee.consoleai.ru -> 72.56.250.136):"
echo "  ssh $SERVER 'certbot --nginx -d radicoffee.consoleai.ru --non-interactive --agree-tos -m meletskaya@gmail.com --redirect'"
echo "  ssh $SERVER 'systemctl enable --now radicoffee-bot'"
