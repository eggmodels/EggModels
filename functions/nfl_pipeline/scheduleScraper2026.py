import pandas as pd
import requests
from datetime import datetime, timezone

try:
    from zoneinfo import ZoneInfo
    _ET = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover - fallback if tz database is unavailable
    _ET = timezone.utc

# pro-football-reference is now behind a Cloudflare bot challenge, so the old
# HTML scrape returns 403 from any machine. We pull the schedule from ESPN's
# free public JSON API instead. Team "name" values (Eagles, 49ers, Commanders,
# ...) already match the nicknames the Elo model uses exactly.

SEASON = 2026
_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"

# ESPN postseason week -> model week. Pro Bowl (ESPN week 4) is skipped.
_POSTSEASON_WEEK_MAP = {1: 19, 2: 20, 3: 21, 5: 22}


def _fetch(seasontype, espn_week):
    params = {"dates": str(SEASON), "seasontype": str(seasontype), "week": str(espn_week)}
    resp = requests.get(_SCOREBOARD, params=params, timeout=30)
    if resp.status_code != 200:
        print(f"ESPN request failed (seasontype={seasontype}, week={espn_week}): {resp.status_code}")
        return []
    return resp.json().get("events", [])


def _game_row(event, model_week):
    comp = event["competitions"][0]
    competitors = comp["competitors"]
    home = next(c for c in competitors if c["homeAway"] == "home")
    away = next(c for c in competitors if c["homeAway"] == "away")

    state = comp["status"]["type"]["state"]  # 'pre' | 'in' | 'post'

    def score(c):
        # Only trust a final score once the game is complete.
        if state != "post":
            return None
        try:
            return int(c.get("score"))
        except (TypeError, ValueError):
            return None

    # ESPN dates are UTC ISO strings; display in US Eastern like prior seasons.
    dt = datetime.fromisoformat(event["date"].replace("Z", "+00:00")).astimezone(_ET)

    return {
        "Week": float(model_week),
        "Day": dt.strftime("%a"),
        "Date": dt.strftime("%Y-%m-%d"),
        "Time": dt.strftime("%I:%M%p").lstrip("0"),
        "Home": home["team"]["name"],
        "Away": away["team"]["name"],
        "ScoreH": score(home),
        "ScoreA": score(away),
        "ElopreH": None,
        "ElopreA": None,
        "ElopostH": None,
        "ElopostA": None,
        "probH": None,
        "probA": None,
        "eloSpread": None,
    }


def scheduleScraper2026():
    schedule_data = []

    def add(event, model_week):
        row = _game_row(event, model_week)
        # ESPN lists not-yet-seeded playoff games as "TBD"; skip until the
        # matchup is known (they carry no Elo and have no team logo).
        if row["Home"] == "TBD" or row["Away"] == "TBD":
            return
        schedule_data.append(row)

    # Regular season: ESPN seasontype 2, weeks 1-18.
    for week in range(1, 19):
        for event in _fetch(2, week):
            add(event, week)

    # Postseason: ESPN seasontype 3; map ESPN weeks to model weeks 19-22.
    for espn_week, model_week in _POSTSEASON_WEEK_MAP.items():
        for event in _fetch(3, espn_week):
            add(event, model_week)

    if not schedule_data:
        print("No games returned from ESPN.")
        return None

    return pd.DataFrame(schedule_data)
