"""
Global Change Point Detector
Automatically scans entire time series to detect all change points
Uses sliding window approach with the DualChangePointModel
"""

import pandas as pd
import numpy as np
from datetime import datetime
import logging
from typing import List, Dict, Optional, Tuple

# Import your existing Bayesian model
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..','src')))
from dual_change_point_model import DualChangePointModel

from .db_data_loader import (
    get_bayesian_input_data,
    get_sliding_windows,
    validate_data_quality
)
from .db_service import (
    save_detected_change_points,
    load_detected_change_points,
    get_last_processed_date
)

logger = logging.getLogger(__name__)


class GlobalChangePointDetector:
    """
    Automatically detects ALL change points in the time series
    without relying on pre-labeled events.
    """

    def __init__(self, window_size=365, step_size=90, min_confidence=0.70):
        """
        Args:
            window_size: Size of sliding window in days (default 365 = 1 year)
            step_size: Step between windows in days (default 90 = 3 months)
            min_confidence: Minimum posterior confidence to save detection (0-1)
        """
        self.window_size = window_size
        self.step_size = step_size
        self.min_confidence = min_confidence
        self.detected_change_points = []

        logger.info(f"🔍 Initialized Global Detector:")
        logger.info(f"   Window Size: {window_size} days")
        logger.info(f"   Step Size: {step_size} days")
        logger.info(f"   Min Confidence: {min_confidence}")

    def run_global_scan(self, tune=1000, draws=1000):
        """
        Main function: Scans entire dataset for change points.

        Args:
            tune: MCMC tuning iterations (reduce for speed)
            draws: MCMC sampling iterations

        Returns:
            pd.DataFrame: Detected change points
        """
        logger.info("🚀 Starting Global Change Point Scan...")

        # Load data
        prices_df, _ = get_bayesian_input_data()

        if prices_df is None or not validate_data_quality(prices_df):
            logger.error("❌ Data validation failed. Aborting scan.")
            return None

        # Initialize model
        model = DualChangePointModel(prices_df)

        # Generate sliding windows
        windows = list(get_sliding_windows(
            prices_df,
            window_size=self.window_size,
            step_size=self.step_size
        ))

        logger.info(f"📊 Processing {len(windows)} windows...")

        detected_count = 0

        for idx, (start_date, end_date, window_df) in enumerate(windows):
            logger.info(f"\n--- Window {idx + 1}/{len(windows)} ---")
            logger.info(f"   Range: {start_date.date()} to {end_date.date()}")

            try:
                # Run Bayesian analysis on this window
                trace, _ = self._analyze_window(
                    model, window_df, start_date, end_date,
                    tune=tune, draws=draws
                )

                if trace is not None:
                    # Extract change points from this window
                    change_point = self._extract_change_point(
                        trace, window_df, start_date, end_date
                    )

                    if change_point and change_point['detection_confidence'] >= self.min_confidence:
                        self.detected_change_points.append(change_point)
                        detected_count += 1
                        logger.info(
                            f"   ✅ Change point detected! Confidence: {change_point['detection_confidence']:.3f}")
                    else:
                        logger.info(f"   ⏭️  No significant change point in this window.")

            except Exception as e:
                logger.error(f"   ❌ Error processing window: {e}")
                continue

        logger.info(f"\n🎯 Global Scan Complete!")
        logger.info(f"   Total Windows Processed: {len(windows)}")
        logger.info(f"   Change Points Detected: {detected_count}")

        # Consolidate overlapping detections
        if self.detected_change_points:
            consolidated = self._consolidate_detections()
            logger.info(f"   After Consolidation: {len(consolidated)} unique change points")

            # Save to database
            self._save_to_db(consolidated)

            return pd.DataFrame(consolidated)

        return pd.DataFrame()

    def _analyze_window(self, model, window_df, start_date, end_date, tune, draws):
        """Run Bayesian analysis on a single window."""
        try:
            # Use the center of the window as reference date
            center_date = start_date + (end_date - start_date) / 2

            # Your existing model's analyze_event method
            # We're hijacking it for our sliding window approach
            trace, analyzed_df = model.analyze_event(
                event_date=center_date,
                window_days=self.window_size // 2,  # Half window on each side
                tune=tune,
                draws=draws
            )

            return trace, analyzed_df

        except Exception as e:
            logger.error(f"Error in Bayesian analysis: {e}")
            return None, None

    def _extract_change_point(self, trace, window_df, start_date, end_date):
        """
        Extract change point information from MCMC trace.

        Returns:
            dict with change point metadata
        """
        try:
            # Get posterior medians for tau_1 and tau_2
            t1_idx = int(trace.posterior['tau_1'].median())
            t2_idx = int(trace.posterior['tau_2'].median())

            # Convert indices to dates
            crisis_start = window_df.index[t1_idx]
            crisis_end = window_df.index[t2_idx]

            # Get volatility estimates (posterior means)
            sigma_1 = float(trace.posterior['sigma_1'].mean())
            sigma_2 = float(trace.posterior['sigma_2'].mean())
            sigma_3 = float(trace.posterior['sigma_3'].mean())

            # Calculate detection confidence
            # We use the "sharpness" of the posterior distribution
            # Sharper = more confident
            tau_1_std = float(trace.posterior['tau_1'].std())
            tau_2_std = float(trace.posterior['tau_2'].std())

            # Normalize: Lower std = higher confidence
            # Confidence = 1 - (normalized_std)
            max_std = len(window_df) / 4  # Max uncertainty is 1/4 of window
            confidence_1 = max(0, 1 - (tau_1_std / max_std))
            confidence_2 = max(0, 1 - (tau_2_std / max_std))
            avg_confidence = (confidence_1 + confidence_2) / 2

            # Check if crisis volatility is significantly higher
            volatility_ratio = sigma_2 / ((sigma_1 + sigma_3) / 2)

            # Only consider it a real change point if:
            # 1. Crisis vol is at least 1.5x normal vol
            # 2. Confidence is above threshold
            if volatility_ratio < 1.5:
                logger.info(f"   Vol ratio too low ({volatility_ratio:.2f}x)")
                return None

            return {
                'crisis_start_date': crisis_start.date(),
                'crisis_end_date': crisis_end.date(),
                'volatility_pre': round(sigma_1, 5),
                'volatility_crisis': round(sigma_2, 5),
                'volatility_post': round(sigma_3, 5),
                'detection_confidence': round(avg_confidence, 4),
                'window_size_days': self.window_size,
                'notes': f"Auto-detected in window {start_date.date()} to {end_date.date()}. "
                         f"Vol Ratio: {volatility_ratio:.2f}x"
            }

        except Exception as e:
            logger.error(f"Error extracting change point: {e}")
            return None

    def _consolidate_detections(self):
        """
        Merge overlapping change points detected in multiple windows.

        If multiple windows detect the same crisis, we consolidate them
        by taking the detection with highest confidence.
        """
        if not self.detected_change_points:
            return []

        logger.info(f"\n🔄 Consolidating {len(self.detected_change_points)} detections...")

        # Sort by start date
        sorted_detections = sorted(
            self.detected_change_points,
            key=lambda x: x['crisis_start_date']
        )

        consolidated = []
        current_cluster = [sorted_detections[0]]

        for detection in sorted_detections[1:]:
            # Check if this detection overlaps with current cluster
            # Overlap = start date is within 60 days of cluster's start
            cluster_start = pd.to_datetime(current_cluster[0]['crisis_start_date'])
            detection_start = pd.to_datetime(detection['crisis_start_date'])

            days_diff = abs((detection_start - cluster_start).days)

            if days_diff <= 60:  # Overlapping detection
                current_cluster.append(detection)
            else:
                # Close current cluster, pick best detection
                best_detection = max(
                    current_cluster,
                    key=lambda x: x['detection_confidence']
                )
                consolidated.append(best_detection)

                # Start new cluster
                current_cluster = [detection]

        # Don't forget the last cluster
        if current_cluster:
            best_detection = max(
                current_cluster,
                key=lambda x: x['detection_confidence']
            )
            consolidated.append(best_detection)

        logger.info(f"   Consolidated {len(self.detected_change_points)} → {len(consolidated)}")

        return consolidated

    def _save_to_db(self, consolidated_detections):
        """Save consolidated detections to database."""
        if not consolidated_detections:
            return

        df = pd.DataFrame(consolidated_detections)
        df['detection_date'] = datetime.now()

        save_detected_change_points(df)
        logger.info(f"✅ Saved {len(df)} change points to database.")

    def incremental_update(self, tune=1000, draws=1000):
        """
        Run detection only on NEW data since last scan.
        For daily automation.
        """
        logger.info("🔄 Running Incremental Update...")

        # Get last processed date
        last_date = get_last_processed_date('detected_change_points')

        if last_date is None:
            logger.info("   No previous scan found. Running full scan...")
            return self.run_global_scan(tune=tune, draws=draws)

        # Load recent data
        from db_data_loader import prepare_price_data_for_bayesian
        start_date = last_date - pd.Timedelta(days=self.window_size)

        prices_df = prepare_price_data_for_bayesian(start_date=start_date)

        if prices_df is None or len(prices_df) < 100:
            logger.info("   Insufficient new data for analysis.")
            return pd.DataFrame()

        logger.info(f"   Analyzing data from {start_date.date()} onwards...")

        # Run detection on recent window only
        model = DualChangePointModel(prices_df)

        # Analyze the most recent window
        center_date = prices_df.index[-1] - pd.Timedelta(days=self.window_size // 2)

        try:
            trace, window_df = model.analyze_event(
                event_date=center_date,
                window_days=self.window_size // 2,
                tune=tune,
                draws=draws
            )

            if trace:
                change_point = self._extract_change_point(
                    trace, window_df,
                    window_df.index[0], window_df.index[-1]
                )

                if change_point and change_point['detection_confidence'] >= self.min_confidence:
                    self._save_to_db([change_point])
                    logger.info(f"✅ New change point detected in incremental scan!")
                    return pd.DataFrame([change_point])

            logger.info("   No new change points detected.")
            return pd.DataFrame()

        except Exception as e:
            logger.error(f"❌ Error in incremental update: {e}")
            return pd.DataFrame()


if __name__ == "__main__":
    # Test the global detector
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    print("=" * 60)
    print("  GLOBAL CHANGE POINT DETECTOR - TEST RUN")
    print("=" * 60)

    # Initialize detector
    detector = GlobalChangePointDetector(
        window_size=365,  # 1 year windows
        step_size=90,  # 3 month steps
        min_confidence=0.70  # 70% confidence threshold
    )

    # Run global scan
    # Note: For full production run, use tune=2000, draws=2000
    # For testing, we use smaller values for speed
    detected = detector.run_global_scan(tune=500, draws=500)

    if detected is not None and not detected.empty:
        print(f"\n📊 DETECTION SUMMARY:")
        print(detected[['crisis_start_date', 'crisis_end_date',
                        'volatility_crisis', 'detection_confidence']])
    else:
        print("\n⚠️ No change points detected in test run.")
