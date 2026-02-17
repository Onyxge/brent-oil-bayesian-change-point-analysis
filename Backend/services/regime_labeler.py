"""
Regime Labeler
Assigns every trading day to a regime (Normal/Crisis/Recovery)
based on detected change points from the Bayesian model
"""

import pandas as pd
import numpy as np
import logging
from typing import List, Dict

from .db_service import (
    load_market_data,
    load_detected_change_points,
    save_regimes
)

logger = logging.getLogger(__name__)


class RegimeLabeler:
    """
    Assigns daily regime labels to the entire time series
    based on detected change points.
    """

    def __init__(self):
        self.change_points = None
        self.market_data = None
        self.regimes = None

    def load_data(self):
        """Load necessary data from database."""
        logger.info("📊 Loading data for regime labeling...")

        self.market_data = load_market_data()
        self.change_points = load_detected_change_points()

        if self.market_data.empty:
            logger.error("❌ No market data available.")
            return False

        if self.change_points.empty:
            logger.warning("⚠️ No detected change points found. All dates will be labeled 'Normal'.")
            # This is okay - it means no crises detected

        logger.info(f"✅ Loaded {len(self.market_data)} market data rows")
        logger.info(f"✅ Loaded {len(self.change_points)} change points")

        return True

    def assign_regimes(self):
        """
        Main function: Assign regime to every date.

        Returns:
            pd.DataFrame: Daily regime assignments
        """
        if not self.load_data():
            return None

        logger.info("\n🏷️ Assigning regimes to all dates...")

        # Initialize regime dataframe
        regime_df = pd.DataFrame({
            'date': self.market_data.index,
            'price': self.market_data['price'].values,
            'regime': 'Normal',  # Default
            'volatility': 0.0,
            'confidence': 0.0
        })

        # If no change points detected, everything is "Normal"
        if self.change_points.empty:
            # Calculate baseline volatility from log returns
            log_returns = np.log(self.market_data['price'] / self.market_data['price'].shift(1))
            baseline_vol = log_returns.std()

            regime_df['volatility'] = baseline_vol
            regime_df['confidence'] = 1.0

            logger.info("   All dates labeled as 'Normal' (no change points detected)")
            self.regimes = regime_df
            return regime_df

        # Sort change points by date
        change_points_sorted = self.change_points.sort_values('crisis_start_date')

        # Label each date based on which regime it falls into
        for _, cp in change_points_sorted.iterrows():
            start_date = pd.to_datetime(cp['crisis_start_date'])
            end_date = pd.to_datetime(cp['crisis_end_date'])

            # Crisis period
            crisis_mask = (regime_df['date'] >= start_date) & (regime_df['date'] <= end_date)
            regime_df.loc[crisis_mask, 'regime'] = 'Crisis'
            regime_df.loc[crisis_mask, 'volatility'] = cp['volatility_crisis']
            regime_df.loc[crisis_mask, 'confidence'] = cp['detection_confidence']

            # Pre-crisis period (up to 30 days before start)
            pre_start = start_date - pd.Timedelta(days=30)
            pre_mask = (regime_df['date'] >= pre_start) & (regime_df['date'] < start_date)
            regime_df.loc[pre_mask, 'regime'] = 'Normal'
            regime_df.loc[pre_mask, 'volatility'] = cp['volatility_pre']
            regime_df.loc[pre_mask, 'confidence'] = cp['detection_confidence']

            # Recovery period (30 days after end)
            recovery_end = end_date + pd.Timedelta(days=30)
            recovery_mask = (regime_df['date'] > end_date) & (regime_df['date'] <= recovery_end)
            regime_df.loc[recovery_mask, 'regime'] = 'Recovery'
            regime_df.loc[recovery_mask, 'volatility'] = cp['volatility_post']
            regime_df.loc[recovery_mask, 'confidence'] = cp['detection_confidence']

        # For dates not covered by any change point, assign baseline volatility
        normal_mask = regime_df['regime'] == 'Normal'
        if normal_mask.sum() > 0:
            # ✅ FIXED: Get dates where regime is Normal, then filter market_data
            normal_dates = regime_df.loc[normal_mask, 'date'].values
            baseline_data = self.market_data[self.market_data.index.isin(normal_dates)]

            if len(baseline_data) > 1:
                log_returns = np.log(baseline_data['price'] / baseline_data['price'].shift(1))
                baseline_vol = log_returns.std()

                regime_df.loc[normal_mask & (regime_df['volatility'] == 0), 'volatility'] = baseline_vol
                regime_df.loc[normal_mask & (regime_df['confidence'] == 0), 'confidence'] = 0.8

        # Summary statistics
        regime_counts = regime_df['regime'].value_counts()
        logger.info(f"\n📊 Regime Distribution:")
        for regime, count in regime_counts.items():
            pct = (count / len(regime_df)) * 100
            logger.info(f"   {regime}: {count} days ({pct:.1f}%)")

        self.regimes = regime_df
        return regime_df

    def save_to_db(self):
        """Save regime assignments to database."""
        if self.regimes is None:
            logger.error("❌ No regimes to save. Run assign_regimes() first.")
            return False

        try:
            save_regimes(self.regimes)
            logger.info(f"✅ Saved {len(self.regimes)} regime assignments to database.")
            return True
        except Exception as e:
            logger.error(f"❌ Error saving regimes: {e}")
            return False

    def generate_regime_report(self):
        """Generate a summary report of regime assignments."""
        if self.regimes is None:
            logger.error("❌ No regimes available. Run assign_regimes() first.")
            return None

        report = {
            'total_days': len(self.regimes),
            'regime_distribution': self.regimes['regime'].value_counts().to_dict(),
            'avg_volatility_by_regime': self.regimes.groupby('regime')['volatility'].mean().to_dict(),
            'date_range': {
                'start': self.regimes['date'].min().date(),
                'end': self.regimes['date'].max().date()
            }
        }

        # Crisis periods summary
        crisis_periods = []
        current_period = None

        for _, row in self.regimes.iterrows():
            if row['regime'] == 'Crisis':
                if current_period is None:
                    current_period = {
                        'start': row['date'],
                        'end': row['date'],
                        'avg_volatility': row['volatility']
                    }
                else:
                    current_period['end'] = row['date']
            else:
                if current_period is not None:
                    crisis_periods.append(current_period)
                    current_period = None

        # Don't forget last period
        if current_period is not None:
            crisis_periods.append(current_period)

        report['crisis_periods'] = crisis_periods
        report['num_crisis_periods'] = len(crisis_periods)

        return report

    def visualize_regimes(self, save_path=None):
        """
        Create a visualization of regime assignments over time.

        Args:
            save_path: Optional path to save the plot
        """
        if self.regimes is None:
            logger.error("❌ No regimes available. Run assign_regimes() first.")
            return

        try:
            import matplotlib.pyplot as plt
            import matplotlib.dates as mdates

            fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(18, 10), sharex=True)

            # Plot 1: Price with regime shading
            ax1.plot(self.regimes['date'], self.regimes['price'],
                     color='black', linewidth=0.8, label='Brent Oil Price')

            # Shade regime periods
            for regime, color in [('Normal', 'green'), ('Crisis', 'red'), ('Recovery', 'blue')]:
                regime_data = self.regimes[self.regimes['regime'] == regime]
                if not regime_data.empty:
                    ax1.scatter(regime_data['date'], regime_data['price'],
                                c=color, alpha=0.3, s=1, label=regime)

            ax1.set_ylabel('Price (USD)', fontsize=12, fontweight='bold')
            ax1.set_title('Brent Oil Price with Regime Labels', fontsize=14, fontweight='bold')
            ax1.legend(loc='upper left')
            ax1.grid(True, alpha=0.3)

            # Plot 2: Volatility over time
            ax2.plot(self.regimes['date'], self.regimes['volatility'],
                     color='purple', linewidth=1.5, label='Expected Volatility')

            # Shade by regime
            for regime, color in [('Normal', 'green'), ('Crisis', 'red'), ('Recovery', 'blue')]:
                regime_data = self.regimes[self.regimes['regime'] == regime]
                if not regime_data.empty:
                    ax2.fill_between(regime_data['date'], 0, regime_data['volatility'],
                                     color=color, alpha=0.2)

            ax2.set_xlabel('Date', fontsize=12, fontweight='bold')
            ax2.set_ylabel('Volatility', fontsize=12, fontweight='bold')
            ax2.set_title('Regime Volatility Over Time', fontsize=14, fontweight='bold')
            ax2.legend(loc='upper left')
            ax2.grid(True, alpha=0.3)

            # Format x-axis
            ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m'))
            plt.xticks(rotation=45)

            plt.tight_layout()

            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
                logger.info(f"✅ Visualization saved to {save_path}")

            plt.show()

        except Exception as e:
            logger.error(f"❌ Error creating visualization: {e}")


def run_regime_labeling_pipeline():
    """
    Convenience function to run the full regime labeling process.
    """
    logger.info("=" * 60)
    logger.info("  REGIME LABELING PIPELINE")
    logger.info("=" * 60)

    labeler = RegimeLabeler()

    # Step 1: Assign regimes
    regimes_df = labeler.assign_regimes()

    if regimes_df is None:
        logger.error("❌ Failed to assign regimes.")
        return None

    # Step 2: Save to database
    if labeler.save_to_db():
        logger.info("✅ Regime labeling complete!")

    # Step 3: Generate report
    report = labeler.generate_regime_report()
    if report:
        logger.info(f"\n📊 REGIME REPORT:")
        logger.info(f"   Total Days: {report['total_days']}")
        logger.info(f"   Date Range: {report['date_range']['start']} to {report['date_range']['end']}")
        logger.info(f"   Crisis Periods Detected: {report['num_crisis_periods']}")
        logger.info(f"\n   Regime Distribution:")
        for regime, count in report['regime_distribution'].items():
            logger.info(f"      {regime}: {count} days")
        logger.info(f"\n   Avg Volatility by Regime:")
        for regime, vol in report['avg_volatility_by_regime'].items():
            logger.info(f"      {regime}: {vol:.5f}")

    return labeler


if __name__ == "__main__":
    # Test the regime labeler
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    # Run the pipeline
    labeler = run_regime_labeling_pipeline()

    if labeler:
        # Create visualization
        labeler.visualize_regimes(save_path='Backend/results/regime_visualization.png')
