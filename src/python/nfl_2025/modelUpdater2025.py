from eloUpdater2025 import *
from scheduleScraper2025 import *
import os

nflModel = scheduleScraper2025()
nflModel = eloInit2025(nflModel)
nflModel = update_win_prob_2025(nflModel)

currentWeek = 15

for i in range(1, currentWeek):
    nflModel = update_post_elos(nflModel)
    nflModel = transfer_post_to_pre(nflModel, i + 1)
    nflModel = update_win_prob_2025(nflModel)

nflModel = update_home_elo_spread(nflModel)

directory_path = "/Users/sebygarza/documents/portfolio/eggmodels/src/python/nfl_2025"

# Convert the DataFrame to JSON
json_data = nflModel.to_json(orient='records')

file_path = os.path.join(directory_path, 'nflModel2025.json')

# Save the JSON data to a file
with open(file_path, 'w') as file:
    file.write(json_data)