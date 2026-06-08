from bs4 import BeautifulSoup
import json
import pandas as pd
import requests


def scheduleScraper2025():
    # Define a function to extract the last word from a string
    def lastWord(string):
        reversed_string = string[::-1]
        index = reversed_string.find(" ")
        return string[-index:] if index != -1 else string

    # ✅ Changed URL to printable version
    url = "https://www.pro-football-reference.com/years/2025/games.htm?printable=1"

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    import time
    time.sleep(3)
    response = requests.get(url, headers=headers)

    print(response.status_code)

    # Check if the request was successful (status code 200)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, "html.parser")

        tables = soup.find_all("table")

        schedule_table = None
        for table in tables:
            rows = table.find_all("tr")
            if any(len(row.find_all(["th", "td"])) >= 3 for row in rows):
                schedule_table = table
                break

        if schedule_table is not None:
            schedule_data = []
            rows = schedule_table.find_all("tr")

            for row in rows:
                columns = row.find_all(["th", "td"])
                if len(columns) >= 7:

                    week = columns[0].text.strip()

                    if week.startswith("Pre"):
                        continue
                    if week == 'WildCard':
                        week = 19
                    if week == 'Division':
                        week = 20
                    if week == 'ConfChamp':
                        week = 21
                    if week == 'SuperBowl':
                        week = 22
                    if week == "":
                        continue
                    if week != "Week":

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

            df = pd.DataFrame(schedule_data)

        else:
            print("Schedule table not found on the page.")
            return None

    else:
        print("Failed to retrieve the webpage.")
        return None

    return df