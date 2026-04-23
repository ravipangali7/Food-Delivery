# Infelo Group — Google Maps (beginner guide)

This page explains **how to show a Google Map on your website** using your Infelo account, in small steps. You do **not** need a separate Google Cloud project for the basic flow: when your **map subscription** is active, Infelo returns a **ready-to-use** Maps JavaScript API key.

---

## 1. Two different “keys” (read this once)

- **Infelo account API key** — A long secret that identifies *your* Infelo account (same as SMS, embed). **Where:** in the `Authorization: Bearer ...` **header** on calls to **Infelo’s** API.
- **`maps_api_key` in the JSON** — The **Google** Maps JavaScript key for the **browser**. **Where:** in the [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript) script URL or loader as the `key` parameter. This is **not** the same string as your Bearer token.

**In one sentence:** you prove who you are to Infelo with the **Bearer** key; Infelo responds with `{ "maps_api_key": "..." }` for the **browser** to draw the map.

---

## 2. Checklist before you code

1. You have **issued** an Infelo account API key in **Client → API → Reference** and enabled **API access** if your project requires it.
2. Your **map subscription** is **active** (today lies between your map start and end dates). Check **Client → Service** or call `GET /api/v1/embed/summary/` with the same Bearer key and read `maps_subscription_active` and `maps_days_remaining`.
3. Infelo has configured the **platform** Google key on the server. If the maps endpoint returns **503**, it is not configured on Infelo’s side yet.
4. Choose **one** path: (A) a small **backend** on your site that calls Infelo (**recommended**), or (B) the **browser** calls Infelo directly (only for prototypes; see section 6).

If something fails, use the table in **section 7**.

---

## 3. The Infelo request (this is the only HTTP call for the key)

**Path (under your API root; example host):**

`GET https://api.infelogroup.com/api/v1/google-goods/maps-js-api-key/`

**Header:**

```http
Authorization: Bearer YOUR_INFELO_ACCOUNT_KEY
```

**Success (HTTP 200):**

```json
{ "maps_api_key": "AIzaSy..." }
```

Use that string as **Google’s** `key` when loading the Maps JavaScript API in the next sections.

**Note:** This does **not** use your SMS credit balance. It only checks that your **map date window** is valid and the platform is configured.

---

## 4. Recommended flow: your server fetches the key (production)

**Why:** Your **Infelo account** key should not live in public static JavaScript. Store it in **server environment variables** and call Infelo from **your** backend.

**Steps:**

1. The user is logged in on **your** site (your own session or auth).
2. **Your** server (with `INFELO_API_KEY` in env) calls the `GET` from **section 3** with `Authorization: Bearer` + that env value.
3. If `200`, your server returns only `{ "mapsApiKey": "..." }` to **your** frontend, or server-renders a page that injects the key **once** for that request.
4. The **browser** loads the Maps script using `mapsApiKey` only. It should **not** need the Infelo Bearer key.

**Minimal Node.js (Express) example** — do not commit real keys; use `process.env`:

```javascript
// GET /api/infelo/maps-js-key — your own route, protected by your session
app.get("/api/infelo/maps-js-key", async (req, res) => {
  if (!req.session || !req.session.isLoggedIn) {
    return res.status(401).json({ error: "Login required" });
  }
  const base = "https://api.infelogroup.com/api";
  const r = await fetch(base + "/v1/google-goods/maps-js-api-key/", {
    headers: { Authorization: "Bearer " + process.env.INFELO_API_KEY },
  });
  if (!r.ok) {
    return res.status(r.status).type("text").send(await r.text());
  }
  const { maps_api_key } = await r.json();
  res.json({ mapsApiKey: maps_api_key });
});
```

**Your** frontend then calls your own `GET /api/infelo/maps-js-key` and uses `mapsApiKey` in the browser (section 5).

---

## 5. Show the map in the browser (after you have `mapsApiKey` or `maps_api_key`)

**Simple pattern:** load the Google script **once** with the key, then run `new google.maps.Map(...)`.

```html
<div id="map" style="height: 400px; width: 100%"></div>
<script>
  async function initMap() {
    const res = await fetch("/api/infelo/maps-js-key");
    if (!res.ok) { alert("Maps unavailable: " + res.status); return; }
    const { mapsApiKey } = await res.json();
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(mapsApiKey) + "&callback=onGoogleMapsReady";
    script.async = true;
    window.onGoogleMapsReady = function () {
      new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: { lat: 27.7172, lng: 85.324 },
      });
    };
    document.body.appendChild(script);
  }
  initMap();
</script>
```

Replace the `fetch` URL with **your** backend path from section 4. Replace the center with your own coordinates. Use **HTTPS** on the live site.

(Advanced: you can use the newer `importLibrary` pattern from Google’s docs; the idea is the same: the **key** in the request is always the `maps_api_key` from Infelo.)

---

## 6. Browser calls Infelo directly (prototypes only)

For quick tests, you *may* call the Infelo URL from the browser and put the Bearer key in a header. **Everyone** can read it in dev tools, so **rotate** the key if it leaks, and do **not** use this for production marketing pages. **CORS** may block the request; if so, use section 4.

```javascript
const r = await fetch("https://api.infelogroup.com/api/v1/google-goods/maps-js-api-key/", {
  headers: { Authorization: "Bearer " + "YOUR_INFELO_ACCOUNT_KEY" }
});
const { maps_api_key } = await r.json();
```

---

## 7. HTTP status quick reference

- **200** — `maps_api_key` in body. Use it in the Maps JS loader.
- **401** — Bad or missing Bearer. Fix or re-issue the Infelo account key.
- **403** — Suspended account, or no active **map subscription**. Check **Service → Map** or **Buy credits → Map**; wait for admin if a payment is pending.
- **503** — Platform Maps key not set on Infelo. Contact support.

**Helpful pre-check (same Bearer):** `GET /api/v1/embed/summary/` returns `maps_subscription_active` and `maps_days_remaining` so you can show “Renew maps” before loading a map.

---

## 8. Protect the `maps_api_key` in Google Cloud

That string is a real **Google** API key. In Google Cloud Console, restrict it by **HTTP referrers** to your real domains, enable only the products you use (e.g. **Maps JavaScript API**), and watch billing.

---

## 9. Buy or extend map days

- **Portal:** **Client → Buy credits** → **Map** tab, then follow pay + screenshot; an admin must approve the invoice. Your `end_date_map` is then extended.
- **Bearer (embed) same as public embed API:** `POST /api/v1/embed/checkout/preview/` and `POST /api/v1/embed/checkout/` with `service: "google_maps"`, `map_days`, and payment image (see General API doc for fields).
- **Session (logged into portal app):** `POST /api/me/checkout/preview/` and `POST /api/me/checkout/` with `service: "google_maps"` and `map_days`.

---

## 10. Support

For map dates, billing, or 503 errors, use **Support** in the client portal and mention “Maps JavaScript API / subscription.”
