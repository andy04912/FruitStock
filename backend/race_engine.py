import random
import json
import math
from datetime import datetime, timedelta
from sqlmodel import select, Session
from models import Horse, Race, Bet, User, Transaction, TransactionType, EventLog

HORSE_NAMES_PREFIX = ["超級", "閃電", "無敵", "暴風", "黃金", "赤兔", "飛天", "神速", "絕影", "快樂", "幸運", "瘋狂"]
HORSE_NAMES_SUFFIX = ["馬", "龍", "虎", "豹", "王", "星", "寶貝", "戰士", "刺客", "老爹", "小子", "旋風"]

class RaceEngine:
    def __init__(self, session_factory):
        self.session_factory = session_factory
    
    def initialize_horses(self):
        """Creates initial batch of horses if none exist."""
        with self.session_factory() as session:
            existing = session.exec(select(Horse)).first()
            if not existing:
                print("initializing Horses...")
                for _ in range(20):
                    name = f"{random.choice(HORSE_NAMES_PREFIX)}{random.choice(HORSE_NAMES_SUFFIX)}"
                    horse = Horse(
                        name=name,
                        speed=random.randint(40, 95),
                        stamina=random.randint(40, 95),
                        luck=random.randint(20, 80)
                    )
                    session.add(horse)
                    # Avoid duplicate names ideally, but random enough for now
                session.commit()

    def get_current_race(self, session: Session) -> Race:
        """Returns the active or next scheduled race."""
        # Find pending or runnning race
        statement = select(Race).where(
            Race.status.in_(["SCHEDULED", "OPEN", "CLOSED", "RUNNING"])
        ).order_by(Race.start_time.asc())
        return session.exec(statement).first()

    def schedule_new_race(self, session: Session):
        """Schedules a new race 5 minutes from now."""
        # Clean up old finished races (keep last 5 maybe?) - assume DB logic handles cleanup or we ignore
        
        horses = session.exec(select(Horse)).all()
        if len(horses) < 8:
            print("Not enough horses to race!")
            return

        participants = random.sample(horses, 8)
        
        # Calculate Odds (Simplified)
        # 1. Calculate Score = Speed + Stamina + Luck*0.2
        scores = []
        for h in participants:
            score = h.speed + h.stamina + (h.luck * 0.2)
            scores.append({"id": h.id, "score": score, "name": h.name})
        
        total_score = sum(s["score"] for s in scores)
        
        # 2. Probability = Score / Total
        # 3. Fair Odds = 1 / Probability
        # 4. House Edge = 1.15x (lower odds)
        
        snapshot = []
        for i, p in enumerate(scores):
            prob = p["score"] / total_score
            fair_odds = 1 / prob
        for i, p in enumerate(scores):
            prob = p["score"] / total_score
            fair_odds = 1 / prob
            # Adjust odds: 
            # User requested NO explicit house edge deduction (no * 0.85).
            # Odds will look "Fair" (high), but outcome will be manipulated.
            final_odds = round(fair_odds, 2)
            if final_odds < 1.01: final_odds = 1.01
            
            snapshot.append({
                "lane": i + 1,
                "horse_id": p["id"],
                "name": p["name"],
                "odds": final_odds,
                "score": p["score"] # hidden debug info
            })
        
        start_time = datetime.now() + timedelta(minutes=10) # 10 mins interval for production
        race = Race(
            start_time=start_time,
            status="OPEN", # Allow betting immediately
            participants_snapshot=json.dumps(snapshot)
        )
        session.add(race)
        session.commit()
        print(f"New Race Scheduled at {start_time}")
        
    def process_race_loop(self):
        """Called periodically (e.g. every 1s) by main loop."""
        with self.session_factory() as session:
            race = self.get_current_race(session)
            
            if not race:
                self.schedule_new_race(session)
                return

            now = datetime.now()
            
            # State Machine
            if race.status == "OPEN":
                # Close betting 20s before start
                if now >= race.start_time - timedelta(seconds=20):
                    race.status = "CLOSED"
                    session.add(race)
                    print(f"Race {race.id} Betting CLOSED.")
                    session.commit()
                    
            elif race.status == "CLOSED":
                # Start Race
                if now >= race.start_time:
                    # Start Race
                    race.status = "RUNNING"
                    print(f"Race {race.id} STARTED!")

                    # DETERMINE WINNER NOW for Frontend Animation
                    participants = json.loads(race.participants_snapshot)
                    
                    # Fetch Bets to calculate "Kill Penalty"
                    bets = session.exec(select(Bet).where(Bet.race_id == race.id)).all()
                    bet_totals = {}
                    overall_bet_total = 0
                    for bet in bets:
                        bet_totals[bet.horse_id] = bet_totals.get(bet.horse_id, 0) + bet.amount
                        overall_bet_total += bet.amount

                    # Simulate Race based on random variance around score
                    results = []
                    for p in participants:
                        # Base Score
                        base_perf = p["score"] * random.uniform(0.8, 1.2) + random.uniform(0, 20)
                        
                        # Kill Logic: Heavy Betting Penalty
                        # If a horse has > 30% of total pool, start penalizing.
                        # Penalty scales with bet amount.
                        horse_bet = bet_totals.get(p["horse_id"], 0)
                        penalty = 0
                        
                        if overall_bet_total > 0:
                            bet_ratio = horse_bet / overall_bet_total
                            if bet_ratio > 0.2: # If > 20% of money is on this horse
                                # Penalty factor: Moderate (User requested not too harsh)
                                # E.g. 50% money -> 0.5 * 50 = -25 score.
                                # Base scores are ~100-150. -25 is significant but survivable ("Bite slightly").
                                penalty = bet_ratio * 50 
                                print(f"   [Kill Logic] Horse {p['name']} has {bet_ratio*100:.1f}% of bets. Penalty: -{penalty:.1f}")
                        
                        final_perf = base_perf - penalty
                        results.append({"id": p["horse_id"], "perf": final_perf, "name": p["name"], "odds": p["odds"]})
                        
                    results.sort(key=lambda x: x["perf"], reverse=True)
                    winner = results[0]
                    race.winner_horse_id = winner["id"]
                    
                    session.add(race)
                    session.commit()
            
            elif race.status == "RUNNING":
                # Run for 45 seconds then Finish
                # We determine result NOW if we haven't already (actually we settle at finish)
                # Let's say race takes 30s
                if now >= race.start_time + timedelta(seconds=30):
                    self._finish_race(session, race)

    def _finish_race(self, session: Session, race: Race):
        print(f"Finishing Race {race.id}...")
        
        # Winner is already determined at start
        winner_id = race.winner_horse_id
        if not winner_id:
             # Fallback if somehow not set (should not happen)
             # ... copy old logic or simply fail safe
             print("Error: Winner not set for running race")
             return

        participants = json.loads(race.participants_snapshot)
        winner = next((p for p in participants if p["horse_id"] == winner_id), None)
        
        race.status = "FINISHED"
        session.add(race)
        
        # Record stats for horse
        horse = session.get(Horse, winner["horse_id"])
        if horse:
            horse.wins += 1
            horse.total_races += 1
            session.add(horse)
        
        # Update losers stats
        for p in participants:
             if p["horse_id"] == winner_id:
                 continue
             h = session.get(Horse, p["horse_id"])
             if h:
                 h.total_races += 1
                 session.add(h)
        
        # Payouts
        bets = session.exec(select(Bet).where(Bet.race_id == race.id)).all()
        total_payout = 0
        winning_bets = 0
        
        for bet in bets:
            if bet.horse_id == winner["horse_id"]:
                bet.result = "WON"
                payout = bet.amount * bet.odds
                bet.payout = payout
                
                user = session.get(User, bet.user_id)
                if user:
                    user.balance += payout
                    session.add(user)
                    print(f"   -> Payout User {user.username}: +${payout} (New Balance: {user.balance})")
                
                winning_bets += 1
                total_payout += payout
            else:
                bet.result = "LOST"
                bet.payout = 0
            session.add(bet)
            
        # Global Announcement
        # Generate Winner Names String
        winner_names = []
        for bet in bets:
            if bet.horse_id == winner["horse_id"]:
                user = session.get(User, bet.user_id)
                if user:
                     winner_names.append(user.username)
        
        # Format string with length limit
        winner_str = ""
        current_len = 0
        displayed_count = 0
        
        random.shuffle(winner_names)
        
        final_names = []
        for name in winner_names:
            if current_len + len(name) > 30:
                break
            final_names.append(name)
            current_len += len(name) + 2 # +2 for comma space
            displayed_count += 1
            
        if final_names:
            winner_str = "恭喜 " + ", ".join(final_names)
            remaining = len(winner_names) - displayed_count
            if remaining > 0:
                winner_str += f" 以及其他 {remaining} 位贏家"
        else:
            winner_str = "無人中獎"

        # Commentary based on Odds
        commentary = "精彩絕倫的比賽！"
        if winner['odds'] >= 10.0:
            commentary = "大爆冷門！誰也沒想到這匹黑馬會殺出重圍！"
        elif winner['odds'] >= 5.0:
            commentary = "令人意外的結果！這場比賽充滿了變數。"
        elif winner['odds'] <= 2.5:
            commentary = "不出意外！熱門馬展現了壓倒性的統治力。"
        elif winner['odds'] <= 4.0:
            commentary = "穩健的表現，實力馬順利奪冠。"
            
        win_msg = EventLog(
            title=f"🏇 賽馬結果: {winner['name']} 奪冠！",
            description=f"賠率 {winner['odds']} 倍。{commentary} {winner_str}！總獎金 ${total_payout:,.0f}。",
            impact_multiplier=0,
            duration_seconds=120
        )
        session.add(win_msg)
        
        session.commit()
        print(f"Race Finished. Winner: {winner['name']}. Payout: {total_payout}")
