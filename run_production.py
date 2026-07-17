import os
from waitress import serve
from app import app

if __name__ == "__main__":
    PORT = 5002
    print(f"--- GustoAnalytics WSGI Server (Waitress) ---")
    print(f"Serving application on http://127.0.0.1:{PORT}")
    print("Multi-threaded serving active (threads=6). Press Ctrl+C to terminate.")
    serve(app, host="127.0.0.1", port=PORT, threads=6)
