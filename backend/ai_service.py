import os
import random
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

LITE_MODEL = 'gemini-2.5-flash-lite'
PRO_MODEL = 'gemini-2.5-flash-pro'

# Fallback names in case AI fails or no key provided
FALLBACK_COMPANIES = [
    {"name": "CyberDyne Systems", "symbol": "CYBR", "desc": "專注於天網研發的頂尖科技公司。"},
    {"name": "Umbrella Corp", "symbol": "UMBR", "desc": "生物科技與製藥領域的全球領導者。"},
    {"name": "Noka Cola", "symbol": "COLA", "desc": "遭遇核戰也能生存的飲料品牌。"},
    {"name": "Stark Industries", "symbol": "STRK", "desc": "潔淨能源與先進武器系統供應商。"},
    {"name": "Wayne Ent", "symbol": "WAYN", "desc": "高譚市最大的多元化控股集團。"},
    {"name": "Acme Corp", "symbol": "ACME", "desc": "提供各式各樣莫名其妙的道具。"},
    {"name": "Massive Dynamic", "symbol": "MASS", "desc": "我們不做什麼，我們讓事情發生。"},
    {"name": "Aperture Science", "symbol": "PORT", "desc": "我們做我們必須做的，因為我們以此為能。"},
    {"name": "Mom Corp", "symbol": "MOM", "desc": "您最喜愛的機器人製造商。"},
    {"name": "GlobeX", "symbol": "GLOB", "desc": "致力於透過征...服務世界來改善生活。"},
]

def generate_new_company(category=None):
    """
    Generates a new fictional company using Gemini API.
    category: 'FRUIT', 'MEAT', 'ROOT' or None (Generic)
    Returns a dict: {"name": str, "symbol": str, "desc": str}
    """
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("[AI Service] No API Key found, using fallback.")
        return random.choice(FALLBACK_COMPANIES)

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(LITE_MODEL)
        
        theme_instruction = "The theme can be Cyberpunk, Sci-Fi, Meme, Crypto, or Futuristic Tech."
        if category == 'FRUIT':
            theme_instruction = "The company Name MUST be a specific Fruit (e.g. Peach, Mango, Berry, Lime) or orchard related. The Symbol should be related to that fruit. STRICTLY fruit themed."
        elif category == 'MEAT':
            theme_instruction = "The company Name MUST be a specific Meat/Cut (e.g. Wagyu, Bacon, Ribs, Sausage) or BBQ related. The Symbol should be related to that meat. STRICTLY meat themed."
        elif category == 'ROOT':
            theme_instruction = "The company Name MUST be a specific Root Vegetable (e.g. Potato, Yam, Turnip, Ginger) or underground crop. The Symbol should be related to roots. STRICTLY root themed."

        prompt = f"""
        Generate company name, ticker symbol (3-5 letters), and a short 1-sentence description.
        {theme_instruction}
        The Company Name MUST only use Two words.
        
        Response format (JSON only):
        {{
            "name": "Company Name",
            "symbol": "TICKER",
            "desc": "Short description."
        }}
        """
        
        response = model.generate_content(prompt)
        # Clean up code blocks if generic returns them
        text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        
        # Validate keys
        if "name" in data and "symbol" in data and "desc" in data:
             print(f"[AI Service] Generated: {data['name']} ({data['symbol']})")
             return data
        else:
             raise ValueError("Missing keys in JSON")

    except Exception as e:
        print(f"[AI Service] Error generating company: {e}. Using fallback.")
        return random.choice(FALLBACK_COMPANIES)

def generate_market_event(stock_name, tier, direction):
    """
    Generates a market event title and description using Gemini.
    tier: 'NORMAL', 'SIGNIFICANT', 'SHOCK', 'BLACK_SWAN'
    direction: 'UP' or 'DOWN'
    Returns: {"title": str, "desc": str} or None if failed
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return None

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(LITE_MODEL)
        
        intensity = "mild"
        if tier == 'SIGNIFICANT': intensity = "moderate"
        if tier == 'SHOCK': intensity = "high/shocking"
        if tier == 'BLACK_SWAN': intensity = "extreme/apocalyptic/legendary"
        
        dir_text = "Good news, price goes up" if direction == 'UP' else "Bad news, price goes down"
        
        prompt = f"""
        Act as a senior financial journalist for Bloomberg/Reuters.
        Write a breaking news headline and a short summary for stock "{stock_name}".
        
        Event Type: {tier} (Intensity: {intensity}).
        Market Direction: {dir_text}.
        
        Requirements:
        1. Professional, authoritative tone.
        2. Use financial terminology (e.g. "Earnings beat", "Supply chain disruption", "M&A rumors", "Regulatory approval").
        3. STRICTLY in Traditional Chinese (Taiwan usage).
        
        Output JSON only:
        {{
            "title": "Headline (Max 15 chars, e.g. '營收優於預期', '爆發管理危機')",
            "desc": "Summary (Max 50 chars, e.g. '第三季EPS創新高，外資重申買進評等。')"
        }}
        """
        
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        
        if "title" in data and "desc" in data:
            return data
        return None

    except Exception as e:
        print(f"[AI Service] Error generating event: {e}")
        return None

def generate_guru_forecast(stock_name, current_price, base_price=None, guru_persona=None):
    """
    Generates a guru prediction.
    guru_persona: {"name": str, "bio": str}
    Returns prediction data.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    
    # Default persona if None
    if not guru_persona:
        guru_persona = {"name": "神秘分析師", "bio": "市場觀察者"}

    if not api_key: 
        # Fallback Mock (Harder)
        target = round(current_price * 1.2, 2) # +20%
        return {
            "guru_name": guru_persona["name"],
            "prediction_type": "BULL",
            "target_price": target,
            "rationale": "根據我的模型顯示，買點已到！"
        }

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(LITE_MODEL)
        
        trend_context = "Market is neutral."
        if base_price:
            ratio = current_price / base_price
            if ratio > 1.3:
                trend_context = f"The stock is OVERVALUED (Bubble). Price is {ratio:.1f}x base price. Consider a BEARISH prediction to correct it."
            elif ratio < 0.7:
                 trend_context = f"The stock is UNDERVALUED. Price is {ratio:.1f}x base price. Consider a BULLISH prediction."
        
        prompt = f"""
        You are a financial guru named "{guru_persona['name']}". 
        Your Style/Bio: "{guru_persona['bio']}".
        
        Create a stock prediction for "{stock_name}" (Current Price: {current_price}).
        Context: {trend_context}
        
        Decide if you are Bullish or Bearish based on your persona AND the market context.
        Set a target price that is 10% to 25% away from current price. (If Bearish, target must be lower).
        Write a convincing, analytical rationale in Traditional Chinese, reflecting your persona style.
        
        Output JSON only:
        {{
            "prediction_type": "BULL" or "BEAR",
            "target_price": 123.45,
            "rationale": "Your rationale here."
        }}
        """
        
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        
        # Validate and Type Convert
        data['target_price'] = float(data['target_price'])
        if data['prediction_type'] not in ['BULL', 'BEAR']:
            data['prediction_type'] = 'BULL' # Default
            
        return {
            "guru_name": guru_persona['name'],
            "prediction_type": data['prediction_type'],
            "target_price": data['target_price'],
            "rationale": data['rationale']
        }

    except Exception as e:
        print(f"[AI Service] Error generating guru: {e}")
        # Fallback Mock
        target = round(current_price * 1.2, 2)
        return {
            "guru_name": guru_persona['name'],
            "prediction_type": "BULL",
            "target_price": target,
            "rationale": "大盤氣氛不錯，這支股票有潛力。"
        }

def generate_fulfillment_news(guru_name, stock_name, action):
    """
    Generates news when a prediction comes true.
    action: e.g. "hit target price", "prediction failed"
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: 
        return {"title": "預言成真", "desc": f"{guru_name} 的預言成真了！{stock_name} 達到目標價。"}

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(LITE_MODEL)
        
        prompt = f"""
        Write a breaking news headline and description about Guru "{guru_name}" being right about "{stock_name}".
        Event: {action}.
        Tone: Excited, Viral, Internet Slang allowed. Traditional Chinese.
        
        Output JSON only:
        {{
            "title": "Headline (max 10 chars)",
            "desc": "Description (max 40 chars)"
        }}
        """
        
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return data
        
    except Exception as e:
        print(f"[AI Service] Error generating guru news: {e}")
        return {"title": "神準預言", "desc": f"{guru_name} 再次展現神蹟，{stock_name} 達標！"}

def generate_fake_news(stock_name):
    """
    Generates plausible market rumors.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: 
        return {"title": "市場謠言", "desc": f"市場傳出關於 {stock_name} 的併購傳聞。"}

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(LITE_MODEL)
        
        prompt = f"""
        Act as a market insider spreading a rumor about "{stock_name}".
        Create a realistic but unverified market rumor.
        
        Examples: "Secret merger talks", "CEO health issues", "Product recall cover-up", "Big whale accumulating".
        Tone: Gossipy but plausible financial rumor. Traditional Chinese.
        
        Output JSON only:
        {{
            "title": "Headline (Max 12 chars)",
            "desc": "Description (Max 45 chars)"
        }}
        """
        
        response = model.generate_content(prompt)
        text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        return data
        
    except Exception as e:
        print(f"[AI Service] Error generating fake news: {e}")
        return {"title": "路邊社消息", "desc": f"傳聞 {stock_name} 經營層將有重大異動。"}
