import json
import requests

URL = 'https://script.google.com/macros/s/AKfycbxQOorPl0pb6NosauudEePUyO7kfdeKGuILdLfrsfWFOtBlRxeUTAfSm38AqjVnnAiH/exec'

payload = {
    "action": "submit",
    "payload": {
        "type": "支出",
        "submitter": "テストユーザー",
        "date": "2026-04-20",
        "category": "その他",
        "amount": 100,
        "description": "API Test",
        "payee": "Test Payee",
        "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==",
        "imageMimeType": "image/png"
    }
}

try:
    response = requests.post(
        URL,
        headers={'Content-Type': 'text/plain;charset=utf-8'},
        data=json.dumps(payload),
        allow_redirects=True
    )
    print(f"Status: {response.status_code}")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
