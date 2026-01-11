const API_URL = "https://marketdata-analysis-dashboard-production.up.railway.app/api/market-data";
// const API_URL = "http://localhost:8000/api/market-data"; // Local development
const CACHE_KEY = "btc_prices_cache";
const AUTO_UPDATE_INTERVAL = 120000; // 2 minutes (backend caches for 2 min)

const state = {
    lastData: null,
    loading: false
};

const fmtNumber = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const refreshBtn = document.getElementById("refresh-btn");
const toast = document.getElementById("toast");
const timestampEl = document.getElementById("timestamp");
const favoriteCurrencySelect = document.getElementById("favorite-currency");

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
].sort((a, b) => a.name.localeCompare(b.name)); // Alphabetical by name

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
        year: 'numeric',
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
// Get pinned currency
    const pinnedCurr = localStorage.getItem("pinned_currency");
    let displayOrder = [...CURRENCIES];
    
    // Move pinned to top if selected
    if (pinnedCurr) {
        displayOrder = displayOrder.filter(c => c.code !== pinnedCurr);
        const pinned = CURRENCIES.find(c => c.code === pinnedCurr);
        if (pinned) displayOrder.unshift(pinned);
    }

    displayOrder.forEach((curr) => {
        const data = currencies[curr.code];
        if (!data) return;

        const item = document.createElement("div");
        item.className = "currency-item";
        
        const priceFormatted = fmtNumber.format(data.price);
        const mcapFormatted = data.market_cap !== null && data.market_cap !== undefined 
            ? fmtNumber.format(data.market_cap) 
            : "N/A";

        const pinIcon = pinnedCurr === curr.code ? "📌 " : "";
        
        item.innerHTML = `
            <p class="currency-name">${pinIcon}${curr.name}: <span class="value">${curr.code} ${priceFormatted}</span></p>
            <p class="mcap">Bitcoin market capitalization: <span class="value">${curr.code} ${mcapFormatted}</span></p>
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

favoriteCurrencySelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    if (selected) {
        localStorage.setItem("pinned_currency", selected);
    } else {
        localStorage.removeItem("pinned_currency");
    }
    // Re-render to show pinned at top
    if (state.lastData) {
        renderBtc(state.lastData.currencies);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // Populate currency select
    const select = document.getElementById("favorite-currency");
    select.innerHTML = '<option value="">📌 Pin a currency...</option>';
    CURRENCIES.forEach(curr => {
        const option = document.createElement("option");
        option.value = curr.code;
        option.textContent = `${curr.code} - ${curr.name}`;
        select.appendChild(option);
    });
    
    // Set to previously pinned
    const pinned = localStorage.getItem("pinned_currency");
    if (pinned) {
        select.value = pinned;
    }
    
    // Load cached data immediately if available
    loadCachedData();
    
    // Then fetch fresh data
    loadData();
    
    // Auto-update every 30 seconds
    setInterval(() => loadData(), AUTO_UPDATE_INTERVAL);
    
    // Initialize chart
    initChart();
});

// ===============================
// CHART FUNCTIONALITY
// ===============================

let chartInstance = null;
let chartState = {
    currency: "USD",
    timeframe: "1d"
};

function initChart() {
    const chartCurrencySelect = document.getElementById("chart-currency");
    
    // Populate currency dropdown for chart
    CURRENCIES.forEach(curr => {
        const option = document.createElement("option");
        option.value = curr.code;
        option.textContent = `${curr.name} (${curr.code})`;
        chartCurrencySelect.appendChild(option);
    });
    
    // Set default to USD
    chartCurrencySelect.value = "USD";
    
    // Event listener for currency change
    chartCurrencySelect.addEventListener("change", (e) => {
        chartState.currency = e.target.value;
        loadChartData();
    });
    
    // Event listeners for timeframe buttons
    document.querySelectorAll(".timeframe-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            // Remove active class from all
            document.querySelectorAll(".timeframe-btn").forEach(b => b.classList.remove("active"));
            // Add active to clicked
            e.target.classList.add("active");
            // Update state
            chartState.timeframe = e.target.dataset.timeframe;
            loadChartData();
        });
    });
    
    // Initial chart load
    loadChartData();
}

async function loadChartData() {
    const { currency, timeframe } = chartState;
    const chartUrl = `${API_URL.replace("/market-data", "")}/btc-history?currency=${currency}&timeframe=${timeframe}`;
    
    const loadingEl = document.getElementById("chart-loading");
    const chartCanvas = document.getElementById("btc-chart");
    
    if (loadingEl) {
        loadingEl.style.display = "block";
        loadingEl.textContent = "⏳ Loading chart...";
    }
    
    if (chartCanvas) chartCanvas.style.opacity = "0.5";
    
    try {
        // Set timeout to prevent hanging - only 8 seconds for responsiveness
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        console.log(`Fetching chart: ${chartUrl}`);
        
        const res = await fetch(chartUrl, { 
            cache: "no-store",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`Response status: ${res.status}`);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        console.log(`Got data:`, data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (data.data && data.data.length > 0) {
            console.log(`Rendering chart with ${data.data.length} points`);
            renderChart(data.data, currency);
            if (loadingEl) loadingEl.style.display = "none";
            if (chartCanvas) chartCanvas.style.opacity = "1";
        } else {
            throw new Error("No chart data available");
        }
    } catch (err) {
        console.error("Chart loading failed:", err);
        if (loadingEl) {
            if (err.name === "AbortError") {
                loadingEl.textContent = "⚠️ Timeout - skipping chart";
                setTimeout(() => {
                    if (loadingEl) loadingEl.style.display = "none";
                }, 3000);
            } else {
                loadingEl.textContent = `⚠️ ${err.message}`;
                setTimeout(() => {
                    if (loadingEl) loadingEl.style.display = "none";
                }, 5000);
            }
        }
        if (chartCanvas) chartCanvas.style.opacity = "1";
    }
}

function renderChart(dataPoints, currency) {
    const ctx = document.getElementById("btc-chart");
    if (!ctx) {
        console.error("Chart canvas not found");
        return;
    }
    
    const context = ctx.getContext("2d");
    
    // Destroy existing chart
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    // Format data for Chart.js - CoinGecko returns [[timestamp_ms, price], ...]
    const labels = dataPoints.map(point => new Date(point[0]));
    const prices = dataPoints.map(point => point[1]);
    
    chartInstance = new Chart(context, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: `Bitcoin Price (${currency})`,
                data: prices,
                borderColor: "#f59e0b",
                backgroundColor: "rgba(245, 158, 11, 0.05)",
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "#e2e8f0",
                        font: {
                            family: "'Space Grotesk', sans-serif",
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                    backgroundColor: "rgba(11, 18, 36, 0.8)",
                    borderColor: "#f59e0b",
                    borderWidth: 1,
                    titleColor: "#e2e8f0",
                    bodyColor: "#e2e8f0",
                    callbacks: {
                        title: function(context) {
                            return new Date(context[0].label).toLocaleDateString("en-US", { 
                                month: "short", 
                                day: "numeric", 
                                year: "numeric" 
                            });
                        },
                        label: function(context) {
                            return `${currency} ${fmtNumber.format(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        unit: "auto",
                        displayFormats: {
                            hour: "MMM d, HH:mm",
                            day: "MMM d",
                            week: "MMM d",
                            month: "MMM yyyy",
                            year: "yyyy"
                        }
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)"
                    },
                    ticks: {
                        color: "#9ca3af",
                        font: {
                            family: "'Space Grotesk', sans-serif"
                        }
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)"
                    },
                    ticks: {
                        color: "#9ca3af",
                        font: {
                            family: "'Space Grotesk', sans-serif"
                        },
                        callback: function(value) {
                            return fmtNumber.format(value);
                        }
                    }
                }
            }
        }
    });
}
