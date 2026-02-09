import pandas as pd
import numpy as np
from pathlib import Path
import os

# --- CONFIGURATION ---
# Define default paths relative to this script or the project root
# Adjust these based on where this script runs from.
# Assuming this script is in 'Backend/src/' or similar, and data is in 'Backend/api/data/'
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DATA_PATH = BASE_DIR  / "data" / "raw" / "BrentOilPrices.csv"
PROCESSED_DATA_PATH = BASE_DIR / "data" / "processed" / "key_events.csv"

def load_price_data(filepath=RAW_DATA_PATH):
    """
    Loads and preprocesses the Brent Oil Prices dataset.

    Steps:
    1. Load CSV.
    2. Parse Dates (handling '20-May-87' format).
    3. Sort by Date.
    4. Calculate Log Returns for volatility analysis.
    5. Drop NaN values.

    Returns:
        pd.DataFrame: Cleaned data with 'Date' index and 'Log_Return' column.
    """
    try:
        if not filepath.exists():
            raise FileNotFoundError(f"Price data not found at: {filepath}")

        print(f"Loading price data from: {filepath}")
        df = pd.read_csv(filepath)

        # 1. Date Parsing
        # The format '%d-%b-%y' handles '20-May-87'
        df['Date'] = pd.to_datetime(df['Date'], format='mixed')

        # 2. Set Index and Sort
        df.set_index('Date', inplace=True)
        df.sort_index(inplace=True)

        # 3. Ensure Numeric Prices
        # Coerce errors to NaN (in case of "null" strings) then drop them
        df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
        df.dropna(subset=['Price'], inplace=True)

        # 4. Feature Engineering: Log Returns
        # Log Return = ln(Price_t / Price_{t-1})
        # This is preferred over percentage change for statistical modeling
        df['Log_Return'] = np.log(df['Price'] / df['Price'].shift(1))

        # 5. Clean up initial NaN from shift
        df.dropna(inplace=True)

        print(f"Successfully loaded {len(df)} price records.")
        print(f"Date Range: {df.index.min().date()} to {df.index.max().date()}")

        return df

    except Exception as e:
        print(f"CRITICAL ERROR loading price data: {e}")
        return None


def load_event_data(filepath=PROCESSED_DATA_PATH):
    """
    Loads the Key Events dataset for context overlay.
    """
    try:
        if not filepath.exists():
            raise FileNotFoundError(f"Event data not found at: {filepath}")

        print(f"Loading event data from: {filepath}")
        df = pd.read_csv(filepath)

        # Standard format YYYY-MM-DD usually works with default parser
        df['Date'] = pd.to_datetime(df['Date'])
        df.sort_values('Date', inplace=True)

        # Filter: Only keep events with valid dates
        df.dropna(subset=['Date'], inplace=True)

        print(f"Successfully loaded {len(df)} events.")
        return df

    except Exception as e:
        print(f"Error loading event data: {e}")
        return None


def get_merged_data():
    """
    Utility to get both datasets in one call.
    Useful for main analysis notebooks.
    """
    prices = load_price_data()
    events = load_event_data()

    if prices is None or events is None:
        print("Failed to load one or more datasets.")
        return None, None

    return prices, events


if __name__ == "__main__":
    # Test the functions when running this script directly
    print("--- Testing Data Preprocessing ---")
    p, e = get_merged_data()

    if p is not None:
        print("\nHead of Price Data:")
        print(p.head())

    if e is not None:
        print("\nHead of Event Data:")
        print(e.head())