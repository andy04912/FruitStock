from datetime import datetime
from sqlmodel import Session, select
from fastapi import HTTPException
from models import User, Stock, Portfolio, Transaction, TransactionType

class Trader:
    def __init__(self, session: Session):
        self.session = session

    def get_portfolio_item(self, user_id: int, stock_id: int) -> Portfolio:
        statement = select(Portfolio).where(
            Portfolio.user_id == user_id, 
            Portfolio.stock_id == stock_id
        )
        portfolio = self.session.exec(statement).first()
        if not portfolio:
            portfolio = Portfolio(user_id=user_id, stock_id=stock_id, quantity=0, average_cost=0.0)
            self.session.add(portfolio) # Add to session but commit later
        return portfolio

    def buy_stock(self, user: User, stock_id: int, quantity: int, live_price: float = None):
        if quantity <= 0:
            return {"status": "error", "message": "Quantity must be positive"}
            
        stock = self.session.get(Stock, stock_id)
        if not stock:
            return {"status": "error", "message": "Stock not found"}
        
        # 優先使用即時價格，否則用 DB 價格
        price = live_price if live_price and live_price > 0 else stock.price
            
        cost = price * quantity
        
        # 餘額容錯機制：允許 1% 誤差（解決 MAX 按鈕競態問題）
        tolerance = cost * 0.01
        if user.balance < cost - tolerance:
            return {"status": "error", "message": "Insufficient funds"}
        
        # 如果餘額差一點點，調整為全部餘額
        if user.balance < cost:
            cost = user.balance
            
        # Update Balance
        user.balance -= cost
        
        # Update Portfolio
        portfolio = self.get_portfolio_item(user.id, stock_id)
        
        # Calculate new average cost if long position
        if portfolio.quantity >= 0:
            total_cost = (portfolio.quantity * portfolio.average_cost) + cost
            portfolio.quantity += quantity
            portfolio.average_cost = total_cost / portfolio.quantity
        else:
            # Covering short position
            # If covering, we are closing the position.
            # Realized P&L is needed here?
            # Standard logic: First cover the negative quantity.
            remaining_buy = quantity
            short_qty = abs(portfolio.quantity)
            
            covered_qty = min(remaining_buy, short_qty)
            portfolio.quantity += covered_qty
            remaining_buy -= covered_qty
            
            # If we flipped to long
            if remaining_buy > 0:
                portfolio.quantity += remaining_buy
                portfolio.average_cost = price # New position cost
        
        # Record Transaction (使用實際成交價格)
        tx = Transaction(
            user_id=user.id,
            stock_id=stock_id,
            type=TransactionType.BUY,
            price=price,
            quantity=quantity,
            timestamp=datetime.utcnow()
        )
        self.session.add(tx)
        self.session.add(user)
        self.session.add(portfolio)
        self.session.commit()
        return tx

    def sell_stock(self, user: User, stock_id: int, quantity: int, live_price: float = None):
        if quantity <= 0:
            return {"status": "error", "message": "Quantity must be positive"}

        stock = self.session.get(Stock, stock_id)
        if not stock:
            return {"status": "error", "message": "Stock not found"}
        
        # 優先使用即時價格，否則用 DB 價格
        price = live_price if live_price and live_price > 0 else stock.price
            
        portfolio = self.get_portfolio_item(user.id, stock_id)
        
        # If we don't have enough to sell, are we shorting?
        # User requested specific "Sell" vs "Short".
        # If simple interface: "Sell" usually means close position.
        # If selling more than owned, it becomes short.
        # Check current quantity.
        
        proceeds = price * quantity
        
        if portfolio.quantity < quantity:
            return {"status": "error", "message": "持股不足，無法賣出 (Insufficient shares)"}
            
        # Normal sell (Long closing)
        portfolio.quantity -= quantity
        user.balance += proceeds
            
        # Calculate Realized PnL (使用即時價格)
        # Profit = (Sell Price - Average Cost) * Quantity
        realized_pnl = (price - portfolio.average_cost) * quantity
            
        # Record Transaction
        tx = Transaction(
            user_id=user.id,
            stock_id=stock_id,
            type=TransactionType.SELL,
            price=price,
            quantity=quantity,
            profit=realized_pnl,
            timestamp=datetime.utcnow()
        )
        
        self.session.add(tx)
        self.session.add(user)
        self.session.add(portfolio)
        self.session.commit()
        return tx
        
    def short_stock(self, user: User, stock_id: int, quantity: int, live_price: float = None):
        """
        做空股票

        Args:
            user: 使用者物件
            stock_id: 股票 ID
            quantity: 做空數量（正數）
            live_price: 即時價格（從 Redis 取得）

        Returns:
            Transaction 或錯誤字典
        """
        if quantity <= 0:
            return {"status": "error", "message": "數量必須為正數"}

        stock = self.session.get(Stock, stock_id)
        if not stock:
            return {"status": "error", "message": "股票不存在"}

        # 優先使用即時價格，否則用 DB 價格
        price = live_price if live_price and live_price > 0 else stock.price

        # 計算所需保證金（150%）
        short_value = price * quantity
        required_margin = short_value * 1.5

        # 檢查保證金是否足夠
        if user.balance < required_margin:
            return {
                "status": "error",
                "message": f"保證金不足。需要 ${required_margin:.2f}，當前餘額 ${user.balance:.2f}"
            }

        # 檢查單筆做空上限（不超過帳戶總值的 30%）
        max_short_value = user.balance * 0.3
        if short_value > max_short_value:
            return {
                "status": "error",
                "message": f"超過單筆做空上限（帳戶總值 30% = ${max_short_value:.2f}）"
            }

        # 扣除保證金
        user.balance -= required_margin

        # 更新持倉
        portfolio = self.get_portfolio_item(user.id, stock_id)

        if portfolio.quantity > 0:
            # 有多單，需要先平掉多單再做空
            if portfolio.quantity >= quantity:
                # 多單足夠抵消 - 實際上是賣出
                portfolio.quantity -= quantity
                user.balance += required_margin  # 退還保證金
                return {"status": "error", "message": "您持有多頭倉位，請先賣出後再做空"}
            else:
                # 多單不足，先平掉多單再做空
                remaining_short = quantity - portfolio.quantity
                portfolio.quantity = -remaining_short
                portfolio.average_cost = price
                portfolio.short_entry_price = price
                portfolio.margin_locked = remaining_short * price * 1.5
        elif portfolio.quantity < 0:
            # 已有空單，繼續加空
            old_value = abs(portfolio.quantity) * portfolio.average_cost
            new_value = quantity * price
            total_qty = abs(portfolio.quantity) + quantity
            portfolio.quantity = -total_qty
            portfolio.average_cost = (old_value + new_value) / total_qty
            portfolio.short_entry_price = portfolio.average_cost
            portfolio.margin_locked += required_margin
        else:
            # 新開空倉
            portfolio.quantity = -quantity
            portfolio.average_cost = price
            portfolio.short_entry_price = price
            portfolio.margin_locked = required_margin
            portfolio.last_interest_charged = datetime.utcnow()

        # 記錄交易
        tx = Transaction(
            user_id=user.id,
            stock_id=stock_id,
            type=TransactionType.SHORT,
            price=price,
            quantity=quantity,
            timestamp=datetime.utcnow()
        )

        self.session.add(tx)
        self.session.add(user)
        self.session.add(portfolio)
        self.session.commit()

        return tx

    def cover_short(self, user: User, stock_id: int, quantity: int, live_price: float = None):
        """
        回補空單

        Args:
            user: 使用者物件
            stock_id: 股票 ID
            quantity: 回補數量（正數）
            live_price: 即時價格（從 Redis 取得）

        Returns:
            Transaction 或錯誤字典
        """
        if quantity <= 0:
            return {"status": "error", "message": "數量必須為正數"}

        stock = self.session.get(Stock, stock_id)
        if not stock:
            return {"status": "error", "message": "股票不存在"}

        # 優先使用即時價格，否則用 DB 價格
        price = live_price if live_price and live_price > 0 else stock.price

        portfolio = self.get_portfolio_item(user.id, stock_id)

        # 檢查是否有空單
        if portfolio.quantity >= 0:
            return {"status": "error", "message": "您沒有空頭倉位"}

        short_qty = abs(portfolio.quantity)
        if quantity > short_qty:
            return {
                "status": "error",
                "message": f"回補數量超過空單數量。您的空單: {short_qty} 股"
            }

        # 計算回補成本
        cover_cost = price * quantity

        # 檢查餘額是否足夠（容錯 1%）
        tolerance = cover_cost * 0.01
        if user.balance < cover_cost - tolerance:
            return {"status": "error", "message": f"餘額不足。需要 ${cover_cost:.2f}"}

        # 調整成本（如果差一點點）
        if user.balance < cover_cost:
            cover_cost = user.balance

        # 計算已實現損益
        # 做空損益 = (開倉價 - 回補價) * 數量
        realized_pnl = (portfolio.average_cost - price) * quantity

        # 計算退還的保證金
        margin_ratio = quantity / short_qty
        margin_to_return = portfolio.margin_locked * margin_ratio

        # 更新餘額
        user.balance -= cover_cost  # 支付回補成本
        user.balance += margin_to_return  # 退還保證金

        # 更新持倉
        portfolio.quantity += quantity  # 減少空單（quantity 是負數，加上正數就是減少）
        portfolio.margin_locked -= margin_to_return

        # 如果完全平倉，清空相關欄位
        if portfolio.quantity == 0:
            portfolio.average_cost = 0.0
            portfolio.short_entry_price = None
            portfolio.margin_locked = 0.0
            portfolio.last_interest_charged = None

        # 記錄交易
        tx = Transaction(
            user_id=user.id,
            stock_id=stock_id,
            type=TransactionType.COVER,
            price=price,
            quantity=quantity,
            profit=realized_pnl,
            timestamp=datetime.utcnow()
        )

        self.session.add(tx)
        self.session.add(user)
        self.session.add(portfolio)
        self.session.commit()

        return tx
