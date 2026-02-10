📈 Birhan Energies: Model Observability Layer (Frontend)

A React-based Financial Dashboard for visualizing Bayesian Change Point Analysis.
📖 Overview

This frontend is not just a data dashboard; it is a Model Observability Interface. It connects to the Flask inference engine to visualize Regime Shifts, Volatility Uncertainty, and Macro-Economic Correlations in Brent Oil prices.

Designed with a "Bloomberg Terminal" aesthetic, it allows quantitative analysts to:

    Inspect structural breaks in real-time.

    Compare pre-crisis vs. post-crisis risk distributions.

    Analyze the decoupling of Oil prices from the USD Index.

🚀 Key Visualizations
1. Regime-Aware Price Chart (PriceChart.jsx)

    What it does: Renders 20+ years of daily price data.

    The Intelligence: Dynamically shades the background (Green/Red) based on the Bayesian inferred volatility state.

    Tech: Recharts ComposedChart with custom ReferenceLine markers for detected events.

2. Gaussian Distribution Inspector (ChangePointInspector.jsx)

    What it does: Visualizes the "Statistical Shift" caused by an event.

    The Math: Renders two overlapping Normal Distribution curves (N(μ,σ)) representing the Stable vs. Volatile regimes.

    Insight: Visually proves that the market risk profile fundamentally changed (e.g., the curve flattened and widened).

3. Macro Sensitivity Panel (MacroSensitivityPanel.jsx)

    What it does: A dual-axis chart comparing Brent Oil Price (Left Axis) vs. USD Correlation (Right Axis).

    The Insight: Helps analysts identify if price movements are driven by fundamental supply shocks (positive correlation) or currency effects (negative correlation).

🛠️ Tech Stack

    Core Framework: React 18 + Vite (Build Tool)

    UI Component Library: Material UI (MUI) - Used for the responsive Grid layout and "Card" architecture.

    Data Visualization: Recharts - Chosen for its composable, React-native SVG rendering.

    Data Fetching: Native fetch API connecting to the Python/Flask backend.

    Icons: lucide-react for modern, clean iconography.

📂 Component Architecture

The application follows a Component-Based Architecture focused on reusability and isolation.
Bash

Frontend/src/
├── Components/
│   ├── Dashboard.jsx             # Main Controller (State Management & Layout)
│   ├── PriceChart.jsx            # The "Hero" Visualization
│   ├── ChangePointInspector.jsx  # Probability Distribution Rendering
│   ├── MacroSensitivityPanel.jsx # Dual-Axis Correlation Chart
│   └── MetricCard.jsx            # Reusable Stat Block (Volatility, Impact %)
├── App.jsx                       # Route Entry Point (React-Admin Wrapper)
└── main.jsx                      # DOM Injection

⚡ Setup & Installation
Prerequisites

    Node.js (v16 or higher)

    pnpm (recommended) or npm

1. Install Dependencies
Bash

cd Frontend
pnpm install

2. Configure Backend Connection

Ensure the Flask backend is running on port 5000. The frontend is pre-configured to look for: http://127.0.0.1:5000/api/...
3. Run Development Server
Bash

pnpm run dev

    The dashboard will launch at http://localhost:5173 or 3000

🧪 Integration Notes

    Responsive Design: The dashboard uses MUI's Grid system (xs, md, lg breakpoints) to ensure full compatibility with Desktop (Analyst Workstation) and Tablet (Executive Review) form factors.

    Error Handling: All charts include Try/Catch blocks and "No Data" states to gracefully handle API failures or missing datasets.

    Performance: Large datasets (5,000+ points) are optimized using Recharts' allowDataOverflow and backend-side downsampling where necessary.

## Dashborad preview
![A screenshot of the project](Frontend/Brent_Oil_Analysis_Dashboard/src/assets/1.png)

![A screenshot of the project](Frontend/Brent_Oil_Analysis_Dashboard/src/assets/2.png)


![A screenshot of the project](Frontend/Brent_Oil_Analysis_Dashboard/src/assets/3.png)


![A screenshot of the project](Frontend/Brent_Oil_Analysis_Dashboard/src/assets/4.png)


Developer: Yonatan

Status: Production Ready

Last Updated: Feb 2026