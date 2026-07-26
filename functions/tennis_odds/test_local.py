"""
Local test for the tennis odds pipeline.
Run: python test_local.py
Tests match scraping, Elo processing, and country lookups without GCP credentials.
"""
import sys
import json
from datetime import datetime, timezone

sys.path.insert(0, '.')

from main import (
    scrape_elo_ratings,
    get_all_matches,
    get_countries_for_matches,
    process_matches,
)


def main():
    print("=" * 70)
    print("Tennis Odds Pipeline - Local Test")
    print("=" * 70)

    # Step 1: Fetch matches from TennisExplorer
    print("\n[1] Fetching today's matches from TennisExplorer...")
    matches = get_all_matches()

    if not matches:
        print("  No matches found today.")
        return

    print(f"  Found {len(matches)} matches")
    for m in matches[:5]:
        print(f"    {m['Player']} vs {m['Opponent']} | {m['tournament']} ({m['tour']})")

    # Step 2: Get country codes
    print(f"\n[2] Fetching country codes for players...")
    # Only look up first 10 matches to avoid too many requests in test
    test_matches = matches[:10]
    test_matches = get_countries_for_matches(test_matches)
    print("  Sample countries:")
    for m in test_matches[:5]:
        print(f"    {m['Player']} [{m.get('Player Country', '?')}] vs {m['Opponent']} [{m.get('Opponent Country', '?')}]")

    # Step 3: Scrape Elo ratings
    print("\n[3] Scraping Elo ratings from TennisAbstract...")
    try:
        combined_elos = scrape_elo_ratings()
        print(f"  Scraped {len(combined_elos)} players")
    except Exception as e:
        print(f"  ERROR: {e}")
        return

    # Step 4: Process matches with Elo
    print("\n[4] Processing matches with Elo ratings...")
    results = process_matches(test_matches, combined_elos)

    if not results:
        print("  No matches could be processed (name matching failed)")
        # Try with full set
        print("  Trying with all matches...")
        all_with_countries = get_countries_for_matches(matches[:30])
        results = process_matches(all_with_countries, combined_elos)

    if not results:
        print("  Still no results. Check name matching logic.")
        return

    print(f"\n  Successfully processed {len(results)} matches:")
    print("-" * 70)
    for r in results:
        c1 = r.get('Player 1 Country', '??') or '??'
        c2 = r.get('Player 2 Country', '??') or '??'
        print(f"  [{c1}] {r['Player 1']:<25} {r['Player 1 Win Probability']*100:5.1f}%"
              f"  vs  [{c2}] {r['Player 2']:<25} {r['Player 2 Win Probability']*100:5.1f}%"
              f"  | {r.get('tournament', '')}")
    print("-" * 70)

    # Step 5: Show Firestore document format
    print(f"\n[5] Firestore document preview (first 2):")
    print(json.dumps(results[:2], indent=2))
    print(f"\nTotal matches ready for Firestore: {len(results)}")


if __name__ == "__main__":
    main()
