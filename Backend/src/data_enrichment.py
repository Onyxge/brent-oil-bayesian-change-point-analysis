import pandas as pd
import pandas_datareader.data as web
from datetime import datetime

# Mapping: Your Name -> FRED Code
FRED_SERIES = {
    "GDP": "GDP",  # Quarterly
    "CPI": "CPIAUCSL",  # Monthly
    "Interest_Rate": "DGS10",  # Daily (10-Year Treasury)
    "USD_Index": "DTWEXBGS",  # Daily (Trade Weighted Dollar)
}


def fetch_macro_data(start_date):
    print(f"   🇺🇸 Connecting to Federal Reserve (FRED)...")
    try:
        # 1. Fetch
        df = web.DataReader(list(FRED_SERIES.values()), 'fred', start_date, datetime.now())

        # 2. Rename to friendly names
        inv_map = {v: k for k, v in FRED_SERIES.items()}
        df = df.rename(columns=inv_map)

        # 3. Resample & Fill
        # Align everything to Daily ('D') and Forward Fill the gaps
        df_daily = df.resample('D').ffill()

        # 4. Calculate Inflation (YoY Change in CPI)
        df_daily['Inflation_Rate'] = df_daily['CPI'].pct_change(365) * 100
        df_daily['Inflation_Rate'] = df_daily['Inflation_Rate'].fillna(0)

        return df_daily
    except Exception as e:
        print(f"   ❌ FRED Fetch Failed: {e}")
        return pd.DataFrame()