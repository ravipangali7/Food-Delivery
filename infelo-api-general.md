# Infelo Group — General API

## Base URL (API root)

`https://api.infelogroup.com/api`

(Exact host may differ by deployment.)

## Account API key (Bearer)

One **account API key** unlocks all integrations you are entitled to: public SMS, website embed, Maps JS (when your map subscription is active), and (optionally) exchanging a session in the full portal.

Issue, rotate, and enable API access in the client portal under **Client → API**.

```http
Authorization: Bearer <your_api_key>
```

- `401` if the key is missing or invalid.
- `403` if the account is suspended or the integration is not enabled.

For logged-in **dashboard** JSON endpoints, use a session instead:

```http
Authorization: Token <your_session_token>
```

Obtain a token with `POST /api/auth/login/`.

## Service-specific reference

- **SMS** (send, logs, portal test routes): see the **SMS** tab in the portal, or the SMS Markdown/PDF download.
- **Google Maps** (get a key for the Maps JavaScript API, subscription): see the **Map** tab or Map Markdown/PDF download for a **beginner-friendly, step-by-step** integration guide.

## Public embed — account summary (Bearer)

`GET /api/v1/embed/summary/`

Returns **SMS credit**, **Google Maps window** (start/end, per-day rate, active flag, days remaining), and optional `buy_credits_url` / `whatsapp_recharge_url` for older embeds. Legacy alias: `GET /api/v1/sms/embed/summary/`.

## Bearer payment settings (embed UI)

`GET /api/v1/embed/payment-settings/`

Same auth as summary; returns QR and payment hints (mirrors the portal).

## Bearer checkout (pending invoice)

- `POST /api/v1/embed/checkout/preview/`  
  - SMS: `{ "service": "sms", "sms_credits": 500, "currency": "NPR" }`  
  - Maps: `{ "service": "google_maps", "map_days": 30, "currency": "NPR" }`
- `POST /api/v1/embed/checkout/` — `multipart/form-data`: `service`, `payment_method`, `payment_screenshot` (image), `currency` (optional), and either `sms_credits` or `map_days`. Admin approval applies credits or extends map dates.

## Optional — exchange API key for a session

`POST /api/auth/exchange-api-key/`

Open the full portal in another tab with a normal session if needed.

## Website embed (account portal in iframe)

Host the client app so `infelo-api-embed.js` is served (same path as the marketing/portal app). The iframe loads the hosted embed UI at `/embed/portal` on the **same origin** as the script.

```html
<script
  src="https://YOUR_PORTAL_ORIGIN/infelo-api-embed.js"
  data-api-key="YOUR_API_KEY"
  data-api-base="https://api.infelogroup.com/api"
  data-height="720"
  async
></script>
```

- Replace `YOUR_PORTAL_ORIGIN` with the origin where the Infelo app is deployed.
- `data-api-base` must point at this API’s `/api` root. Defaults to `https://api.infelogroup.com/api` if omitted.

**Security:** A key in HTML/JS is visible in source and the network. Use only on trusted pages; rotate the key if it leaks.

**Framing:** The portal origin must allow embedding in an iframe from your site (e.g. permissive `Content-Security-Policy: frame-ancestors` for `/embed/portal`).

## Support

Contact support via the client portal or your account email.
