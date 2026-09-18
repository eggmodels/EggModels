import requests
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
    _ET = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover - fallback if tz database is unavailable
    _ET = timezone.utc

# Same free, unauthenticated ESPN scoreboard API the NFL pipeline uses.
# Unlike NFL, MLB's scoreboard is queried per calendar day rather than per
# week, so the scraper walks every day of the season instead of a week list.
SEASON = 2026
_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"

# Spring training runs through late March and the World Series usually wraps
# by early November, so this window comfortably covers the whole season
# (days with no games simply return an empty event list).
_SEASON_START = datetime(SEASON, 3, 1)
_SEASON_END = datetime(SEASON, 11, 10)

# ESPN's team abbreviations don't all match the ones the site's logos
# (src/logosmlb/) and its bundled 2024 Elo dataset use, which follow the
# FiveThirtyEight convention. Map ESPN -> that existing convention.
_TEAM_ABBR_MAP = {
    "ARI": "ARI", "ATL": "ATL", "BAL": "BAL", "BOS": "BOS", "CHC": "CHC",
    "CHW": "CHW", "CIN": "CIN", "CLE": "CLE", "COL": "COL", "DET": "DET",
    "HOU": "HOU", "KC": "KCR", "LAA": "ANA", "LAD": "LAD", "MIA": "FLA",
    "MIL": "MIL", "MIN": "MIN", "NYM": "NYM", "NYY": "NYY", "OAK": "OAK",
    "ATH": "OAK",  # Athletics relocated to Sacramento in 2025; map to the
                   # legacy OAK code the existing logos/dataset use.
    "PHI": "PHI", "PIT": "PIT", "SD": "SDP", "SEA": "SEA", "SF": "SFG",
    "STL": "STL", "TB": "TBD", "TEX": "TEX", "TOR": "TOR", "WSH": "WSN",
}


def _fetch(date_str):
    resp = requests.get(_SCOREBOARD, params={"dates": date_str}, timeout=30)
    if resp.status_code != 200:
        print(f"ESPN request failed (date={date_str}): {resp.status_code}")
        return []
    return resp.json().get("events", [])


def _game_row(event):
    comp = event["competitions"][0]
    competitors = comp["competitors"]
    home = next(c for c in competitors if c["homeAway"] == "home")
    away = next(c for c in competitors if c["homeAway"] == "away")

    home_abbr = _TEAM_ABBR_MAP.get(home["team"]["abbreviation"])
    away_abbr = _TEAM_ABBR_MAP.get(away["team"]["abbreviation"])
    if not home_abbr or not away_abbr:
        print(f"Unmapped MLB team abbreviation: {home['team']['abbreviation']} / {away['team']['abbreviation']}")
        return None

    state = comp["status"]["type"]["state"]  # 'pre' | 'in' | 'post'

    def score(c):
        # Only trust a final score once the game is complete.
        if state != "post":
            return None
        try:
            return float(c.get("score"))
        except (TypeError, ValueError):
            return None

    dt = datetime.fromisoformat(event["date"].replace("Z", "+00:00")).astimezone(_ET)

    return {
        "date": dt.strftime("%Y-%m-%d"),
        "season": SEASON,
        "neutral": 0,
        # Not derived from ESPN's feed (unused by the frontend); kept for
        # schema parity with the bundled 2024 dataset.
        "playoff": None,
        "team1": home_abbr,
        "team2": away_abbr,
        "score1": score(home),
        "score2": score(away),
        "elo1_pre": None,
        "elo2_pre": None,
        "elo_prob1": None,
        "elo_prob2": None,
        "elo1_post": None,
        "elo2_post": None,
    }


def scheduleScraper():
    """Fetch every 2026 MLB game (played and scheduled) in chronological order."""
    games = []
    day = _SEASON_START
    while day <= _SEASON_END:
        for event in _fetch(day.strftime("%Y%m%d")):
            row = _game_row(event)
            if row is not None:
                games.append(row)
        day += timedelta(days=1)

    if not games:
        print("No games returned from ESPN.")
        return None

    games.sort(key=lambda g: g["date"])
    return games
