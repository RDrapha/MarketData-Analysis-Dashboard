import requests
import json
from datetime import datetime
import yfinance as yf
import time

# ----------------------------
# SETTINGS
# ----------------------------

# Currencies to fetch
CURRENCIES = [
    "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "EUR", "GBP",
    "HKD", "ILS", "JPY", "KRW", "NOK", "NZD", "PLN", "RUB",
    "SEK", "SGD", "USD", "BTC"
]

# ETFs to fetch
ETFS = ["SPY", "VOO", "QQQ"]  # you can add more

# Historical timeframes
TIMEFRAMES = {
    "1d": "1d",
    "1w": "7d",
    "1m": "30d",
    "ytd": "ytd",
    "1y": "365d",
    "5y": "1825d",
    "10y": "3650d",
    "all": "max"
}

# Update interval in seconds for realtime BTC price
UPDATE_INTERVAL = 60  # 1 minute

# Cache settings for historical data (CoinGecko rate limits are stricter for history)
HISTORY_TTL_SECONDS = 1800  # 30 minutes
# Runtime cache
_HISTORY_CACHE = None
_HISTORY_CACHE_TS = 0

# Chart data cache (per currency/timeframe)
_CHART_CACHE = {}

# Output JSON file
OUTPUT_FILE = "market_data.json"

# ----------------------------
# FUNCTION TO FETCH CURRENT BTC PRICES
# ----------------------------
def fetch_btc_prices():
    """
    Fetch current Bitcoin prices in all currencies + market cap
    and calculate Satoshi.
    """
    url = "https://api.coingecko.com/api/v3/simple/price"
    params = {
        "ids": "bitcoin",
        "vs_currencies": ",".join(CURRENCIES),
        "include_market_cap": "true"
    }
    resp = requests.get(url, params=params)
    data = resp.json().get("bitcoin", {})

    # Add Satoshi value
    data["sat"] = int(data.get("usd", 0) * 100_000_000)

    # Market cap only for selected currencies
    market_cap = {curr: data.get(f"{curr}_market_cap") for curr in CURRENCIES}

    return data, market_cap

# ----------------------------
# FUNCTION TO FETCH HISTORICAL BTC DATA
# ----------------------------
def fetch_btc_history():
    """
    Fetch historical Bitcoin prices for multiple timeframes.
    CoinGecko OHLC API supports 1 day and higher.
    """
    history_data = {}
    for label, days in TIMEFRAMES.items():
        hist_url = f"https://api.coingecko.com/api/v3/coins/bitcoin/ohlc"
        hist_params = {"vs_currency": "usd", "days": days}
        hist_resp = requests.get(hist_url, params=hist_params)
        if hist_resp.status_code == 200:
            history_data[label] = hist_resp.json()
        else:
            history_data[label] = []
    return history_data


def get_history(ttl_seconds: int = HISTORY_TTL_SECONDS):
    """Return cached historical data to limit CoinGecko calls."""
    global _HISTORY_CACHE, _HISTORY_CACHE_TS
    now = time.time()
    if _HISTORY_CACHE and (now - _HISTORY_CACHE_TS) < ttl_seconds:
        return _HISTORY_CACHE

    _HISTORY_CACHE = fetch_btc_history()
    _HISTORY_CACHE_TS = now
    return _HISTORY_CACHE

# ----------------------------
# FUNCTION TO FETCH ETF DATA
# ----------------------------
def fetch_etf_data(btc_usd):
    """
    Fetch ETFs using yfinance, get price in USD and convert to BTC.
    """
    etf_data = {}
    for ticker in ETFS:
        etf = yf.Ticker(ticker)
        try:
            price = etf.history(period="1d")["Close"][-1]
            price_btc = price / btc_usd if btc_usd else None
            etf_data[ticker] = {"price_usd": price, "price_btc": price_btc}
        except Exception as e:
            etf_data[ticker] = {"error": str(e)}
    return etf_data


def build_market_snapshot(history_ttl_seconds: int = HISTORY_TTL_SECONDS):
    """Fetch current snapshot: BTC prices, market cap, history, ETF quotes."""
    btc_prices, market_cap = fetch_btc_prices()
    etfs = fetch_etf_data(btc_prices.get("usd"))
    history = get_history(ttl_seconds=history_ttl_seconds)

    return {
        "timestamp": datetime.now().isoformat(),
        "BTC": {
            "prices": btc_prices,
            "market_cap": market_cap,
            "history": history
        },
        "ETFs": etfs
    }

# ----------------------------
# FUNCTION TO FETCH BTC CHART DATA
# ----------------------------
def fetch_btc_chart_data(currency: str, timeframe: str):
    """
    Fetch BTC price history for charting.
    
    Args:
        currency: Currency code (e.g., USD, EUR, BTC)
        timeframe: Days as string or 'max'
    
    Returns:
        List of [timestamp_ms, price] pairs
    """
    global _CHART_CACHE
    
    cache_key = f"{currency}_{timeframe}"
    now = time.time()
    
    # Check cache (60 min TTL for chart data - much longer since it rarely changes)
    if cache_key in _CHART_CACHE:
        cached_data, cached_time = _CHART_CACHE[cache_key]
        if (now - cached_time) < 3600:  # 60 minutes
            print(f"[CHART CACHE HIT] {cache_key} (age: {now - cached_time:.0f}s)")
            return cached_data
    
    # Map timeframe to days
    timeframe_map = {
        "1h": "1",      # CoinGecko doesn't have hourly, use 1 day with 5min intervals
        "1d": "1",
        "7d": "7",
        "1m": "30",
        "6m": "180",
        "ytd": "ytd",   # Not directly supported, we'll calculate
        "1y": "365",
        "5y": "1825",
        "10y": "3650",
        "max": "max"
    }
    
    days = timeframe_map.get(timeframe, "30")
    
    # Handle YTD specially
    if timeframe == "ytd":
        from datetime import datetime
        start_of_year = datetime(datetime.now().year, 1, 1)
        days_since_jan1 = (datetime.now() - start_of_year).days
        days = str(max(1, days_since_jan1))
    
    url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
    params = {
        "vs_currency": currency.lower(),
        "days": days
    }
    
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        # Extract prices array [[timestamp_ms, price], ...]
        prices = data.get("prices", [])
        
        # Cache the result
        _CHART_CACHE[cache_key] = (prices, now)
        print(f"[CHART CACHE NEW] {cache_key} ({len(prices)} points)")
        
        return prices
    except Exception as e:
        print(f"Error fetching chart data: {e}")
        # Return cached data even if expired (fallback)
        if cache_key in _CHART_CACHE:
            return _CHART_CACHE[cache_key][0]
        return []

# ----------------------------
# MAIN LOOP FOR REALTIME UPDATES
# ----------------------------
def main_loop():
    """
    Main loop: fetch BTC realtime every minute, update JSON file.
    Historical and ETF data are fetched once at start.
    """
    while True:
        output = build_market_snapshot()

        with open(OUTPUT_FILE, "w") as f:
            json.dump(output, f, indent=4)

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Data updated in {OUTPUT_FILE}")

        # Wait before next update
        time.sleep(UPDATE_INTERVAL)

# ----------------------------
# ENTRY POINT
# ----------------------------
if __name__ == "__main__":
    main_loop()


