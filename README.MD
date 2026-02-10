# 🛢️ Birhan Energies: Bayesian Change Point Analysis

*A Full-Stack Probabilistic Machine Learning System for Financial Regime Detection*

---

## 📖 Executive Summary

In financial markets, volatility is not constant. Standard forecasting models fail during "Black Swan" events because they assume linear continuity of market conditions.

This project implements a **Bayesian Change Point Detection** framework to mathematically identify **regime shifts** in Brent Oil prices over the last 20 years. Unlike traditional lagging indicators such as moving averages, this probabilistic model quantifies the uncertainty of a structural break, allowing analysts to distinguish between normal market noise and fundamental shifts in risk.

The system is deployed as an **interactive Model Observability Dashboard**, enabling stakeholders to visualize price dynamics, uncertainty bands, and macroeconomic correlations in real time.

---

## 🚀 Key Features

### 1. Bayesian Inference Engine (Backend)

* **Model**: Switch-point model implemented using PyMC3 or PyMC to detect abrupt changes in mean volatility (σ) of log-returns.
* **Probabilistic Output**: Returns full posterior distributions rather than point estimates. Example: *94% confidence that a regime change occurred on Aug 20, 2008*.
* **Macro-Economic Causality**: Vector Autoregression (VAR) to analyze impulse responses between Oil, USD Index, and Inflation.

### 2. Interactive Command Center (Frontend)

* **Regime-Aware Charting**: Price history with background shading indicating detected high-volatility regimes.
* **Distribution Inspector**: Interactive visualization of Gaussian shifts between pre-crisis and post-crisis volatility.
* **Macro Sensitivity Explorer**: Dual-axis analysis of rolling Oil and USD correlation to identify periods of market decoupling.

---

## 🛠️ Tech Stack

### Backend ("Ferrari Engine")

* **Python 3.10**: Core logic
* **Flask**: REST API serving model artifacts
* **PyMC3 / ArviZ**: Bayesian modeling and MCMC sampling
* **Statsmodels**: Time-series decomposition (STL) and VAR models
* **Pandas / NumPy**: Vectorized data manipulation

### Frontend ("Observability Layer")

* **React (Vite)**: High-performance UI framework
* **Recharts**: Composable financial time-series charting
* **Material UI (MUI)**: Responsive layout grid and components
* **Axios**: API integration

---

## 📂 Project Structure

```bash
├── Backend/
│   ├── api/
│   │   └── app.py                   # Flask API entry point
│   ├── data/
│   │   ├── raw/                     # Original Brent oil prices (CSV)
│   │   └── processed/               # Enriched macroeconomic data
│   └── results/
│       ├── Figures
│       └── change_point.csv         # Detected regime events
│   ├── notebooks/
│   │   ├──  task1-Analyze-time-series-properties.ipynb       # Stationarity tests (ADF) & Volatility Plots         
│   │   ├──  Change_Point_modeling_Insight_Generation.ipynb   # Main Analysis (Single Switch)
│   │   ├──  dual_change_point_model.ipynb                    # Deep Dive (Shock & Recovery)
│   │   ├──  markov_switching.ipynb                           # Markov-Switching models to explicitly define 'calm' vs. 'volatile' market regimes
│   │   └──  multivariate_analysis.ipynb                      VAR (Vector Autoregression) for analyzing dynamic relationships between oil prices and macroeconomic variables#
│   └──src/
│       ├── __init__.py
│       ├── data_preprocessing.py        # Data loading & Log Return calc
│       ├── change_point_model.py        # PyMC Class for Single Change Point
│       ├── dual_change_point_model.py   # PyMC Class for Dual Change Point
│       └──  data_enrichmet.py           # Data Scrape from FRED for GDP,InflationRate, CPI, USD_Index
├── Frontend/
│   ├── src/
│   │   ├── Components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── PriceChart.jsx
│   │   │   ├── ChangePointInspector.jsx
│   │   │   └── MacroSensitivityPanel.jsx
│   │   └── App.jsx
│   └── package.json
├── requirements.txt
└── README.md

```

---

## ⚡ Step-by-Step Execution

### Phase 1: Data Analysis and Modeling

We processed more than 20 years of daily Brent Oil prices.

* **Stationarity Checks**: Augmented Dickey-Fuller tests confirmed non-stationarity, requiring log-return transformation.

* **Bayesian Modeling**:
$$
y_t \sim \text{Normal}(0, \sigma_t^2)
$$

$$
\sigma_t = \begin{cases} 
\sigma_1 & \text{if } t < \tau \\ 
\sigma_2 & \text{if } t \ge \tau 
\end{cases}
$$

Where $\tau$ (tau) is the discrete switch point inferred from the data.
* **Result**: Detected major structural breaks including the 2008 financial crisis, the 2014 oil crash, and COVID-19.

### Phase 2: Backend API Development

A Flask API was built to expose probabilistic model outputs.

* **`/api/model/regimes`**: Merges daily prices with inferred volatility states
* **`/api/macro/correlations`**: Computes rolling 90-day macro correlations dynamically

### Phase 3: Frontend Dashboard

A Bloomberg-terminal-style interface was developed to make Bayesian outputs interpretable.

* **Drill-Down**: Selecting an event retrieves event-specific posterior distributions
* **Visual Proof**: Overlayed Gaussian curves demonstrate pre-event versus post-event volatility

---

## 💻 Installation and Setup

### Prerequisites

* Python 3.10.19 or higher
* Node.js v22 or higher

### 1. Backend Setup

```bash
cd Backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install flask flask-cors pandas numpy pymc3 arviz statsmodels
python api/app.py
```

Expected output:

```
🚀 API Running on Port 5000
```

### 2. Frontend Setup

```bash
cd Frontend
pnpm install
pnpm run dev
```

Expected output:

```
Vite server running at http://localhost:5173 or 3000
```

---

## 📊 Sample Insights

| Event                   | Date Detected | Pre-Vol (σ) | Post-Vol (σ) | Impact |
| ----------------------- | ------------- | ----------- | ------------ | ------ |
| Global Financial Crisis | 2008-08-20    | 0.015       | 0.045        | +200%  |
| COVID-19 Pandemic       | 2020-03-09    | 0.022       | 0.068        | +209%  |
| 2014 Oil Crash          | 2014-10-01    | 0.010       | 0.028        | +180%  |

---

## 🔮 Future Improvements

* **Real-Time Inference**: Integrate live market feeds such as AlphaVantage for online regime detection
* **Multi-Asset Support**: Extend analysis to WTI, Gold, and S&P 500
* **LSTM Forecasting**: Add deep learning models to forecast price dynamics within detected regimes

---

**Author**: Yonatan

**Date**: February 2026
