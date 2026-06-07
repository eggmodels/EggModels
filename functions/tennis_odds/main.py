import functions_framework
import requests
import re
import json
import logging
import pandas as pd
import numpy as np
from bs4 import BeautifulSoup
from io import StringIO
from bisect import bisect_right
from rapidfuzz import process, fuzz
from scipy.optimize import brentq
from datetime import datetime, timedelta
import uuid
import unicodedata
from google.cloud import firestore
from google.cloud import secretmanager
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = "egg-models"

def get_secret(secret_id, version_id="latest"):
    """Retrieve a secret from Google Cloud Secret Manager."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_ID}/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8").strip()


# ============= UTILITY FUNCTIONS =============

def american_to_probability(odds):
    odds = int(odds)
    if odds > 0:
        return np.round(100 / (odds + 100), 3)
    else:
        return np.round(abs(odds) / (abs(odds) + 100), 3)

def elo_win_probability(player_celo, opponent_celo):
    return np.round(1 / (1 + 10 ** ((opponent_celo - player_celo) / 400)), 3)

def american_to_decimal(odds):
    odds = int(odds)
    return np.round(1 + (odds / 100) if odds > 0 else 1 + (100 / abs(odds)), 3)

def decimal_to_american(decimal_odds):
    if decimal_odds >= 2.0:
        return round((decimal_odds - 1) * 100)
    else:
        return round(-100 / (decimal_odds - 1))

def decimal_to_probability(decimal_odds):
    return 1 / decimal_odds

def probability_to_american(prob):
    if prob <= 0 or prob >= 1:
        return None
    if prob > 0.5:
        return round(-100 * prob / (1 - prob))
    else:
        return round(100 * (1 - prob) / prob)

def make_odds_10_percent_worse(original_american_odds):
    decimal_odds = american_to_decimal(original_american_odds)
    base = 1
    profit = decimal_odds - base
    worse_profit = profit * 0.95
    worse_decimal_odds = base + worse_profit
    return decimal_to_american(worse_decimal_odds)

def improve_odds_by_20_percent(odds):
    implied_prob = american_to_probability(odds)
    improved_prob = implied_prob * 0.8
    return probability_to_american(improved_prob)

def kelly_allocation_from_odds(breakeven_odds, list_odds):
    try:
        p = decimal_to_probability(american_to_decimal(breakeven_odds))
        b = american_to_decimal(list_odds) - 1
        q = 1 - p
        kelly_fraction = (b * p - q) / b
        return max(kelly_fraction, 0)
    except:
        return 0

VALID_ODDS_BACKUP = sorted([
    -10000, -7500, -5000, -4500, -4000, -3500, -3000, -2750, -2500, -2250, -2000,
    -1900, -1800, -1700, -1600, -1500, -1400, -1300, -1200, -1100, -1000, -980,
    -960, -940, -920, -900, -880, -860, -840, -820, -800, -780, -760, -740, -720,
    -700, -680, -660, -640, -620, -600, -580, -560, -540, -520, -500, -490, -480,
    -470, -460, -450, -440, -430, -420, -410, -400, -390, -380, -370, -360, -350,
    -340, -330, -320, -310, -300, -295, -290, -285, -280, -275, -270, -265, -260,
    -255, -250, -245, -240, -235, -230, -225, -220, -215, -210, -205, -200, -198,
    -196, -194, -192, -190, -188, -186, -184, -182, -180, -178, -176, -174, -172,
    -170, -168, -166, -164, -162, -160, -158, -156, -154, -152, -150, -148, -146,
    -144, -142, -140, -138, -136, -134, -132, -130, -128, -126, -124, -122, -120,
    -119, -118, -117, -116, -115, -114, -113, -112, -111, -110, -109, -108, -107,
    -106, -105, -104, -103, -102, -101, 100, 101, 102, 103, 104, 105, 106, 107,
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 122, 124, 126,
    128, 130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158,
    160, 162, 164, 166, 168, 170, 172, 174, 176, 178, 180, 182, 184, 186, 188, 190,
    192, 194, 196, 198, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245, 250, 255,
    260, 265, 270, 275, 280, 285, 290, 295, 300, 310, 320, 330, 340, 350, 360, 370,
    380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 520, 540, 560,
    580, 600, 620, 640, 660, 680, 700, 720, 740, 760, 780, 800, 820, 840, 860, 880,
    900, 920, 940, 960, 980, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800,
    1900, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500, 5000, 7500, 10000
])

def get_valid_odds(odds):
    if odds in VALID_ODDS_BACKUP:
        return odds
    idx = bisect_right(VALID_ODDS_BACKUP, odds)
    return VALID_ODDS_BACKUP[idx] if idx < len(VALID_ODDS_BACKUP) else None

def normalize_name(name):
    return (
        unicodedata.normalize('NFKD', name)
        .encode('ascii', 'ignore')
        .decode('utf-8')
        .lower()
        .replace("-", " ")
        .strip()
    )

def fuzzy_match_column(df_main, df_lookup, main_col, lookup_col, threshold=90):
    df_main = df_main.copy()
    df_lookup = df_lookup.copy()
    df_main['normalized'] = df_main[main_col].map(normalize_name)
    df_lookup['normalized'] = df_lookup[lookup_col].map(normalize_name)
    lookup_dict = dict(zip(df_lookup['normalized'], df_lookup[lookup_col]))
    matches = df_main['normalized'].dropna().unique()
    lookup_names = list(lookup_dict.keys())
    match_dict = {}
    for name in matches:
        match, score, _ = process.extractOne(name, lookup_names, scorer=fuzz.token_sort_ratio)
        if score >= threshold:
            match_dict[name] = lookup_dict[match]
        else:
            match_dict[name] = None
    df_main[main_col + "_matched"] = df_main['normalized'].map(match_dict)
    df_main = df_main.drop(columns=['normalized'])
    return df_main

def bo3_to_game_prob(P_bo3):
    """Estimate single-game win probability p from best-of-3 match win probability P_bo3."""
    p1 = np.roots([-2, 3, 0, -1*P_bo3])[1]
    return p1

def game_prob_to_bo5(p):
    """Compute best-of-5 match win probability from single-game win probability p."""
    return p**3 * (10 - 15*p + 6*p**2)

def bo3_to_bo5(P_bo3):
    """Convert best-of-3 match win probability to best-of-5 match win probability."""
    p = bo3_to_game_prob(P_bo3)
    return game_prob_to_bo5(p)

# ============= DATA FETCHING =============

def scrape_elo_ratings():
    """Scrape ATP and WTA Elo ratings from TennisAbstract."""
    logger.info("Scraping Elo ratings...")

    atp_elos = None
    wta_elos = None

    try:
        url = "https://tennisabstract.com/reports/atp_elo_ratings.html"
        response = requests.get(url, timeout=10)
        tables = BeautifulSoup(response.text, "html.parser").find_all("table")
        atp_elos = pd.read_html(StringIO(str(tables[2])))[0]
    except Exception as e:
        logger.error(f"Error scraping ATP Elo: {e}")

    try:
        url = "https://tennisabstract.com/reports/wta_elo_ratings.html"
        response = requests.get(url, timeout=10)
        tables = BeautifulSoup(response.text, "html.parser").find_all("table")
        wta_elos = pd.read_html(StringIO(str(tables[2])))[0]
    except Exception as e:
        logger.error(f"Error scraping WTA Elo: {e}")

    if atp_elos is None or wta_elos is None:
        raise Exception("Failed to scrape Elo ratings")

    atp_elos.columns = atp_elos.columns.str.replace('\xa0', ' ', regex=True).str.strip()
    wta_elos.columns = wta_elos.columns.str.replace('\xa0', ' ', regex=True).str.strip()
    atp_elos = atp_elos.drop(columns=['WTA Rank'], errors='ignore')
    wta_elos = wta_elos.drop(columns=['ATP Rank'], errors='ignore')
    atp_elos['tour'] = 'ATP'
    wta_elos['tour'] = 'WTA'

    combined_elos = pd.concat([atp_elos.reset_index(drop=True), wta_elos.reset_index(drop=True)], ignore_index=True)
    combined_elos = combined_elos.loc[:, ~combined_elos.columns.str.contains('^Unnamed')]
    combined_elos['Rank'] = combined_elos.apply(
        lambda row: row['ATP Rank'] if row['tour'] == 'ATP' else row['WTA Rank'], axis=1
    )
    combined_elos = combined_elos.drop(columns=['ATP Rank', 'WTA Rank'], errors='ignore')

    logger.info(f"Scraped {len(combined_elos)} players")
    return combined_elos

def get_kalshi_matches(api_key, private_key_pem):
    """Fetch upcoming tennis matches from Kalshi API."""
    logger.info("Fetching Kalshi tennis markets...")

    match_rows = []

    try:
        base_url = "https://external-api.kalshi.com/trade-api/v2"

        # Fetch ATP and WTA match markets
        for series_ticker, tour in [('KXATPMATCH', 'ATP'), ('KXTAMATCH', 'WTA')]:
            logger.info(f"Starting fetch for {tour} with series_ticker={series_ticker}")
            response = requests.get(
                f"{base_url}/markets",
                params={"series_ticker": series_ticker, "limit": 500},
                timeout=10
            )

            if response.status_code != 200:
                logger.warning(f"Kalshi API error for {tour}: {response.status_code}")
                logger.warning(f"Response: {response.text[:500]}")
                continue

            markets_data = response.json()
            markets = markets_data.get('markets', [])
            logger.info(f"Found {len(markets)} {tour} markets")
            logger.info(f"Sample market titles: {[m.get('title', '')[:80] for m in markets[:2]]}")

            # Parse markets to get match info
            seen_matches = set()
            for market in markets:
                title = market.get('title', '')
                ticker = market.get('ticker', '')

                # Extract player name and match info from title
                # Format: "Will [Player Name] win the [Match Info]?"
                if 'Will ' in title and ' win the ' in title:
                    parts = title.split(' win the ')
                    player_name = parts[0].replace('Will ', '').strip()
                    match_info = parts[1].replace('?', '').strip()

                    # Extract opponent from match info (format: "Player vs Opponent: Round info")
                    if ' vs ' in match_info:
                        match_part = match_info.split(':')[0].strip()  # "Player vs Opponent"
                        opponent_name = match_part.replace(player_name, '').replace(' vs ', '').replace('vs ', '').strip()
                    else:
                        opponent_name = None

                    # Skip if we couldn't extract both players
                    if not opponent_name:
                        logger.debug(f"Failed to extract opponent from: {title}")
                        continue

                    # Use match_info as unique key to avoid duplicates
                    if match_part not in seen_matches:
                        seen_matches.add(match_part)
                        match_rows.append({
                            'event_name': f"{tour} Match",
                            'event_id': ticker,
                            'match_name': match_part,
                            'Player': player_name,
                            'Opponent': opponent_name,
                            'match_date': datetime.utcnow().date(),
                            'status': 'open'
                        })
                else:
                    logger.debug(f"Unexpected title format: {title}")

        if not match_rows:
            logger.info("No tennis matches found in Kalshi markets")
            return pd.DataFrame()

        matches = pd.DataFrame(match_rows)
        matches['Player'] = matches['Player'].apply(normalize_name)
        matches['Opponent'] = matches['Opponent'].apply(normalize_name)
        matches['match_date'] = pd.to_datetime(matches['match_date'])
        matches = matches[matches['status'].isin(['open', 'active'])]

        logger.info(f"Found {len(matches)} upcoming tennis matches in Kalshi")
        return matches

    except Exception as e:
        logger.error(f"Error fetching Kalshi matches: {type(e).__name__}: {str(e)[:200]}")
        return pd.DataFrame()

def extract_tennis_players_from_title(title):
    """Extract player names from Kalshi market title."""
    # Common patterns: "Player A beats Player B" or "Will Player A beat Player B"
    title_lower = title.lower()

    # Try "beats" pattern
    if ' beats ' in title_lower:
        parts = title.split(' beats ')
        if len(parts) == 2:
            player_a = parts[0].strip()
            player_b = parts[1].split(' in ')[0].strip() if ' in ' in parts[1] else parts[1].split(' on ')[0].strip()
            return [player_a, player_b]

    # Try "beat" pattern
    if ' beat ' in title_lower:
        parts = title.split(' beat ')
        if len(parts) == 2:
            player_a = parts[0].strip()
            player_b = parts[1].split(' in ')[0].strip() if ' in ' in parts[1] else parts[1].split(' on ')[0].strip()
            return [player_a, player_b]

    # Try "vs" pattern
    if ' vs ' in title_lower or ' v ' in title_lower:
        separator = ' vs ' if ' vs ' in title_lower else ' v '
        parts = title.split(separator)
        if len(parts) >= 2:
            player_a = parts[0].strip()
            player_b = parts[1].split(' in ')[0].strip() if ' in ' in parts[1] else parts[1].split(' on ')[0].strip()
            return [player_a, player_b]

    return None

def extract_tournament_from_title(title):
    """Extract tournament name from market title."""
    # Look for tournament names in the title
    tournaments = ['wimbledon', 'us open', 'french open', 'australian open', 'atp', 'wta', 'masters', 'slam']

    for tournament in tournaments:
        if tournament.lower() in title.lower():
            return tournament.title()

    # Extract what's after "in" or "on"
    if ' in ' in title:
        return title.split(' in ')[-1].split(' on ')[0].strip()
    if ' on ' in title:
        return title.split(' on ')[-1].strip()

    return 'Unknown Tournament'

def get_prophetx_odds(matches, auth_header, base_url):
    """Fetch moneyline odds from ProphetX."""
    logger.info("Fetching ProphetX odds...")

    all_rows = []
    unique_event_ids = list(set(matches['event_id']))

    for event in unique_event_ids:
        params = {"event_id": event}
        response = requests.get(base_url + "/v2/mm/get_markets", headers=auth_header, params=params).json()

        if response['data'].get('markets') is None:
            continue

        for market in response['data']['markets']:
            if market['name'] == 'Moneyline':
                for group in market.get('selections', []):
                    for selection in group:
                        all_rows.append({
                            "event_id": event,
                            "competitor_id": selection['competitor_id'],
                            "name": selection['name'],
                            "odds": selection['odds'],
                            "line_id": selection['line_id']
                        })

    df = pd.DataFrame(all_rows)
    df[['name', 'line_id', 'odds']] = df[['name', 'line_id', 'odds']].fillna(
        {'name': 'Unknown', 'line_id': 'Unknown', 'odds': float('-inf')}
    )

    df_max_odds = df.loc[df.groupby(['name', 'line_id'])['odds'].idxmax()]
    df_max_odds = df_max_odds.replace({'name': 'Unknown', 'line_id': 'Unknown', 'odds': float('-inf')}, '')
    df_max_odds = df_max_odds.drop(columns=[col for col in ['stake', 'updated_at', 'display_odds'] if col in df.columns])

    df_max_odds['name'] = df_max_odds['name'].apply(normalize_name)

    logger.info(f"Found odds for {len(df_max_odds)} players")
    return df_max_odds

# ============= PROCESSING =============

def process_matches(matches, combined_elos, surface="grass", best_of=3):
    """Process matches with Elo ratings to calculate win probabilities."""
    logger.info("Processing matches with Elo ratings...")

    matches = fuzzy_match_column(matches, combined_elos, "Player", "Player", threshold=70)
    matches = fuzzy_match_column(matches, combined_elos, "Opponent", "Player", threshold=70)

    surface_elo = {"clay": "cElo", "grass": "gElo", "hard": "hElo"}.get(surface, "Elo")

    matches_with_elos = matches.merge(
        combined_elos[["Player", "Elo", surface_elo]].rename(columns={
            "Player": "Player_matched",
            "Elo": "Player Elo",
            surface_elo: "Player " + surface_elo
        }),
        on="Player_matched",
        how="left"
    )

    matches_with_elos = matches_with_elos.merge(
        combined_elos[["Player", "Elo", surface_elo]].rename(columns={
            "Player": "Opponent_matched",
            "Elo": "Opponent Elo",
            surface_elo: "Opponent " + surface_elo
        }),
        on="Opponent_matched",
        how="left"
    )

    matches_with_elos = matches_with_elos.drop(columns=["Player_matched", "Opponent_matched"])

    cols_to_fill = ["Player Elo", f"Player {surface_elo}", "Opponent Elo", f"Opponent {surface_elo}"]
    matches_with_elos[cols_to_fill] = matches_with_elos[cols_to_fill].fillna(1000)

    matches_with_elos["Surface Elo Win Probability"] = matches_with_elos.apply(
        lambda row: bo3_to_bo5(elo_win_probability(row["Player " + surface_elo], row["Opponent " + surface_elo]))
        if best_of == 5 and ("atp" in row["event_name"].lower() or "(m)" in row["event_name"].lower())
        else elo_win_probability(row["Player " + surface_elo], row["Opponent " + surface_elo]),
        axis=1
    )

    # Remove rows with default Elo
    elo_cols = ["Player Elo", f"Player {surface_elo}", "Opponent Elo", f"Opponent {surface_elo}"]
    matches_with_elos = matches_with_elos[~matches_with_elos[elo_cols].isin([1000]).any(axis=1)]

    logger.info(f"Processed {len(matches_with_elos)} matches")
    return matches_with_elos

def generate_website_data(matches_with_elos):
    """Generate clean dataset for website."""
    matches_with_elos = matches_with_elos.reset_index(drop=True)

    # Only use complete pairs (even rows paired with their next odd row)
    num_complete_pairs = len(matches_with_elos) // 2
    even_rows = np.arange(0, num_complete_pairs * 2, 2)
    odd_rows = even_rows + 1

    if len(even_rows) == 0:
        return pd.DataFrame(columns=["Player 1", "Player 2", "Player 1 Win Probability", "Player 2 Win Probability"])

    df_for_website = pd.DataFrame({
        "Player 1": matches_with_elos.loc[even_rows, "Player"].values,
        "Player 2": matches_with_elos.loc[odd_rows, "Player"].values,
        "Player 1 Win Probability": np.round(matches_with_elos.loc[even_rows, "Surface Elo Win Probability"].values, 3),
        "Player 2 Win Probability": np.round(matches_with_elos.loc[odd_rows, "Surface Elo Win Probability"].values, 3)
    })

    return df_for_website

# ============= FIREBASE =============

def write_to_firestore(data, collection_path="tennis_odds", document_id="current"):
    """Write results to Firestore."""
    logger.info(f"Writing to Firestore at {collection_path}/{document_id}...")

    db = firestore.Client(project=PROJECT_ID)

    firestore_data = {
        "timestamp": datetime.utcnow(),
        "matches": data.to_dict('records') if hasattr(data, 'to_dict') else data
    }

    db.collection(collection_path).document(document_id).set(firestore_data)
    logger.info("Successfully wrote to Firestore")

# ============= MAIN FUNCTION =============

@functions_framework.http
def run_tennis_odds(request):
    """HTTP Cloud Function to run the tennis odds pipeline."""
    try:
        logger.info("Starting tennis odds pipeline...")

        # Get Kalshi credentials from Secret Manager
        kalshi_api_key = get_secret("kalshi-api-key")
        kalshi_private_key = get_secret("kalshi-private-key")

        logger.info("Kalshi credentials retrieved from Secret Manager")

        # Fetch data
        print("DEBUG: Scraping Elo ratings...")
        combined_elos = scrape_elo_ratings()
        print(f"DEBUG: Retrieved Elo data for {len(combined_elos)} players")

        print("DEBUG: Fetching Kalshi matches...")
        matches = get_kalshi_matches(kalshi_api_key, kalshi_private_key)
        print(f"DEBUG: Retrieved {len(matches)} matches from Kalshi")

        if len(matches) == 0:
            logger.info("No upcoming matches found")
            write_to_firestore({"matches": [], "message": "No upcoming matches"})
            return {"status": "success", "message": "No upcoming matches"}

        # Process matches with Elo ratings
        print("DEBUG: Processing matches with Elo ratings...")
        matches_with_elos = process_matches(matches, combined_elos)
        print(f"DEBUG: After processing: {len(matches_with_elos)} matches")

        # Generate website data
        print("DEBUG: Generating website data...")
        df_for_website = generate_website_data(matches_with_elos)
        print(f"DEBUG: Website data generated for {len(df_for_website)} matches")

        # Write to Firestore
        write_to_firestore(df_for_website)

        logger.info("Pipeline completed successfully")
        return {
            "status": "success",
            "matches": len(df_for_website),
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}", exc_info=True)
        return {"status": "error", "error": "Internal server error"}, 500
