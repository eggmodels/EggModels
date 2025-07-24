const functions = require('firebase-functions');
const fetch = require('node-fetch');
const cors = require('cors')({ origin: true });
const crypto = require('crypto');
const axios = require("axios");
const { createPrivateKey } = require("crypto");

// ─── ProphetX Setup ──────────────────────────────────────────────────────────
let accessToken = null;

async function loginToProphetX() {
  console.log('Logging in to ProphetX...');
  const loginRes = await fetch('https://cash.api.prophetx.co/partner/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_key: functions.config().prophetx.access_key,
      secret_key: functions.config().prophetx.secret_key
    })
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    console.error('Login failed response:', text);
    throw new Error('Login failed');
  }

  const loginData = await loginRes.json();
  accessToken = loginData.data.access_token;
  console.log('ProphetX login successful');
}

async function ensureLoggedIn() {
  if (!accessToken) {
    await loginToProphetX();
  }
}

// ─── ProphetX Endpoints ──────────────────────────────────────────────────────

exports.getEvents = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      await ensureLoggedIn();
      const eventsRes = await fetch('https://cash.api.prophetx.co/partner/mm/get_sport_events', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!eventsRes.ok) {
        const text = await eventsRes.text();
        console.error('Events fetch failed response:', text);
        if (eventsRes.status === 401) {
          accessToken = null;
          await ensureLoggedIn();
          return exports.getEvents(req, res);
        }
        return res.status(500).json({ error: 'Events fetch failed' });
      }

      const eventsData = await eventsRes.json();
      res.json(eventsData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

exports.getProphetMarkets = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const eventId = req.query.event_id;
    if (!eventId) return res.status(400).json({ error: "Missing event_id query param." });

    try {
      await ensureLoggedIn();
      const marketsRes = await fetch(`https://cash.api.prophetx.co/partner/v2/mm/get_markets?event_id=${eventId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!marketsRes.ok) {
        const text = await marketsRes.text();
        console.error('Market fetch failed response:', text);
        if (marketsRes.status === 401) {
          accessToken = null;
          await ensureLoggedIn();
          return exports.getProphetMarkets(req, res);
        }
        return res.status(500).json({ error: "Market fetch failed", body: text });
      }

      const json = await marketsRes.json();
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.json(json);
    } catch (err) {
      console.error("ProphetX market fetch error:", err);
      res.status(500).json({ error: "Server error", message: err.message });
    }
  });
});

exports.getBets = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      await ensureLoggedIn();

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const fromTime = currentTimestamp - Math.floor(86400 * 2.5);

      const wagersRes = await fetch(
        `https://cash.api.prophetx.co/partner/v2/mm/get_wager_histories?from=${fromTime}&to=${currentTimestamp}&limit=1000&market_id=186`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!wagersRes.ok) {
        const text = await wagersRes.text();
        console.error('Wager fetch failed response:', text);
        if (wagersRes.status === 401) {
          accessToken = null;
          await ensureLoggedIn();
          return exports.getBets(req, res);
        }
        return res.status(500).json({ error: 'Wager fetch failed' });
      }

      const wagersData = await wagersRes.json();
      res.json(wagersData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// ─── Kalshi Setup ────────────────────────────────────────────────────────────
const KALSHI_ACCESS_KEY = functions.config().kalshi.access_key;
const KALSHI_PRIVATE_KEY_PEM = functions.config().kalshi.private_key.replace(/\\n/g, '\n');
const KALSHI_BASE_URL = "https://api.elections.kalshi.com";

// ─── Kalshi Endpoints ────────────────────────────────────────────────────────

exports.getKalshiEvents = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const ACCESS_KEY_ID = functions.config().kalshi.access_key;
    const PRIVATE_KEY_PEM = functions.config().kalshi.private_key.replace(/\\n/g, '\n');
    const BASE_URL = "https://api.elections.kalshi.com";
    const EVENTS_PATH = "/trade-api/v2/events";

    try {
      // Create timestamp and signing string
      const now_ms = String(Date.now());
      const msg_string = now_ms + "GET" + EVENTS_PATH;

      // Sign it
      const privateKey = createPrivateKey({ key: PRIVATE_KEY_PEM, format: "pem" });
      const signature = crypto.sign("sha256", Buffer.from(msg_string), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
      }).toString("base64");

      const headers = {
        "KALSHI-ACCESS-KEY": ACCESS_KEY_ID,
        "KALSHI-ACCESS-TIMESTAMP": now_ms,
        "KALSHI-ACCESS-SIGNATURE": signature,
      };

      // Paginate with cursor
      let allEvents = [];
      let cursor = '';
      let page = 1;

      while (true) {
        const params = {
          status: 'open',
          limit: 200,
          cursor: cursor,
        };

        console.log(`📄 Page ${page} | Fetching with cursor: ${cursor || 'NONE'}`);
        const response = await axios.get(`${BASE_URL}${EVENTS_PATH}`, { headers, params });

        const events = response.data?.events || [];
        allEvents.push(...events);

        cursor = response.data.cursor;
        if (!cursor) break;
        page++;
      }

      console.log(`🎉 Fetched total of ${allEvents.length} open events.`);
      res.status(200).json({ events: allEvents });

    } catch (err) {
      console.error("❌ Kalshi fetch failed:", err.response?.data || err.message);
      res.status(500).json({
        error: "Failed to fetch Kalshi events",
        details: err.response?.data || err.message,
      });
    }
  });
});

exports.getKalshiMarketsByEvent = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const eventTicker = req.query.event_id;

    if (!eventTicker) {
      return res.status(400).json({ error: "Missing event_id (event_ticker) query param." });
    }

    try {
      const nowMs = Date.now().toString();
      const path = "/trade-api/v2/markets";
      const message = nowMs + "GET" + path;

      const signature = crypto.sign("sha256", Buffer.from(message), {
        key: KALSHI_PRIVATE_KEY_PEM,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_MAX_SIGN,
      }).toString("base64");

      const headers = {
        "KALSHI-ACCESS-KEY": KALSHI_ACCESS_KEY,
        "KALSHI-ACCESS-TIMESTAMP": nowMs,
        "KALSHI-ACCESS-SIGNATURE": signature,
      };

      const params = new URLSearchParams({
        event_ticker: eventTicker,
        limit: "1000"
      });

      const response = await fetch(`${KALSHI_BASE_URL}${path}?${params.toString()}`, {
        headers
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(500).json({ error: "Market fetch failed", body: text });
      }

      const json = await response.json();
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.json(json);
    } catch (err) {
      console.error("Kalshi markets fetch error:", err);
      res.status(500).json({ error: "Server error", message: err.message });
    }
  });
});
