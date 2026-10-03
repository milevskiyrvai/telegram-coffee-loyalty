#!/bin/bash
# Суточная копия БД Radi Coffee, храним 14 последних.
# Почасовые (radi-backup.sh, 48 шт.) дают глубину всего 2 суток: порчу,
# замеченную через 3 дня, из них уже не откатить. Эти — глубина в 2 недели.
# Лежат в отдельной папке daily/, чтобы почасовая ротация их не трогала.
DB=/opt/radicoffee/backend/data/radi.db
DIR=/opt/radicoffee/backups/daily
PY=/opt/radicoffee/backend/.venv/bin/python3
mkdir -p "$DIR"
F="$DIR/radi_daily_$(date +%Y%m%d).db"
# консистентный дамп через .backup (не копия файла)
$PY -c "import sqlite3; s=sqlite3.connect('$DB'); d=sqlite3.connect('$F'); s.backup(d); d.close()" || { rm -f "$F"; exit 1; }
# битые не храним
OK=$($PY -c "import sqlite3; print(sqlite3.connect('$F').execute('PRAGMA integrity_check').fetchone()[0])")
[ "$OK" != "ok" ] && { rm -f "$F"; exit 1; }
# храним последние 14
ls -t "$DIR"/radi_daily_*.db 2>/dev/null | tail -n +15 | xargs -r rm -f
