import math
import pandas as pd

def eloRevert(oldElo):
    return 1505 * (1/3) + oldElo * (2/3)

def eloWinProb(homeElo, awayElo):
    # Calculate the expected outcome for each player
    eloDiff = homeElo - awayElo
    homeProb = 1 / (1 + math.pow(10, -(eloDiff+65) / 400) ) #65 is Home Field Advantage Adjustment
    awayProb = 1 / (1 + math.pow(10, (eloDiff+65) / 400)  )
    return homeProb, awayProb

def update_elo_ratings(homeElo, awayElo, homePointDiff):
    # Calculate the expected win probability for the home team
    K = 20
    expected_win_prob_home, expected_win_prob_away = eloWinProb(homeElo, awayElo)
    # Determine the result based on the point differential
    if homePointDiff > 0:
        result_home = 1
        result_away = 0
    elif homePointDiff < 0:
        result_home = 0
        result_away = 1
    else:
        result_home = 0.5
        result_away = 0.5

    # Margin of Victory Multiplier    
    absolute_point_diff = abs(homePointDiff)
    movMultiplier = math.log(absolute_point_diff + 1) * (2.2 / (absolute_point_diff * 0.001 + 2.2))
    
    # Update Elo ratings
    updated_home_elo = homeElo + K * (result_home - expected_win_prob_home) * movMultiplier 
    updated_away_elo = awayElo + K * (result_away - expected_win_prob_away) * movMultiplier

    return updated_home_elo, updated_away_elo

def update_win_prob(df):
    for index, row in df.iterrows():
        # Check if ElopreH and ElopreA are not None
        if not pd.isnull(row['ElopreH']) and not pd.isnull(row['ElopreA']):
            # Calculate probH and probA using the eloWinProb function
            home_team = row['ElopreH']
            away_team = row['ElopreA']
            expected1, expected2 = eloWinProb(home_team, away_team)

            # Update the DataFrame with the calculated values
            df.at[index, 'probH'] = expected1
            df.at[index, 'probA'] = expected2

    return df

def update_post_elos(df):
    for index, row in df.iterrows():
        # Check if ScoreH is not empty (assuming ScoreH is a numeric column)
        if not pd.isnull(row['ScoreH']) and not pd.isnull(row['probH']):
            # Calculate ElopostH and ElopostA using the update_elo_ratings function
            home_elo_pre = row['ElopreH']
            away_elo_pre = row['ElopreA']
            home_point_diff = row['ScoreH'] - row['ScoreA']
            updated_home_elo, updated_away_elo = update_elo_ratings(home_elo_pre, away_elo_pre, home_point_diff)

            # Update the DataFrame with the calculated values
            df.at[index, 'ElopostH'] = updated_home_elo
            df.at[index, 'ElopostA'] = updated_away_elo
    return df

def transfer_post_to_pre(df, followingWeek):
    # Initialize a dictionary to store the latest team Elo ratings
    team_latest_elo = {}

    # Iterate through the rows of the DataFrame for the current week
    for index, row in df.iterrows():
        if row['Week'] == followingWeek - 2:  # Check if the Week column is equal to the previous week
            home_team = row['Home']
            away_team = row['Away']
            elo_post_h = row['ElopostH']
            elo_post_a = row['ElopostA']

            # Update the latest Elo ratings for home and away teams
            team_latest_elo[home_team] = elo_post_h
            team_latest_elo[away_team] = elo_post_a
        
        if row['Week'] == followingWeek - 1:  # Check if the Week column is equal to the previous week
            home_team = row['Home']
            away_team = row['Away']
            elo_post_h = row['ElopostH']
            elo_post_a = row['ElopostA']

            # Update the latest Elo ratings for home and away teams
            team_latest_elo[home_team] = elo_post_h
            team_latest_elo[away_team] = elo_post_a

    # Iterate through the rows of the DataFrame for the following week
    for index, row in df.iterrows():
        if row['Week'] == followingWeek:
            home_team = row['Home']
            away_team = row['Away']

            # Get the latest Elo rating for the home team
            df.at[index, 'ElopreH'] = team_latest_elo.get(home_team)

            # Get the latest Elo rating for the away team
            df.at[index, 'ElopreA'] = team_latest_elo.get(away_team)

    return df

def update_home_elo_spread(df):
    for index, row in df.iterrows():
        if not pd.isnull(row['ElopreH']):
            home_team = row['ElopreH']
            away_team = row['ElopreA']
            df.at[index, 'eloSpread'] = -(home_team - away_team + 65) / 25
    return df

def eloInit(df):
    elo_ratings = {
        "Rams": 1449.9087,
        "Bills": 1629.759771,
        "Dolphins": 1497.009399,
        "Patriots": 1510.539926,
        "Bengals": 1647.634582,
        "Steelers": 1537.130925,
        "Falcons": 1462.14432,
        "Saints": 1508.606463,
        "Jets": 1432.07461,
        "Ravens": 1524.73123,
        "Panthers": 1479.93095,
        "Browns": 1499.291349,
        "Commanders": 1491.662749,
        "Jaguars": 1512.738609,
        "Lions": 1507.596301,
        "Eagles": 1600.275889,
        "Bears": 1382.149819,
        "49ers": 1625.299697,
        "Texans": 1376.377882,
        "Colts": 1415.729243,
        "Vikings": 1520.844775,
        "Packers": 1524.074319,
        "Cardinals": 1423.047417,
        "Chiefs": 1672.680832,
        "Titans": 1464.196361,
        "Giants": 1481.237705,
        "Chargers": 1512.723623,
        "Raiders": 1478.044725,
        "Cowboys": 1586.821108,
        "Buccaneers": 1486.420688,
        "Seahawks": 1501.585071,
        "Broncos": 1417.672861,
    }

    # Update ElopreH and ElopreA columns only for week 1 games
    for index, row in df.iterrows():
        if row["Week"] == 1:
            home_team = row["Home"]
            away_team = row["Away"]
            if home_team in elo_ratings:
                df.at[index, "ElopreH"] = elo_ratings[home_team]
            if away_team in elo_ratings:
                df.at[index, "ElopreA"] = elo_ratings[away_team]
        else:
            df.at[index, "ElopreH"] = None
            df.at[index, "ElopreA"] = None
    
    return df
