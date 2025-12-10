import requests
from bs4 import BeautifulSoup
import json
import pandas as pd

def scheduleScraper():
    # Define a function to extract the last word from a string
    def lastWord(string):
        # reversing the string
        reversed_string = string[::-1]
        # finding the index of first space in reversed string
        index = reversed_string.find(" ")
        # returning the last word in original string
        return string[-index:]

    # URL of the NFL 2023 schedule page
    url = "https://www.pro-football-reference.com/years/2023/games.htm"

    # Send an HTTP GET request to the URL
    response = requests.get(url)

    # Check if the request was successful (status code 200)
    if response.status_code == 200:
        # Parse the HTML content of the page using BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")

        # Find all HTML tables on the page
        tables = soup.find_all("table")

        # Loop through the tables and look for one that resembles the schedule table
        schedule_table = None
        for table in tables:
            # Check if the table contains rows with at least 3 columns (typical for a schedule table)
            rows = table.find_all("tr")
            if any(len(row.find_all(["th", "td"])) >= 3 for row in rows):
                schedule_table = table
                break

        # If the schedule table is found, collect specific columns (week, day, date, time, team names)
        if schedule_table is not None:
            schedule_data = []
            rows = schedule_table.find_all("tr")
            for row in rows:
                columns = row.find_all(["th", "td"])
                if len(columns) >= 7:  # Ensure there are enough columns for the data you need
                    week = columns[0].text.strip()
                    if week == 'WildCard':
                        week = 19
                    if week == 'Division':
                        week = 20
                    if week == 'ConfChamp':
                        week = 21
                    if week == 'SuperBowl':
                        week = 22
                    if week == '':
                        week = 19
                    
                    if week != "Week":  # Exclude rows where Week is "Week"
                        day = columns[1].text.strip()
                        date = columns[2].text.strip()
                        time = columns[3].text.strip()
                        at = columns[5].text.strip()
                        if at == "@":
                            team_names1 = lastWord(columns[6].text.strip())
                            team_names2 = lastWord(columns[4].text.strip())
                            
                            try:
                                scoreA = int(columns[8].text.strip())
                            except:
                                scoreA = None

                            try:
                                scoreH = int(columns[9].text.strip())
                            except:
                                scoreH = None
                        else: 
                            team_names1 = lastWord(columns[4].text.strip())
                            team_names2 = lastWord(columns[6].text.strip())

                            try:
                                scoreA = int(columns[9].text.strip())
                            except:
                                scoreA = None

                            try:
                                scoreH = int(columns[8].text.strip())
                            except:
                                scoreH = None

                        game_data = {
                            "Week": float(week),
                            "Day": day,
                            "Date": date,
                            "Time": time,
                            "Home": team_names1,
                            "Away": team_names2,
                            "ScoreH": scoreH,  
                            "ScoreA": scoreA,
                            "ElopreH": None,
                            "ElopreA": None,
                            "ElopostH": None,
                            "ElopostA": None,
                            "probH": None,
                            "probA": None,
                            "eloSpread": None
                        }
                        schedule_data.append(game_data)

            # Create a Pandas DataFrame from the collected data
            df = pd.DataFrame(schedule_data)
            # Serialize the collected data as a JSON file
            # with open("nfl_schedule.json", "w") as json_file:
            #     json.dump(schedule_data, json_file, indent=2)

        else:
            print("Schedule table not found on the page.")
    else:
        print("Failed to retrieve the webpage.")

    return df
