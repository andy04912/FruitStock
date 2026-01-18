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
        
    # TODO: Explicit Short/Cover functions for clarity in UI?
    # Logic above covers it using negative quantities.
