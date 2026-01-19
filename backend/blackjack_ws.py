"""
21 點 WebSocket 廣播輔助模組
"""
import asyncio
from typing import Callable, Any

# 廣播回調函式和事件循環，由 main.py 設置
_broadcast_callback = None
_event_loop = None

def set_broadcast_callback(callback, loop=None):
    """設置廣播回調函式和事件循環"""
    global _broadcast_callback, _event_loop
    _broadcast_callback = callback
    _event_loop = loop

def broadcast_room_state(room_id: int, room_state: dict):
    """廣播房間狀態（從同步函式呼叫）"""
    global _broadcast_callback, _event_loop
    if _broadcast_callback and _event_loop:
        try:
            # 使用 run_coroutine_threadsafe 安全地在事件循環中執行
            future = asyncio.run_coroutine_threadsafe(
                _broadcast_callback(room_id, room_state),
                _event_loop
            )
            # 等待結果（最多 2 秒），確保廣播完成
            future.result(timeout=2.0)
        except Exception as e:
            print(f"[Blackjack Broadcast Error] {e}")

