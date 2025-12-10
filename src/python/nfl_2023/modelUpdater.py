from eloUpdater import *
from scrapeFR import *
from playoffLogic import *
import os

nflModel = scheduleScraper()
nflModel = eloInit(nflModel)
nflModel = update_win_prob(nflModel)

currentWeek = 23

for i in range(1, currentWeek):
    nflModel = update_post_elos(nflModel)
    nflModel = transfer_post_to_pre(nflModel, i + 1)
    nflModel = update_win_prob(nflModel)
    
nflModel = update_home_elo_spread(nflModel)

directory_path = "/Users/sebygarza/documents/portfolio/eggmodels/src/python"

# Convert the DataFrame to JSON
json_data = nflModel.to_json(orient='records')

file_path = os.path.join(directory_path, 'nflModel.json')

# Save the JSON data to a file
with open(file_path, 'w') as file:
    file.write(json_data)

## Playoffs

# Main execution
file_path = 'src/python/nflModel.json'
data = load_game_data(file_path)
results = compute_team_records(data)
afc_playoffs, nfc_playoffs = select_playoff_teams(results, data)

# Save playoff teams to a JSON file in the same location as the script
script_directory = os.path.dirname(os.path.realpath(__file__))
playoffs_file_path = os.path.join(script_directory, 'playoffs.json')

playoffs_data = {
    "AFC": afc_playoffs,
    "NFC": nfc_playoffs
}

with open(playoffs_file_path, 'w') as playoffs_file:
    json.dump(playoffs_data, playoffs_file, indent=2)