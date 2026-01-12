import sys
import os
from sqlmodel import Session, select
from database import engine
from models import Horse, Race
from race_engine import RaceEngine

def verify_odds():
    print("Verifying Odds calculation...")
    
    with Session(engine) as session:
        re = RaceEngine(lambda: Session(engine))
        
        # Ensure horses exist
        re.initialize_horses()
        
        # Schedule a new race to trigger odds calculation
        re.schedule_new_race(session)
        
        # Get the latest race
        race = session.exec(select(Race).order_by(Race.id.desc())).first()
        
        if not race:
            print("ERROR: No race found.")
            return

        import json
        participants = json.loads(race.participants_snapshot)
        
        print(f"\nAnalyzing Race ID: {race.id}")
        
        implied_probs = []
        print(f"{'Horse':<10} | {'Odds':<6} | {'Implied Prob':<12}")
        print("-" * 35)
        
        for p in participants:
            odds = p['odds']
            implied_prob = 1 / odds
            implied_probs.append(implied_prob)
            print(f"{p['name']:<10} | {odds:<6.2f} | {implied_prob:<12.2%}")
            
        total_implied_prob = sum(implied_probs)
        overround = total_implied_prob * 100
        
        with open("result.txt", "w", encoding="utf-8") as f:
            f.write(f"Total Implied Probability (Overround): {overround:.2f}%\n")
            if 115 <= overround <= 120:
                f.write("SUCCESS: Overround is within expected range (approx 117.6% for 15% House Edge).\n")
            else:
                f.write(f"WARNING: Overround is {overround:.2f}%, expected approx 117.6%.\n")
                
        print("Verification complete. Check result.txt")

if __name__ == "__main__":
    verify_odds()
