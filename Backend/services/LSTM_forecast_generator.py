"""
Dual LSTM Forecast Generator
Runs BOTH models and saves to a single cache file.

Models:
  1. Baseline  → lstm_model.keras            + price_scaler.pkl  (shape: 60×1)
  2. Enhanced  → lstm_enhanced_bayesian.keras + multi_scaler.pkl  (shape: 60×4)

Output: Backend/cache/lstm_forecast.json

Run daily:
    python generate_forecast.py
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import joblib
from sqlalchemy import create_engine
from dotenv import load_dotenv

# ==============================================================================
#  PATHS
# ==============================================================================
BACKEND_ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR    = os.path.join(BACKEND_ROOT, '../models')
CACHE_DIR    = os.path.join(BACKEND_ROOT, '../cache')
SERVICES_DIR = os.path.join(BACKEND_ROOT, 'services')

sys.path.append(SERVICES_DIR)
os.makedirs(CACHE_DIR, exist_ok=True)

load_dotenv()

# Connect to PostgreSQL
DB_URL = (f"postgresql://{os.getenv('DB_USER')}:"
          f"{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:"
          f"{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}")
engine = create_engine(DB_URL)

# ==============================================================================
#  DATABASE
# ==============================================================================
# DB_CONFIG = {
#     'host':     'localhost',
#     'database': 'oil_analysis',
#     'user':     'postgres',
#     'password': 'your_password'   # ← UPDATE THIS
# }
#
# def get_engine():
#     url = (
#         f"postgresql+psycopg2://{DB_CONFIG['user']}:{DB_CONFIG['password']}"
#         f"@{DB_CONFIG['host']}/{DB_CONFIG['database']}"
#     )
#     return create_engine(url)

# ==============================================================================
#  DATA LOADING
# ==============================================================================

def load_data(lookback_buffer=120):
    """Load prices and change points from PostgreSQL"""
    # engine = get_engine()

    df = pd.read_sql(
        f"SELECT date, price FROM market_data ORDER BY date DESC LIMIT {lookback_buffer}",
        engine
    )
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').set_index('date')

    cp = pd.read_sql(
        """SELECT crisis_start_date, crisis_end_date,
                  volatility_pre, volatility_crisis, detection_confidence
           FROM detected_change_points ORDER BY crisis_start_date""",
        engine
    )
    cp['crisis_start_date'] = pd.to_datetime(cp['crisis_start_date'])
    cp['crisis_end_date']   = pd.to_datetime(cp['crisis_end_date'])

    engine.dispose()

    print(f"✅ Market data:   {len(df)} rows | Latest: {df.index.max().date()} | ${df['price'].iloc[-1]:.2f}")
    print(f"✅ Change points: {len(cp)} crises")

    return df, cp

# ==============================================================================
#  FEATURE ENGINEERING  (mirrors training Cell 3)
# ==============================================================================

def engineer_crisis_features(market_data, change_points):
    """Build 3 crisis features - matches training notebook exactly"""
    rows = []
    for date in market_data.index:
        past   = change_points[change_points['crisis_end_date'] < date]
        active = change_points[
            (change_points['crisis_start_date'] <= date) &
            (change_points['crisis_end_date']   >= date)
        ]

        days_since = float((date - past.iloc[-1]['crisis_end_date']).days) if len(past) > 0 else 9999.0
        in_crisis  = 1.0 if len(active) > 0 else 0.0
        intensity  = float(active.iloc[0]['volatility_crisis'] / active.iloc[0]['volatility_pre']) \
                     if len(active) > 0 else 1.0

        rows.append({
            'days_since_last_crisis':   days_since,
            'in_crisis':                in_crisis,
            'current_crisis_intensity': intensity
        })

    return pd.DataFrame(rows, index=market_data.index)

# ==============================================================================
#  SHARED HELPERS
# ==============================================================================

def make_forecast_dates(start_date, n_days):
    """Generate n business days starting after start_date"""
    dates = []
    d = pd.Timestamp(start_date) + timedelta(days=1)
    while len(dates) < n_days:
        if d.weekday() < 5:
            dates.append(d)
        d += timedelta(days=1)
    return dates

def confidence_bands(predictions, rmse, lookback=60):
    """Expanding uncertainty: ±RMSE × sqrt(day / lookback)"""
    return [
        {
            'lower_bound': float(p - rmse * np.sqrt((i+1) / lookback)),
            'upper_bound': float(p + rmse * np.sqrt((i+1) / lookback)),
            'uncertainty': float(rmse * np.sqrt((i+1) / lookback))
        }
        for i, p in enumerate(predictions)
    ]

# ==============================================================================
#  MODEL 1 - BASELINE  (price only, shape 60×1)
# ==============================================================================

class BaselineForecaster:

    LOOKBACK  = 60
    HORIZON   = 180
    RMSE      = 1.68  # From your test results

    def __init__(self):
        self.model  = None
        self.scaler = None

    def load(self):
        from tensorflow.keras.models import load_model

        model_path  = os.path.join(MODEL_DIR, 'lstm_model.keras')
        scaler_path = os.path.join(MODEL_DIR, 'price_scaler.pkl')

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Baseline model not found: {model_path}\n"
                "  → Save it from your training notebook:\n"
                "    lstm_model.save('../models/lstm_model.keras')\n"
                "    joblib.dump(price_scaler, '../models/price_scaler.pkl')"
            )

        self.model  = load_model(model_path)
        self.scaler = joblib.load(scaler_path)

        actual_shape = self.model.input_shape
        if actual_shape[-1] != 1:
            raise ValueError(
                f"Baseline model expects 1 feature, got {actual_shape[-1]}.\n"
                "  → Are you pointing to the right model file?"
            )

        print(f"  ✅ Baseline model loaded  | input: (None, {self.LOOKBACK}, 1)")

    def run(self, market_df):
        last_60 = market_df['price'].tail(self.LOOKBACK).values.reshape(-1, 1)
        scaled  = self.scaler.transform(last_60)
        batch   = scaled.reshape(1, self.LOOKBACK, 1)

        preds_scaled = []
        for day in range(self.HORIZON):
            next_s = self.model.predict(batch, verbose=0)[0, 0]
            preds_scaled.append(next_s)
            batch = np.append(batch[:, 1:, :], [[[next_s]]], axis=1)

        preds_actual = self.scaler.inverse_transform(
            np.array(preds_scaled).reshape(-1, 1)
        ).flatten()

        current_price = float(market_df['price'].iloc[-1])
        end_price     = float(preds_actual[-1])
        ret_pct       = (end_price / current_price - 1) * 100

        print(f"  📈 Baseline: ${current_price:.2f} → ${end_price:.2f}  ({ret_pct:+.1f}%)")
        return preds_actual, current_price

# ==============================================================================
#  MODEL 2 - ENHANCED  (price + 3 crisis features, shape 60×4)
# ==============================================================================

class EnhancedForecaster:

    FEATURE_COLS = ['price', 'days_since_last_crisis', 'in_crisis', 'current_crisis_intensity']
    N_FEATURES   = 4
    PRICE_IDX    = 0
    LOOKBACK     = 60
    HORIZON      = 180
    RMSE         = 2.69  # From your test results

    def __init__(self):
        self.model  = None
        self.scaler = None

    def load(self):
        from tensorflow.keras.models import load_model

        model_path  = os.path.join(MODEL_DIR, 'lstm_enhanced_bayesian.keras')
        scaler_path = os.path.join(MODEL_DIR, 'multi_scaler.pkl')

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Enhanced model not found: {model_path}")

        self.model  = load_model(model_path)
        self.scaler = joblib.load(scaler_path)

        if self.model.input_shape[-1] != self.N_FEATURES:
            raise ValueError(
                f"Enhanced model expects {self.model.input_shape[-1]} features, "
                f"generator provides {self.N_FEATURES}."
            )

        print(f"  ✅ Enhanced model loaded  | input: (None, {self.LOOKBACK}, {self.N_FEATURES})")

    def _inv_price(self, scaled_val):
        dummy = np.zeros((1, self.N_FEATURES))
        dummy[0, self.PRICE_IDX] = scaled_val
        return self.scaler.inverse_transform(dummy)[0, self.PRICE_IDX]

    def run(self, market_df, change_points):
        cp_feats = engineer_crisis_features(market_df, change_points)
        full_df  = market_df[['price']].join(
            cp_feats[['days_since_last_crisis', 'in_crisis', 'current_crisis_intensity']]
        )[self.FEATURE_COLS]

        window_scaled = self.scaler.transform(full_df.tail(self.LOOKBACK).values)
        batch = window_scaled.reshape(1, self.LOOKBACK, self.N_FEATURES)

        last         = full_df.iloc[-1]
        days_since   = float(last['days_since_last_crisis'])
        in_crisis    = float(last['in_crisis'])
        intensity    = float(last['current_crisis_intensity'])

        preds_actual = []
        for day in range(self.HORIZON):
            pred_s = self.model.predict(batch, verbose=0)[0, 0]
            pred_a = self._inv_price(pred_s)
            preds_actual.append(pred_a)

            if in_crisis == 0.0:
                days_since += 1.0

            next_scaled = self.scaler.transform(
                np.array([[pred_a, days_since, in_crisis, intensity]])
            )
            batch = np.append(
                batch[:, 1:, :],
                next_scaled.reshape(1, 1, self.N_FEATURES),
                axis=1
            )

        current_price = self._inv_price(window_scaled[-1, self.PRICE_IDX])
        end_price     = float(preds_actual[-1])
        ret_pct       = (end_price / current_price - 1) * 100

        print(f"  📈 Enhanced: ${current_price:.2f} → ${end_price:.2f}  ({ret_pct:+.1f}%)")
        return np.array(preds_actual), current_price

# ==============================================================================
#  CACHE BUILDER
# ==============================================================================

def build_cache(baseline_preds, enhanced_preds, current_price, latest_date):
    """
    Merge both forecasts into one JSON payload.
    The dashboard reads this single file.
    """
    dates = make_forecast_dates(latest_date, BaselineForecaster.HORIZON)

    baseline_bands = confidence_bands(baseline_preds, BaselineForecaster.RMSE)
    enhanced_bands = confidence_bands(enhanced_preds, EnhancedForecaster.RMSE)

    def build_series(preds, bands, label, rmse):
        return {
            'label':    label,
            'rmse':     rmse,
            'end_price': float(preds[-1]),
            'expected_return_pct': float((preds[-1] / current_price - 1) * 100),
            'predictions': [
                {
                    'date':            dates[i].isoformat(),
                    'day':             i + 1,
                    'predicted_price': float(preds[i]),
                    'lower_bound':     bands[i]['lower_bound'],
                    'upper_bound':     bands[i]['upper_bound'],
                    'uncertainty':     bands[i]['uncertainty'],
                    'actual_price':    float(current_price) if i == 0 else None
                }
                for i in range(len(preds))
            ]
        }

    payload = {
        'timestamp': datetime.now().isoformat(),
        'forecast': {
            'metadata': {
                'generated_at':       datetime.now().isoformat(),
                'current_date':       str(latest_date),
                'current_price':      float(current_price),
                'horizon_days':       180,
                'lookback_days':      60,
                'model_confidence':   85.0
            },
            # Two model forecasts side by side
            'baseline':  build_series(baseline_preds,  baseline_bands,  'Baseline LSTM (Price Only)',        BaselineForecaster.RMSE),
            'enhanced':  build_series(enhanced_preds,  enhanced_bands,  'Enhanced LSTM (Bayesian Features)', EnhancedForecaster.RMSE),

            # Divergence: gap between models = Bayesian "crisis signal"
            'divergence': [
                {
                    'date': dates[i].isoformat(),
                    'gap':  float(abs(baseline_preds[i] - enhanced_preds[i])),
                    'baseline_higher': bool(baseline_preds[i] >= enhanced_preds[i])
                }
                for i in range(len(baseline_preds))
            ]
        }
    }

    return payload

# ==============================================================================
#  MAIN
# ==============================================================================

def run():
    print("=" * 70)
    print("  DUAL LSTM FORECAST GENERATOR")
    print("  Baseline (60×1) + Enhanced (60×4)")
    print("=" * 70)

    try:
        # 1. Load data
        print("\n📊 Loading data...")
        market_df, change_points = load_data()

        # 2. Run Baseline
        print("\n🔵 Running Baseline LSTM...")
        baseline = BaselineForecaster()
        baseline.load()
        baseline_preds, current_price = baseline.run(market_df)

        # 3. Run Enhanced
        print("\n🔴 Running Enhanced LSTM...")
        enhanced = EnhancedForecaster()
        enhanced.load()
        enhanced_preds, _ = enhanced.run(market_df, change_points)

        # 4. Build and save cache
        print("\n💾 Building cache...")
        payload = build_cache(
            baseline_preds, enhanced_preds,
            current_price, market_df.index.max()
        )

        cache_file = os.path.join(CACHE_DIR, 'lstm_forecast.json')
        with open(cache_file, 'w') as f:
            json.dump(payload, f, indent=2)

        print(f"\n✅ Saved: {cache_file} ({os.path.getsize(cache_file)/1024:.1f} KB)")

        # 5. Summary
        b_ret = (baseline_preds[-1] / current_price - 1) * 100
        e_ret = (enhanced_preds[-1] / current_price - 1) * 100
        divergence = abs(baseline_preds[-1] - enhanced_preds[-1])

        print("\n" + "=" * 70)
        print("  SUMMARY")
        print("=" * 70)
        print(f"  Current Price:           ${current_price:.2f}")
        print(f"  Baseline 6M Forecast:    ${baseline_preds[-1]:.2f}  ({b_ret:+.1f}%)  RMSE: ${BaselineForecaster.RMSE}")
        print(f"  Enhanced 6M Forecast:    ${enhanced_preds[-1]:.2f}  ({e_ret:+.1f}%)  RMSE: ${EnhancedForecaster.RMSE}")
        print(f"  Model Divergence:        ${divergence:.2f}  ← Bayesian uncertainty signal")
        print("=" * 70)
        print("\n🎉 Complete! Dashboard will now show both forecasts.")
        print("=" * 70)
        return True

    except FileNotFoundError as e:
        print(f"\n❌ FILE ERROR:\n  {e}")
        print("=" * 70)
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 70)
        return False


if __name__ == '__main__':
    success = run()
    sys.exit(0 if success else 1)
