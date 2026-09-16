import functions_framework
import logging
import math
from datetime import datetime, timezone
from google.cloud import firestore

from scheduleScraper2026 import scheduleScraper2026
from eloInit2026 import eloInit2026
from eloUpdater2026 import (
    update_win_prob_2026,
    update_post_elos,
    transfer_post_to_pre,
    update_home_elo_spread,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = "egg-models"

# Regular season (weeks 1-18) + playoffs through the Super Bowl (weeks 19-22).
# This is a fixed upper bound for the Elo replay loop, not a "current week" -
# weeks without a final score simply no-op in update_post_elos.
TOTAL_WEEKS = 22


def _clean(value):
    """Firestore rejects NaN and most numpy scalar types; normalize to native Python."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def build_model():
    """Run the full 2026 NFL schedule scrape + Elo replay, mirroring modelUpdater2026.py."""
    df = scheduleScraper2026()
    if df is None:
        raise RuntimeError("scheduleScraper2026 returned no data")

    df = eloInit2026(df)
    df = update_win_prob_2026(df)

    for i in range(1, TOTAL_WEEKS):
        df = update_post_elos(df)
        df = transfer_post_to_pre(df, i + 1)
        df = update_win_prob_2026(df)

    df = update_home_elo_spread(df)

    records = df.to_dict(orient="records")
    return [{k: _clean(v) for k, v in row.items()} for row in records]


def write_to_firestore(games, collection_path="nfl_2026", document_id="current"):
    logger.info(f"Writing {len(games)} games to Firestore...")
    db = firestore.Client(project=PROJECT_ID)
    db.collection(collection_path).document(document_id).set({
        "timestamp": datetime.now(timezone.utc),
        "matches": games,
    })
    logger.info("Successfully wrote to Firestore")


@functions_framework.http
def run_nfl_pipeline(request):
    """HTTP Cloud Function to run the 2026 NFL Elo pipeline."""
    try:
        logger.info("Starting NFL model pipeline...")

        games = build_model()
        write_to_firestore(games)

        logger.info(f"Pipeline completed: {len(games)} games")
        return {
            "status": "success",
            "games": len(games),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}", exc_info=True)
        return {"status": "error", "error": "Internal server error"}, 500
