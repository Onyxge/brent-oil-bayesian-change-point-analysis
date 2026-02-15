import pandas as pd
from .db_service import engine, init_db
from sqlalchemy import text
# The "Truth" List (Curated History of Oil Volatility)
# 20 Events from 2007 to 2026
KNOWN_EVENTS = [
    # --- 2007-2009: The Great Recession ---
    {
        "event_date": "2008-07-11",
        "event_type": "Economic Shock",
        "description": "Oil Peaks at $147: Speculative bubble bursts before the crash.",
        "source": "Bloomberg"
    },
    {
        "event_date": "2008-09-15",
        "event_type": "Economic Shock",
        "description": "Lehman Brothers Collapse: Triggers global financial crisis; demand evaporates.",
        "source": "Federal Reserve"
    },

    # --- 2010-2013: Arab Spring & Recovery ---
    {
        "event_date": "2010-04-20",
        "event_type": "Geopolitical Conflict",
        "description": "Deepwater Horizon Spill: Major regulatory shock and US supply disruption.",
        "source": "Wikipedia"
    },
    {
        "event_date": "2011-02-17",
        "event_type": "Geopolitical Conflict",
        "description": "Libyan Civil War: 1.6M barrels/day removed from market (Arab Spring).",
        "source": "Reuters"
    },
    {
        "event_date": "2012-07-01",
        "event_type": "Geopolitical Conflict",
        "description": "EU Iran Sanctions: European embargo on Iranian oil begins.",
        "source": "European Council"
    },

    # --- 2014-2016: The Shale Crash ---
    {
        "event_date": "2014-11-27",
        "event_type": "Economic Shock",
        "description": "OPEC 'No Cut' Decision: Saudi Arabia declares market share war on US Shale.",
        "source": "OPEC"
    },
    {
        "event_date": "2015-07-14",
        "event_type": "Geopolitical Conflict",
        "description": "Iran Nuclear Deal (JCPOA): Agreement signed, signaling return of Iranian supply.",
        "source": "UN"
    },
    {
        "event_date": "2016-01-20",
        "event_type": "Economic Shock",
        "description": "The Bottom ($27): Oil hits lowest price since 2003 due to oversupply.",
        "source": "MarketWatch"
    },
    {
        "event_date": "2016-12-10",
        "event_type": "Geopolitical Conflict",
        "description": "OPEC+ Formation: First joint cut between OPEC and Russia (Vienna Agreement).",
        "source": "OPEC"
    },

    # --- 2017-2019: Trump Era Volatility ---
    {
        "event_date": "2018-05-08",
        "event_type": "Geopolitical Conflict",
        "description": "US Exits Iran Deal: Trump reimposes sanctions; supply fears spike.",
        "source": "White House Archives"
    },
    {
        "event_date": "2019-01-28",
        "event_type": "Geopolitical Conflict",
        "description": "US Sanctions on PDVSA: Trump administration freezes Venezuelan oil assets, effectively cutting off heavy crude supply to US refineries.",
        "source": "US Treasury"
    },
    {
        "event_date": "2019-09-14",
        "event_type": "Geopolitical Conflict",
        "description": "Abqaiq Drone Attack: Houthi strike knocks out 50% of Saudi oil production overnight.",
        "source": "Aramco"
    },
# --- Venezuela Crisis (Heavy Crude Supply Shock) ---

    # --- 2020-2021: The Pandemic Era ---
    {
        "event_date": "2020-03-06",
        "event_type": "Geopolitical Conflict",
        "description": "OPEC+ Deal Collapse: Russia refuses cuts; Saudi launches aggressive price war.",
        "source": "Reuters"
    },
    {
        "event_date": "2020-04-20",
        "event_type": "Economic Shock",
        "description": "Negative Oil Prices: WTI falls to -$37; Global lockdown demand shock.",
        "source": "CME Group"
    },
    {
        "event_date": "2021-10-04",
        "event_type": "Economic Shock",
        "description": "Global Energy Crunch: Post-COVID demand outpaces supply; gas prices soar.",
        "source": "IEA"
    },

    # --- 2022-2026: War & Inflation Era ---
    {
        "event_date": "2022-02-24",
        "event_type": "Geopolitical Conflict",
        "description": "Russia Invades Ukraine: Global energy panic; Brent hits $139.",
        "source": "BBC"
    },
    {
        "event_date": "2022-06-03",
        "event_type": "Geopolitical Conflict",
        "description": "EU Russian Oil Embargo: 6th sanctions package approved.",
        "source": "EU Commission"
    },
    {
        "event_date": "2023-04-02",
        "event_type": "Economic Shock",
        "description": "OPEC+ Surprise Cut: 1.6M bpd voluntary cut to fight short sellers.",
        "source": "OPEC"
    },
    {
        "event_date": "2023-10-07",
        "event_type": "Geopolitical Conflict",
        "description": "Israel-Hamas Conflict: War premium returns to markets; Middle East tension.",
        "source": "AP News"
    },

    {
        "event_date": "2023-10-18",
        "event_type": "Geopolitical Conflict",
        "description": "Venezuela Sanctions Relief: US temporarily lifts sanctions (Barbados Agreement), allowing oil to flow again.",
        "source": "US State Dept"
    },

    {
        "event_date": "2024-01-12",
        "event_type": "Geopolitical Conflict",
        "description": "Red Sea Strikes: US/UK strike Houthis; tanker traffic diverts from Suez.",
        "source": "Al Jazeera"
    },
{
        "event_date": "2024-04-17",
        "event_type": "Geopolitical Conflict",
        "description": "Sanctions Snapback: US reimposes oil sanctions after Venezuela fails to meet election promises.",
        "source": "Reuters"
    },
    {
        "event_date": "2025-06-01",
        "event_type": "Economic Shock",
        "description": "Global Green Transition Peak: Demand forecasts revised down significantly.",
        "source": "IEA Prediction (Simulated)"
    },
# --- February 2026: The Venezuela Regime Change ---
    {
        "event_date": "2026-02-10",
        "event_type": "Geopolitical Conflict",
        "description": "Maduro Captured: US Special Forces operation leads to the capture of Nicolás Maduro; transition government declared.",
        "source": "Simulated Intelligence (Current Event)"
    },
    {
        "event_date": "2026-02-11",
        "event_type": "Economic Shock",
        "description": "Oil Market Freeze: Brent volatility hits 10-year high as traders weigh the potential for a massive Venezuelan supply surge vs. civil unrest.",
        "source": "Simulated Intelligence (Current Event)"
    }
]


def seed_events():
    print("📜 Seeding Events (Correctly this time!)...")

    # 1. Initialize DB to ensure Schema (Columns + Serial ID) exists
    init_db()

    df = pd.DataFrame(KNOWN_EVENTS)
    df['event_date'] = pd.to_datetime(df['event_date'])

    try:
        with engine.begin() as conn:
            # 2. Clear existing rows manually (Keep the table structure!)
            print("   🧹 Clearing old events...")
            conn.execute(text("TRUNCATE TABLE events RESTART IDENTITY;"))

            # 3. Append new data (Postgres will auto-generate event_id)
            print("   📥 Inserting new events...")
            df.to_sql('events', conn, if_exists='append', index=False)

        print(f"✅ Successfully seeded {len(df)} events with IDs.")

    except Exception as e:
        print(f"❌ Failed to seed events: {e}")


if __name__ == "__main__":
    seed_events()