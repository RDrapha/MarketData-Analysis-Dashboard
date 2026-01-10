import os
import time
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.data_fetch.data_fetch import build_market_snapshot

app = FastAPI(title="Market Data API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache settings
CACHE_TTL = 120  # Cache for 2 minutes (seconds)
_cache = {
    "data": None,
    "timestamp": 0
}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/market-data")
def market_data():
    global _cache
    now = time.time()
    
    # Return cached data if still valid
    if _cache["data"] and (now - _cache["timestamp"]) < CACHE_TTL:
        return _cache["data"]
    
    # Fetch new data
    snapshot = build_market_snapshot()
    
    # Extract only BTC prices and market caps
    btc_data = snapshot.get("BTC", {})
    prices = btc_data.get("prices", {})
    
    result = {
        "timestamp": snapshot.get("timestamp"),
        "currencies": {}
    }
    
    currencies = [
        "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "EUR", "GBP",
        "HKD", "ILS", "JPY", "KRW", "NOK", "NZD", "PLN", "RUB",
        "SEK", "SGD", "USD", "BTC"
    ]
    
    for curr in currencies:
        key = curr.lower()
        price = prices.get(key)
        mcap = prices.get(f"{key}_market_cap")
        
        if price is not None:
            result["currencies"][curr] = {
                "price": price,
                "market_cap": mcap
            }
    
    # Store in cache
    _cache["data"] = result
    _cache["timestamp"] = now
    
    return result


# Mount static files (frontend)
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
