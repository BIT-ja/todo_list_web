#!/bin/bash
# Todo App Database Backup Script
# Add to crontab: 0 2 * * * /opt/todo-app/deploy/backup.sh

DB_PATH="${DB_PATH:-/opt/todo-app/data/todo.db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/todo-app/backup}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

DATE=$(date +%F)
BACKUP_FILE="$BACKUP_DIR/todo-$DATE.db"

if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
  echo "[$(date)] Backup created: $BACKUP_FILE"

  # Compress
  gzip -f "$BACKUP_FILE"
  echo "[$(date)] Compressed: $BACKUP_FILE.gz"

  # Remove backups older than KEEP_DAYS
  find "$BACKUP_DIR" -name "todo-*.db.gz" -mtime +$KEEP_DAYS -delete
  echo "[$(date)] Cleaned backups older than $KEEP_DAYS days"
else
  echo "[$(date)] ERROR: Database not found at $DB_PATH"
  exit 1
fi
