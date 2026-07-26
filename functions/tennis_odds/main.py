import functions_framework
import requests
import re
import json
import logging
import pandas as pd
import numpy as np
from bs4 import BeautifulSoup
from io import StringIO
from rapidfuzz import process, fuzz
from datetime import datetime, timezone
import unicodedata
from google.cloud import firestore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = "egg-models"

COUNTRY_NAME_TO_ISO = {
    'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'argentina': 'AR',
    'armenia': 'AM', 'australia': 'AU', 'austria': 'AT', 'azerbaijan': 'AZ',
    'bahamas': 'BS', 'bahrain': 'BH', 'bangladesh': 'BD', 'barbados': 'BB',
    'belarus': 'BY', 'belgium': 'BE', 'bolivia': 'BO', 'bosnia': 'BA',
    'bosnia and herzeg.': 'BA', 'bosnia and herzegovina': 'BA',
    'botswana': 'BW', 'brazil': 'BR', 'brunei': 'BN', 'bulgaria': 'BG',
    'burkina faso': 'BF', 'cambodia': 'KH', 'cameroon': 'CM', 'canada': 'CA',
    'chile': 'CL', 'china': 'CN', 'chinese taipei': 'TW', 'colombia': 'CO',
    'congo': 'CG', 'costa rica': 'CR', 'croatia': 'HR', 'cuba': 'CU',
    'cyprus': 'CY', 'czech republic': 'CZ', 'denmark': 'DK',
    'dominican rep.': 'DO', 'dominican republic': 'DO', 'ecuador': 'EC',
    'egypt': 'EG', 'el salvador': 'SV', 'england': 'GB', 'estonia': 'EE',
    'ethiopia': 'ET', 'finland': 'FI', 'france': 'FR', 'gabon': 'GA',
    'georgia': 'GE', 'germany': 'DE', 'ghana': 'GH', 'great britain': 'GB',
    'greece': 'GR', 'guatemala': 'GT', 'haiti': 'HT', 'honduras': 'HN',
    'hong kong': 'HK', 'hungary': 'HU', 'iceland': 'IS', 'india': 'IN',
    'indonesia': 'ID', 'iran': 'IR', 'iraq': 'IQ', 'ireland': 'IE',
    'israel': 'IL', 'italy': 'IT', 'ivory coast': 'CI', 'jamaica': 'JM',
    'japan': 'JP', 'jordan': 'JO', 'kazakhstan': 'KZ', 'kenya': 'KE',
    'korea': 'KR', 'south korea': 'KR', 'kuwait': 'KW', 'kyrgyzstan': 'KG',
    'latvia': 'LV', 'lebanon': 'LB', 'libya': 'LY', 'liechtenstein': 'LI',
    'lithuania': 'LT', 'luxembourg': 'LU', 'macau': 'MO', 'malaysia': 'MY',
    'mali': 'ML', 'malta': 'MT', 'mauritius': 'MU', 'mexico': 'MX',
    'moldova': 'MD', 'moldavia': 'MD', 'monaco': 'MC', 'mongolia': 'MN',
    'montenegro': 'ME', 'morocco': 'MA', 'mozambique': 'MZ', 'myanmar': 'MM',
    'namibia': 'NA', 'nepal': 'NP', 'netherlands': 'NL', 'new zealand': 'NZ',
    'nicaragua': 'NI', 'niger': 'NE', 'nigeria': 'NG', 'north macedonia': 'MK',
    'northern ireland': 'GB', 'norway': 'NO', 'oman': 'OM', 'pakistan': 'PK',
    'panama': 'PA', 'paraguay': 'PY', 'peru': 'PE', 'philippines': 'PH',
    'poland': 'PL', 'portugal': 'PT', 'puerto rico': 'PR', 'qatar': 'QA',
    'romania': 'RO', 'russia': 'RU', 'rsa': 'ZA', 'rwanda': 'RW',
    'saudi arabia': 'SA', 'scotland': 'GB', 'senegal': 'SN', 'serbia': 'RS',
    'singapore': 'SG', 'slovakia': 'SK', 'slovenia': 'SI',
    'south africa': 'ZA', 'spain': 'ES', 'sri lanka': 'LK', 'sudan': 'SD',
    'sweden': 'SE', 'switzerland': 'CH', 'syria': 'SY', 'taiwan': 'TW',
    'tajikistan': 'TJ', 'tanzania': 'TZ', 'thailand': 'TH', 'togo': 'TG',
    'trinidad': 'TT', 'trinidad and tobago': 'TT', 'tunisia': 'TN',
    'turkey': 'TR', 'turkmenistan': 'TM', 'uae': 'AE', 'uganda': 'UG',
    'ukraine': 'UA', 'united kingdom': 'GB', 'united states': 'US',
    'uruguay': 'UY', 'usa': 'US', 'uzbekistan': 'UZ', 'venezuela': 'VE',
    'viet nam': 'VN', 'vietnam': 'VN', 'wales': 'GB', 'zambia': 'ZM',
    'zimbabwe': 'ZW',
}

REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# ============= UTILITY FUNCTIONS =============

def elo_win_probability(player_elo, opponent_elo):
    return np.round(1 / (1 + 10 ** ((opponent_elo - player_elo) / 400)), 3)

def normalize_name(name):
    return (
        unicodedata.normalize('NFKD', name)
        .encode('ascii', 'ignore')
        .decode('utf-8')
        .lower()
        .replace("-", " ")
        .strip()
    )

def strip_initial(name):
    """Remove trailing single-letter initial from TennisExplorer format.
    'Van Assche L.' -> 'Van Assche', 'Seyboth Wild T.' -> 'Seyboth Wild'
    """
    return re.sub(r'\s+[A-Za-z]\.\s*$', '', name).strip()

def fuzzy_match_name(name, lookup_names, threshold=90):
    """Match a TennisExplorer name (Last F.) against TennisAbstract names (First Last)."""
    stripped = strip_initial(name)
    normalized = normalize_name(stripped)
    if not normalized:
        return None
    result = process.extractOne(normalized, lookup_names, scorer=fuzz.token_set_ratio)
    if result and result[1] >= threshold:
        return result[0]
    return None

def bo3_to_game_prob(P_bo3):
    roots = np.roots([-2, 3, 0, -1 * P_bo3])
    real_roots = [r.real for r in roots if np.isreal(r) and 0 < r.real < 1]
    return real_roots[0] if real_roots else P_bo3

def game_prob_to_bo5(p):
    return p**3 * (10 - 15*p + 6*p**2)

def bo3_to_bo5(P_bo3):
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
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
        tables = BeautifulSoup(response.text, "html.parser").find_all("table")
        atp_elos = pd.read_html(StringIO(str(tables[2])))[0]
    except Exception as e:
        logger.error(f"Error scraping ATP Elo: {e}")

    try:
        url = "https://tennisabstract.com/reports/wta_elo_ratings.html"
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
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

    combined = pd.concat([atp_elos.reset_index(drop=True), wta_elos.reset_index(drop=True)], ignore_index=True)
    combined = combined.loc[:, ~combined.columns.str.contains('^Unnamed')]

    logger.info(f"Scraped {len(combined)} players with Elo ratings")
    return combined


def scrape_tennis_explorer_matches(match_type='atp-single'):
    """Scrape today's matches from TennisExplorer."""
    url = f'https://www.tennisexplorer.com/results/?type={match_type}'
    logger.info(f"Fetching TennisExplorer matches: {url}")

    try:
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
        r.raise_for_status()
    except Exception as e:
        logger.error(f"TennisExplorer fetch failed: {e}")
        return []

    soup = BeautifulSoup(r.text, 'html.parser')
    table = soup.find('table', class_='result')
    if not table:
        return []

    rows = table.find_all('tr')
    matches = []
    current_tournament = ''
    current_match = {}

    for row in rows:
        cls = ' '.join(row.get('class', []))

        # Tournament header row
        if 'head' in cls and 'flags' in cls:
            tds = row.find_all('td')
            current_tournament = tds[0].get_text(strip=True) if tds else ''
            continue

        # Skip minor/non-tour events
        t_lower = current_tournament.lower()
        if any(x in t_lower for x in ['utr', 'futures', 'itf']):
            continue

        # Player 1 row (has 'bott' = first player of pair)
        if 'bott' in cls and 'head' not in cls:
            name_td = row.find('td', class_='t-name')
            if name_td:
                link = name_td.find('a')
                if link:
                    href = link.get('href', '')
                    slug = href.strip('/').split('/')[-1] if href else ''
                    name = link.get_text(strip=True)
                    name = re.sub(r'\s*\(\d+\)\s*$', '', name)
                    name = re.sub(r'\s*\(WC\)\s*$', '', name, flags=re.IGNORECASE)
                    name = re.sub(r'\s*\(Q\)\s*$', '', name, flags=re.IGNORECASE)
                    name = re.sub(r'\s*\(LL\)\s*$', '', name, flags=re.IGNORECASE)
                    current_match = {
                        'Player': name.strip(),
                        'Player_slug': slug,
                        'tournament': current_tournament,
                    }

        # Player 2 row (follows player 1, no 'bott')
        elif 'bott' not in cls and 'head' not in cls and current_match:
            name_td = row.find('td', class_='t-name')
            if name_td:
                link = name_td.find('a')
                if link:
                    href = link.get('href', '')
                    slug = href.strip('/').split('/')[-1] if href else ''
                    name = link.get_text(strip=True)
                    name = re.sub(r'\s*\(\d+\)\s*$', '', name)
                    name = re.sub(r'\s*\(WC\)\s*$', '', name, flags=re.IGNORECASE)
                    name = re.sub(r'\s*\(Q\)\s*$', '', name, flags=re.IGNORECASE)
                    name = re.sub(r'\s*\(LL\)\s*$', '', name, flags=re.IGNORECASE)
                    current_match['Opponent'] = name.strip()
                    current_match['Opponent_slug'] = slug
                    matches.append(current_match.copy())
                    current_match = {}

    logger.info(f"Found {len(matches)} matches from TennisExplorer ({match_type})")
    return matches


def get_all_matches():
    """Fetch both ATP and WTA matches."""
    atp_matches = scrape_tennis_explorer_matches('atp-single')
    wta_matches = scrape_tennis_explorer_matches('wta-single')

    for m in atp_matches:
        m['tour'] = 'ATP'
    for m in wta_matches:
        m['tour'] = 'WTA'

    all_matches = atp_matches + wta_matches
    logger.info(f"Total matches: {len(all_matches)} (ATP: {len(atp_matches)}, WTA: {len(wta_matches)})")
    return all_matches


def get_player_country(slug):
    """Get player country ISO code from their TennisExplorer profile."""
    url = f'https://www.tennisexplorer.com/player/{slug}/'
    try:
        r = requests.get(url, headers=REQUEST_HEADERS, timeout=8)
        if r.status_code != 200:
            return ''
        text = BeautifulSoup(r.text, 'html.parser').get_text()
        match = re.search(r'Country:\s*([A-Za-z\s\.\-\']+?)(?=Age:|Current|Height|Born|Sex)', text)
        if match:
            country_name = match.group(1).strip().lower()
            return COUNTRY_NAME_TO_ISO.get(country_name, '')
    except Exception as e:
        logger.debug(f"Failed to get country for {slug}: {e}")
    return ''


def get_countries_for_matches(matches):
    """Batch-fetch country codes for all players in matches."""
    logger.info("Fetching player country codes...")

    slug_to_country = {}
    unique_slugs = set()
    for m in matches:
        unique_slugs.add(m.get('Player_slug', ''))
        unique_slugs.add(m.get('Opponent_slug', ''))
    unique_slugs.discard('')

    logger.info(f"Looking up countries for {len(unique_slugs)} unique players")

    for slug in unique_slugs:
        if slug not in slug_to_country:
            country = get_player_country(slug)
            slug_to_country[slug] = country

    # Assign countries back to matches
    for m in matches:
        m['Player Country'] = slug_to_country.get(m.get('Player_slug', ''), '')
        m['Opponent Country'] = slug_to_country.get(m.get('Opponent_slug', ''), '')

    found = sum(1 for v in slug_to_country.values() if v)
    logger.info(f"Found countries for {found}/{len(unique_slugs)} players")
    return matches


# ============= PROCESSING =============

def detect_surface(tournament_name):
    """Guess surface from tournament name."""
    t = tournament_name.lower()
    clay_indicators = ['roland garros', 'french open', 'rome', 'madrid', 'barcelona',
                       'monte carlo', 'hamburg', 'estoril', 'buenos aires', 'rio',
                       'marrakech', 'lyon', 'kitzbuhel', 'bastad', 'umag', 'gstaad']
    grass_indicators = ['wimbledon', 'halle', 'queens', "queen's", 's-hertogenbosch',
                        'eastbourne', 'mallorca', 'stuttgart', 'newport']

    for indicator in clay_indicators:
        if indicator in t:
            return 'clay'
    for indicator in grass_indicators:
        if indicator in t:
            return 'grass'
    return 'hard'


def detect_best_of(tournament_name, tour):
    """Determine if match is best-of-5 (Grand Slam men's)."""
    slams = ['australian open', 'roland garros', 'french open', 'wimbledon', 'us open']
    t = tournament_name.lower()
    if tour == 'ATP' and any(s in t for s in slams):
        return 5
    return 3


def process_matches(matches, combined_elos):
    """Match players with Elo ratings and compute win probabilities."""
    logger.info("Processing matches with Elo ratings...")

    # Build normalized name lookup
    elo_names_norm = combined_elos['Player'].apply(normalize_name).tolist()
    elo_lookup = dict(zip(elo_names_norm, combined_elos.index))

    results = []
    for m in matches:
        player_name = m['Player']
        opponent_name = m['Opponent']
        tournament = m.get('tournament', '')
        tour = m.get('tour', 'ATP')

        surface = detect_surface(tournament)
        best_of = detect_best_of(tournament, tour)
        surface_col = {'clay': 'cElo', 'grass': 'gElo', 'hard': 'hElo'}.get(surface, 'Elo')

        # Fuzzy match player names to Elo database
        # TennisExplorer format: "Last F." -> we need to match with "First Last"
        player_match = fuzzy_match_name(player_name, elo_names_norm)
        opponent_match = fuzzy_match_name(opponent_name, elo_names_norm)

        if player_match is None or opponent_match is None:
            continue

        player_idx = elo_lookup.get(player_match)
        opponent_idx = elo_lookup.get(opponent_match)

        if player_idx is None or opponent_idx is None:
            continue

        player_row = combined_elos.iloc[player_idx]
        opponent_row = combined_elos.iloc[opponent_idx]

        # Get surface-specific Elo (fall back to overall Elo)
        player_elo = player_row.get(surface_col, player_row.get('Elo', None))
        opponent_elo = opponent_row.get(surface_col, opponent_row.get('Elo', None))

        if pd.isna(player_elo) or pd.isna(opponent_elo):
            player_elo = player_row.get('Elo', None)
            opponent_elo = opponent_row.get('Elo', None)

        if pd.isna(player_elo) or pd.isna(opponent_elo):
            continue

        player_elo = float(player_elo)
        opponent_elo = float(opponent_elo)

        win_prob = float(elo_win_probability(player_elo, opponent_elo))

        # Convert to bo5 for Grand Slam men's
        if best_of == 5:
            win_prob = float(bo3_to_bo5(win_prob))

        results.append({
            'Player 1': player_row['Player'].replace('\xa0', ' '),
            'Player 2': opponent_row['Player'].replace('\xa0', ' '),
            'Player 1 Win Probability': round(win_prob, 3),
            'Player 2 Win Probability': round(1 - win_prob, 3),
            'Player 1 Country': m.get('Player Country', ''),
            'Player 2 Country': m.get('Opponent Country', ''),
            'tournament': tournament,
            'surface': surface,
        })

    logger.info(f"Processed {len(results)} matches with valid Elo data")
    return results


# ============= FIREBASE =============

def write_to_firestore(matches_list, collection_path="tennis_odds", document_id="current"):
    """Write results to Firestore."""
    logger.info(f"Writing {len(matches_list)} matches to Firestore...")

    db = firestore.Client(project=PROJECT_ID)

    firestore_data = {
        "timestamp": datetime.now(timezone.utc),
        "matches": matches_list,
    }

    db.collection(collection_path).document(document_id).set(firestore_data)
    logger.info("Successfully wrote to Firestore")


# ============= MAIN FUNCTION =============

@functions_framework.http
def run_tennis_odds(request):
    """HTTP Cloud Function to run the tennis odds pipeline."""
    try:
        logger.info("Starting tennis odds pipeline...")

        # 1. Scrape Elo ratings
        combined_elos = scrape_elo_ratings()

        # 2. Fetch today's matches from TennisExplorer
        matches = get_all_matches()

        if not matches:
            logger.info("No matches found")
            write_to_firestore([])
            return {"status": "success", "message": "No matches found"}

        # 3. Get country codes for players
        matches = get_countries_for_matches(matches)

        # 4. Process matches with Elo ratings
        results = process_matches(matches, combined_elos)

        if not results:
            logger.info("No matches with valid Elo data")
            write_to_firestore([])
            return {"status": "success", "message": "No matches with valid Elo data"}

        # 5. Write to Firestore
        write_to_firestore(results)

        logger.info(f"Pipeline completed: {len(results)} matches")
        return {
            "status": "success",
            "matches": len(results),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}", exc_info=True)
        return {"status": "error", "error": "Internal server error"}, 500
