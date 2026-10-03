#!/bin/bash
DB=/opt/radicoffee/backend/data/radi.db
DIR=/opt/radicoffee/backups
TS=$(date +%Y%m%d_%H%M%S)
# консистентный дамп через .backup (не копия файла)
/opt/radicoffee/backend/.venv/bin/python3 -c "import sqlite3; s=sqlite3.connect(\"$DB\"); d=sqlite3.connect(\"$DIR/radi_$TS.db\"); s.backup(d); d.close()" 2>/dev/null
# проверяем целостность дампа, битые не храним
OK=$(/opt/radicoffee/backend/.venv/bin/python3 -c "import sqlite3; print(sqlite3.connect(\"$DIR/radi_$TS.db\").execute(\"PRAGMA integrity_check\").fetchone()[0])" 2>/dev/null)
[ "$OK" != "ok" ] && rm -f "$DIR/radi_$TS.db"
# храним последние 48
ls -t $DIR/radi_*.db 2>/dev/null | tail -n +49 | xargs -r rm -f
