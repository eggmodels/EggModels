const functions = require('firebase-functions');
const fetch = require('node-fetch');
const cors = require('cors')({ origin: true });
const crypto = require('crypto');
const axios = require("axios");
const { createPrivateKey } = require("crypto");

// ─── TypeSafe Setup ──────────────────────────────────────────────────────────
// TypeSafe (api.typesafe.ai) is a structured-decision model: it answers named
// yes/no, multiple-choice, or rubric-score questions about supplied content.
// It does not generate free-form text, so any blurb text below is templated
// here from its structured answer, not written by the model itself.
const TYPESAFE_BASE_URL = "https://api.typesafe.ai";

async function callTypeSafeSystemOne(state, questions) {
  const apiKey = functions.config().typesafe?.api_key;
  const response = await fetch(`${TYPESAFE_BASE_URL}/v1/systemone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TypeSafe request failed (${response.status}): ${text}`);
  }

  return response.json();
}

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

// ─── TypeSafe-backed Endpoints ───────────────────────────────────────────────

const CONFIDENCE_LEVELS = [
  "Even matchup — could go either way",
  "Slight favorite",
  "Clear favorite",
  "Lock-level favorite",
];

function buildPickBlurb(game, tierIndex) {
  const { home, away, probH, probA, eloSpread } = game;
  const homeFavored = (probH ?? 0) >= (probA ?? 0);
  const favorite = homeFavored ? home : away;
  const underdog = homeFavored ? away : home;
  const favoriteProb = homeFavored ? probH : probA;
  const probText = favoriteProb != null ? `${Math.round(favoriteProb * 100)}%` : null;
  const spreadText = eloSpread != null ? Math.abs(eloSpread).toFixed(1) : null;

  if (tierIndex === 0) {
    return probText
      ? `Coin-flip game: ${home} and ${away} are evenly matched (${probText} win probability).`
      : `Coin-flip game: ${home} and ${away} are evenly matched.`;
  }
  const descriptors = ["a modest", "a clear", "a lock-level"];
  const descriptor = descriptors[Math.min(tierIndex, descriptors.length) - 1];
  let blurb = `${favorite} is ${descriptor} favorite over ${underdog}`;
  if (spreadText) blurb += ` (favored by ${spreadText})`;
  if (probText) blurb += `, ${probText} win probability`;
  return `${blurb}.`;
}

// Rates every game in a week in one TypeSafe call, then templates a one-line
// blurb per game from the structured confidence tier it returns.
exports.getPickInsights = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const games = req.body?.games;
      if (!Array.isArray(games) || games.length === 0) {
        return res.status(400).json({ error: "Missing games array in request body." });
      }

      const questions = {};
      games.forEach((game, i) => {
        questions[`game_${i}`] = {
          type: "score",
          instructions: {
            task: "Rate how lopsided this matchup is based on the model's own numbers.",
            home: game.home,
            away: game.away,
            home_win_probability: game.probH,
            away_win_probability: game.probA,
            elo_spread: game.eloSpread,
          },
          criteria: CONFIDENCE_LEVELS,
        };
      });

      const result = await callTypeSafeSystemOne(
        "An NFL schedule week. Each question below refers to a different game; rate that game only.",
        questions,
      );

      const insights = games.map((game, i) => {
        const answer = result.answers[`game_${i}`];
        const tierIndex = answer ? Math.round(answer.score) : 0;
        return {
          home: game.home,
          away: game.away,
          tier: CONFIDENCE_LEVELS[tierIndex] ?? CONFIDENCE_LEVELS[0],
          confidence: answer?.confidence ?? null,
          blurb: buildPickBlurb(game, tierIndex),
        };
      });

      res.json({ insights });
    } catch (err) {
      console.error("getPickInsights error:", err);
      res.status(500).json({ error: "Server error", message: err.message });
    }
  });
});

// Matches a free-text search against a list of betting events (ProphetX +
// Kalshi titles) by meaning rather than exact substring, so phrasing like
// "the Bills game" can find "Buffalo Bills @ Miami Dolphins".
exports.searchOdds = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const query = req.body?.query;
      const events = req.body?.events; // [{ id, title }]
      if (typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: "Missing query string in request body." });
      }
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "Missing events array in request body." });
      }

      const criteria = {};
      events.slice(0, 255).forEach((event) => {
        criteria[String(event.id)] = event.title;
      });

      const result = await callTypeSafeSystemOne(query, {
        match: {
          type: "choice",
          instructions: "Which event is the user asking about?",
          criteria,
        },
      });

      const answer = result.answers.match;
      res.json({
        matchedId: answer.choice,
        confidence: answer.confidence,
        ranked: Object.entries(answer.probabilities)
          .sort((a, b) => b[1] - a[1])
          .map(([id, probability]) => ({ id, probability })),
      });
    } catch (err) {
      console.error("searchOdds error:", err);
      res.status(500).json({ error: "Server error", message: err.message });
    }
  });
});
