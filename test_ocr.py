import base64
import requests
import json
import sys

URL = 'https://script.google.com/macros/s/AKfycbx9kqh_pob0Vk0UNQyYxGfGJSvpD1nb7KY6gEr0abS_RYdbVDFjpAvLJMKWizYAheZV/exec'
IMAGE_PATH = sys.argv[1]

# Load and encode image
with open(IMAGE_PATH, 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('utf-8')

payload = {
    "action": "ocr",
    "payload": {
        "imageBase64": img_b64,
        "imageMimeType": "image/png"
    }
}

print(f"Sending POST request to {URL}...")
# Note: Google Apps Script with text/plain requires redirects
# Requests handles redirects by default
response = requests.post(
    URL,
    headers={'Content-Type': 'text/plain;charset=utf-8'},
    data=json.dumps(payload)
)

print(f"Status Code: {response.status_code}")
print("Response Text:")
print(response.text)
