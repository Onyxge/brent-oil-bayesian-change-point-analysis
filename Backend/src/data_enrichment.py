import pandas as pd
import pandas_datareader.data as web
from datetime import datetime, timedelta

FRED_SERIES = {
    "GDP": "GDP",  # Quarterly
    "CPI": "CPIAUCSL",  # Monthly
    "Interest_Rate": "DGS10",  # Daily
    "USD_Index": "DTWEXBGS",  # Daily
}


def fetch_macro_data(target_start_date):
    """
    Fetches economic indicators with a 90-day 'Lookback Buffer'
    to ensure we capture the most recent Quarterly GDP report.
    """
    # 1. THE FIX: Buffer the start date by 90 days (1 Quarter)
    # This grabs the Q1 GDP report so we can ffill it into Q2
    fetch_start = target_start_date - timedelta(days=90)

    print(f"   🇺🇸 Connecting to FRED (Buffer: {fetch_start.date()})...")

    try:
        # Fetch from the BUFFERED date
        df = web.DataReader(list(FRED_SERIES.values()), 'fred', fetch_start, datetime.now())

        inv_map = {v: k for k, v in FRED_SERIES.items()}
        df = df.rename(columns=inv_map)

        # Resample to Daily and Forward Fill
        df_daily = df.resample('D').ffill()

        # Calculate Inflation
        # Use ffill() first to prevent the warning you saw earlier
        df_daily['Inflation_Rate'] = df_daily['CPI'].ffill().pct_change(365) * 100
        df_daily['Inflation_Rate'] = df_daily['Inflation_Rate'].fillna(0)

        # 2. TRIM: Slice the data back to the User's requested start date
        # We only needed the buffer for the math; we don't need to return it.
        df_final = df_daily[df_daily.index >= target_start_date]

        print(f"   ✅ Retrieved {len(df_final)} days of aligned macro data.")
        return df_final

    except Exception as e:
        print(f"   ❌ FRED Fetch Failed: {e}")
        return pd.DataFrame()