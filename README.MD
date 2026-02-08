# 🛢️ Brent Oil Price Change Point Analysis

**Project:** Birhan Energies - Week 11 Challenge  

**Domain:** Energy Sector, Financial Time Series, Bayesian Statistics  

**Status:** ✅ Analysis complete , Modeling ongoing| 🚧 Dashboard In-Progress

---

## 📖 Executive Summary
This project employs advanced **Bayesian Probabilistic Modeling (PyMC)** to detect structural breaks in Brent oil prices (1987–2022). By analyzing volatility clustering, we identify specific dates where market behavior fundamentally shifted and correlate these statistical "switch points" with major geopolitical events (e.g., the 2008 Financial Crisis, COVID-19, geopolitical conflicts).

**Key Insight:** Identifying these change points allows Birhan Energies' clients to quantify the "Impact Factor" of global events, moving beyond simple price tracking to understanding systemic risk.

---

## 🚀 Key Features

* **Robust Data Pipeline:** Ingestion and cleaning of 30+ years of daily price data, handling complex date formats and ensuring stationarity via **Log Returns**.
* **Bayesian Change Point Detection:**
    * **Single-Switch Model:** Detects the exact moment ($\tau$) a regime change occurred within a window.
    * **Dual-Switch Model:** Detects "Shock" and "Recovery" phases (3 Regimes) for deep-dive crisis analysis.
* **Quantitative Impact Metrics:** Calculates the percentage increase in volatility ($\sigma$) pre- and post-event.
* **Advanced Diagnostics:** MCMC Trace plots, Posterior distributions, and 94% High Density Interval (HDI) visualizations.

---

## 📂 Repository Structure

```text
brent-oil-bayesian-analysis/
├── Backend/
│   ├── api/
│   │   └──
│   │ 
│   ├── data/
│   │     ├── raw/                 # Original BrentOilPrices.csv
│   │     └── processed/           # generated change_point_results.csv
│   ├── notebooks/
│   │   ├── task1-Analyze-time-series-properties.ipynb       # Stationarity tests (ADF) & Volatility Plots               # Deep Dive (Shock & Recovery)
│   │ 
│   │ 
│   └── src/
│       ├── data_preprocessing.py        # Data loading & Log Return calc
│       ├── change_point_model.py        # PyMC Class for Single Change Point
│       └── dual_change_point_model.py   # PyMC Class for Dual Change Point
├── requirements.txt
└── README.md
```
## 🛠️ Installation & Setup

### Clone the repository:

```
git clone [git@github.com:Onyxge/brent-oil-bayesian-change-point-analysis.git]
```
cd brent-oil-analysis
### Create a Virtual Environment:
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate

### Install Dependencies:
```
pip install -r requirements.txt
```
**Key libraries: pymc, arviz, pandas, numpy, matplotlib, seaborn**


# 📊 Methodology
### 1. Data Preprocessing

We transform raw prices into Log Returns (rt​=ln(Pt​/Pt−1​)).
Why? Raw prices are non-stationary (random walk). Returns are stationary, allowing for valid statistical inference.

**Author: Yonatan** 

**For: 10 Academy**