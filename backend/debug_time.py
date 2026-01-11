from datetime import datetime, timedelta
import time
import sys

print(f"--- DEBUG TIME INFO ---")
print(f"System Time (datetime.now): {datetime.now()}")
print(f"UTC Time (datetime.utcnow): {datetime.utcnow()}")
print(f"Timestamp (now.timestamp): {datetime.now().timestamp()}")

ts = datetime.now().timestamp()
reconstructed = datetime.fromtimestamp(ts)
print(f"Reconstructed from Timestamp: {reconstructed}")

# Test the api.py logic
print(f"--- API LOGIC TEST ---")
api_time_logic = int(ts) + 28800
print(f"API sends (ts + 28800): {api_time_logic}")
print(f"Equivalent DateTime: {datetime.fromtimestamp(api_time_logic)}")

print(f"--- CONCLUSION ---")
local_now = datetime.now()
utc_now = datetime.utcnow()
diff = (local_now - utc_now).total_seconds() / 3600
print(f"Detected Offset from UTC: {diff} hours")
