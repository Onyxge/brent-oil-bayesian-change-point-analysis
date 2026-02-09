import pymc as pm
import numpy as np
import pandas as pd
import arviz as az


class DualChangePointModel:
    """
    Detects TWO structural breaks (3 Regimes).
    Useful for 'Shock and Recovery' analysis (Normal -> Crisis -> New Normal).
    """

    def __init__(self, data: pd.DataFrame):
        self.data = data

    def analyze_event(self, event_date, window_days=365, tune=2000, draws=2000):
        """
        Runs the MCMC sampler to find start and end of a crisis.
        Note: We need a wider window (default 365 days) to ensure we capture the full recovery.
        """
        target_date = pd.to_datetime(event_date)
        start_date = target_date - pd.Timedelta(days=window_days)
        end_date = target_date + pd.Timedelta(days=window_days)

        # Slice Data
        window_df = self.data.loc[start_date:end_date].copy()

        # Safety Check: Need enough data for 3 distinct regimes
        if len(window_df) < 100:
            print(f"Skipping {event_date}: Insufficient data for 3-regime analysis.")
            return None, None

        y = window_df['Log_Return'].values
        obs_std = np.std(y)

        print(f"Running Dual-Point Analysis for {event_date} ({len(y)} obs)...")

        with pm.Model() as model:
            idx = np.arange(len(y))

            # PRIORS for 2 Change Points (Tau 1 & Tau 2)
            # We force Tau 1 to be in the first 70% and Tau 2 in the last 70% to avoid overlap
            # but usually letting them float with order constraint is better.

            # Simple approach: Tau_1 is early, Tau_2 is late
            tau_1 = pm.DiscreteUniform("tau_1", lower=0, upper=len(y) // 2)
            tau_2 = pm.DiscreteUniform("tau_2", lower=len(y) // 2 + 1, upper=len(y) - 1)

            # 3 Regimes of Volatility (Sigma)
            # Regime 1: Normal (Pre-Crisis)
            sigma_1 = pm.HalfNormal("sigma_1", sigma=obs_std)
            # Regime 2: Crisis (High Volatility) - Prior assumes it's higher (2x)
            sigma_2 = pm.HalfNormal("sigma_2", sigma=obs_std * 2)
            # Regime 3: Recovery (Post-Crisis)
            sigma_3 = pm.HalfNormal("sigma_3", sigma=obs_std)

            # SWITCH LOGIC (The "If-Else-If" Block)
            # If t < tau_1: Use Sigma 1
            # Else if t < tau_2: Use Sigma 2
            # Else: Use Sigma 3
            sigma = pm.math.switch(tau_1 >= idx, sigma_1,
                                   pm.math.switch(tau_2 >= idx, sigma_2, sigma_3))

            # LIKELIHOOD
            # We assume mean returns are 0, focusing purely on volatility clustering
            obs = pm.Normal("obs", mu=0, sigma=sigma, observed=y)

            # SAMPLER
            # Metropolis for discrete variables (Taus), NUTS for continuous (Sigmas)
            step1 = pm.Metropolis([tau_1, tau_2])
            step2 = pm.NUTS([sigma_1, sigma_2, sigma_3], target_accept=0.95)

            trace = pm.sample(draws, tune=tune, step=[step1, step2], progressbar=True)

        return trace, window_df