import os

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:5175",
    "http://127.0.0.1:5175",
])

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


@app.route("/api/sunny", methods=["POST"])
def sunny():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return jsonify({"error": "ANTHROPIC_API_KEY not configured"}), 500

    data = request.get_json(silent=True) or {}
    messages = data.get("messages")
    system = data.get("system")

    if not messages or not isinstance(messages, list):
        return jsonify({"error": "messages array is required"}), 400

    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1000,
        "messages": messages,
    }
    if system:
        payload["system"] = system

    try:
        response = requests.post(
            ANTHROPIC_API_URL,
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": ANTHROPIC_VERSION,
            },
            json=payload,
            timeout=60,
        )
        return jsonify(response.json()), response.status_code
    except requests.RequestException as exc:
        return jsonify({"error": str(exc)}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
