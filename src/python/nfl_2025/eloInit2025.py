import json

def eloInit25():
    # Initialize the teams with Elo rating of 0
    eloInit = [('Rams', 0), ('Bills', 0), ('Dolphins', 0), ('Patriots', 0), ('Bengals', 0),
            ('Steelers', 0), ('Falcons', 0), ('Saints', 0), ('Jets', 0), ('Ravens', 0),
            ('Panthers', 0), ('Browns', 0), ('Commanders', 0), ('Jaguars', 0),
            ('Lions', 0), ('Eagles', 0), ('Bears', 0), ('49ers', 0), ('Texans', 0),
            ('Colts', 0), ('Vikings', 0), ('Packers', 0), ('Cardinals', 0),
            ('Chiefs', 0), ('Titans', 0), ('Giants', 0), ('Chargers', 0),
            ('Raiders', 0), ('Cowboys', 0), ('Buccaneers', 0), ('Seahawks', 0),
            ('Broncos', 0)]

    # Load the JSON data from the file
    import os
    _dir = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(_dir, 'nflModel2024.json'), 'r') as file:
        data = json.load(file)

    # Create a dictionary for easy lookup of the initial Elo ratings
    elo_dict = dict(eloInit)

    # Loop through the data backwards to find the most recent Elo ratings
    for game in reversed(data):
        # Skip entries that are not actual games (like Playoffs placeholders)
        if game['Home'] and game['Away']:
            # Update the Elo ratings if they haven't been updated yet
            if elo_dict[game['Home']] == 0:
                elo_dict[game['Home']] = game['ElopostH']
            if elo_dict[game['Away']] == 0:
                elo_dict[game['Away']] = game['ElopostA']

    # Convert the dictionary back to a list of tuples

    # Print the updated Elo ratings
    return elo_dict