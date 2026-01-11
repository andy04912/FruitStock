import sys
import os
from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Horse, Race, Bet
from race_engine import RaceEngine

def verify():
    print("1. Creating Tables...")
    create_db_and_tables()
    
    with Session(engine) as session:
        print("2. Checking Horses...")
        re = RaceEngine(lambda: Session(engine))
        re.initialize_horses()
        
        horses = session.exec(select(Horse)).all()
        print(f"   Found {len(horses)} horses.")
        if len(horses) == 0:
            print("   ERROR: No horses created!")
            return
            
        print("3. Scheduling Race...")
        re.schedule_new_race(session)
        
        race = re.get_current_race(session)
        if race:
            print(f"   Race Scheduled! ID: {race.id}, Status: {race.status}, Start: {race.start_time}")
            print("   Participants Snapshot found:", bool(race.participants_snapshot))
        else:
            print("   ERROR: Failed to schedule race.")
            return

        print("4. Verification Successful!")

if __name__ == "__main__":
    verify()
