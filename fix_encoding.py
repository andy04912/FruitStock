
import os

file_path = "backend/api.py"

with open(file_path, "rb") as f:
    content = f.read()

# Replace null bytes
cleaned_content = content.replace(b'\x00', b'')

with open(file_path, "wb") as f:
    f.write(cleaned_content)

print(f"Cleaned {len(content)} bytes to {len(cleaned_content)} bytes.")
