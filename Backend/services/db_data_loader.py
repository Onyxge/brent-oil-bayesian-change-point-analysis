"""
Data Loader for Bayesian Change Point Analysis
Replaces the old CSV-based data_preprocessing.py
Loads data directly from PostgreSQL database
"""

import pandas as pd
import numpy as np
from .db_service import load_market_data, load_events, engine
import logging

logger = logging.getLogger(__name__)


def prepare_price_data_for_bayesian(start_date=None, end_date=None):
    """
    Load and prepare price data for Bayesian change point analysis.

    Args:
        start_date: Optional start date filter
        end_date: Optional end date filter

    Returns:
        pd.DataFrame with DatetimeIndex and Log_Return column
    """
    try:
        # Load from DB
        df = load_market_data(start_date, end_date)

        if df.empty:
            logger.error("No market data available in database.")
            return None

        # Ensure we have price data
        if 'price' not in df.columns:
            logger.error("Price column missing from market data.")
            return None

        # Calculate Log Returns for Bayesian analysis
        # Log Return = ln(Price_t / Price_{t-1})
        df['Log_Return'] = np.log(df['price'] / df['price'].shift(1))

        # Drop NaN from shift operation
        df = df.dropna(subset=['Log_Return'])

        # Add Price column (keep original for reference)
        df['Price'] = df['price']

        logger.info(f"✅ Prepared {len(df)} records for Bayesian analysis.")
        logger.info(f"   Date Range: {df.index.min().date()} to {df.index.max().date()}")

        return df

    except Exception as e:
        logger.error(f"❌ Error preparing price data: {e}")
        return None


def get_bayesian_input_data():
    """
    Main function to get all data needed for Bayesian analysis.

    Returns:
        tuple: (prices_df, events_df)
    """
    logger.info("📊 Loading data for Bayesian analysis...")

    # Load price data with log returns
    prices = prepare_price_data_for_bayesian()

    # Load events for validation (optional - we won't use these as input)
    events = load_events()

    if prices is None:
        logger.error("Failed to load price data.")
        return None, None

    logger.info(f"✅ Loaded {len(prices)} price records")
    if not events.empty:
        logger.info(f"✅ Loaded {len(events)} historical events (for validation)")

    return prices, events


def get_window_data(prices_df, center_date, window_days=365):
    """
    Extract a time window around a specific date for analysis.

    Args:
        prices_df: DataFrame with DatetimeIndex
        center_date: Center date (str or datetime)
        window_days: Days before and after center (total window = 2 * window_days)

    Returns:
        pd.DataFrame: Sliced window data
    """
    try:
        center = pd.to_datetime(center_date)
        start = center - pd.Timedelta(days=window_days)
        end = center + pd.Timedelta(days=window_days)

        window_df = prices_df.loc[start:end].copy()

        if len(window_df) < 100:
            logger.warning(f"Window around {center_date} has only {len(window_df)} observations.")
            return None

        logger.info(f"✅ Extracted window: {len(window_df)} days around {center_date}")
        return window_df

    except Exception as e:
        logger.error(f"❌ Error extracting window: {e}")
        return None


def get_sliding_windows(prices_df, window_size=365, step_size=30):
    """
    Generate sliding windows for global change point detection.

    Args:
        prices_df: DataFrame with DatetimeIndex
        window_size: Size of each window in days
        step_size: Step between windows in days

    Yields:
        tuple: (window_start_date, window_end_date, window_df)
    """
    start_date = prices_df.index.min()
    end_date = prices_df.index.max()

    current_start = start_date
    window_count = 0

    while current_start + pd.Timedelta(days=window_size) <= end_date:
        current_end = current_start + pd.Timedelta(days=window_size)

        window_df = prices_df.loc[current_start:current_end].copy()

        if len(window_df) >= 100:  # Minimum data requirement
            window_count += 1
            yield (current_start, current_end, window_df)

        # Move to next window
        current_start = current_start + pd.Timedelta(days=step_size)

    logger.info(f"✅ Generated {window_count} sliding windows for analysis.")


def validate_data_quality(prices_df):
    critical_issues = []
    warnings = []

    # Check for missing values (CRITICAL)
    if prices_df['Log_Return'].isna().sum() > 0:
        critical_issues.append(f"{prices_df['Log_Return'].isna().sum()} missing log returns")

    # Check for infinite values (CRITICAL)
    if np.isinf(prices_df['Log_Return']).sum() > 0:
        critical_issues.append(f"{np.isinf(prices_df['Log_Return']).sum()} infinite log returns")

    # Check minimum data length (CRITICAL)
    if len(prices_df) < 100:
        critical_issues.append(f"Insufficient data: {len(prices_df)} records (need at least 100)")

    # Check for extreme outliers (WARNING ONLY - these might be real crises!)
    mean_ret = prices_df['Log_Return'].mean()
    std_ret = prices_df['Log_Return'].std()
    outliers = np.abs(prices_df['Log_Return'] - mean_ret) > (10 * std_ret)
    if outliers.sum() > 0:
        warnings.append(f"{outliers.sum()} extreme outliers detected (may be crisis events)")
        # Log which dates for inspection
        outlier_dates = prices_df[outliers].index.tolist()
        logger.info(f"   Outlier dates: {[d.date() for d in outlier_dates[:5]]}")

    # Only abort on CRITICAL issues
    if critical_issues:
        logger.error(f"❌ Critical data quality issues:")
        for issue in critical_issues:
            logger.error(f"   - {issue}")
        return False

    if warnings:
        logger.warning(f"⚠️ Data quality warnings (non-critical):")
        for warning in warnings:
            logger.warning(f"   - {warning}")

    logger.info("✅ Data quality checks passed (critical issues: 0).")
    return True

if __name__ == "__main__":
    # Test the data loader
    logging.basicConfig(level=logging.INFO)

    print("=== Testing DB Data Loader ===\n")

    # Test 1: Load all data
    prices, events = get_bayesian_input_data()

    if prices is not None:
        print(f"\n📊 Price Data Summary:")
        print(f"   Records: {len(prices)}")
        print(f"   Date Range: {prices.index.min().date()} to {prices.index.max().date()}")
        print(f"   Columns: {list(prices.columns)}")
        print(f"\n   Sample Data:")
        print(prices[['Price', 'Log_Return']].head())

        # Test 2: Validate quality
        print(f"\n🔍 Data Quality Check:")
        validate_data_quality(prices)

        # Test 3: Get a specific window
        print(f"\n📅 Testing Window Extraction (2008 Crisis):")
        window = get_window_data(prices, '2008-09-15', window_days=180)
        if window is not None:
            print(f"   Window size: {len(window)} days")
            print(f"   Date range: {window.index.min().date()} to {window.index.max().date()}")

        # Test 4: Generate sliding windows
        print(f"\n🔄 Testing Sliding Window Generation:")
        windows_list = list(get_sliding_windows(prices, window_size=365, step_size=90))
        print(f"   Generated {len(windows_list)} windows")
        if windows_list:
            print(f"   First window: {windows_list[0][0].date()} to {windows_list[0][1].date()}")
            print(f"   Last window: {windows_list[-1][0].date()} to {windows_list[-1][1].date()}")

    if events is not None and not events.empty:
        print(f"\n📜 Events Summary:")
        print(f"   Total events: {len(events)}")
        print(f"   First event: {events['event_date'].min().date()}")
        print(f"   Last event: {events['event_date'].max().date()}")
