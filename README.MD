# Bayesian Change Point Analysis Pipeline

Automatic detection of regime changes in Brent Oil prices using Bayesian inference, designed to enhance LSTM forecasting models.

## 🎯 Overview

This pipeline automatically detects structural breaks (regime changes) in oil price data **without** relying on pre-labeled events. It uses a sliding window approach with Bayesian MCMC to identify:

- **Crisis Start & End Dates** (dual change points)
- **Volatility Regimes** (Normal → Crisis → Recovery)
- **Confidence Scores** (posterior probabilities)

The detected regimes are then used as features for LSTM price forecasting.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                │
├─────────────────────────────────────────────────────────┤
│  1. market_data          - Raw price + macro factors    │
│  2. events               - Ground truth (validation)    │
│  3. detected_change_points - Auto-discovered patterns   │
│  4. regimes              - Daily regime labels          │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│            PHASE 1: Change Point Detection              │
├─────────────────────────────────────────────────────────┤
│  • Sliding window scan (365-day windows, 90-day steps)  │
│  • Bayesian MCMC (PyMC) for dual change points          │
│  • Consolidate overlapping detections                   │
│  • Save to detected_change_points table                 │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│             PHASE 2: Regime Labeling                    │
├─────────────────────────────────────────────────────────┤
│  • Assign every date to: Normal/Crisis/Recovery         │
│  • Calculate expected volatility per date               │
│  • Save to regimes table                                │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│             PHASE 3: LSTM Training (Your Code)          │
├─────────────────────────────────────────────────────────┤
│  • Load market_data + regimes (joined)                  │
│  • Train LSTM with regime features                      │
│  • Generate 30-day forecasts                            │
│  • Plot predictions                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure



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
│   │   ├──  multivariate_analysis.ipynb                      # VAR (Vector Autoregression) for analyzing dynamic relationships between oil prices and macroeconomic variables#
│   │   ├──  
│   │   ├──
│   │   ├──
│   │   └──
│   └──src/
│       ├── __init__.py
│       ├── data_preprocessing.py        # Data loading & Log Return calc
│       ├── change_point_model.py        # PyMC Class for Single Change Point
│       ├── dual_change_point_model.py   # PyMC Class for Dual Change Point
│       └──  data_enrichment.py           # Data Scrape from FRED for GDP,InflationRate, CPI, USD_Index
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

## 🚀 Installation

### 1. Prerequisites

```bash
# Python 3.8+
pip install -r requirements.txt
```

**Required packages:**
```
pymc>=5.0
arviz
pandas
numpy
sqlalchemy
psycopg2-binary
python-dotenv
matplotlib
seaborn
yfinance
```

### 2. Database Setup

Create a `.env` file with your PostgreSQL credentials:

```env
DB_USER=your_username
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oil_price_analysis
```

Initialize the database:

```bash
python src/db_service.py
```

### 3. Load Initial Data

```bash
# Scrape and load market data + macro factors
python api/data_fetcher.py

# Seed ground truth events (for validation)
python api/seed_events.py
```

---

## 🎮 Usage

### **Mode 1: Full Pipeline (First Run)**

Runs complete change point detection across all historical data:

```bash
python src/bayesian_pipeline.py --mode full --tune 2000 --draws 2000
```

**Parameters:**
- `--window-size`: Sliding window size in days (default: 365)
- `--step-size`: Step between windows (default: 90)
- `--min-confidence`: Detection threshold (default: 0.70)
- `--tune`: MCMC tuning iterations (default: 2000)
- `--draws`: MCMC sampling iterations (default: 2000)

**Expected Runtime:** 2-6 hours (depending on data size and hardware)

---

### **Mode 2: Incremental Update (Daily Automation)**

Only processes new data since last run:

```bash
python src/bayesian_pipeline.py --mode incremental --tune 1000 --draws 1000
```

**Expected Runtime:** 5-15 minutes

**Use Case:** Schedule this as a daily cron job to keep regimes up-to-date

---

### **Mode 3: Regime Labeling Only**

Skip detection, just re-label regimes based on existing change points:

```bash
python src/bayesian_pipeline.py --mode full --skip-detection
```

---

## 📊 Output Tables

### **1. detected_change_points**

Auto-discovered change points:

| Column | Type | Description |
|--------|------|-------------|
| `change_point_id` | SERIAL | Auto-incrementing ID |
| `detection_date` | TIMESTAMP | When it was detected |
| `crisis_start_date` | DATE | Crisis start |
| `crisis_end_date` | DATE | Crisis end |
| `volatility_pre` | DECIMAL | Pre-crisis volatility |
| `volatility_crisis` | DECIMAL | Crisis volatility |
| `volatility_post` | DECIMAL | Recovery volatility |
| `detection_confidence` | DECIMAL | Posterior confidence (0-1) |
| `window_size_days` | INT | Analysis window used |
| `notes` | TEXT | Auto-generated description |

### **2. regimes**

Daily regime assignments:

| Column | Type | Description |
|--------|------|-------------|
| `date` | DATE | Trading date (PRIMARY KEY) |
| `price` | DECIMAL | Brent oil price |
| `volatility` | DECIMAL | Expected volatility |
| `regime` | VARCHAR | Normal/Crisis/Recovery |
| `confidence` | DECIMAL | Assignment confidence |

---

## 🔗 Integration with LSTM

### Query for LSTM Training Data

```python
from db_service import engine
import pandas as pd

# Load joined dataset
query = """
SELECT 
    m.date,
    m.price, m.open, m.high, m.low, m.volume,
    m.gdp, m.cpi, m.interest_rate, m.usd_index, m.inflation_rate,
    r.regime,        -- NEW: Regime label
    r.volatility,    -- NEW: Expected volatility
    r.confidence     -- NEW: Detection confidence
FROM market_data m
LEFT JOIN regimes r ON m.date = r.date
ORDER BY m.date ASC
"""

df = pd.read_sql(query, engine, parse_dates=['date'], index_col='date')
```

### LSTM Feature Engineering

```python
# One-hot encode regimes
df = pd.get_dummies(df, columns=['regime'], prefix='regime')

# Features for LSTM
features = [
    'price', 'volume', 'gdp', 'cpi', 'interest_rate', 'usd_index',
    'regime_Normal', 'regime_Crisis', 'regime_Recovery',  # ← NEW
    'volatility',  # ← NEW
    'confidence'   # ← NEW
]

X = df[features].values
y = df['price'].shift(-30).values  # 30-day ahead target
```

**Why this helps LSTM:**
- **Regime indicators** → context about market state
- **Volatility** → uncertainty estimates
- **Confidence** → weight predictions differently by regime

---

## 📈 Validation

The pipeline automatically validates detections against ground truth events:

```
Validation Results:
  Total Known Events: 24
  Successfully Detected: 18 (75.0%)
  Missed Events: 6
  False Positives: 3 (12.5%)
```

---

## ⚙️ Configuration

### Tuning Detection Sensitivity

**More Sensitive** (detect smaller changes):
```bash
--min-confidence 0.60 --window-size 180
```

**Less Sensitive** (only major crises):
```bash
--min-confidence 0.80 --window-size 365
```

### Speed vs Accuracy

**Fast (testing)**:
```bash
--tune 500 --draws 500
```

**Balanced (production)**:
```bash
--tune 2000 --draws 2000
```

**High Accuracy (research)**:
```bash
--tune 5000 --draws 5000
```

---

## 🐛 Troubleshooting

### "No change points detected"

**Possible causes:**
- `min_confidence` too high → Lower to 0.60
- `window_size` too small → Increase to 365+
- Data quality issues → Check for gaps/outliers

### "MCMC divergence warnings"

**Solutions:**
- Increase `tune` iterations
- Check for data anomalies (inf/nan values)
- Use `target_accept=0.95` in model

### "Pipeline too slow"

**Optimizations:**
- Use `--mode incremental` for daily updates
- Reduce `draws` to 1000 for testing
- Increase `step_size` to 120 (fewer windows)

---

## 📝 Logging

Logs are saved to `bayesian_pipeline.log`:

```bash
tail -f bayesian_pipeline.log  # Monitor progress
```

---

## 🔄 Daily Automation

Set up a cron job for automatic updates:

```bash
# crontab -e
0 2 * * * /path/to/venv/bin/python /path/to/bayesian_pipeline.py --mode incremental
```

This runs at 2 AM daily, updating regimes with new data.

---

## 📚 Next Steps

1. **Run the full pipeline** to populate the `regimes` table
2. **Integrate with your LSTM model** using the query above
3. **Compare LSTM performance** with and without regime features
4. **Iterate on detection parameters** based on validation results

---

## 🤝 Support

For issues or questions:
- Check logs in `bayesian_pipeline.log`
- Review validation metrics for detection accuracy
- Adjust configuration parameters based on your use case

---


