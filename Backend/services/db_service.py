import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import logging
from datetime import datetime

load_dotenv()

# Connect to PostgreSQL
DB_URL = (f"postgresql://{os.getenv('DB_USER')}:"
          f"{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:"
          f"{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}")
engine = create_engine(DB_URL)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db():
    """Initializes all tables including new change point detection tables."""
    try:
        with engine.connect() as conn:
            # 1. MARKET DATA TABLE (Master Dataset)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS market_data (
                    date DATE PRIMARY KEY,
                    -- Market Data (from yfinance)
                    price DECIMAL(10, 2),
                    open DECIMAL(10, 2),
                    high DECIMAL(10, 2),
                    low DECIMAL(10, 2),
                    volume BIGINT,

                    -- Macro Data (from FRED)
                    gdp DECIMAL(15, 2),
                    cpi DECIMAL(10, 2),
                    interest_rate DECIMAL(5, 2),
                    usd_index DECIMAL(10, 2),
                    inflation_rate DECIMAL(5, 2)
                );
            """))

            # 2. REGIMES TABLE (Daily regime assignments from Bayesian model)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS regimes (
                    date DATE PRIMARY KEY,
                    price DECIMAL(10, 2),
                    volatility DECIMAL(10, 4),
                    regime VARCHAR(20),
                    confidence DECIMAL(5, 4)
                );
            """))

            # 3. EVENTS TABLE (Ground truth - human curated)
            conn.execute(text("""
                  CREATE TABLE IF NOT EXISTS events (
                        event_id SERIAL PRIMARY KEY,
                        event_date DATE NOT NULL,
                        event_type VARCHAR(50),
                        description TEXT,
                        source VARCHAR(100)
                        );
            """))

            # 4. Add validation columns to EVENTS table
            conn.execute(text("""
                ALTER TABLE events 
                ADD COLUMN IF NOT EXISTS detected_start_date DATE,
                ADD COLUMN IF NOT EXISTS detected_end_date DATE,
                ADD COLUMN IF NOT EXISTS volatility_pre DECIMAL(10, 5),
                ADD COLUMN IF NOT EXISTS volatility_crisis DECIMAL(10, 5),
                ADD COLUMN IF NOT EXISTS volatility_post DECIMAL(10, 5);
            """))

            # 5. DETECTED CHANGE POINTS TABLE (Auto-discovered patterns)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS detected_change_points (
                    change_point_id SERIAL PRIMARY KEY,
                    detection_date TIMESTAMP DEFAULT NOW(),
                    crisis_start_date DATE NOT NULL,
                    crisis_end_date DATE NOT NULL,
                    volatility_pre DECIMAL(10, 5),
                    volatility_crisis DECIMAL(10, 5),
                    volatility_post DECIMAL(10, 5),
                    detection_confidence DECIMAL(5, 4),
                    window_size_days INT,
                    notes TEXT
                );
            """))

            conn.commit()
        logger.info("✅ Database initialized with all tables.")

    except Exception as e:
        logger.error(f"❌ Error initializing database: {e}")


def save_market_data(df):
    """Save or update market data."""
    try:
        df.columns = [c.lower() for c in df.columns]
        df.to_sql('market_data', engine, if_exists='append', index=False, method='multi')
        logger.info(f"✅ Saved {len(df)} rows to market_data.")
    except Exception as e:
        # Ignore duplicate key errors silently
        pass


def load_market_data(start_date=None, end_date=None):
    """
    Load market data from DB with optional date filtering.

    Args:
        start_date: Optional start date (str or datetime)
        end_date: Optional end date (str or datetime)

    Returns:
        DataFrame with DatetimeIndex
    """
    try:
        query = "SELECT * FROM market_data"
        conditions = []

        if start_date:
            conditions.append(f"date >= '{start_date}'")
        if end_date:
            conditions.append(f"date <= '{end_date}'")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY date ASC"

        df = pd.read_sql(query, engine, parse_dates=['date'], index_col='date')
        logger.info(f"✅ Loaded {len(df)} rows from market_data.")
        return df
    except Exception as e:
        logger.error(f"❌ Error loading market data: {e}")
        return pd.DataFrame()


def load_events():
    """Load curated events from DB."""
    try:
        query = "SELECT * FROM events ORDER BY event_date ASC"
        df = pd.read_sql(query, engine, parse_dates=['event_date'])
        logger.info(f"✅ Loaded {len(df)} events.")
        return df
    except Exception as e:
        logger.error(f"❌ Error loading events: {e}")
        return pd.DataFrame()


def save_detected_change_points(change_points_df):
    """
    Save auto-detected change points to DB.

    Args:
        change_points_df: DataFrame with columns:
            - crisis_start_date
            - crisis_end_date
            - volatility_pre
            - volatility_crisis
            - volatility_post
            - detection_confidence
            - window_size_days
            - notes
    """
    try:
        change_points_df.to_sql(
            'detected_change_points',
            engine,
            if_exists='append',
            index=False,
            method='multi'
        )
        logger.info(f"✅ Saved {len(change_points_df)} detected change points.")
    except Exception as e:
        logger.error(f"❌ Error saving change points: {e}")


def load_detected_change_points():
    """Load all detected change points from DB."""
    try:
        query = "SELECT * FROM detected_change_points ORDER BY crisis_start_date ASC"
        df = pd.read_sql(query, engine, parse_dates=['crisis_start_date', 'crisis_end_date', 'detection_date'])
        logger.info(f"✅ Loaded {len(df)} detected change points.")
        return df
    except Exception as e:
        logger.error(f"❌ Error loading detected change points: {e}")
        return pd.DataFrame()


def save_regimes(regimes_df):
    """
    Save daily regime assignments to DB.

    Args:
        regimes_df: DataFrame with columns: date, price, volatility, regime, confidence
    """
    try:
        # Clear existing data first (or use upsert logic)
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM regimes WHERE date IN :dates"),
                         {"dates": tuple(regimes_df['date'].tolist())})

        regimes_df.to_sql('regimes', engine, if_exists='append', index=False, method='multi')
        logger.info(f"✅ Saved {len(regimes_df)} regime assignments.")
    except Exception as e:
        logger.error(f"❌ Error saving regimes: {e}")


def load_regimes(start_date=None, end_date=None):
    """Load regime assignments with optional date filtering."""
    try:
        query = "SELECT * FROM regimes"
        conditions = []

        if start_date:
            conditions.append(f"date >= '{start_date}'")
        if end_date:
            conditions.append(f"date <= '{end_date}'")

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY date ASC"

        df = pd.read_sql(query, engine, parse_dates=['date'], index_col='date')
        logger.info(f"✅ Loaded {len(df)} regime assignments.")
        return df
    except Exception as e:
        logger.error(f"❌ Error loading regimes: {e}")
        return pd.DataFrame()


def get_last_processed_date(table_name='regimes'):
    """
    Get the last date processed for incremental updates.

    Args:
        table_name: 'regimes' or 'detected_change_points'

    Returns:
        datetime or None
    """
    try:
        if table_name == 'regimes':
            query = "SELECT MAX(date) as last_date FROM regimes"
        else:
            query = "SELECT MAX(crisis_end_date) as last_date FROM detected_change_points"

        result = pd.read_sql(query, engine)
        last_date = result['last_date'].iloc[0]

        if pd.notna(last_date):
            logger.info(f"✅ Last processed date in {table_name}: {last_date}")
            return pd.to_datetime(last_date)
        return None
    except Exception as e:
        logger.error(f"❌ Error getting last processed date: {e}")
        return None


if __name__ == "__main__":
    # Test the database initialization
    init_db()
    logger.info("Database service ready!")
