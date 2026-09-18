import json
import os

_DIR = os.path.dirname(os.path.abspath(__file__))


def eloRevert(oldElo):
    """Regress a team's Elo one third of the way back to the league mean between seasons."""
    return 1505 * (1 / 3) + oldElo * (2 / 3)


def initial_elo_ratings():
    """Starting Elo for each team, derived from the 2024 season's final ratings
    (mlbFinalElo2024.json, computed once from src/python/mlb_2024/csv/mlb-elo-2024.json)
    and reverted toward the mean for the new season."""
    with open(os.path.join(_DIR, "mlbFinalElo2024.json"), "r") as f:
        final_elo = json.load(f)

    return {team: eloRevert(elo) for team, elo in final_elo.items()}
