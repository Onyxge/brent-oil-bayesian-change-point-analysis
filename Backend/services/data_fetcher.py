import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from .db_service import save_market_data, load_market_data

import os
import sys
script_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','src')
sys.path.append(script_dir)

from data_enrichment import fetch_macro_data

TICKER = "BZ=F"  # Brent Oil Futures


def update_market_data():
    print("⏳ Starting Master Data Sync...")

    # 1. Determine Start Date
    try:
        df_existing = load_market_data()
        if not df_existing.empty:
            last_date = pd.to_datetime(df_existing['date']).max()
            start_date = last_date + timedelta(days=1)
        else:
            start_date = datetime(2007, 1, 1)
            print("   DB Empty. Attempting to fetch full history from 1987...")
    except:
        start_date = datetime(2007, 1, 1)

    if start_date >= datetime.now():
        print("✅ Data is up to date.")
        return

    # 2. Fetch Market Data (OHLCV)
    print(f"   🛢️ Fetching OHLCV from yfinance starting {start_date.date()}...")
    oil_df = yf.download(TICKER, start=start_date, interval="1d", progress=False)

    if oil_df.empty:
        print("   No new market data.")
        return

    # Clean yfinance data
    oil_df = oil_df.reset_index()
    if isinstance(oil_df.columns, pd.MultiIndex):
        oil_df.columns = oil_df.columns.get_level_values(0)

    # Rename 'Close' to 'Price' for consistency with your V1 model
    oil_df = oil_df.rename(columns={'Close': 'Price'})

    # Select the 6 market columns we want
    market_cols = ['Date', 'Price', 'Open', 'High', 'Low', 'Volume']
    oil_df = oil_df[market_cols]

    # 3. Fetch Macro Data
    macro_df = fetch_macro_data(start_date)

    # 4. MERGE (The Critical Step)
    # Left Join: We keep all trading days (oil_df), and attach macro data to them.
    # If macro data is missing for a specific day, ffill handles it.
    oil_df['Date'] = pd.to_datetime(oil_df['Date'])

    full_df = pd.merge(oil_df, macro_df, left_on='Date', right_index=True, how='left')

    # Fill any remaining gaps (e.g. if FRED update is slightly delayed)
    full_df = full_df.ffill()

    # 5. Save to DB
    # Filter only for the 11 columns in our schema
    expected_cols = ['Date', 'Price', 'Open', 'High', 'Low', 'Volume',
                     'GDP', 'CPI', 'Interest_Rate', 'USD_Index', 'Inflation_Rate']

    # Ensure we only pass existing columns (in case FRED failed)
    final_cols = [c for c in expected_cols if c in full_df.columns]

    save_market_data(full_df[final_cols])


if __name__ == "__main__":
    from .db_service import init_db

    init_db()
    update_market_data()