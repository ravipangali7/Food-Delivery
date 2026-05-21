# Deploy Django API on `api.shyam-sweets.com` (cPanel / LiteSpeed)

## What went wrong

The browser CORS error is a **symptom**. `https://api.shyam-sweets.com` currently returns a **LiteSpeed 404 HTML page** for `/api/...` — Django is not running there, so no `Access-Control-Allow-Origin` header is sent. The SPA on `https://shyam-sweets.com` cannot load data until the API subdomain serves Django.

Verify after deploy:

```bash
curl -sI -X OPTIONS "https://api.shyam-sweets.com/api/admin/banners/" \
  -H "Origin: https://shyam-sweets.com" \
  -H "Access-Control-Request-Method: GET"
```

You should see `HTTP/2 200` or `204` with `access-control-allow-origin: https://shyam-sweets.com` (from Django or `.htaccess`), not `404` from LiteSpeed alone.

## Steps (cPanel)

1. **Subdomain** `api.shyam-sweets.com` → document root (e.g. `~/api.shyam-sweets.com`).
2. Upload the entire **`server/`** folder contents into that root (`manage.py`, `fooddelivery/`, `core/`, `passenger_wsgi.py`, `requirements.txt`, …).
3. **Setup Python App**
   - Python version: 3.11+ (match your host)
   - Application root: same folder as `manage.py`
   - Application URL: `/` (or subdomain root)
   - Application startup file: `passenger_wsgi.py`
   - Run `pip install -r requirements.txt` in the app virtualenv (cPanel UI or SSH).
4. Copy **`deploy/.htaccess`** into the app root (merge with any Passenger block cPanel generated — do not delete Passenger lines).
5. SSH (or Terminal in cPanel):

   ```bash
   cd ~/api.shyam-sweets.com   # your path
   source /home/USER/virtualenv/api.shyam-sweets.com/3.11/bin/activate
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

6. **Environment variables** (cPanel → Python App → Environment variables):

   | Variable | Example |
   |----------|---------|
   | `DJANGO_SETTINGS_MODULE` | `fooddelivery.settings` |
   | `PUBLIC_BASE_URL` | `https://api.shyam-sweets.com` |
   | `DEBUG` | `0` |
   | `SECRET_KEY` | (generate a new secret; do not use the dev key in repo) |

7. **Restart** the Python app in cPanel.

8. Rebuild the web SPA if needed (`web/.env.production` already sets `VITE_API_BASE=https://api.shyam-sweets.com`) and upload `web/dist` to `shyam-sweets.com`.

## CORS

- Django: `fooddelivery/settings.py` allows `https://shyam-sweets.com` and `https://www.shyam-sweets.com`.
- Fallback: `deploy/.htaccess` adds CORS for preflight and when the web server answers before WSGI.

Do **not** set `CORS_ALLOW_ALL_ORIGINS=1` in production.

## WebSockets (order tracking / chat)

If you use Channels, configure the host’s ASGI/daphne or a separate process; WSGI-only Passenger does not serve `/ws/` paths.
