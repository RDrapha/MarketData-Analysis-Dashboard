# MarketData-Analysis-Dashboard
Web-based dashboard for analyzing and visualizing market time series and news data using open APIs.

This project is developed as a learning and portfolio project with a focus on clean software architecture, data analysis, and reproducibility.  
Bitcoin and ETFs are currently used as example datasets, but the architecture is designed to be reusable for other markets or assets.

---

## Project Goals

- Fetch and visualize market time series data from public APIs
- Display historical price trends in a clear and structured way
- Compare multiple assets (e.g., Bitcoin, ETFs) side by side
- Integrate news data related to the selected assets
- Perform basic sentiment analysis on textual data
- Provide transparent and explainable analysis (no price predictions)

---

## Planned Architecture (High-Level)

- **Frontend**
  - Web-based user interface
  - Interactive charts and dashboards
  - Multi-asset comparison charts

- **Backend**
  - Data fetching from open APIs
  - Data processing and aggregation
  - Basic NLP-based sentiment analysis

- **Data Sources**
  - Market price data:
    - Bitcoin: CoinGecko API
    - ETFs: Yahoo Finance API
  - News data via RSS feeds from financial news sources

---

## Technology Stack (planned)

- Backend: Python
- Frontend: HTML, JavaScript
- Visualization: Charting libraries (e.g., Chart.js, Plotly)
- Version Control: Git & GitHub

---

## Project Status

🔹 Version 0.1 – Planning & Setup  
The project is currently in an early planning stage.  
Initial focus is on repository setup, documentation, and architecture definition.

Planned next steps:
- Define project folder structure
- Implement backend data fetching for BTC and ETFs
- Build basic frontend with interactive charts
- Integrate news feed and sentiment analysis

---

## Disclaimer

This project is for educational and analytical purposes only.  
It does **not** provide financial advice, trading signals, or price predictions.

