import math

# MLB-specific Elo constants. HFA and K are much smaller than the NFL model's
# since a 162-game season moves ratings far more gradually than a 17-game one.
HOME_FIELD_ADVANTAGE = 24
K_FACTOR = 4


def eloWinProb(elo1, elo2, neutral):
    """Win probability for team1 (home unless neutral) against team2."""
    hfa = 0 if neutral else HOME_FIELD_ADVANTAGE
    eloDiff = elo1 - elo2
    prob1 = 1 / (1 + math.pow(10, -(eloDiff + hfa) / 400))
    prob2 = 1 - prob1
    return prob1, prob2


def update_elo_ratings(elo1, elo2, scoreDiff, neutral):
    """Post-game Elo for both teams given team1's score minus team2's score."""
    expected1, expected2 = eloWinProb(elo1, elo2, neutral)

    if scoreDiff > 0:
        result1, result2 = 1, 0
    elif scoreDiff < 0:
        result1, result2 = 0, 1
    else:
        result1, result2 = 0.5, 0.5

    updated_elo1 = elo1 + K_FACTOR * (result1 - expected1)
    updated_elo2 = elo2 + K_FACTOR * (result2 - expected2)

    return updated_elo1, updated_elo2


def apply_elo_replay(games, initial_elo):
    """Walk the season's games in chronological order, carrying each team's
    Elo rating forward game to game. `games` must already be sorted by date.
    Mutates and returns the same list of dicts."""
    current_elo = dict(initial_elo)

    for game in games:
        team1, team2 = game["team1"], game["team2"]
        elo1 = current_elo.get(team1, 1505)
        elo2 = current_elo.get(team2, 1505)

        game["elo1_pre"] = elo1
        game["elo2_pre"] = elo2

        prob1, prob2 = eloWinProb(elo1, elo2, game["neutral"])
        game["elo_prob1"] = prob1
        game["elo_prob2"] = prob2

        if game["score1"] is not None and game["score2"] is not None:
            updated_elo1, updated_elo2 = update_elo_ratings(
                elo1, elo2, game["score1"] - game["score2"], game["neutral"]
            )
            game["elo1_post"] = updated_elo1
            game["elo2_post"] = updated_elo2
            current_elo[team1] = updated_elo1
            current_elo[team2] = updated_elo2
        else:
            game["elo1_post"] = None
            game["elo2_post"] = None

    return games
