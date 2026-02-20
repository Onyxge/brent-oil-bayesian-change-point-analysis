import { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, Area, AreaChart, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Brush
} from "recharts";


// ─── THEME TOKENS ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#070b14",
  surface:  "#0e1421",
  card:     "#111827",
  border:   "#1e2d45",
  blue:     "#3b82f6",
  cyan:     "#06b6d4",
  purple:   "#a78bfa",
  green:    "#10b981",
  red:      "#ef4444",
  orange:   "#f59e0b",
  text:     "#f1f5f9",
  muted:    "#64748b",
  subtle:   "#1e293b",
};


// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const generatePriceData = () => {
  const data = [];
  let actual = 67.5, predicted = 67.8;
  const dates = [];
  const start = new Date("2025-08-22");
  for (let i = 0; i < 180; i++) {
    const d = new Date(start);
    d.offset = i;
    d.setDate(start.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(d);
  }
  dates.forEach((d, i) => {
    actual    += (Math.random() - 0.49) * 1.4 + Math.sin(i / 20) * 0.3;
    predicted += (Math.random() - 0.48) * 1.2 + Math.sin(i / 20) * 0.3;
    const uncertainty = 0.8 + (i / dates.length) * 3.5;
    data.push({
      date:      d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      actual:    i < 130 ? parseFloat(actual.toFixed(2)) : null,
      predicted: parseFloat(predicted.toFixed(2)),
      upper:     parseFloat((predicted + uncertainty).toFixed(2)),
      lower:     parseFloat((predicted - uncertainty).toFixed(2)),
    });
  });
  return data;
};


const generateChangePointData = () => {
  const data = [];
  let price = 67.2;
  const start = new Date("2025-10-01");
  for (let i = 0; i < 140; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    price += (Math.random() - 0.51) * 1.3 + Math.sin(i / 15) * 0.4;
    data.push({
      date:  d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: parseFloat(price.toFixed(2)),
    });
  }
  return data;
};


const PRICE_DATA  = generatePriceData();
const CP_DATA     = generateChangePointData();


const CHANGE_POINTS = [
  { date: "Nov 03", label: "Regime shift", confidence: 94, color: C.orange, description: "Transition from bullish to mean-reverting regime. Volatility increased 35%." },
  { date: "Dec 12", label: "Structural break", confidence: 87, color: C.red,    description: "Correlation structure changed across sector. Possible macro repricing." },
  { date: "Jan 20", label: "Volatility spike",  confidence: 79, color: C.blue,   description: "Sharp volatility increase. Crisis regime probability elevated." },
];


const KEY_EVENTS = [
  { date: "Sep 15", type: "earnings",  label: "Q3 Earnings Beat",    detail: "EPS $3.42 vs $3.18 expected. Revenue up 12% YoY.",       color: C.green  },
  { date: "Oct 28", type: "policy",    label: "Fed Rate Hold",        detail: "FOMC held rates at 5.25%. Dovish tone noted.",            color: C.orange },
  { date: "Nov 15", type: "macro",     label: "CPI Surprise",         detail: "CPI came in at 2.8%, below 3.1% forecast.",             color: C.green  },
  { date: "Dec 10", type: "shock",     label: "OPEC Supply Cut",      detail: "OPEC+ announced 500k bpd cut, tightening supply.",       color: C.red    },
  { date: "Jan 13", type: "earnings",  label: "Q4 Earnings Miss",     detail: "EPS $2.91 vs $3.20 expected. Guidance cut 8%.",          color: C.red    },
  { date: "Jan 29", type: "policy",    label: "Fed Cut Signal",       detail: "Fed minutes signaled March cut. Markets rally 2.1%.",    color: C.green  },
];


const PERF_DATA = (() => {
  const d = [];
  let port = 0, bench = 0, dd = 0, peak = 0;
  const start = new Date("2025-08-21");
  for (let i = 0; i < 130; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    port  += (Math.random() - 0.505) * 0.5;
    bench += (Math.random() - 0.49)  * 0.4;
    peak   = Math.max(peak, port);
    dd     = port - peak;
    d.push({
      date:      dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      portfolio: parseFloat(port.toFixed(2)),
      benchmark: parseFloat(bench.toFixed(2)),
      drawdown:  parseFloat(dd.toFixed(2)),
    });
  }
  return d;
})();


const METRICS = [
  { label: "Current Price",    value: "$67.26",   sub: "Brent Crude",         color: C.blue,   delta: null    },
  { label: "6M LSTM Forecast", value: "$71.40",   sub: "+6.1% expected",      color: C.green,  delta: "+6.1%" },
  { label: "Model RMSE",       value: "$1.68",    sub: "Baseline accuracy",   color: C.cyan,   delta: null    },
  { label: "Regime",           value: "Normal",   sub: "238 days stable",     color: C.green,  delta: null    },
  { label: "Volatility",       value: "2.34%",    sub: "30-day rolling",      color: C.orange, delta: null    },
  { label: "Crisis Prob.",     value: "5%",        sub: "Next 6 months",       color: C.muted,  delta: null    },
];


const NAV_ITEMS = [
  { id: "overview",     label: "Overview",        icon: "⊞"  },
  { id: "prediction",   label: "Price Prediction", icon: "📈" },
  { id: "changepoints", label: "Change Points",    icon: "⚡" },
  { id: "events",       label: "Key Events",       icon: "📅" },
  { id: "performance",  label: "Performance",      icon: "📊" },
];


// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useForecast() {
  const [forecast, setForecast] = useState(null);
  const [analysis, setAnalysis] = useState(null);


  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/forecast/lstm")
      .then(r => r.json())
      .then(d => setForecast(d))
      .catch(() => {});


    fetch("http://127.0.0.1:5000/api/forecast/analysis")
      .then(r => r.json())
      .then(d => setAnalysis(d))
      .catch(() => {});
  }, []);


  return { forecast, analysis };
}


// ─── COMPONENTS ───────────────────────────────────────────────────────────────


const Badge = ({ label, color }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700,
    letterSpacing: 0.5, textTransform: "uppercase"
  }}>
    {label}
  </span>
);


const MetricCard = ({ label, value, sub, color, delta }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "18px 20px",
    borderTop: `3px solid ${color}`,
    transition: "transform 0.15s",
  }}
    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
  >
    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>
      {value}
      {delta && <span style={{ fontSize: 13, fontWeight: 600, color: C.green, marginLeft: 8 }}>{delta}</span>}
    </div>
    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</div>
  </div>
);


const ChartCard = ({ title, subtitle, children, controls }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: 16, padding: "24px", marginBottom: 24,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{subtitle}</div>
      </div>
      {controls}
    </div>
    {children}
  </div>
);


const RangeBtn = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? C.blue : "transparent",
    color: active ? "#fff" : C.muted,
    border: `1px solid ${active ? C.blue : C.border}`,
    borderRadius: 6, padding: "4px 12px", fontSize: 12,
    fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
  }}>
    {label}
  </button>
);


const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1e2d45", border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "12px 16px", fontSize: 12,
    }}>
      <div style={{ color: C.muted, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color, marginBottom: 3 }}>
          {p.name}: <strong>${typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};


// ─── SECTIONS ─────────────────────────────────────────────────────────────────


const OverviewSection = ({ analysis }) => (
  <div>
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 6 }}>
        Brent Oil Analytics
      </div>
      <div style={{ fontSize: 14, color: C.muted }}>
        LSTM forecasting + Bayesian regime detection · Updated {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>
    </div>


    {/* Metrics Grid */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
      {METRICS.map(m => <MetricCard key={m.label} {...m} />)}
    </div>


    {/* Analysis Summary */}
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: 24
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Analysis Summary</div>
          <div style={{ fontSize: 12, color: C.muted }}>Key findings from LSTM and Bayesian models</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge label="Accumulation" color={C.blue} />
          <Badge label="Neutral-Bullish" color={C.green} />
        </div>
      </div>


      <div style={{
        background: C.subtle, borderRadius: 10, padding: 16, marginBottom: 20,
        borderLeft: `3px solid ${C.blue}`, fontSize: 14, color: C.text, lineHeight: 1.7
      }}>
        LSTM baseline model forecasts moderate upside over the next 6 months with a predicted price target of <strong style={{ color: C.cyan }}>$71.40 (±$3.20)</strong>. Baseline RMSE: $1.68. Enhanced Bayesian model signals <strong style={{ color: C.orange }}>238 days</strong> since last crisis — approaching historical average cycle of 180 days.
      </div>


      {[
        { icon: "🔵", title: "Current Regime", text: analysis?.current_state?.regime === "Crisis" ? "Crisis regime detected. Reduce exposure 20-30% and increase cash reserves." : "Normal regime. Market stable for 238 days. Forecast confidence at 85%. Consider light hedging as cycle matures." },
        { icon: "🛡️", title: "Risk Assessment", text: "Crisis probability: 5% over next 6 months. Volatility at 2.34% (low). Historical average crisis intensity: 1.52× pre-crisis volatility." },
        { icon: "💡", title: "Opportunities", text: "LSTM baseline (RMSE $1.68) outperforms enhanced model. Price momentum positive. 6-month target $71.40 implies 6.1% upside from current levels." },
      ].map(({ icon, title, text }) => (
        <div key={title} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 20, marginTop: 2 }}>{icon}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{text}</div>
          </div>
        </div>
      ))}


      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
        <span>🕐 Last updated: {new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        <span>Model confidence: <strong style={{ color: C.green }}>85%</strong></span>
      </div>
    </div>
  </div>
);


const PredictionSection = ({ forecast }) => {
  const [range, setRange] = useState("ALL");
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch historical price data on mount
  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/model/regimes")
      .then(res => res.json())
      .then(data => {
        // Filter to 2007 onwards and format for chart
        const filtered = data
          .filter(d => new Date(d.Date || d.date) >= new Date("2007-01-01"))
          .map(d => ({
            date: new Date(d.Date || d.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: d.Date ? new Date(d.Date).getFullYear() % 100 : undefined // show year for historical
            }),
            fullDate: new Date(d.Date || d.date),
            price: parseFloat((d.Price || d.price).toFixed(2)),
            regime: d.regime,
            isHistorical: true
          }))
          .sort((a, b) => a.fullDate - b.fullDate);

        setHistoricalData(filtered);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load historical data:", err);
        setLoading(false);
      });
  }, []);

  // Build combined dataset: historical + forecast
  const buildChartData = () => {
    if (loading || !historicalData.length) return [];

    // Get forecast data
    const apiData = forecast?.baseline?.predictions;
    const forecastPoints = apiData
      ? apiData.map(p => ({
          date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          fullDate: new Date(p.date),
          predicted: parseFloat(p.predicted_price?.toFixed(2)),
          upper: parseFloat(p.upper_bound?.toFixed(2)),
          lower: parseFloat(p.lower_bound?.toFixed(2)),
          isForecast: true
        }))
      : [];

    // Combine: all historical + forecast
    let combined = [...historicalData];

    // Add forecast points
    forecastPoints.forEach(f => {
      combined.push({
        date: f.date,
        fullDate: f.fullDate,
        predicted: f.predicted,
        upper: f.upper,
        lower: f.lower,
        isForecast: true
      });
    });

    // Apply range filter
    const now = new Date();
    let cutoffDate;

    switch(range) {
      case "1Y":
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case "3Y":
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 3);
        break;
      case "5Y":
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 5);
        break;
      case "ALL":
      default:
        cutoffDate = new Date("2007-01-01");
    }

    combined = combined.filter(d => d.fullDate >= cutoffDate);

    // Downsample for performance if showing ALL (too many points)
    if (range === "ALL" && combined.length > 500) {
      const step = Math.ceil(combined.length / 500);
      combined = combined.filter((_, i) => i % step === 0 || combined[i]?.isForecast);
    }

    return combined;
  };

  const chartData = buildChartData();
  const currentPrice = historicalData.length ? historicalData[historicalData.length - 1].price : 67.26;
  const forecastEndPrice = forecast?.baseline?.end_price || 71.40;
  const expectedReturn = ((forecastEndPrice / currentPrice - 1) * 100).toFixed(1);

  if (loading) {
    return (
      <ChartCard title="Price & LSTM Prediction" subtitle="Loading historical data...">
        <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: C.muted }}>Loading...</div>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Price & LSTM Prediction"
      subtitle={`Historical prices (2007–present) with baseline model forecast and confidence interval`}
      controls={
        <div style={{ display: "flex", gap: 6 }}>
          {["1Y", "3Y", "5Y", "ALL"].map(r => (
            <RangeBtn key={r} label={r} active={range === r} onClick={() => setRange(r)} />
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.purple} stopOpacity={0.35} />
              <stop offset="95%" stopColor={C.purple} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis
            dataKey="date"
            tick={{ fill: C.muted, fontSize: 11 }}
            interval={Math.ceil(chartData.length / 12)} // ~12 labels max
          />
          <YAxis
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fill: C.muted, fontSize: 11 }}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: C.muted }} />

          {/* Confidence band for forecast */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="url(#confBand)"
            name="Confidence Band"
            legendType="square"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill={C.bg}
            name=""
            legendType="none"
          />

          {/* Historical price line (solid cyan) */}
          <Line
            type="monotone"
            dataKey="price"
            stroke={C.cyan}
            strokeWidth={2}
            dot={false}
            name="Historical Price"
            connectNulls={false}
          />

          {/* LSTM forecast line (dashed purple) */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={C.purple}
            strokeWidth={2}
            dot={false}
            name="LSTM Forecast"
            strokeDasharray="5 3"
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary bar */}
      <div style={{
        display: "flex",
        gap: 24,
        marginTop: 16,
        padding: "12px 16px",
        background: C.subtle,
        borderRadius: 8,
        flexWrap: "wrap"
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Data Range</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.cyan, fontFamily: "'DM Mono', monospace" }}>
            {range === "ALL" ? "2007–Present" : `${range} History`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Current Price</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.cyan, fontFamily: "'DM Mono', monospace" }}>
            ${currentPrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>6M Forecast</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.purple, fontFamily: "'DM Mono', monospace" }}>
            ${forecastEndPrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Expected Return</div>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: expectedReturn >= 0 ? C.green : C.red,
            fontFamily: "'DM Mono', monospace"
          }}>
            {expectedReturn >= 0 ? '+' : ''}{expectedReturn}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Model RMSE</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.muted, fontFamily: "'DM Mono', monospace" }}>
            ±${forecast?.baseline?.rmse?.toFixed(2) || "1.68"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Confidence</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.green, fontFamily: "'DM Mono', monospace" }}>
            85%
          </div>
        </div>
      </div>

      {/* Additional info */}
      <div style={{
        marginTop: 12,
        padding: "8px 12px",
        background: C.subtle,
        borderRadius: 6,
        borderLeft: `3px solid ${C.blue}`
      }}>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          💡 <strong>Chart shows:</strong> {historicalData.length.toLocaleString()} days of historical Brent crude prices
          (2007–present) plus 180-day LSTM baseline forecast with expanding confidence band.
          {range === "ALL" && " Data downsampled for performance."}
        </div>
      </div>
    </ChartCard>
  );
};


const ChangePointSection = () => {
  const [changePoints, setChangePoints] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1Y"); // 6M, 1Y, 3Y, ALL

  useEffect(() => {
    // Fetch change points and price data
    Promise.all([
      fetch("http://127.0.0.1:5000/api/events").then(r => r.json()),
      fetch("http://127.0.0.1:5000/api/model/regimes").then(r => r.json())
    ])
      .then(([eventsData, pricesData]) => {
        // Process change points
        const processedCP = eventsData.map((ev, i) => {
          const date = new Date(ev.Detected_Date || ev.detected_date);
          const confidence = parseFloat(ev.Confidence_Interval || ev.confidence || 0);
          const volChange = parseFloat(ev.Volatility_Change_Pct || 0);

          // Color based on confidence
          let color = C.blue;
          if (confidence >= 0.90) color = C.red;
          else if (confidence >= 0.80) color = C.orange;
          else if (confidence >= 0.70) color = C.green;

          return {
            id: ev.id || i,
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: date,
            label: ev.Event || ev.event_name || "Unknown Event",
            confidence: confidence,
            confidencePercent: (confidence * 100).toFixed(0) + "%",
            volChange: volChange,
            preVol: parseFloat(ev.Pre_Event_Vol || 0),
            postVol: parseFloat(ev.Post_Event_Vol || 0),
            description: `Transition to ${volChange > 50 ? 'high' : volChange > 20 ? 'elevated' : 'moderate'} volatility regime. ` +
                        `Volatility ${volChange >= 0 ? 'increased' : 'decreased'} ${Math.abs(volChange).toFixed(1)}%.`,
            color: color
          };
        }).sort((a, b) => b.fullDate - a.fullDate); // Most recent first

        // Process price data
        const processedPrices = pricesData
          .map(d => ({
            date: new Date(d.Date || d.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            }),
            fullDate: new Date(d.Date || d.date),
            price: parseFloat((d.Price || d.price).toFixed(2)),
            regime: d.regime
          }))
          .sort((a, b) => a.fullDate - b.fullDate);

        setChangePoints(processedCP);
        setPriceData(processedPrices);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load change point data:", err);
        setLoading(false);
      });
  }, []);

  // Filter data based on time range
  const getFilteredData = () => {
    if (!priceData.length || !changePoints.length) return { prices: [], cps: [] };

    const now = new Date();
    let cutoffDate;

    switch(timeRange) {
      case "6M":
        cutoffDate = new Date(now);
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case "1Y":
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case "3Y":
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(now.getFullYear() - 3);
        break;
      case "ALL":
      default:
        // Show all data from earliest change point
        cutoffDate = new Date(Math.min(...changePoints.map(cp => cp.fullDate)));
        cutoffDate.setMonth(cutoffDate.getMonth() - 1); // Add 1 month buffer before
    }

    const filteredPrices = priceData.filter(d => d.fullDate >= cutoffDate);
    const filteredCPs = changePoints.filter(cp => cp.fullDate >= cutoffDate);

    return { prices: filteredPrices, cps: filteredCPs };
  };

  const { prices, cps } = getFilteredData();

  if (loading) {
    return (
      <ChartCard title="Bayesian Change Point Analysis" subtitle="Loading...">
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: C.muted }}>Loading change points and price data...</div>
        </div>
      </ChartCard>
    );
  }

  if (!changePoints.length) {
    return (
      <ChartCard title="Bayesian Change Point Analysis" subtitle="No change points detected">
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: C.muted }}>No structural breaks detected in database.</div>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Bayesian Change Point Analysis"
      subtitle={`Detected structural breaks with confidence levels (${cps.length} events in view)`}
      controls={
        <div style={{ display: "flex", gap: 6 }}>
          {["6M", "1Y", "3Y", "ALL"].map(r => (
            <RangeBtn
              key={r}
              label={r}
              active={timeRange === r}
              onClick={() => setTimeRange(r)}
            />
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={prices}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis
            dataKey="date"
            tick={{ fill: C.muted, fontSize: 11 }}
            interval={Math.ceil(prices.length / 10)}
          />
          <YAxis
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fill: C.muted, fontSize: 11 }}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Vertical markers for each change point */}
          {cps.map(cp => (
            <ReferenceLine
              key={cp.id}
              x={cp.date}
              stroke={cp.color}
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{
                value: cp.confidencePercent,
                fill: cp.color,
                fontSize: 11,
                fontWeight: 700,
                position: "top"
              }}
            />
          ))}

          <Line
            type="monotone"
            dataKey="price"
            stroke={C.cyan}
            strokeWidth={2}
            dot={false}
            name="Price"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Change point details list */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {cps.length === 0 ? (
          <div style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: C.subtle,
            textAlign: "center",
            color: C.muted,
            fontSize: 13
          }}>
            No change points in selected time range. Try "ALL" to see historical events.
          </div>
        ) : (
          cps.map(cp => (
            <div
              key={cp.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: C.subtle,
                borderLeft: `3px solid ${cp.color}`,
              }}
            >
              {/* Confidence badge */}
              <div
                style={{
                  background: cp.color + "22",
                  color: cp.color,
                  border: `1px solid ${cp.color}44`,
                  borderRadius: 99,
                  padding: "2px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                  marginTop: 2,
                  minWidth: 50,
                  textAlign: "center"
                }}
              >
                {cp.confidencePercent}
              </div>

              {/* Event details */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 3
                }}>
                  {cp.label}
                  <span style={{
                    color: C.muted,
                    fontWeight: 400,
                    marginLeft: 8
                  }}>
                    {cp.date}
                  </span>
                </div>
                <div style={{
                  fontSize: 12,
                  color: C.muted,
                  lineHeight: 1.5,
                  marginBottom: 6
                }}>
                  {cp.description}
                </div>

                {/* Stats */}
                <div style={{
                  display: "flex",
                  gap: 16,
                  fontSize: 11,
                  color: C.muted
                }}>
                  <span>
                    <strong style={{ color: C.text }}>Vol Change:</strong> {cp.volChange >= 0 ? '+' : ''}{cp.volChange.toFixed(1)}%
                  </span>
                  <span>
                    <strong style={{ color: C.text }}>Pre:</strong> {cp.preVol.toFixed(3)}
                  </span>
                  <span>
                    <strong style={{ color: C.text }}>Post:</strong> {cp.postVol.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary stats */}
      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${C.border}`,
        display: "flex",
        gap: 24,
        fontSize: 12,
        color: C.muted
      }}>
        <div>
          <strong style={{ color: C.text }}>Total Detected:</strong> {changePoints.length} structural breaks
        </div>
        <div>
          <strong style={{ color: C.text }}>Avg Confidence:</strong> {
            (changePoints.reduce((sum, cp) => sum + cp.confidence, 0) / changePoints.length * 100).toFixed(1)
          }%
        </div>
        <div>
          <strong style={{ color: C.text }}>In View:</strong> {cps.length} events ({timeRange})
        </div>
      </div>
    </ChartCard>
  );
};


const EventsSection = () => {
  const [events, setEvents] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch events and price data on mount
  useEffect(() => {
    Promise.all([
      fetch("http://127.0.0.1:5000/api/events").then(r => r.json()),
      fetch("http://127.0.0.1:5000/api/model/regimes").then(r => r.json())
    ])
      .then(([eventsData, pricesData]) => {
        // Process events - map to our format
        const processedEvents = eventsData.map((ev, i) => {
          const date = new Date(ev.Detected_Date || ev.detected_date);
          const confidence = parseFloat(ev.Confidence_Interval || ev.confidence || 0);
          const volChange = parseFloat(ev.Volatility_Change_Pct || 0);

          // Color based on confidence
          let color = C.blue;
          if (confidence >= 0.90) color = C.red;
          else if (confidence >= 0.80) color = C.orange;
          else if (confidence >= 0.70) color = C.green;

          return {
            id: ev.id || i,
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: date,
            label: ev.Event || ev.event_name || "Unknown Event",
            confidence: (confidence * 100).toFixed(1) + "%",
            confidenceNum: confidence,
            volChange: volChange.toFixed(1) + "%",
            detail: `Volatility change: ${volChange >= 0 ? '+' : ''}${volChange.toFixed(1)}%. Pre-event: ${(ev.Pre_Event_Vol || 0).toFixed(3)}, Post-event: ${(ev.Post_Event_Vol || 0).toFixed(3)}.`,
            color: color,
            type: volChange > 50 ? "shock" : volChange > 20 ? "crisis" : volChange > 0 ? "policy" : "stabilization"
          };
        }).sort((a, b) => b.fullDate - a.fullDate); // Most recent first

        // Process price data - filter to event date range
        const minDate = new Date(Math.min(...processedEvents.map(e => e.fullDate)));
        const maxDate = new Date(Math.max(...processedEvents.map(e => e.fullDate)));

        // Add buffer (30 days before first event, 30 days after last)
        minDate.setDate(minDate.getDate() - 30);
        maxDate.setDate(maxDate.getDate() + 30);

        const processedPrices = pricesData
          .filter(d => {
            const date = new Date(d.Date || d.date);
            return date >= minDate && date <= maxDate;
          })
          .map(d => ({
            date: new Date(d.Date || d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: new Date(d.Date || d.date),
            price: parseFloat((d.Price || d.price).toFixed(2))
          }))
          .sort((a, b) => a.fullDate - b.fullDate);

        setEvents(processedEvents);
        setPriceData(processedPrices);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load events:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <ChartCard title="Key Events & Structural Breakdown" subtitle="Loading...">
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: C.muted }}>Loading events and price data...</div>
          </div>
        </ChartCard>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
          <div style={{ color: C.muted }}>Loading timeline...</div>
        </div>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <ChartCard title="Key Events & Structural Breakdown" subtitle="No events found">
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: C.muted }}>No change point events detected in database.</div>
          </div>
        </ChartCard>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Chart */}
      <ChartCard
        title="Key Events & Structural Breakdown"
        subtitle={`Price movements aligned with ${events.length} detected change points`}
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="date"
              tick={{ fill: C.muted, fontSize: 10 }}
              interval={Math.ceil(priceData.length / 10)}
            />
            <YAxis
              domain={["dataMin - 5", "dataMax + 5"]}
              tick={{ fill: C.muted, fontSize: 10 }}
              tickFormatter={v => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Event markers - vertical reference lines */}
            {events.map(ev => (
              <ReferenceLine
                key={ev.id}
                x={ev.date}
                stroke={ev.color}
                strokeWidth={2}
                label={{
                  value: "▲",
                  fill: ev.color,
                  fontSize: 14,
                  position: "top"
                }}
              />
            ))}

            <Line
              type="monotone"
              dataKey="price"
              stroke={C.cyan}
              strokeWidth={2}
              dot={false}
              name="Price"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div style={{
          marginTop: 12,
          display: "flex",
          gap: 16,
          fontSize: 11,
          color: C.muted,
          flexWrap: "wrap"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, background: C.red, borderRadius: 2 }} />
            <span>≥90% confidence</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, background: C.orange, borderRadius: 2 }} />
            <span>80-89% confidence</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, background: C.green, borderRadius: 2 }} />
            <span>70-79% confidence</span>
          </div>
        </div>
      </ChartCard>

      {/* Timeline */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 24
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Event Timeline
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
          {events.length} detected change points · Click any event for details
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "auto",
          maxHeight: 340
        }}>
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: selected?.id === ev.id ? ev.color + "18" : C.subtle,
                border: `1px solid ${selected?.id === ev.id ? ev.color + "44" : C.border}`,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: selected?.id === ev.id ? 8 : 0
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: ev.color,
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.text,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {ev.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <Badge label={ev.type} color={ev.color} />
                  <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
                    {ev.date}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {selected?.id === ev.id && (
                <div style={{
                  fontSize: 12,
                  color: C.muted,
                  lineHeight: 1.6,
                  marginLeft: 20,
                  paddingTop: 8,
                  borderTop: `1px solid ${C.border}`
                }}>
                  <div style={{ marginBottom: 6 }}>
                    <strong style={{ color: C.text }}>Confidence:</strong> {ev.confidence}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong style={{ color: C.text }}>Impact:</strong> {ev.volChange}
                  </div>
                  <div>
                    {ev.detail}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Total Events</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{events.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>Avg Confidence</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>
              {(events.reduce((sum, e) => sum + e.confidenceNum, 0) / events.length * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>High Conf</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.red }}>
              {events.filter(e => e.confidenceNum >= 0.90).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PerformanceSection = ({ forecast }) => {
  const [performanceData, setPerformanceData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch historical price data + calculate performance
    fetch("http://127.0.0.1:5000/api/model/regimes")
      .then(res => res.json())
      .then(data => {
        // Filter to last 1 year of data for performance chart
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const filtered = data
          .filter(d => new Date(d.Date || d.date) >= oneYearAgo)
          .map(d => ({
            date: new Date(d.Date || d.date),
            price: parseFloat(d.Price || d.price),
            regime: d.regime
          }))
          .sort((a, b) => a.date - b.date);

        if (filtered.length === 0) {
          setLoading(false);
          return;
        }

        // Calculate cumulative returns (buy-and-hold strategy)
        const startPrice = filtered[0].price;
        let peak = 0;

        const perfData = filtered.map((d, i) => {
          const portfolioReturn = ((d.price - startPrice) / startPrice) * 100;

          // Simulate benchmark (S&P 500 proxy: slower growth, less volatile)
          // Real version would fetch actual S&P data
          const benchmarkReturn = portfolioReturn * 0.6 + (Math.random() - 0.5) * 2;

          // Calculate drawdown
          peak = Math.max(peak, portfolioReturn);
          const drawdown = portfolioReturn - peak;

          return {
            date: d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: d.date,
            portfolio: parseFloat(portfolioReturn.toFixed(2)),
            benchmark: parseFloat(benchmarkReturn.toFixed(2)),
            drawdown: parseFloat(drawdown.toFixed(2)),
            regime: d.regime
          };
        });

        // Calculate statistics
        const finalReturn = perfData[perfData.length - 1].portfolio;
        const finalBench = perfData[perfData.length - 1].benchmark;
        const maxDD = Math.min(...perfData.map(d => d.drawdown));

        // Calculate volatility (std dev of daily returns)
        const returns = perfData.map((d, i) =>
          i > 0 ? d.portfolio - perfData[i-1].portfolio : 0
        );
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, r) => a + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance);

        // Sharpe ratio (simplified: return / volatility)
        const sharpe = volatility > 0 ? (finalReturn / volatility) : 0;

        // Win rate (days with positive returns)
        const positiveDays = returns.filter(r => r > 0).length;
        const winRate = (positiveDays / returns.length) * 100;

        // Get LSTM accuracy from forecast metadata
        const lstmRmse = forecast?.baseline?.rmse || 1.68;
        const currentPrice = filtered[filtered.length - 1].price;
        const lstmAccuracy = Math.max(0, (1 - (lstmRmse / currentPrice)) * 100);

        setStats({
          totalReturn: finalReturn,
          vssBenchmark: finalReturn - finalBench,
          maxDrawdown: maxDD,
          sharpe: sharpe,
          winRate: winRate,
          lstmAccuracy: lstmAccuracy,
          volatility: volatility,
          daysTracked: perfData.length
        });

        setPerformanceData(perfData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load performance data:", err);
        setLoading(false);
      });
  }, [forecast]);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <ChartCard title="Performance Over Time" subtitle="Loading...">
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: C.muted }}>Loading performance data...</div>
          </div>
        </ChartCard>
      </div>
    );
  }

  if (!performanceData.length || !stats) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <ChartCard title="Performance Over Time" subtitle="No data available">
          <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: C.muted }}>Insufficient data to calculate performance.</div>
          </div>
        </ChartCard>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

      {/* Chart */}
      <ChartCard
        title="Performance Over Time"
        subtitle={`1-year cumulative returns vs benchmark with drawdown (${stats.daysTracked} trading days)`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={performanceData}>
            <defs>
              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.red} stopOpacity={0.5} />
                <stop offset="95%" stopColor={C.red} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="date"
              tick={{ fill: C.muted, fontSize: 10 }}
              interval={Math.ceil(performanceData.length / 10)}
            />
            <YAxis
              tick={{ fill: C.muted, fontSize: 10 }}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: 14, fontSize: 12, color: C.muted }} />
            <ReferenceLine y={0} stroke={C.border} strokeWidth={1} />

            {/* Drawdown area */}
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="none"
              fill="url(#ddGrad)"
              name="Drawdown"
            />

            {/* Portfolio line */}
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke={C.cyan}
              strokeWidth={2}
              dot={false}
              name="Brent Oil Portfolio"
            />

            {/* Benchmark line */}
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke={C.orange}
              strokeWidth={2}
              dot={false}
              name="Benchmark (Proxy)"
              strokeDasharray="4 2"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Strategy note */}
        <div style={{
          marginTop: 12,
          padding: "8px 12px",
          background: C.subtle,
          borderRadius: 6,
          borderLeft: `3px solid ${C.cyan}`
        }}>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            📊 <strong>Strategy:</strong> Simple buy-and-hold of Brent crude oil.
            Returns calculated from actual historical prices over past 12 months.
            Benchmark is a simulated proxy (real version would use S&P 500 or GSCI Energy Index).
          </div>
        </div>
      </ChartCard>

      {/* Stats Panel */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 24
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Performance Stats
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
          Period: Last 12 months ({stats.daysTracked} trading days)
        </div>

        {/* Stat bars */}
        {[
          {
            label: "Total Return",
            value: `${stats.totalReturn >= 0 ? '+' : ''}${stats.totalReturn.toFixed(1)}%`,
            color: stats.totalReturn >= 0 ? C.green : C.red,
            bar: Math.min(100, Math.abs(stats.totalReturn))
          },
          {
            label: "vs Benchmark",
            value: `${stats.vssBenchmark >= 0 ? '+' : ''}${stats.vssBenchmark.toFixed(1)}%`,
            color: stats.vssBenchmark >= 0 ? C.green : C.red,
            bar: Math.min(100, Math.abs(stats.vssBenchmark) * 3)
          },
          {
            label: "Max Drawdown",
            value: `${stats.maxDrawdown.toFixed(1)}%`,
            color: C.red,
            bar: Math.min(100, Math.abs(stats.maxDrawdown))
          },
          {
            label: "Sharpe Ratio",
            value: stats.sharpe.toFixed(2),
            color: stats.sharpe > 1 ? C.green : C.orange,
            bar: Math.min(100, stats.sharpe * 50)
          },
          {
            label: "Win Rate",
            value: `${stats.winRate.toFixed(1)}%`,
            color: stats.winRate > 50 ? C.green : C.red,
            bar: stats.winRate
          },
          {
            label: "LSTM Accuracy",
            value: `${stats.lstmAccuracy.toFixed(1)}%`,
            color: stats.lstmAccuracy > 75 ? C.green : stats.lstmAccuracy > 60 ? C.orange : C.red,
            bar: stats.lstmAccuracy
          },
        ].map(({ label, value, color, bar }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color,
                fontFamily: "'DM Mono', monospace"
              }}>
                {value}
              </span>
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 99 }}>
              <div style={{
                height: "100%",
                width: `${bar}%`,
                background: color,
                borderRadius: 99,
                transition: "width 1s ease"
              }} />
            </div>
          </div>
        ))}

        {/* Additional context */}
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`
        }}>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 8 }}>
              <strong style={{ color: C.text }}>Sharpe Ratio:</strong> {
                stats.sharpe > 1 ? "Excellent" :
                stats.sharpe > 0.5 ? "Good" :
                stats.sharpe > 0 ? "Moderate" : "Poor"
              } risk-adjusted return
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong style={{ color: C.text }}>Volatility:</strong> {stats.volatility.toFixed(2)}% daily standard deviation
            </div>
            <div>
              <strong style={{ color: C.text }}>LSTM Accuracy:</strong> Model RMSE of ${forecast?.baseline?.rmse?.toFixed(2) || "1.68"}
              represents {stats.lstmAccuracy.toFixed(1)}% accuracy relative to current price
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [activeSection, setActiveSection] = useState("overview");
  const { forecast, analysis } = useForecast();


  const sectionMap = {
    overview:     <OverviewSection analysis={analysis} />,
    prediction:   <PredictionSection forecast={forecast} />,
    changepoints: <ChangePointSection />,
    events:       <EventsSection />,
    performance:  <PerformanceSection />,
  };


  return (
    <div style={{
      display: "flex", height: "100vh", background: C.bg,
      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      color: C.text, overflowY: "hidden",
    }}>
      {/* ── SIDEBAR ── */}
      <aside style={{
        width: 220, background: C.surface, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
        overflowY: "auto",
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.blue}, ${C.cyan})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800
            }}>⛽</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>BrentAI</div>
              <div style={{ fontSize: 11, color: C.muted }}>Analytics Dashboard</div>
            </div>
          </div>
        </div>


        {/* Nav */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10, paddingLeft: 8 }}>
            Navigation
          </div>
          {NAV_ITEMS.map(item => {
            const active = activeSection === item.id;
            return (
              <button key={item.id}
                onClick={() => setActiveSection(item.id)}
                style={{
                  width: "100%", textAlign: "left", padding: "10px 12px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? C.blue + "22" : "transparent",
                  color: active ? C.blue : C.muted,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 4, transition: "all 0.15s",
                  borderLeft: active ? `3px solid ${C.blue}` : "3px solid transparent",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.subtle; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>


        {/* Status footer */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
            <span style={{ fontSize: 12, color: C.muted }}>API Connected</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Regime: <span style={{ color: analysis?.current_state?.regime === "Crisis" ? C.red : C.green, fontWeight: 600 }}>
              {analysis?.current_state?.regime || "Normal"}
            </span>
          </div>
        </div>
      </aside>


      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex: 1, overflowY: "auto", padding: "32px 36px",
        scrollbarWidth: "thin", scrollbarColor: `${C.border} transparent`,
      }}>
        {sectionMap[activeSection]}
      </main>
    </div>
  );
}

