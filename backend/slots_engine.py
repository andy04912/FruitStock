import random
import json
from sqlmodel import Session, select
from models import User, SlotSpin, EventLog

# Symbols and their weights (Frequency on a virtual reel strip)
# Total weight = sum of all weights
# RTP Theoretical needs to be tuned.
# Payout is for 3 of a kind.

# Symbol Definitions
S_7 = "7️⃣"
S_DIAMOND = "💎"
S_BELL = "🔔"
S_GRAPE = "🍇"
S_LEMON = "🍋"
S_CHERRY = "🍒"
S_BAR = "➖"

SYMBOLS = [S_7, S_DIAMOND, S_BELL, S_GRAPE, S_LEMON, S_CHERRY, S_BAR]

# Weights (Probabilities)
# Total Weight = 100 roughly for easy calc
# Tuning for ~90-95% RTP
WEIGHTS = {
    S_7: 2,       # Very Rare
    S_DIAMOND: 4, # Rare
    S_BELL: 8,    
    S_BAR: 12,
    S_GRAPE: 18,
    S_LEMON: 24,
    S_CHERRY: 32  # Common
}

# Paytable (Multipliers) for 3-of-a-kind (except Cherry)
PAYTABLE = {
    f"{S_7}-{S_7}-{S_7}": 150,     # Was 100
    f"{S_DIAMOND}-{S_DIAMOND}-{S_DIAMOND}": 80, # Was 50
    f"{S_BELL}-{S_BELL}-{S_BELL}": 40,   # Was 20
    f"{S_BAR}-{S_BAR}-{S_BAR}": 25,    # Was 15
    f"{S_GRAPE}-{S_GRAPE}-{S_GRAPE}": 18,  # Was 10
    f"{S_LEMON}-{S_LEMON}-{S_LEMON}": 12,  # Was 5
    f"{S_CHERRY}-{S_CHERRY}-{S_CHERRY}": 5, # Was 3
}

# Special handling for Cherry: 
# 2 Cherries (any position) = 1x
# But we simplify to: Any 2 matching cherries? No, standard slot logic is usually left-to-right or any.
# Let's do: 
# 3 of a kind -> Paytable
# Any 2 Cherries -> 2x (Overrides 3x if logic fails, but 3x is higher)
# Actually commonly: 2 Cherries on Line 1 -> Payout.
# We only have ONE line (center line).

class SlotsEngine:
    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.reel_strip = []
        for sym, weight in WEIGHTS.items():
            self.reel_strip.extend([sym] * weight)
            
    def _spin_reel(self):
        return random.choice(self.reel_strip)

    def calculate_payout(self, symbols, bet):
        # symbols: list of 3 strings
        combo = f"{symbols[0]}-{symbols[1]}-{symbols[2]}"
        
        multiplier = 0
        win_type = "MISS"
        
        # 1. Check exact 3-of-a-kind
        if combo in PAYTABLE:
            multiplier = PAYTABLE[combo]
            win_type = "BIG_WIN" if multiplier >= 20 else "WIN"
        
        # 2. Check 2 Cherries or 1 Cherry (Simple low pay)
        # Classic usually: 1 Cherry (leftmost) = 2x, 2 Cherries = 5x?
        # Let's do: Count cherries
        elif symbols.count(S_CHERRY) == 2:
            multiplier = 2.0 # Was 1.0
            win_type = "SMALL_WIN"
        elif symbols.count(S_CHERRY) == 3: 
             # Should match PAYTABLE above (3x), but just in case
             pass
        
        # 3. Any 3 Mixed Bars/Fruits? (Simplification: No)
        
        total_payout = bet * multiplier
        return total_payout, win_type, multiplier

    def spin(self, user_id: int, bet_amount: float):
        if bet_amount <= 0:
            raise ValueError("Bet amount must be positive")
            
        with self.session_factory() as session:
            user = session.get(User, user_id)
            if not user:
                raise ValueError("User not found")
            
            if user.balance < bet_amount:
                raise ValueError("Insufficient funds")
                
            # Deduct bet
            user.balance -= bet_amount
            
            # Spin!
            s1 = self._spin_reel()
            s2 = self._spin_reel()
            s3 = self._spin_reel()
            symbols = [s1, s2, s3]
            
            payout, win_type, mult = self.calculate_payout(symbols, bet_amount)
            
            # Credit win
            if payout > 0:
                user.balance += payout
                
            # TRIGGER NEWS ON BIG WIN
            if win_type == "BIG_WIN":
                news = EventLog(
                    title="🎉 老虎機大獎報喜！",
                    description=f"幸運玩家 {user.username} 剛剛在老虎機中了 {mult:.0f} 倍大獎，贏得 ${payout:,.0f}！",
                    impact_multiplier=0, # No market impact, just news
                    duration_seconds=120
                )
                session.add(news)
                print(f"   [SlotMachine] Big Win News Triggered for {user.username} (${payout})")

            # Record
            spin_record = SlotSpin(
                user_id=user.id,
                bet_amount=bet_amount,
                payout=payout,
                result_symbols=json.dumps(symbols)
            )
            session.add(spin_record)
            session.add(user)
            session.commit()
            session.refresh(spin_record)
            
            return {
                "symbols": symbols,
                "payout": payout,
                "multiplier": mult,
                "new_balance": user.balance,
                "win_type": win_type
            }
