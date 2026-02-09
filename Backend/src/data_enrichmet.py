import pandas as pd
import pandas_datareader.data as web
import logging
from datetime import datetime
from typing import Dict


# -------------------------------------------------------------------
# Logging Configuration
# -------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# -------------------------------------------------------------------
# Economic Data Enricher
# -------------------------------------------------------------------
class EconomicDataEnricher:
    """
    Fetches macroeconomic indicators from FRED and aligns them with
    daily Brent oil price data.

    Intended for explanatory analysis, not causal inference.
    """

    FRED_SERIES: Dict[str, str] = {
        "GDP": "GDP",              # Quarterly
        "CPI": "CPIAUCSL",         # Monthly
        "Interest_Rate": "DGS10",  # Daily
        "USD_Index": "DTWEXBGS",   # Daily
    }

    def __init__(
        self,
        start_date: str = "1987-05-20",
        end_date: str = None
    ):
        self.start_date = start_date
        self.end_date = end_date or datetime.today().strftime("%Y-%m-%d")

    # ----------------------------------------------------------------
    # Fetch Data from FRED
    # ----------------------------------------------------------------
    def fetch_fred_data(self) -> pd.DataFrame:
        """
        Fetch macroeconomic time series from FRED.

        Returns
        -------
        pd.DataFrame
            DataFrame indexed by date with macroeconomic indicators.
        """
        logger.info("Fetching macroeconomic data from FRED")

        try:
            df = web.DataReader(
                list(self.FRED_SERIES.values()),
                "fred",
                self.start_date,
                self.end_date
            )

        except Exception as exc:
            logger.error("FRED data fetch failed", exc_info=exc)
            raise RuntimeError("Unable to fetch FRED data") from exc

        # Rename columns to readable names
        inverse_map = {v: k for k, v in self.FRED_SERIES.items()}
        df.rename(columns=inverse_map, inplace=True)

        df.index = pd.to_datetime(df.index)

        if df.empty:
            raise RuntimeError("Fetched FRED dataset is empty")

        logger.info("Fetched %d rows of macroeconomic data", len(df))
        return df

    # ----------------------------------------------------------------
    # Merge with Oil Prices
    # ----------------------------------------------------------------
    def merge_with_oil_prices(
        self,
        oil_csv_path: str,
        output_path: str
    ) -> pd.DataFrame:
        """
        Merge macroeconomic indicators with daily Brent oil prices.

        Parameters
        ----------
        oil_csv_path : str
            Path to CSV containing Brent oil prices.
            Expected columns: ['Date', 'Price']
        output_path : str
            Output path for enriched CSV.

        Returns
        -------
        pd.DataFrame
            Enriched dataset.
        """
        logger.info("Loading oil price data from %s", oil_csv_path)

        oil_df = pd.read_csv(oil_csv_path)

        if "Date" not in oil_df.columns or "Price" not in oil_df.columns:
            raise ValueError("Oil CSV must contain 'Date' and 'Price' columns")

        oil_df["Date"] = pd.to_datetime(oil_df["Date"], format="mixed")
        oil_df = oil_df.sort_values("Date").set_index("Date")

        # Fetch macroeconomic data
        econ_df = self.fetch_fred_data()

        # Merge on date index
        logger.info("Merging oil prices with macroeconomic indicators")
        merged_df = oil_df.join(econ_df, how="left")

        # ----------------------------------------------------------------
        # Frequency Alignment
        # ----------------------------------------------------------------
        # Forward-fill macro data:
        # - GDP: quarterly
        # - CPI: monthly
        # - Rates / USD index: daily but missing on weekends
        macro_cols = ["GDP", "CPI", "Interest_Rate", "USD_Index"]
        merged_df[macro_cols] = merged_df[macro_cols].ffill()

        # ----------------------------------------------------------------
        # Derived Variables
        # ----------------------------------------------------------------
        # YoY inflation from CPI (monthly-based calculation)
        merged_df["Inflation_Rate"] = (
            merged_df["CPI"]
            .pct_change(periods=12) * 100
        )

        # Drop rows without oil prices (safety)
        merged_df = merged_df.dropna(subset=["Price"])

        # Save output
        merged_df.to_csv(output_path)
        logger.info("Enriched dataset saved to %s", output_path)
        logger.info("Final columns: %s", list(merged_df.columns))

        return merged_df


# -------------------------------------------------------------------
# Script Entry Point
# -------------------------------------------------------------------
if __name__ == "__main__":
    enricher = EconomicDataEnricher()

    enricher.merge_with_oil_prices(
        oil_csv_path="../data/raw/BrentOilPrices.csv",
        output_path="../data/processed/brent_oil_enriched.csv"
    )
