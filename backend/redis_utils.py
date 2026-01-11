import os
import redis.asyncio as redis

redis_client = None

async def get_redis():
    global redis_client
    if redis_client is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        try:
            redis_client = redis.from_url(url, decode_responses=True)
            print(f"[RedisUtils] Connected to {url}")
        except Exception as e:
            print(f"[RedisUtils] Failed to connect: {e}")
    return redis_client

async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None
