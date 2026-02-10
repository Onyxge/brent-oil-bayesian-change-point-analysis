import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardHeader, CardContent, Typography } from '@mui/material';

// --- MATH HELPER: Normal Distribution PDF ---
// 1 / (σ * sqrt(2π)) * e^(-0.5 * ((x - μ)/σ)^2)
const normalPdf = (x, mean, std) => {
    if (std === 0) return 0;
    return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
};

// Generates data points for Recharts
const generateDistributionData = (stdPre, stdPost) => {
    const data = [];
    // We plot from -4 sigma to +4 sigma to capture the full curve
    const maxSigma = Math.max(stdPre, stdPost);
    const range = maxSigma * 4;
    const step = range / 40; // Resolution

    for (let x = -range; x <= range; x += step) {
        data.push({
            val: x.toFixed(3),
            // Pre-Event Curve (Green)
            Pre_Event: normalPdf(x, 0, stdPre),
            // Post-Event Curve (Orange)
            Post_Event: normalPdf(x, 0, stdPost)
        });
    }
    return data;
};

export const ChangePointInspector = ({ selectedEvent }) => {
    if (!selectedEvent || !selectedEvent.distributions) return null;

    const stdPre = selectedEvent.distributions.pre.std;
    const stdPost = selectedEvent.distributions.post.std;

    // Generate the curve data
    const chartData = generateDistributionData(stdPre, stdPost);

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
                title="Regime Distribution Shift"
                subheader="Comparing Market Risk Profiles (Bell Curves)"
            />
            <CardContent sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="99%" height={250}>
                    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPre" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPost" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ff9800" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ff9800" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="val" tick={{ fontSize: 10 }} label={{ value: 'Daily Returns', position: 'insideBottom', offset: -5 }} />
                        <YAxis hide />
                        <Tooltip
                            labelFormatter={(label) => `Return: ${label}`}
                            formatter={(value) => value.toFixed(2)}
                        />
                        <Legend verticalAlign="top" height={36}/>

                        {/* Pre-Event: Tall and Narrow (Stable) */}
                        <Area
                            type="monotone"
                            dataKey="Pre_Event"
                            stroke="#2e7d32"
                            fillOpacity={1}
                            fill="url(#colorPre)"
                            name="Pre-Event (Stable)"
                            strokeWidth={2}
                        />

                        {/* Post-Event: Short and Fat (Volatile) */}
                        <Area
                            type="monotone"
                            dataKey="Post_Event"
                            stroke="#ff9800"
                            fillOpacity={1}
                            fill="url(#colorPost)"
                            name="Post-Event (Volatile)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>

                <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
                    {stdPost > stdPre
                        ? "⚠️ The curve flattened, indicating higher probability of extreme price swings."
                        : "✅ The curve sharpened, indicating a return to stability."}
                </Typography>
            </CardContent>
        </Card>
    );
};