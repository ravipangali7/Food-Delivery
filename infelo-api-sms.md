# Infelo Group — SMS API reference

## Base URL

`https://api.infelogroup.com/api/v1/sms` (public API; exact path may vary by deployment)

## Public SMS endpoints (API key only)

No login/session token is required.
Use your active **account** API key in every request (same key for SMS, embed sign-in, and Maps where enabled):

```http
Authorization: Bearer <your_api_key>
```

### Send SMS (single recipient)

`POST /api/v1/sms/send/`

JSON body:

```json
{
  "to": "+9779841112233",
  "message": "Hello from Infelo"
}
```

- `message` max length: 160 characters.
- Consumes **1** SMS credit on success.
- `401` if API key is missing/invalid.
- `403` if account is suspended.
- `400` for validation/credit errors.
- `502` when gateway fails.
- `503` when gateway is not configured.

Response (201):

```json
{
  "id": "c2f9a3d6-....",
  "status": "sent",
  "to_number": "9841112233",
  "credits_used": 1,
  "sent_at": "2026-04-22T12:34:56Z"
}
```

## Portal endpoints (authenticated client dashboard)

Use `Authorization: Token <your_token>` (session token from login) for dashboard features.

### Instant SMS (single recipient, dashboard)

`POST /api/me/sms/test/`

JSON body:

```json
{
  "to": "+9779841112233",
  "message": "Hello from Infelo"
}
```

- `message` max length: 160 characters.
- Consumes **1** SMS credit on success.

### Bulk SMS (multiple recipients, dashboard)

`POST /api/me/sms/bulk/`

JSON body:

```json
{
  "message": "Same text to all",
  "recipients": "9841112233, 9851122334"
}
```

Or:

```json
{
  "message": "Same text to all",
  "recipients": ["9841112233", "9851122334"]
}
```

- Recipients: Nepal mobile numbers, one per line and/or comma/semicolon-separated. Duplicates removed after normalization.
- Maximum recipients per request: **80** (configurable server-side).
- `message` max length: **160** characters.
- Consumes **1 credit per recipient** on success.
- Gateway sends one request with comma-separated contacts when supported.

### SMS logs (dashboard)

`GET /api/me/sms/logs/`

Returns recent SMS history for your account.

## Rate limits

- SMS: approximately **100 requests per minute** per account (subject to change).
- HTTP **429** when exceeded; use exponential backoff.

## Webhooks

Configure webhooks under **Settings** for delivery-related events where available. Verify payloads using your webhook secret (HMAC-SHA256).

## Support

Contact support via the client portal or your account email.

For embed, checkout, and session exchange, see the **General** API document in the portal.
