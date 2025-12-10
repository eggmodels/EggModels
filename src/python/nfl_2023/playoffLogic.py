import json
from functools import cmp_to_key

def load_game_data(json_file_path):
    with open(json_file_path, 'r') as file:
        return json.load(file)

def compute_team_records(game_data):
    divisions = {
        "AFC North": ["Ravens", "Bengals", "Browns", "Steelers"],
        "AFC East": ["Bills", "Dolphins", "Patriots", "Jets"],
        "AFC South": ["Texans", "Colts", "Titans", "Jaguars"],
        "AFC West": ["Broncos", "Chiefs", "Raiders", "Chargers"],
        "NFC North": ["Bears", "Lions", "Packers", "Vikings"],
        "NFC East": ["Cowboys", "Giants", "Eagles", "Commanders"],
        "NFC South": ["Falcons", "Panthers", "Saints", "Buccaneers"],
        "NFC West": ["Cardinals", "Rams", "49ers", "Seahawks"]
    }
    
    team_records = {}
    for division, teams in divisions.items():
        conference = "AFC" if "AFC" in division else "NFC"
        for team in teams:
            team_records[team] = {
                "Wins": 0, "Losses": 0, "ConfWins": 0, "DivWins": 0,
                "Division": division, "Conference": conference
            }

    for game in game_data:
        home_team = game["Home"]
        away_team = game["Away"]
        home_score = game["ScoreH"]
        away_score = game["ScoreA"]
        
        if home_score is None or away_score is None:
            continue

        is_division_game = team_records[home_team]["Division"] == team_records[away_team]["Division"]
        is_conference_game = team_records[home_team]["Conference"] == team_records[away_team]["Conference"]

        if home_score > away_score:
            team_records[home_team]["Wins"] += 1
            team_records[away_team]["Losses"] += 1
            if is_conference_game:
                team_records[home_team]["ConfWins"] += 1
            if is_division_game:
                team_records[home_team]["DivWins"] += 1
        elif away_score > home_score:
            team_records[home_team]["Losses"] += 1
            team_records[away_team]["Wins"] += 1
            if is_conference_game:
                team_records[away_team]["ConfWins"] += 1
            if is_division_game:
                team_records[away_team]["DivWins"] += 1
                
    return team_records

def tiebreaker(team1, team2, team_records, game_data):
    # 1. Head-to-head
    team1_vs_team2 = [game for game in game_data if set([game["Home"], game["Away"]]) == set([team1, team2])]
    team1_wins_head_to_head = sum(1 for game in team1_vs_team2 if game["ScoreH"] is not None and game["ScoreA"] is not None and ((game["ScoreH"] > game["ScoreA"] and game["Home"] == team1) or (game["ScoreH"] < game["ScoreA"] and game["Away"] == team1)))
    if len(team1_vs_team2) > 0 and team1_wins_head_to_head != len(team1_vs_team2) // 2:
        return team1 if team1_wins_head_to_head > len(team1_vs_team2) // 2 else team2

    # 2. Division Games
    team1_div_win_pct = team_records[team1]["DivWins"] / (team_records[team1]["Wins"] + team_records[team1]["Losses"])
    team2_div_win_pct = team_records[team2]["DivWins"] / (team_records[team2]["Wins"] + team_records[team2]["Losses"])
    if team1_div_win_pct != team2_div_win_pct:
        return team1 if team1_div_win_pct > team2_div_win_pct else team2

    # 3. Common Games (to be implemented)

    # 4. Conference Games
    team1_conf_win_pct = team_records[team1]["ConfWins"] / (team_records[team1]["Wins"] + team_records[team1]["Losses"])
    team2_conf_win_pct = team_records[team2]["ConfWins"] / (team_records[team2]["Wins"] + team_records[team2]["Losses"])
    if team1_conf_win_pct != team2_conf_win_pct:
        return team1 if team1_conf_win_pct > team2_conf_win_pct else team2

    # If still tied, return team1 by default (additional criteria can be added)
    return team1

def compare_teams(team1, team2, team_records, game_data):
    if team_records[team1]["Wins"] == team_records[team2]["Wins"] and team_records[team1]["Losses"] == team_records[team2]["Losses"]:      
        return 1 if tiebreaker(team1, team2, team_records, game_data) == team1 else -1
    return (team_records[team2]["Wins"] - team_records[team1]["Wins"]) or (team_records[team1]["Losses"] - team_records[team2]["Losses"])

def rank_teams(teams, team_records, game_data):
    return sorted(teams, key=cmp_to_key(lambda team1, team2: compare_teams(team1, team2, team_records, game_data)))

def select_playoff_teams(team_records, game_data):
    # Separate teams by division
    divisions = {
        "AFC North": [], "AFC South": [], "AFC East": [], "AFC West": [],
        "NFC North": [], "NFC South": [], "NFC East": [], "NFC West": []
    }
    
    for team, details in team_records.items():
        divisions[details["Division"]].append(team)

    # Determine division winners by ranking teams within each division
    afc_div_winners = [rank_teams(teams, team_records, game_data)[0] for div, teams in divisions.items() if "AFC" in div]
    nfc_div_winners = [rank_teams(teams, team_records, game_data)[0] for div, teams in divisions.items() if "NFC" in div]

    # Sort the division winners
    sorted_afc_div_winners = rank_teams(afc_div_winners, team_records, game_data)
    sorted_nfc_div_winners = rank_teams(nfc_div_winners, team_records, game_data)

    # Get the remaining teams for wild card consideration
    afc_teams = [team for team in team_records if team_records[team]["Conference"] == "AFC" and team not in sorted_afc_div_winners]
    nfc_teams = [team for team in team_records if team_records[team]["Conference"] == "NFC" and team not in sorted_nfc_div_winners]

    # Sort and select wild card teams
    sorted_afc_wild_cards = rank_teams(afc_teams, team_records, game_data)[:3]  # Select top 3 as wild cards
    sorted_nfc_wild_cards = rank_teams(nfc_teams, team_records, game_data)[:3]

    # Combine division winners and wild cards for final seeding
    afc_playoff_teams = sorted_afc_div_winners + sorted_afc_wild_cards
    nfc_playoff_teams = sorted_nfc_div_winners + sorted_nfc_wild_cards

    return afc_playoff_teams, nfc_playoff_teams

    