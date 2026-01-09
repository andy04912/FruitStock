from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlmodel import Session, select
import random
import math

from models import User, Loan, LaborLog, Stock, Portfolio, Transaction, TransactionType

class BankService:
    def __init__(self, session: Session):
        self.session = session

    def get_top_wealth(self) -> float:
        """Calculates the highest Net Worth (Balance + Stock Value) among all users."""
        users = self.session.exec(select(User)).all()
        stocks = self.session.exec(select(Stock)).all()
        stock_map = {s.id: s.price for s in stocks}
        
        max_wealth = 10000.0 # Floor wealth to avoid 0
        
        for user in users:
            portfolios = self.session.exec(select(Portfolio).where(Portfolio.user_id == user.id)).all()
            stock_value = sum(p.quantity * stock_map.get(p.stock_id, 0) for p in portfolios)
            net_worth = user.balance + stock_value
            if net_worth > max_wealth:
                max_wealth = net_worth
                
        return max_wealth

    def get_dynamic_rates(self) -> dict:
        """Returns dynamic loan limits and wage baselines based on Top Wealth."""
        top_wealth = self.get_top_wealth()
        
        return {
            "top_wealth": top_wealth,
            "loan_limit_micro": top_wealth * 0.05,
            "loan_limit_standard": top_wealth * 0.10,
            "loan_limit_jumbo": top_wealth * 0.40,
            "base_wage": top_wealth * 0.005, # 0.5%
            "passive_income_rate": top_wealth * 0.002 # 0.2%
        }

    def borrow(self, user: User, amount: float) -> dict:
        """Creates a new loan for the user."""
        if user.is_trading_frozen:
            return {"status": "error", "message": "帳戶已凍結，無法借款。"}
            
        # Check if user has outstanding DEFAULT loans (cannot borrow if defaulted)
        active_loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
        if active_loans:
             return {"status": "error", "message": "有違約債務未清之前無法借款。"}

        # Validate Amount against limits (Frontend should restrict, but backend safety)
        # For simplicity, we assume frontend sends specific tier amounts, 
        # but we allow custom amounts as long as they fit roughly within tiers for flexibility?
        # Let's strictly check against the Jumbo limit as absolute max.
        rates = self.get_dynamic_rates()
        if amount > rates["loan_limit_jumbo"] * 1.1: # 10% buffer
             return {"status": "error", "message": "借款金額超過信用額度上限。"}
             
        # TOTAL DEBT LIMIT CHECK (200% of Net Worth)
        # 1. Calc Net Worth
        portfolios = self.session.exec(select(Portfolio).where(Portfolio.user_id == user.id)).all()
        stocks = self.session.exec(select(Stock)).all()
        stock_map = {s.id: s.price for s in stocks}
        stock_value = sum(p.quantity * stock_map.get(p.stock_id, 0) for p in portfolios)
        net_worth = user.balance + stock_value
        
        # 2. Calc Current Debt
        existing_loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status.in_(["ACTIVE", "DEFAULT"]))).all()
        current_debt = sum(l.total_due for l in existing_loans)
        
        # 3. Check Limit
        max_allowed_debt = max(10000, net_worth * 2.0) # Min 10k allowance for newbies
        
        if current_debt + amount > max_allowed_debt:
            return {
                "status": "error", 
                "message": f"總債務超過淨資產 200% 上限 (${max_allowed_debt:,.0f})。請先還款。"
            }

        # Determine Interest Rate
        # Simple logic: If <= Micro limit -> 5%, <= Std -> 10%, > Std -> 20%
        if amount <= rates["loan_limit_micro"] * 1.1:
            interest_rate = 0.05
        elif amount <= rates["loan_limit_standard"] * 1.1:
            interest_rate = 0.10
        else:
            interest_rate = 0.20
            
        # Create Loan
        # Calculate initial interest immediately (1 period worth) to prevent free short-term loans
        initial_interest = amount * interest_rate / 12
        
        loan = Loan(
            user_id=user.id,
            principal=amount,
            surcharge=initial_interest, 
            total_due=amount + initial_interest, 
            due_date=datetime.now() + timedelta(minutes=1),
            status="ACTIVE"
        )
        
        user.balance += amount
        self.session.add(loan)
        self.session.add(user)
        self.session.commit()
        
        return {"status": "success", "message": f"成功借款 ${amount:,.0f}，初始利息 ${initial_interest:,.0f} 已計入。"}

    def calculate_interest(self):
        """Periodic job: Add interest to active loans."""
        # This logic differs slightly from "Fixed Interest at start".
        # User requested: "Every 2 hours calculate interest and accumulate."
        # Formula: Principal * Rate (5%/10%/20%) / 12 (if rate is daily? Or rate is per term?)
        # Original plan said: "Fixed rate. Borrow 10k, repay 11k".
        # User updated plan V4: "Accumulate interest every 2 hours."
        # Let's effectively amortize the fixed rate over 24h?
        # Or just ADD EXTRA interest every 2 hours?
        # "借貸...固定利率...計息週期：每2小時計算一次利息並累積"
        # Interpret: The 5%/10%/20% is the DAILY rate.
        # So every 2 hours, we charge (Rate / 12).
        
        active_loans = self.session.exec(select(Loan).where(Loan.status == "ACTIVE")).all()
        rates = self.get_dynamic_rates()
        
        count = 0
        for loan in active_loans:
            # Re-determine rate based on principal (snapshot)
            if loan.principal <= rates["loan_limit_micro"] * 1.1:
                rate = 0.05
            elif loan.principal <= rates["loan_limit_standard"] * 1.1:
                rate = 0.10
            else:
                rate = 0.20
            
            # 2-hour interest
            period_interest = loan.principal * rate / 12
            
            loan.surcharge += period_interest
            loan.total_due = loan.principal + loan.surcharge
            self.session.add(loan)
            count += 1
            
        self.session.commit()
        print(f"[Bank] Calculated interest for {count} loans.")

    def check_loan_expiry(self):
        """Periodic job: Mark overdue loans as DEFAULT and freeze user."""
        now = datetime.now()
        expired_loans = self.session.exec(select(Loan).where(Loan.status == "ACTIVE", Loan.due_date < now)).all()
        
        for loan in expired_loans:
            loan.status = "DEFAULT"
            user = self.session.get(User, loan.user_id)
            if user and not user.is_trading_frozen:
                user.is_trading_frozen = True
                user.frozen_reason = "貸款違約（逾期未還）"
                self.session.add(user)
            self.session.add(loan)
            
        self.session.commit()

    def repay(self, user: User, amount: float = None) -> dict:
        """Repays active loans."""
        loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status.in_(["ACTIVE", "DEFAULT"]))).all()
        if not loans:
             return {"status": "error", "message": "目前沒有需要償還的貸款。"}
             
        # If amount is None, repay all (if balance sufficient)
        max_repay = sum(l.total_due for l in loans)
        
        if amount is None or amount > max_repay:
            amount = max_repay
            
        if user.balance < amount:
             return {"status": "error", "message": f"餘額不足。您目前只有 ${user.balance:,.0f}。"}
             
        # Process Repayment
        user.balance -= amount
        paid_amount = amount
        count = 0
        
        # FIFO Repayment (Oldest due date first?)
        loans.sort(key=lambda x: x.due_date)
        
        for loan in loans:
            if amount <= 0:
                break
                
            # Floating point tolerance for "Repay All" scenarios
            if amount >= loan.total_due - 0.1:
                amount -= loan.total_due
                loan.total_due = 0
                loan.status = "PAID"
                count += 1
            else:
                loan.total_due -= amount
                amount = 0
                
            self.session.add(loan)
            
        # Check if all defaults cleared
        # Iterate to check constraint
        still_default = False
        remaining = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
        if remaining:
            still_default = True
            
        if not still_default and user.is_trading_frozen:
             user.is_trading_frozen = False
             user.frozen_reason = None
                 
        self.session.add(user)
        self.session.commit()
        
        return {"status": "success", "message": f"成功償還 ${paid_amount:,.0f}。已結清 {count} 筆貸款。"}

    def liquidate_assets(self, user: User) -> dict:
        """Sells all stocks to repay debt."""
        if not user.is_trading_frozen:
             return {"status": "error", "message": "帳戶未被凍結，無需清算。"}
             
        # Get total debt
        loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
        total_debt = sum(l.total_due for l in loans)
        
        if total_debt <= 0:
            # Should not happen if frozen, but safety
            user.is_trading_frozen = False
            user.frozen_reason = None
            self.session.add(user)
            self.session.commit()
            return {"status": "success", "message": "查無債務，帳戶已解凍。"}

        # Sell All Stocks
        portfolios = self.session.exec(select(Portfolio).where(Portfolio.user_id == user.id)).all()
        stocks = self.session.exec(select(Stock)).all()
        stock_map = {s.id: s.price for s in stocks}
        
        liquidation_total = 0.0
        
        from trader import Trader # Import here to avoid circular at top level if any
        trader = Trader(self.session)
        
        for p in portfolios:
            if p.quantity > 0:
                # Force sell - bypass frozen check inside Trader if possible?
                # Trader checks `is_trading_frozen`. We need to bypass or temp unfreeze?
                # Actually, we can just manually process the transaction to avoid Trader restrictions.
                current_price = stock_map.get(p.stock_id, 0)
                revenue = p.quantity * current_price
                liquidation_total += revenue
                
                # Create Transaction Record
                txn = Transaction(
                    user_id=user.id,
                    stock_id=p.stock_id,
                    type=TransactionType.SELL,
                    price=current_price,
                    quantity=p.quantity,
                    profit=revenue - (p.average_cost * p.quantity)
                )
                self.session.add(txn)
                
                # Clear Portfolio
                p.quantity = 0
                p.average_cost = 0.0
                self.session.add(p)
        
        # Add liquidation revenue to balance
        user.balance += liquidation_total
        
        # Repay Debt
        paid_amount = 0.0
        remaining_balance = user.balance
        
        for loan in loans:
            if remaining_balance >= loan.total_due:
                remaining_balance -= loan.total_due
                paid_amount += loan.total_due
                loan.status = "PAID"
                self.session.add(loan)
            else:
                # Partial pay not really supported by "ONE CLICK", 
                # but let's reduce total_due? 
                # Proposal said: "If cash < debt: zero cash, remaining debt stays."
                loan.total_due -= remaining_balance
                paid_amount += remaining_balance
                remaining_balance = 0
                self.session.add(loan)
                break 

        user.balance = remaining_balance
        
        # Check if all cleared
        remaining_loans = [l for l in loans if l.status == "DEFAULT"]
        
        if not remaining_loans:
            user.is_trading_frozen = False
            user.frozen_reason = None
            msg = f"清算成功。變賣資產 ${liquidation_total:,.0f}。債務已結清，重獲自由。"
        else:
            msg = f"清算完成。變賣資產 ${liquidation_total:,.0f}。已償還 ${paid_amount:,.0f}。仍有剩餘債務。"
            
        self.session.add(user)
        self.session.commit()
        
        return {"status": "success", "message": msg}
        
    def start_labor(self, user: User, labor_type: str, hours: int) -> dict:
        """Starts a labor task (Work or Jail). Locks user account."""
        # Check if already in labor
        active_labor = self.session.exec(select(LaborLog).where(LaborLog.user_id == user.id, LaborLog.status == "IN_PROGRESS")).first()
        if active_labor:
             return {"status": "error", "message": f"已經在進行 {active_labor.type}，直到 {active_labor.end_time} 結束。"}
             
        loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
        if not loans:
             return {"status": "error", "message": "沒有違約債務，不需打工或坐牢。"}
             
        # Validate hours
        if labor_type == "JAIL":
             total_debt = sum(l.total_due for l in loans)
             # 4 hours base + 1 hr per $10k
             calc_hours = 4 + int(total_debt / 10000)
             hours = min(calc_hours, 24)
        else:
             # Work: Minimum 2 hours
             if hours < 2:
                 return {"status": "error", "message": "最少工作時數為 2 小時。"}
             if hours > 12:
                 return {"status": "error", "message": "最大工作時數為 12 小時。"}

        end_time = datetime.now() + timedelta(hours=hours)
        
        log = LaborLog(
            user_id=user.id,
            type=labor_type,
            start_time=datetime.now(),
            end_time=end_time,
            status="IN_PROGRESS",
            earnings=0.0
        )
        
        user.is_trading_frozen = True
        user.frozen_reason = f"忙碌中: {labor_type} (結束時間 {end_time.strftime('%H:%M')})"
        
        self.session.add(log)
        self.session.add(user)
        self.session.commit()
        
        return {"status": "success", "message": f"開始 {labor_type}。請在 {hours} 小時後回來。", "end_time": end_time}

    def process_labor_completion(self):
        """Periodic: Check for completed labor."""
        now = datetime.now()
        completed_logs = self.session.exec(select(LaborLog).where(LaborLog.status == "IN_PROGRESS", LaborLog.end_time <= now)).all()
        
        rates = self.get_dynamic_rates()
        base_wage = rates["base_wage"]
        
        count = 0
        for log in completed_logs:
            user = self.session.get(User, log.user_id)
            if not user:
                continue
            
            if log.type == "JAIL":
                # Clear ALL default debt
                loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
                for l in loans:
                    l.status = "PAID"
                    l.total_due = 0
                    self.session.add(l)
                
            else: # WORK
                # Calculate Earnings based on hours
                duration_hours = (log.end_time - log.start_time).seconds / 3600
                duration_hours = max(1, int(round(duration_hours)))
                
                job_subtype = log.type.replace("WORK_", "")
                wage_per_hour = 0
                
                roll = random.random()
                if job_subtype == "NORMAL":
                    mult = 1.0
                    if roll < 0.20: mult = 1.5
                    elif roll > 0.95: mult = 0.8
                    wage_per_hour = base_wage * mult
                elif job_subtype == "BUDDHA":
                    mult = 0.8
                    if roll < 0.50: mult = 2.0
                    elif roll > 0.99: mult = 0.1
                    wage_per_hour = base_wage * mult
                elif job_subtype == "BLACK":
                    mult = 5.0 # Base 5x (High Reward)
                    if roll < 0.05: mult = 10.0 # Jackpot 10x (5% chance)
                    elif roll > 0.60: mult = 0.1 # Fail 0.1x (40% chance)
                    wage_per_hour = base_wage * mult
                else: 
                     wage_per_hour = base_wage
                     
                total_earnings = wage_per_hour * duration_hours
                log.earnings = total_earnings
                
                # Repay Logic
                loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
                remaining_earnings = total_earnings
                loans.sort(key=lambda x: x.due_date)
                
                for loan in loans:
                    if remaining_earnings <= 0: break
                    if remaining_earnings >= loan.total_due:
                        remaining_earnings -= loan.total_due
                        loan.total_due = 0
                        loan.status = "PAID"
                    else:
                        loan.total_due -= remaining_earnings
                        remaining_earnings = 0
                    self.session.add(loan)
            
            # Finalize Log
            log.status = "COMPLETED"
            self.session.add(log)
            
            # Unfreeze Check
            # Only unfreeze if NO default loans left
            remaining_loans = self.session.exec(select(Loan).where(Loan.user_id == user.id, Loan.status == "DEFAULT")).all()
            if not remaining_loans:
                user.is_trading_frozen = False
                user.frozen_reason = None
            else:
                user.frozen_reason = "貸款違約（逾期未還）" # Revert to default reason
            
            self.session.add(user)
            count += 1
            
        self.session.commit()
        if count > 0:
            print(f"[Bank] Processed {count} labor completions.")

    def process_passive_income(self):
        """Periodic: Give money to users with Karma."""
        top_wealth = self.get_top_wealth()
        # Formula: Karma * 0.2% * TopWealth per hour
        # Since this runs every hour, just give the amount.
        
        # Find users with Karma > 0
        statement = select(User).where(User.karma_score > 0)
        users = self.session.exec(statement).all()
        
        total_payout = 0
        for user in users:
            # Re-read Karma from DB? `user` is attached object.
            # Calc bailout count? User model has `karma_score`.
            # Design said: "Redemption Count * 0.2%". 
            # I will assume `karma_score` tracks redemption count directly.
            
            income = user.karma_score * 0.002 * top_wealth
            user.balance += income
            self.session.add(user)
            total_payout += income
            
        self.session.commit()
        if total_payout > 0:
            print(f"[Bank] Distributed ${total_payout:,.0f} passive income to {len(users)} saints.")

    def bail_user(self, rescuer: User, target_user_id: int) -> dict:
        """Pay off another user's debt."""
        target = self.session.get(User, target_user_id)
        if not target:
            return {"status": "error", "message": "找不到該用戶。"}
            
        loans = self.session.exec(select(Loan).where(Loan.user_id == target.id, Loan.status == "DEFAULT")).all()
        if not loans:
            return {"status": "error", "message": "該用戶沒有違約債務。"}
            
        total_debt = sum(l.total_due for l in loans)
        bail_cost = total_debt * 1.5
        
        if rescuer.balance < bail_cost:
             return {"status": "error", "message": f"餘額不足。需要 ${bail_cost:,.0f}。"}
             
        # Process transaction
        rescuer.balance -= bail_cost
        
        # Clear Target Debt
        for loan in loans:
            loan.status = "PAID"
            loan.total_due = 0 # Cleared
            self.session.add(loan)
            
        target.is_trading_frozen = False
        target.frozen_reason = None
        
        # Grant Karma
        rescuer.karma_score += 1
        
        self.session.add(rescuer)
        self.session.add(target)
        self.session.commit()
        
        return {
            "status": "success", 
            "message": f"您保釋了 {target.username}！花費: ${bail_cost:,.0f}。功德 +1。"
        }
