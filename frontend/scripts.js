const API_URL = "https://marketdata-analysis-dashboard-production.up.railway.app/api/market-data";
// const API_URL = "http://localhost:8000/api/market-data"; // Local development
const CACHE_KEY = "btc_prices_cache";
const AUTO_UPDATE_INTERVAL = 120000; // 2 minutes (backend caches for 2 min)

const state = {
    lastData: null,
    loading: false
};

const fmtNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const refreshBtn = document.getElementById("refresh-btn");
const toast = document.getElementById("toast");
const timestampEl = document.getElementById("timestamp");

const CURRENCIES = [
    { code: "AUD", name: "Australian Dollar" },
    { code: "BRL", name: "Brazilian Real" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "CZK", name: "Czech Koruna" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "HKD", name: "Hong Kong Dollar" },
    { code: "ILS", name: "Israeli Shekel" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "KRW", name: "South Korean Won" },
    { code: "NOK", name: "Norwegian Krone" },
    { code: "NZD", name: "New Zealand Dollar" },
    { code: "PLN", name: "Polish Zloty" },
    { code: "RUB", name: "Russian Ruble" },
    { code: "SEK", name: "Swedish Krona" },
    { code: "SGD", name: "Singapore Dollar" },
    { code: "USD", name: "US Dollar" },
    { code: "BTC", name: "Bitcoin" }
];

async function loadData() {
    if (state.loading) return;
    setLoading(true);
    hideToast();

    try {
        const res = await fetch(API_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        state.lastData = data;
        
        // Save to localStorage for offline access
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        
        renderTimestamp();
        renderBtc(data?.currencies);
    } catch (err) {
        showToast(`Loading failed: ${err.message}`);
    } finally {
        setLoading(false);
    }
}

function loadCachedData() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            state.lastData = data;
            renderTimestamp();
            renderBtc(data?.currencies);
            return true;
        } catch (e) {
            console.error("Failed to load cached data", e);
            return false;
        }
    }
    return false;
}

function renderTimestamp() {
    // Use current browser time, not server time (different timezones)
    const date = new Date();
    const options = { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    timestampEl.textContent = `Updated: ${date.toLocaleString('en-US', options)}`;
}

function renderBtc(currencies) {
    if (!currencies) {
        showToast("No BTC data available.");
        return;
    }

    const btcList = document.getElementById("btc-list");
    btcList.innerHTML = "";

    CURRENCIES.forEach((curr) => {
        const data = currencies[curr.code];
        if (!data) return;

        const item = document.createElement("div");
        item.className = "currency-item";
        
        const priceFormatted = fmtNumber.format(data.price);
        const mcapFormatted = data.market_cap !== null && data.market_cap !== undefined 
            ? fmtNumber.format(data.market_cap) 
            : "N/A";

        item.innerHTML = `
            <p class="currency-name">${curr.name} (${curr.code}): <span class="value">"${priceFormatted} ${curr.code}"</span></p>
            <p class="mcap">Bitcoin market capitalization in ${curr.code}: <span class="value">"${mcapFormatted}"</span></p>
        `;
        
        btcList.appendChild(item);
    });
}

function showToast(msg) {
	toast.textContent = msg;
	toast.classList.remove("hidden");
}

function hideToast() {
	toast.classList.add("hidden");
}

function setLoading(flag) {
	state.loading = flag;
	refreshBtn.disabled = flag;
    refreshBtn.textContent = flag ? "Loading..." : "Reload";
}

refreshBtn.addEventListener("click", () => loadData());
document.addEventListener("DOMContentLoaded", () => {
    // Load cached data immediately if available
    loadCachedData();
    
    // Then fetch fresh data
    loadData();
    
    // Auto-update every 30 seconds
    setInterval(() => loadData(), AUTO_UPDATE_INTERVAL);
});