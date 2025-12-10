from eloUpdater import *
import math
import pandas as pd
import random

def simulate_game():
    score_diff = np.random.normal(elo_spread, std_dev)
    
    