#!/bin/sh
# Container start (Render): run Apache, and apply pending database migrations alongside.
#
# Render's free plan has no pre-deploy step, so migrations run here, once per deploy or
# restart. Applied migrations are skipped (all of them are safe to re-run), so a normal
# start only checks the list. If a migration fails, the error is logged and the site keeps
# running: features whose tables are missing stay hidden until the next successful run.
# Set RUN_MIGRATIONS=false in the Render environment to turn this off.

cd /var/www/html || exit 1
PORT="${PORT:-10000}"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  # in the background, so the site answers while the check runs (a free server that just
  # woke up does not wait another few seconds for the database before serving anyone)
  (
    echo "[start] Checking database migrations..."
    if timeout 120 php public/index.php migrate; then
      echo "[start] Migrations finished."
    else
      echo "[start] Migrations did not finish (exit $?). The site keeps running."
    fi
    # forget the cached table list, so new tables and columns show up right away
    rm -f runtime/cache/schema.json
    # this ran as root: anything it wrote under runtime/ must stay writable for Apache
    chown -R www-data:www-data runtime 2>/dev/null || true
  ) &
fi

# Bind Apache to Render's PORT (same as before)
sed -i "s/Listen 80/Listen ${PORT}/g" /etc/apache2/ports.conf
sed -i "s/:80/:${PORT}/g" /etc/apache2/sites-available/000-default.conf
exec apache2-foreground
