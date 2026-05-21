# Deploy Django API (`api.shyam-sweets.com`)

The storefront (`shyam-sweets.com`) is static files only. All `/api/...` routes (including `/api/settings/`) are served by **Django on the API subdomain**. If that app is not running, LiteSpeed returns **404 HTML** for every API URL.

## Quick check

```bash
curl -sI https://api.shyam-sweets.com/api/settings/
```

- **200** + `Content-Type: application/json` → OK  
- **404** + `Server: LiteSpeed` + HTML body → Django/Passenger is not serving the subdomain (follow steps below)

## cPanel / LiteSpeed (recommended)

1. **Subdomain** `api` → document root e.g. `~/api.shyam-sweets.com` (empty or replace old upload).
2. Upload the server project (or run `deploy/build-server-zip.ps1` and extract the zip into that folder).  
   Required at the **root of the document root**:
   - `manage.py`
   - `passenger_wsgi.py`
   - `fooddelivery/`
   - `core/`
   - `requirements.txt`
3. **Setup Python App** (cPanel):
   - Python version: 3.11+ (match your host)
   - Application root: same folder as `manage.py`
   - Application URL: `/` (subdomain root)
   - Application startup file: `passenger_wsgi.py`
   - Application entry point: `application`
4. In the app’s virtualenv, install deps and migrate:

   ```bash
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

5. **Environment** (cPanel → Python App → Environment variables), at minimum:

   | Variable | Example |
   |----------|---------|
   | `DJANGO_SETTINGS_MODULE` | `fooddelivery.settings` |
   | `PUBLIC_BASE_URL` | `https://api.shyam-sweets.com` |
   | `DEBUG` | `0` |
   | `SECRET_KEY` | (long random secret) |

6. **Restart** the Python app in cPanel after each deploy.
7. Confirm: `curl -s https://api.shyam-sweets.com/api/settings/ -H "Accept: application/json"`

## CORS

`fooddelivery/settings.py` already allows `https://shyam-sweets.com`. If the browser reports missing CORS headers on OPTIONS, merge `deploy/cpanel-api-subdomain.htaccess.example` into the API subdomain `.htaccess` (do not duplicate `Access-Control-Allow-Origin` in both Apache and django-cors-headers).

## Storefront build

Build the SPA with the API origin:

```bash
cd web
# .env.production should contain:
# VITE_API_BASE=https://api.shyam-sweets.com
npm run build
```

Upload `web/dist/*` to `shyam-sweets.com` (not the API subdomain).

## Common mistakes

| Symptom | Cause |
|---------|--------|
| 404 HTML on all `/api/*` | No Passenger app, wrong document root, or zip missing `passenger_wsgi.py` |
| SPA HTML from `shyam-sweets.com/api/...` | API called on the **storefront** host; fix `VITE_API_BASE` to `https://api.shyam-sweets.com` |
| CSRF errors on POST | Old deploy without `REST_FRAMEWORK` Token-only auth; redeploy current `settings.py` |
