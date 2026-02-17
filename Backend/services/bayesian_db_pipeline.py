"""
Bayesian Change Point Analysis Pipeline
Main orchestrator that runs the complete workflow:
1. Detect all change points automatically
2. Assign daily regimes
3. Save results to database
4. Generate validation reports
"""

import logging
import pandas as pd
from datetime import datetime
import sys

from .global_change_point_detector import GlobalChangePointDetector
from .regime_labeler import RegimeLabeler, run_regime_labeling_pipeline
from .db_service import (
    init_db,
    load_detected_change_points,
    load_events,
    load_regimes
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bayesian_pipeline.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class BayesianPipeline:
    """
    Complete Bayesian Change Point Analysis Pipeline
    """

    def __init__(self, window_size=365, step_size=90, min_confidence=0.70):
        """
        Args:
            window_size: Sliding window size in days
            step_size: Step between windows in days
            min_confidence: Minimum detection confidence (0-1)
        """
        self.window_size = window_size
        self.step_size = step_size
        self.min_confidence = min_confidence

        self.detector = None
        self.labeler = None

        logger.info("=" * 70)
        logger.info("  BAYESIAN CHANGE POINT ANALYSIS PIPELINE")
        logger.info("=" * 70)
        logger.info(f"  Configuration:")
        logger.info(f"    Window Size: {window_size} days")
        logger.info(f"    Step Size: {step_size} days")
        logger.info(f"    Min Confidence: {min_confidence}")
        logger.info("=" * 70)

    def run_full_pipeline(self, tune=2000, draws=2000, skip_detection=False):
        """
        Run the complete pipeline from start to finish.

        Args:
            tune: MCMC tuning iterations
            draws: MCMC sampling iterations
            skip_detection: If True, skip change point detection and just run regime labeling
                           (useful if you've already run detection)

        Returns:
            dict: Pipeline results with detected change points and regimes
        """
        logger.info("\n🚀 Starting Full Bayesian Pipeline...\n")

        # Initialize database
        logger.info("📦 Step 0: Initialize Database")
        init_db()

        results = {}

        # PHASE 1: Change Point Detection
        if not skip_detection:
            logger.info("\n" + "=" * 70)
            logger.info("📊 PHASE 1: AUTOMATIC CHANGE POINT DETECTION")
            logger.info("=" * 70)

            self.detector = GlobalChangePointDetector(
                window_size=self.window_size,
                step_size=self.step_size,
                min_confidence=self.min_confidence
            )

            detected = self.detector.run_global_scan(tune=tune, draws=draws)

            if detected is not None and not detected.empty:
                results['detected_change_points'] = detected
                logger.info(f"\n✅ Phase 1 Complete: Detected {len(detected)} change points")
            else:
                logger.warning("\n⚠️ Phase 1: No change points detected")
                results['detected_change_points'] = pd.DataFrame()
        else:
            logger.info("\n⏭️ Skipping change point detection (skip_detection=True)")
            detected = load_detected_change_points()
            results['detected_change_points'] = detected
            logger.info(f"   Loaded {len(detected)} existing change points from database")

        # PHASE 2: Regime Labeling
        logger.info("\n" + "=" * 70)
        logger.info("🏷️ PHASE 2: DAILY REGIME LABELING")
        logger.info("=" * 70)

        self.labeler = run_regime_labeling_pipeline()

        if self.labeler:
            regimes = load_regimes()
            results['regimes'] = regimes
            logger.info(f"\n✅ Phase 2 Complete: Labeled {len(regimes)} days")
        else:
            logger.error("\n❌ Phase 2 Failed: Could not label regimes")
            results['regimes'] = pd.DataFrame()

        # PHASE 3: Validation
        logger.info("\n" + "=" * 70)
        logger.info("✅ PHASE 3: VALIDATION & REPORTING")
        logger.info("=" * 70)

        validation_results = self.validate_detections()
        results['validation'] = validation_results

        # PHASE 4: Summary
        self.print_final_summary(results)

        logger.info("\n🎉 Pipeline Complete!")
        logger.info("=" * 70)

        return results

    def run_incremental_update(self, tune=1000, draws=1000):
        """
        Run incremental update (for daily automation).
        Only processes new data since last run.

        Args:
            tune: MCMC tuning iterations
            draws: MCMC sampling iterations

        Returns:
            dict: Update results
        """
        logger.info("\n🔄 Running Incremental Update...\n")

        results = {}

        # Check for new change points
        self.detector = GlobalChangePointDetector(
            window_size=self.window_size,
            step_size=self.step_size,
            min_confidence=self.min_confidence
        )

        new_change_points = self.detector.incremental_update(tune=tune, draws=draws)
        results['new_change_points'] = new_change_points

        if not new_change_points.empty:
            logger.info(f"✅ Detected {len(new_change_points)} new change points")

            # Re-run regime labeling
            self.labeler = run_regime_labeling_pipeline()

            if self.labeler:
                regimes = load_regimes()
                results['regimes'] = regimes
                logger.info(f"✅ Updated {len(regimes)} regime assignments")
        else:
            logger.info("✅ No new change points detected")
            results['regimes'] = load_regimes()

        return results

    def validate_detections(self):
        """
        Validate auto-detected change points against ground truth events.

        Returns:
            dict: Validation metrics
        """
        logger.info("\n📊 Validating Detections Against Ground Truth Events...")

        # Load data
        detected = load_detected_change_points()
        known_events = load_events()

        if detected.empty:
            logger.warning("   No detections to validate.")
            return {'status': 'no_detections'}

        if known_events.empty:
            logger.warning("   No ground truth events available for validation.")
            return {'status': 'no_ground_truth'}

        # Validation logic
        matches = []
        false_positives = []
        missed_events = []

        # For each known event, check if we detected it
        for _, event in known_events.iterrows():
            event_date = pd.to_datetime(event['event_date'])

            # Check if any detected change point is within ±60 days
            match = None
            for _, cp in detected.iterrows():
                cp_start = pd.to_datetime(cp['crisis_start_date'])
                cp_end = pd.to_datetime(cp['crisis_end_date'])

                # Event is within detected crisis window
                if cp_start <= event_date <= cp_end:
                    match = cp
                    break

                # Event is close to detected start (within 60 days)
                days_to_start = abs((event_date - cp_start).days)
                if days_to_start <= 60:
                    match = cp
                    break

            if match is not None:
                matches.append({
                    'event': event['description'],
                    'event_date': event_date,
                    'detected_start': match['crisis_start_date'],
                    'detected_end': match['crisis_end_date'],
                    'confidence': match['detection_confidence']
                })
            else:
                missed_events.append({
                    'event': event['description'],
                    'event_date': event_date
                })

        # Check for false positives (detected but not in ground truth)
        for _, cp in detected.iterrows():
            cp_start = pd.to_datetime(cp['crisis_start_date'])

            # Check if this detection matches any known event
            is_match = False
            for _, event in known_events.iterrows():
                event_date = pd.to_datetime(event['event_date'])
                days_diff = abs((cp_start - event_date).days)

                if days_diff <= 60:
                    is_match = True
                    break

            if not is_match:
                false_positives.append({
                    'detected_start': cp['crisis_start_date'],
                    'detected_end': cp['crisis_end_date'],
                    'confidence': cp['detection_confidence']
                })

        # Calculate metrics
        total_events = len(known_events)
        detected_events = len(matches)
        detection_rate = (detected_events / total_events * 100) if total_events > 0 else 0

        false_positive_rate = (len(false_positives) / len(detected) * 100) if len(detected) > 0 else 0

        validation_results = {
            'total_known_events': total_events,
            'detected_events': detected_events,
            'missed_events': len(missed_events),
            'false_positives': len(false_positives),
            'detection_rate': detection_rate,
            'false_positive_rate': false_positive_rate,
            'matches': matches,
            'missed': missed_events,
            'false_pos_list': false_positives
        }

        # Print results
        logger.info(f"\n   📊 Validation Results:")
        logger.info(f"      Total Known Events: {total_events}")
        logger.info(f"      Successfully Detected: {detected_events} ({detection_rate:.1f}%)")
        logger.info(f"      Missed Events: {len(missed_events)}")
        logger.info(f"      False Positives: {len(false_positives)} ({false_positive_rate:.1f}%)")

        if matches:
            logger.info(f"\n   ✅ Correctly Detected Events:")
            for match in matches[:5]:  # Show first 5
                logger.info(f"      - {match['event'][:50]}")

        if missed_events:
            logger.info(f"\n   ⚠️ Missed Events:")
            for miss in missed_events[:5]:  # Show first 5
                logger.info(f"      - {miss['event'][:50]}")

        return validation_results

    def print_final_summary(self, results):
        """Print a final summary of pipeline results."""
        logger.info("\n" + "=" * 70)
        logger.info("  PIPELINE SUMMARY")
        logger.info("=" * 70)

        if 'detected_change_points' in results:
            cp_df = results['detected_change_points']
            logger.info(f"\n  Change Points Detected: {len(cp_df)}")
            if not cp_df.empty:
                avg_conf = cp_df['detection_confidence'].mean()
                logger.info(f"  Average Confidence: {avg_conf:.3f}")

        if 'regimes' in results:
            reg_df = results['regimes']
            logger.info(f"\n  Total Days Labeled: {len(reg_df)}")
            if not reg_df.empty:
                regime_dist = reg_df['regime'].value_counts()
                logger.info(f"  Regime Distribution:")
                for regime, count in regime_dist.items():
                    pct = (count / len(reg_df)) * 100
                    logger.info(f"    - {regime}: {count} days ({pct:.1f}%)")

        if 'validation' in results and results['validation'].get('total_known_events'):
            val = results['validation']
            logger.info(f"\n  Validation Against Ground Truth:")
            logger.info(f"    Detection Rate: {val['detection_rate']:.1f}%")
            logger.info(f"    False Positive Rate: {val['false_positive_rate']:.1f}%")

        logger.info("\n" + "=" * 70)


def main():
    """Main entry point for running the pipeline."""
    import argparse

    parser = argparse.ArgumentParser(description='Bayesian Change Point Analysis Pipeline')
    parser.add_argument('--mode', choices=['full', 'incremental'], default='full',
                        help='Run mode: full (complete scan) or incremental (new data only)')
    parser.add_argument('--window-size', type=int, default=365,
                        help='Sliding window size in days (default: 365)')
    parser.add_argument('--step-size', type=int, default=90,
                        help='Step size between windows in days (default: 90)')
    parser.add_argument('--min-confidence', type=float, default=0.70,
                        help='Minimum detection confidence 0-1 (default: 0.70)')
    parser.add_argument('--tune', type=int, default=2000,
                        help='MCMC tuning iterations (default: 2000)')
    parser.add_argument('--draws', type=int, default=2000,
                        help='MCMC sampling iterations (default: 2000)')
    parser.add_argument('--skip-detection', action='store_true',
                        help='Skip detection phase, only run regime labeling')

    args = parser.parse_args()

    # Initialize pipeline
    pipeline = BayesianPipeline(
        window_size=args.window_size,
        step_size=args.step_size,
        min_confidence=args.min_confidence
    )

    # Run based on mode
    if args.mode == 'full':
        results = pipeline.run_full_pipeline(
            tune=args.tune,
            draws=args.draws,
            skip_detection=args.skip_detection
        )
    else:  # incremental
        results = pipeline.run_incremental_update(
            tune=args.tune,
            draws=args.draws
        )

    return results


if __name__ == "__main__":
    main()
