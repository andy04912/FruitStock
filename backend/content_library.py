
# 靜態內容資料庫 (Static Content Library)
# 用於替換 Live Gemini API，提供豐富多樣的隨機內容

# 1. 新公司命名庫 (New Companies)
COMPANY_NAMES = {
    "FRUIT": [
        {"name": "Sweet Peach", "symbol": "PECH", "desc": "專注於多汁水蜜桃的栽種與加工。"},
        {"name": "Golden Fruit", "symbol": "GOLD", "desc": "致力於培育傳說中的黃金果實。"},
        {"name": "Sunny Grape", "symbol": "GRPE", "desc": "每一顆葡萄都吸收了加州的陽光。"},
        {"name": "Super Melon", "symbol": "MELO", "desc": "專門生產比車輪還大的基因改良西瓜。"},
        {"name": "Tropical Mango", "symbol": "MANG", "desc": "將熱帶風情帶入每一口甜點中。"},
        {"name": "Sour Lemon", "symbol": "LMON", "desc": "酸得讓你懷疑人生，甜得讓你回味無窮。"},
        {"name": "Berry Blast", "symbol": "BERY", "desc": "擁有獨家爆漿技術的藍莓產品。"},
        {"name": "Kiwi Guard", "symbol": "KIWI", "desc": "富含維他命C的綠色守護者。"},
        {"name": "Lucky Strawberry", "symbol": "STRW", "desc": "戀愛般的滋味，每一口都是幸運。"},
        {"name": "Vitamin C Orange", "symbol": "ORNG", "desc": "感冒剋星，全家人的健康守護。"},
        {"name": "Exotic Durian", "symbol": "DURI", "desc": "愛的人很愛，恨的人很恨的極致美味。"},
        {"name": "Diamond Cherry", "symbol": "CHER", "desc": "奢華水果的代名詞，只為頂級客群服務。"},
        {"name": "Crazy Banana", "symbol": "BANA", "desc": "讓世界跟著一起滑倒的快樂水果。"},
        {"name": "Dragon Fire", "symbol": "DRGN", "desc": "來自深淵的紅色誘惑，口感獨特。"},
        {"name": "Crystal Pear", "symbol": "PEAR", "desc": "清脆爽口，如水晶般剔透。"},
        {"name": "Passion Boom", "symbol": "PASS", "desc": "熱情如火，口感豐富的熱帶水果。"},
        {"name": "Mr. Avocado", "symbol": "AVCO", "desc": "健身界的新寵兒，健康的油脂來源。"},
        {"name": "Royal Lychee", "symbol": "LICH", "desc": "重現唐朝宮廷的頂級美味。"},
        {"name": "Moon Pomelo", "symbol": "POME", "desc": "中秋佳節必備，送禮自用兩相宜。"},
        {"name": "Papaya Milk", "symbol": "PAPA", "desc": "台灣夜市的經典，走向國際化經營。"}
    ],
    "MEAT": [
        {"name": "Kobe Wagyu", "symbol": "KOBE", "desc": "入口即化的奢華享受，肉中之王。"},
        {"name": "Black Pork", "symbol": "PORK", "desc": "來自深山的黑毛豬，鮮甜無腥味。"},
        {"name": "Golden Fried Chicken", "symbol": "FRIED", "desc": "酥脆多汁，罪惡感滿點的宵夜首選。"},
        {"name": "Cherry Duck", "symbol": "DUCK", "desc": "皮脆肉嫩，頂級法式料理的靈魂。"},
        {"name": "Tomahawk Steak", "symbol": "BEEF", "desc": "霸氣外露，滿足食肉獸的原始慾望。"},
        {"name": "Sausage Master", "symbol": "SAUS", "desc": "傳承五十年的古早味，夜市排隊名店。"},
        {"name": "Bacon Hail", "symbol": "BACN", "desc": "所有食物加了培根都會變好吃。"},
        {"name": "Lamb Empire", "symbol": "LAMB", "desc": "來自紐西蘭草原的鮮嫩小羊排。"},
        {"name": "Ham Knight", "symbol": "HAM", "desc": "風乾熟成，時間淬鍊出的美味。"},
        {"name": "Nugget King", "symbol": "NUGT", "desc": "小朋友的最愛，統治速食產業。"},
        {"name": "Golden Six", "symbol": "SONG", "desc": "珍貴的松阪豬，口感爽脆。"},
        {"name": "Ribeye Bros", "symbol": "RIBE", "desc": "油花均勻，牛排愛好者的首選。"},
        {"name": "Pork Belly Machine", "symbol": "KONG", "desc": "24小時都能吃到媽媽的味道。"},
        {"name": "Iberico Pig", "symbol": "IBER", "desc": "吃橡實長大的豬，帶有獨特堅果香。"},
        {"name": "Angus Prime", "symbol": "ANGS", "desc": "純正血統，品質保證的牛肉品牌。"},
        {"name": "Sirloin Lady", "symbol": "SIRL", "desc": "柔嫩多汁，受到廣大女性喜愛。"},
        {"name": "Smoked Bacon", "symbol": "SMOK", "desc": "過年過節必備，濃郁的煙燻香氣。"},
        {"name": "Drumstick King", "symbol": "LEG", "desc": "只賣雞腿，因為那是最好吃的部位。"},
        {"name": "Beef Tongue", "symbol": "TONG", "desc": "Q彈有勁，燒烤店的必點美味。"},
        {"name": "Fatty Beef", "symbol": "FATT", "desc": "火鍋的最佳拍檔，油花就是正義。"}
    ],
    "ROOT": [
        {"name": "Golden Yam", "symbol": "YAM", "desc": "富含纖維，養生族群的最愛。"},
        {"name": "Diamond Potato", "symbol": "POTA", "desc": "無論炸、烤、煮都美味的萬能食材。"},
        {"name": "Energy Ginseng", "symbol": "GINS", "desc": "補氣養身，來自長白山的頂級人參。"},
        {"name": "Carrot Hero", "symbol": "CARR", "desc": "保護視力，讓你的眼睛亮晶晶。"},
        {"name": "Crying Onion", "symbol": "ONIO", "desc": "層層剝開你的心，料理的靈魂。"},
        {"name": "Ginger Master", "symbol": "GING", "desc": "冬天進補首選，溫暖你的身心。"},
        {"name": "Garlic Guard", "symbol": "GARL", "desc": "驅吸血鬼也驅病菌，健康守護者。"},
        {"name": "Red Beet", "symbol": "BEET", "desc": "天然色素，補血養顏的聖品。"},
        {"name": "Taro Lord", "symbol": "TARO", "desc": "火鍋裡該不該放芋頭？引發宗教戰爭。"},
        {"name": "Radish Cake", "symbol": "RABI", "desc": "步步高升，早餐店的經典。"},
        {"name": "Yam Master", "symbol": "YAMM", "desc": "黏稠口感，滋陰補陽的上選。"},
        {"name": "Lotus Lady", "symbol": "LOTU", "desc": "出淤泥而不染，清脆爽口的涼拌菜。"},
        {"name": "Burdock Man", "symbol": "BURD", "desc": "富含菊糖，腸道健康的清道夫。"},
        {"name": "Bamboo Boy", "symbol": "BAMB", "desc": "雨後春筍，鮮嫩脆甜。"},
        {"name": "Water Chestnut", "symbol": "WCHE", "desc": "口感像水梨，卻生長在水田中。"},
        {"name": "Sweet Potato Leaf", "symbol": "LEAF", "desc": "從窮人食物變身養生蔬菜的逆襲。"},
        {"name": "Cassava Powder", "symbol": "CASS", "desc": "珍珠奶茶的原料，台灣之光的幕後功臣。"},
        {"name": "Konjac jelly", "symbol": "KONJ", "desc": "低熱量高纖維，減肥者的好朋友。"},
        {"name": "Turmeric Warrior", "symbol": "TURM", "desc": "抗發炎抗氧化，咖哩的黃色力量。"},
        {"name": "Kudzu Soup", "symbol": "KUDZ", "desc": "傳統漢方，舒緩感冒初期症狀。"}
    ]
}

# 2. 市場新聞庫 (Market Events)
NEWS_EVENTS = {
    # ======= 利多 (Bullish) =======
    "UP": [
        {"title": "業績大爆發", "desc": "季度財報優於預期，每股盈餘(EPS)創新高，股價強勢表態。"},
        {"title": "接獲大訂單", "desc": "宣佈獲得國際科技巨頭長期合約，營收能見度已達三年後。"},
        {"title": "併購傳聞", "desc": "市場傳言將被大型金控溢價收購，激勵股價跳空漲停。"},
        {"title": "新產品發表", "desc": "年度旗艦產品受到市場熱烈迴響，預購量癱瘓官網。"},
        {"title": "外資買進", "desc": "華爾街頂級投行發布買進報告，目標價調升 50%。"},
        {"title": "庫藏股", "desc": "公司宣佈實施大規模庫藏股護盤，展現對未來營運的信心。"},
        {"title": "法說會報喜", "desc": "執行長在法說會上釋出極度樂觀展望，法人全面上調評等。"},
        {"title": "技術突破", "desc": "研發團隊取得關鍵技術專利，將大幅降低生產成本。"},
        {"title": "配息加碼", "desc": "董事會決議發放高額現金股利，殖利率誘人吸引存股族。"},
        {"title": "董監大買", "desc": "內部人近期在市場上大舉敲進自家股票，籌碼面趨於穩定。"},
        {"title": "納入指數", "desc": "宣佈即將被納入 MSCI 成分股，被動型基金準備進場佈局。"},
        {"title": "政策利多", "desc": "政府推出產業補貼方案，該公司為最大受惠者。"},
        {"title": "原物料跌", "desc": "主要原物料價格崩跌，公司毛利率可望顯著提升。"},
        {"title": "擊敗對手", "desc": "主要競爭對手爆發品質瑕疵，大量訂單轉向該公司。"},
        {"title": "擴廠計畫", "desc": "斥資百億興建新廠，展現擴張版圖的強烈企圖心。"},
        {"title": "元宇宙題材", "desc": "宣佈進軍元宇宙與 NFT 市場，股價搭上熱門題材順風車。"},
        {"title": "AI 轉型", "desc": "成功導入 AI 自動化生產，預期人力成本將大幅下降。"},
        {"title": "ESG 績優", "desc": "榮獲年度最佳 ESG 企業獎，吸引永續投資基金青睞。"},
        {"title": "解封受惠", "desc": "隨著疫情趨緩國境解封，觀光旅遊需求報復性反彈。"},
        {"title": "神秘大戶", "desc": "傳聞某知名市場主力已悄悄吃貨，籌碼集中度飆升。"}
    ],
    
    # ======= 利空 (Bearish) =======
    "DOWN": [
        {"title": "財報地雷", "desc": "意外轉盈為虧，毛利率創下歷史新低，失望性賣壓出籠。"},
        {"title": "訂單遭砍", "desc": "最大客戶無預警大砍訂單，庫存水位嚴重攀升。"},
        {"title": "高層涉弊", "desc": "財務長涉嫌內線交易遭檢調約談，公司治理亮紅燈。"},
        {"title": "產品召回", "desc": "明星商品發生電池起火意外，宣佈全面召回，商譽受損。"},
        {"title": "外資看空", "desc": "大摩發布最新報告，給予「劣於大盤」評等，目標價腰斬。"},
        {"title": "增資恐慌", "desc": "宣佈將辦理現金增資，市場擔憂股本膨脹稀釋獲利。"},
        {"title": "法說會變法會", "desc": "經營層對未來展望保守，坦言景氣寒冬將至。"},
        {"title": "專利敗訴", "desc": "關鍵技術專利訴訟敗訴，恐面臨鉅額賠償金與禁售令。"},
        {"title": "配息縮水", "desc": "股利發放不如預期，存股族失望棄守，引發多殺多。"},
        {"title": "董監拋售", "desc": "大股東申報轉讓持股，引發市場恐慌，懷疑高點已到。"},
        {"title": "剔除指數", "desc": "遭移出 0050 成分股名單，將面臨被動基金調節賣壓。"},
        {"title": "政策打壓", "desc": "政府祭出嚴厲監管措施，產業前景蒙上一層陰影。"},
        {"title": "原物料漲", "desc": "通膨導致原物料飆漲，嚴重侵蝕獲利能力。"},
        {"title": "對手崛起", "desc": "競爭對手推出殺手級新品，市佔率面臨嚴峻挑戰。"},
        {"title": "建廠延宕", "desc": "海外新廠因缺工缺料延後投產，營收成長動能受阻。"},
        {"title": "資安駭客", "desc": "公司伺服器遭勒索病毒攻擊，營運全面停擺，損失慘重。"},
        {"title": "裁員風暴", "desc": "宣佈啟動大規模裁員計畫，員工士氣低落，工會醞釀抗爭。"},
        {"title": "環保違規", "desc": "排放廢水遭環保局重罰並勒令停工，社會形象跌入谷底。"},
        {"title": "疫情重創", "desc": "變種病毒肆虐導致多處據點封城，供應鏈完全斷鏈。"},
        {"title": "做空機構", "desc": "知名做空機構發布獵殺報告，指控財報造假，股價跳水。"}
    ],

    # ======= 極端/崩盤 (Shock/Chaos) =======
    "SHOCK": [
        {"title": "熔斷機制", "desc": "市場恐慌情緒蔓延，指數暴跌觸發熔斷，全面暫停交易。"},
        {"title": "核爆危機", "desc": "地緣政治緊張局勢升級，傳聞戰術核武已進入待命狀態。"},
        {"title": "外星人入侵", "desc": "NASA 證實不明飛行物編隊接近地球，全球股市崩盤。"},
        {"title": "金融海嘯", "desc": "雷曼時刻再現！大型銀行驚傳倒閉，流動性瞬間枯竭。"},
        {"title": "AI 覺醒", "desc": "超級人工智慧產生自我意識，宣稱將接管人類金融系統。"},
        {"title": "隕石撞擊", "desc": "小行星正朝地球飛來，末日預言甚囂塵上，資產遭拋售。"},
        {"title": "殭屍病毒", "desc": "實驗室洩漏未知病毒，引發喪屍危機，生技股獨強。"},
        {"title": "時空裂縫", "desc": "科學家發現通往平行宇宙的傳送門，物理法則失效。"},
        {"title": "超級通膨", "desc": "貨幣價值歸零，買麵包需要一卡車鈔票，以物易物重現。"},
        {"title": "石油枯竭", "desc": "中東油田宣告枯竭，能源危機爆發，全球經濟停擺。"}
    ],
    
    # ======= 謠言 (Fake News) =======
    "RUMOR": [
        {"title": "路邊社消息", "desc": "隔壁老王說這家公司好像要倒了，快跑！"},
        {"title": "網紅爆料", "desc": "知名 Youtuber 影片暗示某高層有桃色糾紛。"},
        {"title": "PTT 貼文", "desc": "有網友在股板發畢業文，表示將反手做空這檔股票。"},
        {"title": "早餐店阿姨", "desc": "連早餐店阿姨都在推薦這支股票，可能是擦鞋童理論。"},
        {"title": "神祕代碼", "desc": "有人在馬斯克的推文中發現了這家公司的代碼，暗示？"},
        {"title": "夢到的", "desc": "知名分析師說他昨晚做夢夢到這檔股票會漲停。"},
        {"title": "計程車司機", "desc": "司機大哥說載到公司高層，聽說有大利多。"}
    ]
}

# 3. 專家名言/預測 (Guru Quotes)
GURU_QUOTES = {
    # 狼 (Aggressive Bull/Bear)
    "華爾街之狼": {
        "BULL": [
            "這支股票是下一個 Apple！現在不買，以後只能看這張壁紙哭！",
            "這種價位簡直是送錢！我已經 All-in 了，你呢？",
            "只要有膽識，財富自由不是夢！這是一生一次的機會！",
            "不要慫，就是幹！給我往死裡買！目標價直接翻倍！",
            "恐懼時貪婪！現在滿地都是便宜的鑽石，快撿！"
        ],
        "BEAR": [
            "這是一場徹頭徹尾的龐氏騙局！快逃！連內褲都不要了！",
            "垃圾！這家公司唯一的價值就是它的辦公桌椅！做空它！",
            "我聞到了死亡的味道。這支股票即將歸零！",
            "誰現在買進誰就是接盤俠！聰明人都已經離場了！",
            "崩盤就在眼前！這將是歷史上最慘烈的屠殺！"
        ]
    },
    
    # 婆婆 (Mystic)
    "水晶球婆婆": {
        "BULL": [
            "昨晚觀星，見紫微星垣照耀此股，大吉之兆。",
            "塔羅牌抽到了「太陽」，象徵無盡的光明與獲利。",
            "我感覺到了這家公司的氣場正在轉強，宇宙能量正在匯聚。",
            "水晶球中顯現出了金色的光芒，這是財富的顏色。",
            "命中注定此股將有一波大運，信者得愛。"
        ],
        "BEAR": [
            "星象凶險，水逆當頭，此股恐有血光之災。",
            "牌面顯示「高塔」逆位，毀滅即將降臨，速速迴避。",
            "一股黑氣纏繞在Ｋ線圖上，大凶！大凶啊！",
            "不要違抗天命，這支股票氣數已盡。",
            "我夢見了紅色的瀑布，那是投資人的血淚。"
        ]
    },

    # 機器人 (Quant)
    "AI 量化機器人": {
        "BULL": [
            "分析模式：多頭。RSI < 30，黃金交叉確認。勝率：87.5%。",
            "偵測到主力籌碼異常集中，演算法建議：強力買進。",
            "基本面數據優於歷史平均 3 個標準差，股價嚴重低估。",
            "回測模型顯示此型態未來一週上漲機率為 92.4%。",
            "執行指令：BUY。目標價位已鎖定。"
        ],
        "BEAR": [
            "警報：乖離率過大。均線死亡交叉。建議立即止損。",
            "偵測到非理性繁榮，泡沫係數已達臨界值 9.9。",
            "財報數據與股價呈現高度負相關，演算法建議：放空。",
            "根據大數據分析，此類股泡沫破裂機率高達 98%。",
            "執行指令：SELL。啟動避險程序。"
        ]
    },

    # 老王 (Conservative)
    "穩健老王": {
        "BULL": [
            "這家公司體質不錯，每年配息都很穩，可以買來存退休金。",
            "年輕人不要急，慢慢存股，這支股票長線看好。",
            "我看此股本益比合理，管理層也正派，適合長期持有。",
            "這種跌法是非理性的，好公司遇到倒楣事，反而是買點。",
            "買這支就像買房收租一樣安心，晚上睡得著覺。"
        ],
        "BEAR": [
            "股價已經脫離基本面太多了，追高風險太大，我不碰。",
            "這種炒作題材的股票，漲得快跌得也快，小心駛得萬年船。",
            "老人家我看過太多這種主力拉高出貨的戲碼了，別去接刀。",
            "殖利率太低了，不如把錢放銀行定存。",
            "聽叔叔一句勸，人多的地方不要去，見好就收吧。"
        ]
    },
    
    # 幣圈 (Crypto/Tech)
    "區塊鏈信仰者": {
        "BULL": [
            "這家公司要發幣了嗎？股價 To The Moon！🚀🚀🚀",
            "這就是股票界的比特幣！HODL！不要輕易下車！",
            "社群共識極強，鑽石手準備好了嗎？💎🙌",
            "去中心化金融是未來，這支股票掌握了關鍵技術！",
            "WAGMI (We Are All Gonna Make It)！一起飛向月球！"
        ],
        "BEAR": [
            "這根本是中心化的垃圾 (Fiat Scams)，完全沒有去中心化精神！",
            "這是典型的 Rug Pull (捲款跑路) 徵兆！小心被割韭菜！",
            "項目方在大量倒貨了，這是不是要歸零了？",
            "這支股票連白皮書都沒有，根本是空氣幣！",
            "FUD (恐懼、不確定、懷疑) 正在蔓延，先跑為敬。"
        ]
    }
}
