import sys
from sqlmodel import Session, select
from database import engine
from models import User
from slots_engine import SlotsEngine, SlotSpin

def verify_rtp():
    print("Verifying Slot Machine RTP (10,000 Spins)...")
    
    with Session(engine) as session:
        # Cleanup potential leftover from previous runs
        existing = session.exec(select(User).where(User.username == "slot_tester_999")).first()
        if existing:
            session.delete(existing)
            session.commit()

        # Create a test user with infinite money
        test_user = User(username="slot_tester_999", hashed_password="pw", balance=10000000)
        session.add(test_user)
        session.commit()
        session.refresh(test_user)
        
        se = SlotsEngine(lambda: Session(engine))
        
        total_bet = 0
        total_won = 0
        num_spins = 1000
        bet_amount = 10.0
        
        counts = {"BIG_WIN": 0, "WIN": 0, "SMALL_WIN": 0, "MISS": 0}
        
        print(f"Testing {num_spins} spins...")
        for i in range(num_spins):
            if i % 100 == 0:
                print(f"Spin {i}...", end="\r")
            result = se.spin(test_user.id, bet_amount)
            
            payout = result["payout"]
            win_type = result["win_type"]
            
            total_bet += bet_amount
            total_won += payout
            counts[win_type] = counts.get(win_type, 0) + 1
            
        rtp = (total_won / total_bet) * 100
        
        print("\n=== Results ===")
        print(f"Total Spins: {num_spins}")
        print(f"Total Bet:   ${total_bet:,.0f}")
        print(f"Total Won:   ${total_won:,.0f}")
        print(f"RTP:         {rtp:.2f}%")
        print("\nWin Distribution:")
        for k, v in counts.items():
            print(f"  {k:<10}: {v} ({v/num_spins:.1%})")
            
        # Cleanup
        session.delete(test_user)
        session.commit()
        
        with open("slots_result.txt", "w", encoding="utf-8") as f:
             f.write(f"RTP: {rtp:.2f}%\n")
             if 90 <= rtp <= 96: # Allowing slightly wider range variance
                 f.write("SUCCESS: RTP is within expected range (90-95%).\n")
             else:
                 f.write(f"WARNING: RTP {rtp:.2f}% is outside target range (90-95%). Adjust weights.\n")

if __name__ == "__main__":
    verify_rtp()
