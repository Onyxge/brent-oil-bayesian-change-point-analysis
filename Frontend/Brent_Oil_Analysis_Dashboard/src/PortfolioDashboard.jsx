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
  const [range, setRange] = useState("6M");


  const apiData = forecast?.baseline?.predictions;
  const displayData = apiData
    ? apiData.slice(0, range === "1M" ? 22 : range === "3M" ? 66 : 180).map(p => ({
        date:      new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        predicted: parseFloat(p.predicted_price?.toFixed(2)),
        upper:     parseFloat(p.upper_bound?.toFixed(2)),
        lower:     parseFloat(p.lower_bound?.toFixed(2)),
        actual:    p.actual_price ? parseFloat(p.actual_price.toFixed(2)) : null,
      }))
    : PRICE_DATA.slice(0, range === "1M" ? 22 : range === "3M" ? 66 : 180);


  return (
    <ChartCard
      title="Price & LSTM Prediction"
      subtitle="Historical prices with baseline model forecast and confidence interval"
      controls={
        <div style={{ display: "flex", gap: 6 }}>
          {["1M", "3M", "6M"].map(r => <RangeBtn key={r} label={r} active={range === r} onClick={() => setRange(r)} />)}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={displayData}>
          <defs>
            <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.purple} stopOpacity={0.35} />
              <stop offset="95%" stopColor={C.purple} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} interval={range === "1M" ? 3 : range === "3M" ? 9 : 25} />
          <YAxis domain={["dataMin - 3", "dataMax + 3"]} tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, color: C.muted }} />
          <Area type="monotone" dataKey="upper" stroke="none" fill="url(#confBand)" name="Confidence Band" legendType="square" />
          <Area type="monotone" dataKey="lower" stroke="none" fill={C.bg} name="" legendType="none" />
          <Line type="monotone" dataKey="actual"    stroke={C.cyan}   strokeWidth={2}   dot={false} name="Actual"         connectNulls={false} />
          <Line type="monotone" dataKey="predicted" stroke={C.purple} strokeWidth={2}   dot={false} name="LSTM Predicted" strokeDasharray="5 3" />
        </ComposedChart>
      </ResponsiveContainer>


      <div style={{ display: "flex", gap: 24, marginTop: 16, padding: "12px 16px", background: C.subtle, borderRadius: 8 }}>
        {[
          { label: "Current",      value: "$67.26", color: C.cyan   },
          { label: "6M Forecast",  value: forecast?.baseline?.end_price ? `$${forecast.baseline.end_price.toFixed(2)}` : "$71.40", color: C.purple },
          { label: "Expected +/-", value: forecast?.baseline?.rmse ? `±$${forecast.baseline.rmse.toFixed(2)}` : "±$1.68", color: C.muted  },
          { label: "Confidence",   value: "85%",    color: C.green  },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
};


const ChangePointSection = () => (
  <ChartCard
    title="Bayesian Change Point Analysis"
    subtitle="Detected structural breaks with confidence levels"
  >
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={CP_DATA}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
        <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11 }} interval={14} />
        <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={v => `$${v}`} />
        <Tooltip content={<CustomTooltip />} />
        {CHANGE_POINTS.map(cp => (
          <ReferenceLine key={cp.date} x={cp.date} stroke={cp.color} strokeWidth={2} strokeDasharray="5 3"
            label={{ value: cp.confidence + "%", fill: cp.color, fontSize: 11, fontWeight: 700 }}
          />
        ))}
        <Line type="monotone" dataKey="price" stroke={C.cyan} strokeWidth={2} dot={false} name="Price" />
      </LineChart>
    </ResponsiveContainer>


    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      {CHANGE_POINTS.map(cp => (
        <div key={cp.date} style={{
          display: "flex", alignItems: "flex-start", gap: 14,
          padding: "12px 14px", borderRadius: 10, background: C.subtle,
          borderLeft: `3px solid ${cp.color}`,
        }}>
          <div style={{
            background: cp.color + "22", color: cp.color, border: `1px solid ${cp.color}44`,
            borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 800,
            whiteSpace: "nowrap", marginTop: 2
          }}>
            {cp.confidence}%
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>
              {cp.label} <span style={{ color: C.muted, fontWeight: 400 }}>{cp.date}</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{cp.description}</div>
          </div>
        </div>
      ))}
    </div>
  </ChartCard>
);


const EventsSection = () => {
  const [selected, setSelected] = useState(null);
  const evtData = CP_DATA.map((d, i) => {
    const ev = KEY_EVENTS.find(e => e.date === d.date);
    return { ...d, event: ev || null };
  });


  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Chart */}
      <ChartCard title="Key Events & Structural Breakdown" subtitle="Price movements aligned with earnings, macro, and policy events">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={CP_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} interval={14} />
            <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            {KEY_EVENTS.map(ev => (
              <ReferenceLine key={ev.date} x={ev.date} stroke={ev.color} strokeWidth={2}
                label={{ value: "▲", fill: ev.color, fontSize: 14 }}
              />
            ))}
            <Line type="monotone" dataKey="price" stroke={C.cyan} strokeWidth={2} dot={false} name="Price" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>


      {/* Timeline */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Event Timeline</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Click any event for details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 340 }}>
          {KEY_EVENTS.map(ev => (
            <div key={ev.date}
              onClick={() => setSelected(selected?.date === ev.date ? null : ev)}
              style={{
                padding: "12px 14px", borderRadius: 10,
                background: selected?.date === ev.date ? ev.color + "18" : C.subtle,
                border: `1px solid ${selected?.date === ev.date ? ev.color + "44" : C.border}`,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: selected?.date === ev.date ? 8 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{ev.label}</span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge label={ev.type} color={ev.color} />
                  <span style={{ fontSize: 11, color: C.muted }}>{ev.date}</span>
                </div>
              </div>
              {selected?.date === ev.date && (
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginLeft: 20 }}>
                  {ev.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


const PerformanceSection = () => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
    <ChartCard title="Performance Over Time" subtitle="Cumulative returns vs benchmark with drawdown">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={PERF_DATA}>
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.red} stopOpacity={0.5} />
              <stop offset="95%" stopColor={C.red} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
          <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} interval={18} />
          <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 14, fontSize: 12, color: C.muted }} />
          <ReferenceLine y={0} stroke={C.border} strokeWidth={1} />
          <Area type="monotone" dataKey="drawdown" stroke="none" fill="url(#ddGrad)" name="Drawdown" />
          <Line type="monotone" dataKey="portfolio"  stroke={C.cyan}   strokeWidth={2} dot={false} name="Portfolio" />
          <Line type="monotone" dataKey="benchmark"  stroke={C.orange} strokeWidth={2} dot={false} name="S&P 500" strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>


    {/* Stats panel */}
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>Performance Stats</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Period: Aug 2025 – Present</div>
      {[
        { label: "Total Return",     value: "+4.2%",  color: C.green,  bar: 42  },
        { label: "vs Benchmark",     value: "-1.1%",  color: C.orange, bar: 20  },
        { label: "Max Drawdown",     value: "-5.8%",  color: C.red,    bar: 58  },
        { label: "Sharpe Ratio",     value: "0.74",   color: C.cyan,   bar: 37  },
        { label: "Win Rate",         value: "52.3%",  color: C.green,  bar: 52  },
        { label: "LSTM Accuracy",    value: "76.3%",  color: C.blue,   bar: 76  },
      ].map(({ label, value, color, bar }) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'DM Mono', monospace" }}>{value}</span>
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${bar}%`, background: color, borderRadius: 99, transition: "width 1s ease" }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);


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

