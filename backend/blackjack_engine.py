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
            # 平局退還本金
            result = "PUSH"
            payout = hand.bet_amount
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
    
    def create_room(self, user_id: int, name: str, min_bet: float, max_bet: Optional[float], max_seats: int, player_dealer: bool = False) -> dict:
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
                dealer_seat=1 if player_dealer else 0,  # 1=房主當莊，0=系統當莊
                status="WAITING",
                deck=json.dumps(self.create_deck(6))
            )
            session.add(room)
            session.flush()
            
            # 房主自動加入座位 1
            owner_hand = BlackjackHand(
                room_id=room.id,
                user_id=user_id,
                seat=1,
                status="DEALER" if player_dealer else "WAITING"  # 當莊則標記為 DEALER
            )
            session.add(owner_hand)
            session.commit()
            
            return {
                "status": "success",
                "room_id": room.id,
                "name": room.name,
                "min_bet": room.min_bet,
                "max_bet": room.max_bet,
                "max_seats": room.max_seats,
                "dealer_seat": room.dealer_seat,
                "seat": 1,
                "hand_id": owner_hand.id
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
    
    def get_my_room(self, user_id: int) -> dict:
        """取得用戶當前所在房間"""
        with self.session_factory() as session:
            # 找用戶在哪個房間中
            hand = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.user_id == user_id,
                    BlackjackHand.status.in_(["WAITING", "BETTING", "PLAYING", "DEALER"])
                )
            ).first()
            
            if not hand:
                return {"status": "success", "room_id": None}
            
            return {"status": "success", "room_id": hand.room_id}
    
    # ============ 多人房間遊戲 ============
    
    def join_room(self, user_id: int, room_id: int) -> dict:
        """加入房間"""
        with self.session_factory() as session:
            user = session.get(User, user_id)
            room = session.get(BlackjackRoom, room_id)
            
            if not room:
                return {"status": "error", "message": "房間不存在"}
            
            if room.status not in ["WAITING", "BETTING"]:
                return {"status": "error", "message": "房間已開始遊戲"}
            
            # 檢查是否已在房間（包含 DEALER 狀態）
            existing = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id,
                    BlackjackHand.user_id == user_id,
                    BlackjackHand.status.in_(["WAITING", "BETTING", "PLAYING", "DEALER"])
                )
            ).first()

            if existing:
                return {"status": "error", "message": "你已在房間中"}

            # 計算座位（包含 DEALER 狀態，避免分配到莊家座位）
            hands = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id,
                    BlackjackHand.status.in_(["WAITING", "BETTING", "PLAYING", "DEALER"])
                )
            ).all()
            
            if len(hands) >= room.max_seats:
                return {"status": "error", "message": "房間已滿"}
            
            # 找到空位
            taken_seats = {h.seat for h in hands}
            seat = 1
            for i in range(1, room.max_seats + 1):
                if i not in taken_seats:
                    seat = i
                    break
            
            hand = BlackjackHand(
                room_id=room_id,
                user_id=user_id,
                seat=seat,
                status="WAITING"
            )
            session.add(hand)
            session.commit()
            
            return {
                "status": "success",
                "seat": seat,
                "hand_id": hand.id
            }
    
    def leave_room(self, user_id: int, room_id: int) -> dict:
        """離開房間"""
        with self.session_factory() as session:
            # 允許任何狀態離開
            hand = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id,
                    BlackjackHand.user_id == user_id
                )
            ).first()
            
            if not hand:
                return {"status": "error", "message": "你不在房間中"}
            
            session.delete(hand)
            session.flush()
            
            # 檢查房間是否還有人（包含所有狀態）
            remaining = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id
                )
            ).all()
            
            if len(remaining) == 0:
                # 沒人了，刪除房間
                room = session.get(BlackjackRoom, room_id)
                if room:
                    session.delete(room)
            
            session.commit()
            
            return {"status": "success"}
    
    def place_bet(self, user_id: int, room_id: int, bet_amount: float) -> dict:
        """多人模式下注"""
        with self.session_factory() as session:
            user = session.get(User, user_id)
            room = session.get(BlackjackRoom, room_id)
            
            if not room or room.status not in ["WAITING", "BETTING"]:
                return {"status": "error", "message": "無法下注"}
            
            if bet_amount < room.min_bet:
                return {"status": "error", "message": f"最低下注 ${room.min_bet}"}
            
            if room.max_bet and bet_amount > room.max_bet:
                return {"status": "error", "message": f"最高下注 ${room.max_bet}"}
            
            if user.balance < bet_amount:
                return {"status": "error", "message": "餘額不足"}
            
            hand = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id,
                    BlackjackHand.user_id == user_id,
                    BlackjackHand.status.in_(["WAITING", "BETTING"])
                )
            ).first()
            
            if not hand:
                return {"status": "error", "message": "請先加入房間"}
            
            # 扣款
            user.balance -= bet_amount
            hand.bet_amount = bet_amount
            hand.status = "BETTING"
            
            # 更新房間狀態
            room.status = "BETTING"
            
            session.add(user)
            session.add(hand)
            session.add(room)
            session.commit()
            
            # 檢查是否所有非莊家玩家都已下注，自動發牌
            auto_start = self._check_auto_start(room_id)
            
            return {
                "status": "success",
                "bet_amount": bet_amount,
                "balance": user.balance,
                "auto_started": auto_start
            }
    
    def _check_auto_start(self, room_id: int) -> bool:
        """檢查是否所有人都下注完畢，自動開始"""
        with self.session_factory() as session:
            room = session.get(BlackjackRoom, room_id)
            if not room or room.status != "BETTING":
                return False

            # 取得所有手牌
            hands = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id
                )
            ).all()

            # 排除莊家座位
            non_dealer_hands = [h for h in hands if h.seat != room.dealer_seat]

            # 檢查是否所有非莊家玩家都已下注
            all_bet = all(h.status == "BETTING" for h in non_dealer_hands)

            if all_bet and len(non_dealer_hands) > 0:
                # 自動開始發牌
                return self._auto_start_round(session, room, hands)

            return False
    
    def _auto_start_round(self, session: Session, room: BlackjackRoom, hands: list) -> bool:
        """自動發牌"""
        # 重建牌組
        deck = self.create_deck(6)

        # 發莊家牌
        dealer_cards = [deck.pop(), deck.pop()]

        # 發玩家牌（跳過莊家座位）
        betting_hands = []
        for hand in hands:
            if hand.seat == room.dealer_seat:
                # 玩家當莊，不發牌給莊家
                continue
            if hand.status == "BETTING":
                cards = [deck.pop(), deck.pop()]
                hand.cards = json.dumps(cards)
                hand.status = "PLAYING"
                session.add(hand)
                betting_hands.append(hand)

        if len(betting_hands) == 0:
            return False

        # 按座位號排序，確保從最小座位號開始
        betting_hands.sort(key=lambda h: h.seat)

        room.deck = json.dumps(deck)
        room.dealer_cards = json.dumps(dealer_cards)
        room.status = "PLAYING"
        room.current_seat = betting_hands[0].seat

        session.add(room)
        session.commit()

        return True
    
    def get_room_state(self, room_id: int) -> dict:
        """取得房間完整狀態"""
        with self.session_factory() as session:
            room = session.get(BlackjackRoom, room_id)
            if not room:
                return {"status": "error", "message": "房間不存在"}
            
            # 取得所有玩家手牌
            hands = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id
                ).order_by(BlackjackHand.seat)
            ).all()
            
            players = []
            for hand in hands:
                user = session.get(User, hand.user_id)
                cards = json.loads(hand.cards) if hand.cards else []
                value, _ = self.hand_value(cards) if cards else (0, False)
                
                players.append({
                    "seat": hand.seat,
                    "user_id": hand.user_id,
                    "username": user.nickname or user.username if user else "Unknown",
                    "bet_amount": hand.bet_amount,
                    "cards": cards,
                    "value": value,
                    "status": hand.status,
                    "hand_id": hand.id,
                    "payout": hand.payout
                })
            
            dealer_cards = json.loads(room.dealer_cards) if room.dealer_cards else []
            dealer_value, _ = self.hand_value(dealer_cards) if dealer_cards else (0, False)
            
            owner = session.get(User, room.owner_id)
            
            return {
                "status": "success",
                "room": {
                    "id": room.id,
                    "name": room.name,
                    "owner": owner.nickname or owner.username if owner else "Unknown",
                    "owner_id": room.owner_id,
                    "min_bet": room.min_bet,
                    "max_bet": room.max_bet,
                    "max_seats": room.max_seats,
                    "dealer_seat": room.dealer_seat,
                    "status": room.status,
                    "current_seat": room.current_seat,
                    "dealer_cards": dealer_cards,
                    "dealer_value": dealer_value if room.status == "FINISHED" else None
                },
                "players": players
            }
    
    def start_round(self, room_id: int, owner_id: int) -> dict:
        """房主開始發牌"""
        with self.session_factory() as session:
            room = session.get(BlackjackRoom, room_id)
            
            if not room:
                return {"status": "error", "message": "房間不存在"}
            
            if room.owner_id != owner_id:
                return {"status": "error", "message": "只有房主可以開始"}
            
            if room.status != "BETTING":
                return {"status": "error", "message": "等待玩家下注"}
            
            # 取得已下注玩家
            hands = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id,
                    BlackjackHand.status == "BETTING"
                ).order_by(BlackjackHand.seat)
            ).all()
            
            if len(hands) == 0:
                return {"status": "error", "message": "沒有玩家下注"}
            
            # 重建牌組
            deck = self.create_deck(6)
            
            # 發牌
            dealer_cards = [deck.pop(), deck.pop()]
            
            for hand in hands:
                cards = [deck.pop(), deck.pop()]
                hand.cards = json.dumps(cards)
                hand.status = "PLAYING"
                session.add(hand)
            
            room.deck = json.dumps(deck)
            room.dealer_cards = json.dumps(dealer_cards)
            room.status = "PLAYING"
            room.current_seat = hands[0].seat
            
            session.add(room)
            session.commit()
            
            return self.get_room_state(room_id)
    
    def multi_hit(self, hand_id: int, user_id: int) -> dict:
        """多人模式要牌"""
        with self.session_factory() as session:
            hand = session.get(BlackjackHand, hand_id)

            if not hand or hand.user_id != user_id:
                return {"status": "error", "message": "無效操作"}

            if hand.status != "PLAYING":
                return {"status": "error", "message": "不是你的回合"}

            room = session.get(BlackjackRoom, hand.room_id)
            if room.current_seat != hand.seat:
                return {"status": "error", "message": "不是你的回合"}

            deck = json.loads(room.deck)
            cards = json.loads(hand.cards)

            cards.append(deck.pop())
            hand.cards = json.dumps(cards)
            room.deck = json.dumps(deck)

            value, _ = self.hand_value(cards)

            if value > 21:
                hand.status = "BUST"
                # 如果是莊家 bust，直接結算
                if hand.seat == room.dealer_seat:
                    self._settle_multi_game(session, room)
                else:
                    self._advance_turn(session, room, hand)

            session.add(hand)
            session.add(room)
            session.commit()

            return self.get_room_state(hand.room_id)
    
    def multi_stand(self, hand_id: int, user_id: int) -> dict:
        """多人模式停牌"""
        with self.session_factory() as session:
            hand = session.get(BlackjackHand, hand_id)

            if not hand or hand.user_id != user_id:
                return {"status": "error", "message": "無效操作"}

            if hand.status != "PLAYING":
                return {"status": "error", "message": "不是你的回合"}

            room = session.get(BlackjackRoom, hand.room_id)
            if room.current_seat != hand.seat:
                return {"status": "error", "message": "不是你的回合"}

            hand.status = "STAND"

            # 如果是莊家 stand，直接結算
            if hand.seat == room.dealer_seat:
                self._settle_multi_game(session, room)
            else:
                self._advance_turn(session, room, hand)

            session.add(hand)
            session.add(room)
            session.commit()
            
            return self.get_room_state(hand.room_id)
    
    def multi_double(self, hand_id: int, user_id: int) -> dict:
        """多人模式雙倍下注"""
        with self.session_factory() as session:
            hand = session.get(BlackjackHand, hand_id)
            user = session.get(User, user_id)
            
            if not hand or hand.user_id != user_id:
                return {"status": "error", "message": "無效操作"}
            
            if hand.status != "PLAYING":
                return {"status": "error", "message": "不是你的回合"}
            
            room = session.get(BlackjackRoom, hand.room_id)
            if room.current_seat != hand.seat:
                return {"status": "error", "message": "不是你的回合"}
            
            # 檢查是否只有兩張牌（只有首次可以 double）
            cards = json.loads(hand.cards) if hand.cards else []
            if len(cards) != 2:
                return {"status": "error", "message": "只能在首次行動時雙倍"}
            
            # 檢查餘額
            if user.balance < hand.bet_amount:
                return {"status": "error", "message": "餘額不足"}
            
            # 加倍下注
            user.balance -= hand.bet_amount
            hand.bet_amount *= 2
            hand.is_doubled = True
            
            # 只發一張牌
            deck = json.loads(room.deck)
            cards.append(deck.pop())
            room.deck = json.dumps(deck)
            hand.cards = json.dumps(cards)
            
            # 計算點數
            value, _ = self.hand_value(cards)
            
            if value > 21:
                hand.status = "BUST"
                self._advance_turn(session, room, hand)
            else:
                # Double 後自動停牌
                hand.status = "STAND"
                self._advance_turn(session, room, hand)
            
            session.add(user)
            session.add(hand)
            session.add(room)
            session.commit()
            
            return self.get_room_state(hand.room_id)
    
    def _advance_turn(self, session: Session, room: BlackjackRoom, current_hand: BlackjackHand):
        """進入下一位玩家回合或結算"""
        # 找下一位 PLAYING 的玩家（排除莊家座位）
        hands = session.exec(
            select(BlackjackHand).where(
                BlackjackHand.room_id == room.id,
                BlackjackHand.status == "PLAYING",
                BlackjackHand.seat != room.dealer_seat
            ).order_by(BlackjackHand.seat)
        ).all()

        next_hand = None
        for h in hands:
            if h.seat > current_hand.seat:
                next_hand = h
                break

        if next_hand:
            room.current_seat = next_hand.seat
        else:
            # 所有非莊家玩家完成
            if room.dealer_seat > 0:
                # 玩家當莊：輪到莊家操作
                dealer_hand = session.exec(
                    select(BlackjackHand).where(
                        BlackjackHand.room_id == room.id,
                        BlackjackHand.seat == room.dealer_seat
                    )
                ).first()
                if dealer_hand:
                    dealer_hand.status = "PLAYING"
                    # 發牌給莊家（如果還沒發）
                    if not dealer_hand.cards or dealer_hand.cards == "[]":
                        deck = json.loads(room.deck)
                        dealer_cards = json.loads(room.dealer_cards)
                        dealer_hand.cards = json.dumps(dealer_cards)
                        room.deck = json.dumps(deck)
                    session.add(dealer_hand)
                    room.current_seat = room.dealer_seat
            else:
                # 系統當莊：自動結算
                self._settle_multi_game(session, room)
    
    def _settle_multi_game(self, session: Session, room: BlackjackRoom):
        """多人遊戲結算"""
        deck = json.loads(room.deck)
        dealer_cards = json.loads(room.dealer_cards)

        if room.dealer_seat > 0:
            # 玩家當莊：使用莊家玩家的手牌
            dealer_hand = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room.id,
                    BlackjackHand.seat == room.dealer_seat
                )
            ).first()
            if dealer_hand and dealer_hand.cards:
                dealer_cards = json.loads(dealer_hand.cards)
            # 更新莊家手牌狀態
            if dealer_hand:
                dealer_hand.status = "STAND"
                session.add(dealer_hand)
        else:
            # 系統當莊：自動補牌到 17
            while True:
                dealer_value, _ = self.hand_value(dealer_cards)
                if dealer_value >= 17:
                    break
                dealer_cards.append(deck.pop())

        dealer_value, _ = self.hand_value(dealer_cards)
        dealer_bust = dealer_value > 21

        room.dealer_cards = json.dumps(dealer_cards)
        room.deck = json.dumps(deck)
        room.status = "FINISHED"
        room.current_seat = 0

        # 取得莊家玩家（如果是玩家當莊）
        dealer_user = None
        if room.dealer_seat > 0:
            dealer_hand = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room.id,
                    BlackjackHand.seat == room.dealer_seat
                )
            ).first()
            if dealer_hand:
                dealer_user = session.get(User, dealer_hand.user_id)

        # 結算每位玩家（排除莊家座位）
        hands = session.exec(
            select(BlackjackHand).where(
                BlackjackHand.room_id == room.id,
                BlackjackHand.status.in_(["STAND", "BUST", "BLACKJACK"]),
                BlackjackHand.seat != room.dealer_seat
            )
        ).all()

        for hand in hands:
            user = session.get(User, hand.user_id)
            player_cards = json.loads(hand.cards)
            player_value, _ = self.hand_value(player_cards)
            player_bj = self.is_blackjack(player_cards)

            result = "LOSE"
            payout = 0

            if hand.status == "BUST":
                result = "BUST"
                payout = 0  # 明確設定爆牌沒有賠付
            elif player_bj:
                result = "BLACKJACK"
                payout = hand.bet_amount * 2.5
            elif dealer_bust:
                result = "WIN"
                payout = hand.bet_amount * 2
            elif player_value > dealer_value:
                result = "WIN"
                payout = hand.bet_amount * 2
            elif player_value == dealer_value:
                result = "PUSH"
                payout = hand.bet_amount  # 平局退還本金
            else:
                result = "LOSE"
                payout = 0  # 明確設定輸了沒有賠付

            hand.status = result
            hand.payout = payout

            # 資金流處理
            if dealer_user:
                # 玩家當莊：玩家與莊家之間轉移
                if result in ["WIN", "BLACKJACK"]:
                    # 玩家贏：從莊家扣款給玩家
                    dealer_user.balance -= payout
                    user.balance += payout
                elif result == "PUSH":
                    # 平局：退還玩家下注金額
                    user.balance += payout
                elif result in ["LOSE", "BUST"]:
                    # 玩家輸：下注金額給莊家（已在下注時扣除）
                    dealer_user.balance += hand.bet_amount

                session.add(dealer_user)
            else:
                # 系統當莊：直接給玩家錢
                user.balance += payout

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
            session.add(user)

        session.add(room)
    
    def reset_room(self, room_id: int, user_id: int) -> dict:
        """重置房間開始新一局"""
        with self.session_factory() as session:
            room = session.get(BlackjackRoom, room_id)
            
            if not room:
                return {"status": "error", "message": "房間不存在"}
            
            # 檢查是否為房主或莊家玩家
            is_owner = room.owner_id == user_id
            is_dealer = False
            if room.dealer_seat > 0:
                dealer_hand = session.exec(
                    select(BlackjackHand).where(
                        BlackjackHand.room_id == room_id,
                        BlackjackHand.seat == room.dealer_seat
                    )
                ).first()
                is_dealer = dealer_hand and dealer_hand.user_id == user_id
            
            if not is_owner and not is_dealer:
                return {"status": "error", "message": "只有房主或莊家可以重置"}
            
            if room.status != "FINISHED":
                return {"status": "error", "message": "遊戲尚未結束"}
            
            # 重置房間狀態
            room.status = "WAITING"
            room.deck = json.dumps(self.create_deck(6))
            room.dealer_cards = json.dumps([])
            room.current_seat = 0
            
            # 重置所有玩家手牌
            hands = session.exec(
                select(BlackjackHand).where(
                    BlackjackHand.room_id == room_id
                )
            ).all()
            
            for hand in hands:
                # 如果是莊家座位，保持 DEALER 狀態
                if room.dealer_seat > 0 and hand.seat == room.dealer_seat:
                    hand.status = "DEALER"
                else:
                    hand.status = "WAITING"
                hand.cards = json.dumps([])
                hand.bet_amount = 0
                hand.payout = 0
                hand.is_doubled = False
                session.add(hand)
            
            session.add(room)
            session.commit()
            
            return {"status": "success"}
