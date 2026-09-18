import functions_framework
import logging
import math
from datetime import datetime, timezone
from google.cloud import firestore

from scheduleScraper import scheduleScraper
from eloInit import initial_elo_ratings
from eloUpdater import apply_elo_replay

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ID = "egg-models"


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
    """Scrape the full 2026 MLB schedule from ESPN and replay Elo chronologically."""
    games = scheduleScraper()
    if games is None:
        raise RuntimeError("scheduleScraper returned no data")

    games = apply_elo_replay(games, initial_elo_ratings())

    return [{k: _clean(v) for k, v in game.items()} for game in games]


def write_to_firestore(games, collection_path="mlb_2026", document_id="current"):
    logger.info(f"Writing {len(games)} games to Firestore...")
    db = firestore.Client(project=PROJECT_ID)
    db.collection(collection_path).document(document_id).set({
        "timestamp": datetime.now(timezone.utc),
        "matches": games,
    })
    logger.info("Successfully wrote to Firestore")


@functions_framework.http
def run_mlb_pipeline(request):
    """HTTP Cloud Function to run the 2026 MLB Elo pipeline."""
    try:
        logger.info("Starting MLB model pipeline...")

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
