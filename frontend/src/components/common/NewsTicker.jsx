import React from "react";
import { useSocket } from "../../context/SocketContext";

export default function NewsTicker() {
  const { marketData, isConnected } = useSocket();
  const event = marketData.event;
  const forecast = marketData.forecast;

  let content = "";
  let type = "normal"; // normal, event, error, forecast

  if (!isConnected) {
     content = "🔴 系統連線中斷 (CONNECTION LOST) /// 正在重新建立數據連結... 請檢查您的網路狀態";
     type = "error";
  } else if (event) {
     content = `⚠️ 重大快訊 (BREAKING): ${event.title} - ${event.description} /// 市場影響: ${(event.impact_multiplier * 100).toFixed(0)}%`;
     type = "event";
  } else if (forecast) {
     content = `🔮 市場預測 (FORECAST): 據傳 ${forecast.stock_name} 即將有大動作... (預計 ${forecast.eta_seconds} 秒後)`;
     type = "forecast";
  } else {
     content = "🟢 系統連線正常 (SYSTEM ONLINE) /// 持續監控市場波動 /// 等待最新交易事件...";
     type = "normal";
  }

  const getTextColor = () => {
      if (type === "error") return "text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)] font-bold";
      if (type === "event") return "text-accent drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]";
      if (type === "forecast") return "text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.8)]";
      return "text-primary/70";
  }

  const tickerContent = (
    <div className="flex items-center gap-20 px-4">
      <span className={`whitespace-nowrap ${getTextColor()}`}>
        {content}
      </span>
      <span className="opacity-50 text-xs text-primary/40 whitespace-nowrap"> /// FRUITSTOCK V2.0 </span>
      <span className={`whitespace-nowrap ${getTextColor()}`}>
        {content}
      </span>
       <span className="opacity-50 text-xs text-primary/40 whitespace-nowrap"> /// FRUITSTOCK V2.0 </span>
    </div>
  );

  return (
    <div className="relative w-full overflow-hidden bg-black/80 border-y border-primary/30 backdrop-blur-sm h-8 flex items-center group">
      {/* Scanline effect overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(6,182,212,0.1)_50%)] bg-[length:100%_4px] pointer-events-none z-10"></div>
      
      {/* Scrolling Wrapper - Moves by -50% of its total width (which contains 2 copies) */}
      <div className="flex animate-marquee w-max group-hover:[animation-play-state:paused]">
        {/* Track 1 */}
        <div className="flex shrink-0 items-center">
            {tickerContent}
        </div>
        {/* Track 2 (Duplicate for loop) */}
        <div className="flex shrink-0 items-center">
            {tickerContent}
        </div>
      </div>

      {/* Side fades */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-20"></div>
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-20"></div>
    </div>
  );
}
