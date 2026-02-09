import pymc as pm
import numpy as np
import pandas as pd
import arviz as az


class WindowedChangePointModel:
    def __init__(self, data: pd.DataFrame):
        # Expects data from load_price_data() (which reads BrentOilPrices.csv)
        self.data = data

    def analyze_event(self, event_date, window_days=180, tune=2000, draws=2000):  # Increased tune/draws
        # 1. Define Window
        target_date = pd.to_datetime(event_date)
        start_date = target_date - pd.Timedelta(days=window_days)
        end_date = target_date + pd.Timedelta(days=window_days)
        window_df = self.data.loc[start_date:end_date].copy()

        if len(window_df) < 50: return None, None

        # 2. Run Model
        y = window_df['Log_Return'].values

        # --- DATA DRIVEN PRIORS (The Fix) ---
        # Instead of guessing 1.0, we use the actual data statistics
        obs_std = np.std(y)
        obs_mean = np.mean(y)

        with pm.Model() as model:
            idx = np.arange(len(y))

            # Priors (Scaled to the data)
            tau = pm.DiscreteUniform("tau", lower=0, upper=len(y) - 1)

            # Means: centered on data mean, width is 2x data std
            mu_1 = pm.Normal("mu_1", mu=obs_mean, sigma=obs_std * 2)
            mu_2 = pm.Normal("mu_2", mu=obs_mean, sigma=obs_std * 2)

            # Volatility: centered on data std
            sigma_1 = pm.HalfNormal("sigma_1", sigma=obs_std)
            sigma_2 = pm.HalfNormal("sigma_2", sigma=obs_std)

            # Switch Logic
            mu = pm.math.switch(tau >= idx, mu_1, mu_2)
            sigma = pm.math.switch(tau >= idx, sigma_1, sigma_2)

            # Likelihood
            obs = pm.Normal("obs", mu=mu, sigma=sigma, observed=y)

            # Inference
            step1 = pm.Metropolis([tau])
            step2 = pm.NUTS([mu_1, mu_2, sigma_1, sigma_2], target_accept=0.95)  # Higher acceptance

            trace = pm.sample(draws, tune=tune, step=[step1, step2], progressbar=True)

        return trace, window_df

    def calculate_metrics(self, trace, window_df, event_name, expected_date):
        """
        Extracts scalar metrics for saving to CSV.
        """
        if trace is None: return None

        # 1. Detect Change Date
        posterior_tau = trace.posterior['tau'].values.flatten()
        mode_tau = int(pd.Series(posterior_tau).mode()[0])
        detected_date = window_df.index[mode_tau]

        # 2. Volatility Shift
        sigma_1 = trace.posterior['sigma_1'].mean().item()
        sigma_2 = trace.posterior['sigma_2'].mean().item()
        pct_change = ((sigma_2 - sigma_1) / sigma_1) * 100

        return {
            'Event_Name': event_name,
            'Expected_Date': expected_date,
            'Detected_Date': detected_date.strftime('%Y-%m-%d'),
            'Volatility_Pre': round(sigma_1, 5),
            'Volatility_Post': round(sigma_2, 5),
            'Volatility_Change_Pct': round(pct_change, 2),
            'Confidence_Interval': '95%'  # Placeholder for now
        }