import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.data_fetch.data_fetch import build_market_snapshot

app = FastAPI(title="Market Data API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/market-data")
def market_data():
    snapshot = build_market_snapshot()
    
    # Extract only BTC prices and market caps, filter out history and ETFs
    btc_data = snapshot.get("BTC", {})
    prices = btc_data.get("prices", {})
    
    # Build clean output with only relevant currency data
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
    
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
