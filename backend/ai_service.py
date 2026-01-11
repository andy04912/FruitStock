import random
import json
from dotenv import load_dotenv
import content_library  # The new static DB

load_dotenv()

# No longer using Google GenAI
# LITE_MODEL ... removed

def generate_new_company(category="FRUIT"):
    """
    Generates a new company from the static library.
    category: 'FRUIT', 'MEAT', 'ROOT' (default 'FRUIT' if None)
    """
    if not category: category = "FRUIT"
    
    # Get list from library, default to FRUIT if key missing
    candidates = content_library.COMPANY_NAMES.get(category, content_library.COMPANY_NAMES["FRUIT"])
    
    # Pick one
    company = random.choice(candidates)
    
    # Add some randomness to price based on category (handled in market.py, but here we just return info)
    return {
        "name": company["name"],
        "symbol": company["symbol"],
        "desc": company["desc"]
    }

def generate_market_event(stock_name, tier, direction):
    """
    Generates a market event from static library.
    tier: 'NORMAL', 'SIGNIFICANT', 'SHOCK'
    direction: 'UP', 'DOWN'
    """
    try:
        # Map parameters to library keys
        key = "UP" if direction == "UP" else "DOWN"
        
        if tier == "SHOCK" or tier == "BLACK_SWAN":
            key = "SHOCK"
            
        candidates = content_library.NEWS_EVENTS.get(key, content_library.NEWS_EVENTS["UP"])
        event = random.choice(candidates)
        
        # Inject Stock Name if possible (The static text is generic, 
        # but we can prepend/append or just return generic text which is fine)
        # Actually, let's keep it generic as defined in library or format it?
        # The library string are like "業績大爆發...", no {stock_name} placeholder.
        # We can prepend the stock name to the Title?
        # E.g. Title: "[AAPL] 業績大爆發"
        
        title = f"【{stock_name}】{event['title']}"
        desc = event['desc']
        
        return {
            "title": title,
            "desc": desc
        }

    except Exception as e:
        print(f"[AI Service] Error generating event: {e}")
        return {"title": "市場快訊", "desc": f"{stock_name} 股價出現顯著波動。"}

def generate_guru_forecast(stock_name, current_price, base_price=None, guru_persona=None):
    """
    Generates a guru prediction from static library.
    """
    if not guru_persona:
        guru_persona = {"name": "穩健老王", "bio": "..."}
        
    guru_name = guru_persona.get("name", "穩健老王")
    
    # 1. Determine Bull/Bear Logic (Simple Random or Trend based)
    # We can use the logic from previous version or simple physics
    prediction_type = "BULL"
    if base_price:
        ratio = current_price / base_price
        if ratio > 1.3:
            prediction_type = "BEAR" # Contrarian
        elif ratio < 0.7:
            prediction_type = "BULL" # Value
        else:
            prediction_type = random.choice(["BULL", "BEAR"])
    else:
        prediction_type = random.choice(["BULL", "BEAR"])

    # 2. Get Quote
    quotes_map = content_library.GURU_QUOTES.get(guru_name, content_library.GURU_QUOTES["穩健老王"])
    candidates = quotes_map.get(prediction_type, ["..."])
    rationale = random.choice(candidates)
    
    # 3. Target Price
    if prediction_type == "BULL":
        target = round(current_price * random.uniform(1.1, 1.3), 2)
    else:
        target = round(current_price * random.uniform(0.7, 0.9), 2)
        
    return {
        "guru_name": guru_name,
        "prediction_type": prediction_type,
        "target_price": target,
        "rationale": rationale
    }

def generate_fulfillment_news(guru_name, stock_name, action):
    """
    Static fulfillment news.
    """
    return {
        "title": "神準預言",
        "desc": f"{guru_name} 再次展現神蹟！{stock_name} {action}，市場驚嘆不已。"
    }

def generate_fake_news(stock_name):
    """
    Generates plausible market rumors from library.
    """
    try:
        candidates = content_library.NEWS_EVENTS.get("RUMOR", [])
        if not candidates:
            return {"title": "市場謠言", "desc": f"關於 {stock_name} 的小道消息正在流傳。"}
            
        rumor = random.choice(candidates)
        return {
            "title": f"【{stock_name}】{rumor['title']}",
            "desc": rumor['desc']
        }
    except Exception:
        return {"title": "市場謠言", "desc": f"關於 {stock_name} 的小道消息正在流傳。"}

