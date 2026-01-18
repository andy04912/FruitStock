"""
21 點遊戲引擎
"""
import random
import json
from typing import List, Tuple, Optional
from sqlmodel import Session, select
from models import User, BlackjackRoom, BlackjackHand, BlackjackHistory

# 撲克牌定義
SUITS = ['♠', '♥', '♦', '♣']
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

class BlackjackEngine:
    def __init__(self, session_factory):
        self.session_factory = session_factory
    
    @staticmethod
    def create_deck(num_decks: int = 6) -> List[str]:
        """建立多副牌組"""
        deck = []
        for _ in range(num_decks):
            for suit in SUITS:
                for rank in RANKS:
                    deck.append(f"{rank}{suit}")
        random.shuffle(deck)
        return deck
    
    @staticmethod
    def card_value(card: str) -> int:
        """計算單張牌的值"""
        rank = card[:-1]  # 去掉花色
        if rank in ['J', 'Q', 'K']:
            return 10
        elif rank == 'A':
            return 11  # A 先算 11，後續計算時再調整
        else:
            return int(rank)
    
    @staticmethod
    def hand_value(cards: List[str]) -> Tuple[int, bool]:
        """
        計算手牌點數
        回傳 (點數, 是否軟牌)
        軟牌 = 有 A 算 11 的情況
        """
        total = 0
        aces = 0
        
        for card in cards:
            value = BlackjackEngine.card_value(card)
            if value == 11:
                aces += 1
            total += value
        
        # A 從 11 變 1 直到不爆
        soft = False
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        
        if aces > 0:
            soft = True
            
        return total, soft
    
    @staticmethod
    def is_blackjack(cards: List[str]) -> bool:
        """判斷是否為 Blackjack（前兩張 = 21）"""
        if len(cards) != 2:
            return False
        value, _ = BlackjackEngine.hand_value(cards)
        return value == 21
    
    @staticmethod
    def is_bust(cards: List[str]) -> bool:
        """判斷是否爆牌"""
        value, _ = BlackjackEngine.hand_value(cards)
        return value > 21
    
    @staticmethod
    def can_split(cards: List[str]) -> bool:
        """判斷是否可以分牌"""
        if len(cards) != 2:
            return False
        v1 = BlackjackEngine.card_value(cards[0])
        v2 = BlackjackEngine.card_value(cards[1])
        return v1 == v2
    
    @staticmethod
    def can_double(cards: List[str]) -> bool:
        """判斷是否可以雙倍（只限前兩張）"""
        return len(cards) == 2
    
    # ============ 單人遊戲 ============
    
    def start_solo_game(self, user_id: int, bet_amount: float) -> dict:
        """開始單人遊戲"""
        with self.session_factory() as session:
            user = session.get(User, user_id)
            if not user:
                return {"status": "error", "message": "用戶不存在"}
            
            if bet_amount < 1000:
                return {"status": "error", "message": "最低下注 $1,000"}
            
            if user.balance < bet_amount:
                return {"status": "error", "message": "餘額不足"}
            
            # 扣除下注金額
            user.balance -= bet_amount
            
            # 建立牌組
            deck = self.create_deck(6)
            
            # 發牌
            player_cards = [deck.pop(), deck.pop()]
            dealer_cards = [deck.pop(), deck.pop()]
            
            # 建立房間（單人用）
            room = BlackjackRoom(
                owner_id=user_id,
                name="單人遊戲",
                min_bet=bet_amount,
                max_seats=1,
                status="PLAYING",
                deck=json.dumps(deck),
                dealer_cards=json.dumps(dealer_cards)
            )
            session.add(room)
            session.flush()
            
            # 建立玩家手牌
            hand = BlackjackHand(
                room_id=room.id,
                user_id=user_id,
                seat=1,
                bet_amount=bet_amount,
                cards=json.dumps(player_cards),
                status="PLAYING"
            )
            session.add(hand)
            session.add(user)
            session.commit()
            
            player_value, _ = self.hand_value(player_cards)
            dealer_show = dealer_cards[0]  # 只顯示第一張
            
            # 檢查 Blackjack
            player_bj = self.is_blackjack(player_cards)
            
            result = {
                "status": "success",
                "room_id": room.id,
                "hand_id": hand.id,
                "player_cards": player_cards,
                "player_value": player_value,
                "dealer_show": dealer_show,
                "is_blackjack": player_bj,
                "can_double": self.can_double(player_cards),
                "can_split": self.can_split(player_cards),
                "bet_amount": bet_amount,
                "balance": user.balance
            }
            
            # 如果玩家 Blackjack，直接結算
            if player_bj:
                result = self._settle_solo_game(session, room, hand, user, force_stand=True)
            
            return result
    
    def hit(self, hand_id: int) -> dict:
        """要牌"""
        with self.session_factory() as session:
            hand = session.get(BlackjackHand, hand_id)
            if not hand or hand.status != "PLAYING":
                return {"status": "error", "message": "無效的操作"}
            
            room = session.get(BlackjackRoom, hand.room_id)
            deck = json.loads(room.deck)
            cards = json.loads(hand.cards)
            
            # 抽牌
            cards.append(deck.pop())
            hand.cards = json.dumps(cards)
            room.deck = json.dumps(deck)
            
            player_value, _ = self.hand_value(cards)
            
            result = {
                "status": "success",
                "player_cards": cards,
                "player_value": player_value,
                "can_double": False,  # 要牌後不能雙倍
                "can_split": False
            }
            
            # 檢查是否爆牌
            if self.is_bust(cards):
                hand.status = "BUST"
                result["is_bust"] = True
                user = session.get(User, hand.user_id)
                result = self._settle_solo_game(session, room, hand, user, bust=True)
            
            session.add(hand)
            session.add(room)
            session.commit()
            
            return result
    
    def stand(self, hand_id: int) -> dict:
        """停牌"""
        with self.session_factory() as session:
            hand = session.get(BlackjackHand, hand_id)
            if not hand or hand.status != "PLAYING":
                return {"status": "error", "message": "無效的操作"}
            
            room = session.get(BlackjackRoom, hand.room_id)
            user = session.get(User, hand.user_id)
            
            return self._settle_solo_game(session, room, hand, user)
    
    def double_down(self, hand_id: int) -> dict:
        """雙倍下注"""
        with self.session_factory() as session:
            hand = session.get(BlackjackHand, hand_id)
            if not hand or hand.status != "PLAYING":
                return {"status": "error", "message": "無效的操作"}
            
            cards = json.loads(hand.cards)
            if len(cards) != 2:
                return {"status": "error", "message": "只能在前兩張牌時雙倍"}
            
            user = session.get(User, hand.user_id)
            if user.balance < hand.bet_amount:
                return {"status": "error", "message": "餘額不足以雙倍"}
            
            # 加倍下注
            user.balance -= hand.bet_amount
            hand.bet_amount *= 2
            hand.is_doubled = True
            
            # 只拿一張牌
            room = session.get(BlackjackRoom, hand.room_id)
            deck = json.loads(room.deck)
            cards.append(deck.pop())
            hand.cards = json.dumps(cards)
            room.deck = json.dumps(deck)
            
            session.add(hand)
            session.add(room)
            session.add(user)
            
            # 直接結算
            return self._settle_solo_game(session, room, hand, user)
    
    def _settle_solo_game(self, session: Session, room: BlackjackRoom, hand: BlackjackHand, user: User, bust: bool = False, force_stand: bool = False) -> dict:
        """結算單人遊戲"""
        player_cards = json.loads(hand.cards)
        dealer_cards = json.loads(room.dealer_cards)
        deck = json.loads(room.deck)
        
        player_value, _ = self.hand_value(player_cards)
        player_bj = self.is_blackjack(player_cards)
        
        # 莊家補牌（17 必停）
        if not bust:
            while True:
                dealer_value, soft = self.hand_value(dealer_cards)
                if dealer_value >= 17:
                    break
                dealer_cards.append(deck.pop())
        
        dealer_value, _ = self.hand_value(dealer_cards)
        dealer_bj = self.is_blackjack(dealer_cards) if len(dealer_cards) == 2 else False
        dealer_bust = dealer_value > 21
        
        # 計算結果
        result = "LOSE"
        payout = 0
        
        if bust:
            result = "BUST"
            payout = 0
        elif player_bj and not dealer_bj:
            result = "BLACKJACK"
            payout = hand.bet_amount * 2.5  # 本金 + 1.5 倍
        elif dealer_bust:
            result = "WIN"
            payout = hand.bet_amount * 2
        elif player_value > dealer_value:
            result = "WIN"
            payout = hand.bet_amount * 2
        elif player_value == dealer_value:
            # 平局莊家贏
            result = "PUSH"
            payout = 0
        else:
            result = "LOSE"
            payout = 0
        
        # 更新資料
        hand.status = result
        hand.payout = payout
        user.balance += payout
        room.status = "FINISHED"
        room.dealer_cards = json.dumps(dealer_cards)
        
        # 記錄歷史
        history = BlackjackHistory(
            user_id=user.id,
            room_id=room.id,
            bet_amount=hand.bet_amount,
            result=result,
            payout=payout,
            player_cards=json.dumps(player_cards),
            dealer_cards=json.dumps(dealer_cards)
        )
        session.add(history)
        session.add(hand)
        session.add(room)
        session.add(user)
        session.commit()
        
        return {
            "status": "finished",
            "result": result,
            "player_cards": player_cards,
            "player_value": player_value,
            "dealer_cards": dealer_cards,
            "dealer_value": dealer_value,
            "bet_amount": hand.bet_amount,
            "payout": payout,
            "balance": user.balance
        }
    
    # ============ 多人房間 ============
    
    def create_room(self, user_id: int, name: str, min_bet: float, max_bet: Optional[float], max_seats: int) -> dict:
        """開設牌桌"""
        with self.session_factory() as session:
            user = session.get(User, user_id)
            if not user:
                return {"status": "error", "message": "用戶不存在"}
            
            if min_bet < 1000:
                min_bet = 1000
            
            if max_seats < 1 or max_seats > 6:
                max_seats = 6
            
            room = BlackjackRoom(
                owner_id=user_id,
                name=name[:32],
                min_bet=min_bet,
                max_bet=max_bet,
                max_seats=max_seats,
                status="WAITING",
                deck=json.dumps(self.create_deck(6))
            )
            session.add(room)
            session.commit()
            
            return {
                "status": "success",
                "room_id": room.id,
                "name": room.name,
                "min_bet": room.min_bet,
                "max_bet": room.max_bet,
                "max_seats": room.max_seats
            }
    
    def get_rooms(self) -> list:
        """取得房間列表"""
        with self.session_factory() as session:
            rooms = session.exec(
                select(BlackjackRoom).where(
                    BlackjackRoom.status.in_(["WAITING", "BETTING"])
                ).order_by(BlackjackRoom.created_at.desc())
            ).all()
            
            result = []
            for room in rooms:
                # 計算在座人數
                hands = session.exec(
                    select(BlackjackHand).where(
                        BlackjackHand.room_id == room.id
                    )
                ).all()
                
                owner = session.get(User, room.owner_id)
                
                result.append({
                    "id": room.id,
                    "name": room.name,
                    "owner": owner.nickname or owner.username if owner else "Unknown",
                    "min_bet": room.min_bet,
                    "max_bet": room.max_bet,
                    "seats": len(hands),
                    "max_seats": room.max_seats,
                    "status": room.status
                })
            
            return result
    
    def get_history(self, user_id: int, limit: int = 20) -> list:
        """取得玩家歷史紀錄"""
        with self.session_factory() as session:
            histories = session.exec(
                select(BlackjackHistory).where(
                    BlackjackHistory.user_id == user_id
                ).order_by(BlackjackHistory.created_at.desc()).limit(limit)
            ).all()
            
            return [{
                "id": h.id,
                "bet_amount": h.bet_amount,
                "result": h.result,
                "payout": h.payout,
                "player_cards": json.loads(h.player_cards),
                "dealer_cards": json.loads(h.dealer_cards),
                "created_at": h.created_at.isoformat()
            } for h in histories]
