from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# ==============================================================================
#  PATH CONFIGURATION
# ==============================================================================
API_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(API_DIR)

PATHS = {
    'prices': os.path.join(BACKEND_ROOT, 'data', 'raw', 'BrentOilPrices.csv'),
    'macro': os.path.join(BACKEND_ROOT, 'data', 'processed', 'brent_oil_enriched.csv'),
    'events': os.path.join(BACKEND_ROOT, 'results', 'change_point_results.csv')
}


# ==============================================================================
#  SMART COLUMN MAPPER (The Fix)
# ==============================================================================
def resolve_columns(df):
    """
    Scans the DataFrame and returns a dictionary mapping expected keys
    (Event, Pre, Post) to the ACTUAL column names in the CSV.
    """
    cols = df.columns
    mapping = {}

    # 1. Find EVENT Name
    candidates = ['Event', 'event', 'Event_Name', 'EventName', 'events']
    for c in candidates:
        if c in cols:
            mapping['Event'] = c
            break
    if 'Event' not in mapping: mapping['Event'] = cols[0]  # Fallback to first col

    # 2. Find DETECTED DATE
    candidates = ['Detected_Date', 'Date', 'Change_Point_Date', 'Change_Point', 'date']
    for c in candidates:
        if c in cols:
            mapping['Date'] = c
            break

    # 3. Find PRE-EVENT VOLATILITY (sigma_1)
    candidates = ['Pre_Event_Vol', 'Pre_Vol', 'sigma_1', 'Sigma_1', 'Vol_1', 'pre_vol']
    for c in candidates:
        if c in cols:
            mapping['Pre'] = c
            break

    # 4. Find POST-EVENT VOLATILITY (sigma_2)
    candidates = ['Post_Event_Vol', 'Post_Vol', 'sigma_2', 'Sigma_2', 'Vol_2', 'post_vol']
    for c in candidates:
        if c in cols:
            mapping['Post'] = c
            break

    # 5. Find PERCENTAGE CHANGE
    candidates = ['Volatility_Change_Pct', 'Pct_Change', 'Change_Pct', 'impact']
    for c in candidates:
        if c in cols:
            mapping['Pct'] = c
            break

    return mapping


def load_dataset(key):
    path = PATHS.get(key)
    if not os.path.exists(path):
        print(f"❌ ERROR: File not found at: {path}")
        return None
    try:
        df = pd.read_csv(path)
        if 'Date' in df.columns:
            df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
            df = df.dropna(subset=['Date']).sort_values('Date')
        df = df.replace({np.nan: None, np.inf: None, -np.inf: None})
        return df
    except Exception as e:
        print(f"❌ ERROR reading {key}: {e}")
        return None


# ==============================================================================
#  ENDPOINT 1: REGIME-AWARE PRICE DYNAMICS
# ==============================================================================
@app.route('/api/model/regimes', methods=['GET'])
def get_regime_history():
    df_prices = load_dataset('prices')
    df_events = load_dataset('events')

    if df_prices is None: return jsonify({"error": "Price data missing"}), 404

    # Initialize defaults
    df_prices['regime'] = 'Normal'
    df_prices['regime_volatility'] = 0.02

    if df_events is not None:
        # Get correct column names
        col_map = resolve_columns(df_events)

        # Only proceed if we found the volatility columns
        if 'Pre' in col_map and 'Post' in col_map:
            for _, event in df_events.iterrows():
                try:
                    # We need window start/end. If missing, assume +/- 1 year
                    # (Adjust this logic if your CSV has Window_Start/End)
                    det_date = pd.to_datetime(event[col_map.get('Date', 'Detected_Date')])
                    start = det_date - pd.Timedelta(days=365)
                    end = det_date + pd.Timedelta(days=365)

                    if 'Window_Start' in df_events.columns: start = pd.to_datetime(event['Window_Start'])
                    if 'Window_End' in df_events.columns: end = pd.to_datetime(event['Window_End'])

                    pre_vol = float(event[col_map['Pre']])
                    post_vol = float(event[col_map['Post']])

                    is_high_vol = post_vol > pre_vol
                    regime_label = 'High_Vol' if is_high_vol else 'Low_Vol'

                    mask = (df_prices['Date'] >= start) & (df_prices['Date'] <= end)
                    df_prices.loc[mask, 'regime'] = regime_label

                    mask_pre = mask & (df_prices['Date'] < det_date)
                    mask_post = mask & (df_prices['Date'] >= det_date)

                    df_prices.loc[mask_pre, 'regime_volatility'] = pre_vol
                    df_prices.loc[mask_post, 'regime_volatility'] = post_vol
                except Exception as e:
                    continue

    # Filter & Downsample
    start_arg = request.args.get('start')
    end_arg = request.args.get('end')
    if start_arg and end_arg:
        df_prices = df_prices[(df_prices['Date'] >= start_arg) & (df_prices['Date'] <= end_arg)]

    if len(df_prices) > 5000: df_prices = df_prices.iloc[::2]

    return jsonify(df_prices.to_dict(orient='records'))


# ==============================================================================
#  ENDPOINT 2: EVENT CAUSALITY INSPECTOR
# ==============================================================================
@app.route('/api/model/event/<event_name>', methods=['GET'])
def get_event_distributions(event_name):
    df_events = load_dataset('events')
    if df_events is None: return jsonify({"error": "Events missing"}), 404

    # 1. Resolve Columns dynamically
    col_map = resolve_columns(df_events)
    event_col = col_map['Event']

    # 2. Find the event
    try:
        mask = df_events[event_col].astype(str).str.lower() == event_name.lower()
        event_row = df_events[mask]
    except:
        return jsonify({"error": "Search failed"}), 500

    if event_row.empty:
        return jsonify({"error": "Event not found"}), 404

    event = event_row.iloc[0]

    # 3. Build Response using mapped columns
    # Use .get() with defaults to prevent crashing if a column is still missing
    pre_vol = float(event[col_map['Pre']]) if 'Pre' in col_map else 0.01
    post_vol = float(event[col_map['Post']]) if 'Post' in col_map else 0.02
    pct_change = event[col_map['Pct']] if 'Pct' in col_map else 0

    response = {
        "event_name": event[event_col],
        "detected_date": event[col_map.get('Date', 'Detected_Date')],
        "confidence": event.get('Confidence_Interval', 0.94),
        "distributions": {
            "pre": {"std": pre_vol, "label": "Stable Regime"},
            "post": {"std": post_vol, "label": "New Regime"}
        },
        "stats": {
            "volatility_change_pct": pct_change
        }
    }
    return jsonify(response)


# ==============================================================================
#  ENDPOINT 3: MACRO SENSITIVITY
# ==============================================================================
@app.route('/api/macro/correlations', methods=['GET'])
def get_rolling_correlations():
    df = load_dataset('macro')
    if df is None: return jsonify({"error": "Macro data missing"}), 404

    df['corr_usd'] = df['Price'].rolling(90).corr(df['USD_Index'])
    df_clean = df.dropna(subset=['corr_usd']).tail(2000)

    return jsonify(df_clean[['Date', 'Price', 'corr_usd']].to_dict(orient='records'))


# ==============================================================================
#  ENDPOINT 4: EVENT LIST
# ==============================================================================
@app.route('/api/events', methods=['GET'])
def get_event_list():
    df = load_dataset('events')
    if df is None: return jsonify([]), 200

    col_map = resolve_columns(df)

    # Standardize output for Frontend
    output = []
    for i, row in df.iterrows():
        item = {
            'id': i + 1,
            'Event': row[col_map['Event']],
            'Detected_Date': row[col_map.get('Date', 'Detected_Date')],
            'Volatility_Change_Pct': row[col_map['Pct']] if 'Pct' in col_map else 0,
            'Pre_Event_Vol': row[col_map['Pre']] if 'Pre' in col_map else 0,
            'Post_Event_Vol': row[col_map['Post']] if 'Post' in col_map else 0,
            'Confidence_Interval': row.get('Confidence_Interval', 0.94)
        }
        output.append(item)

    return jsonify(output)


if __name__ == '__main__':
    print(f"🚀 API Running. Data Root: {BACKEND_ROOT}")
    app.run(debug=True, port=5000)