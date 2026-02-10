import React, { useEffect, useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { Card, CardHeader, CardContent, Typography, Box, CircularProgress } from '@mui/material';

export const MacroSensitivityPanel = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://127.0.0.1:5000/api/macro/correlations')
            .then(res => res.json())
            .then(apiData => {
                // Format for Recharts
                const formatted = apiData.map(d => ({
                    date: new Date(d.Date).toLocaleDateString(),
                    price: d.Price,
                    correlation: d.corr_usd
                }));
                setData(formatted);
                setLoading(false);
            })
            .catch(err => {
                console.error("Macro Load Error:", err);
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Card>
    );

    return (
        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
                title="Macro-Economic Sensitivity"
                subheader="90-Day Rolling Correlation: Oil vs. USD Index"
            />
            <CardContent sx={{ flex: 1, minHeight: 0, pb: 0 }}>
                <Box sx={{ width: '100%', height: '100%' }}>
                    <ResponsiveContainer width="99%" height={250}>
                        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorCorr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ff9800" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#ff9800" stopOpacity={0}/>
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />

                            <XAxis
                                dataKey="date"
                                minTickGap={60}
                                tick={{ fontSize: 10 }}
                            />

                            {/* LEFT AXIS: Price ($) */}
                            <YAxis
                                yAxisId="left"
                                orientation="left"
                                tick={{ fontSize: 10, fill: '#2196f3' }}
                                domain={['auto', 'auto']}
                                label={{ value: 'Oil Price ($)', angle: -90, position: 'insideLeft', fill: '#2196f3', fontSize: 10 }}
                            />

                            {/* RIGHT AXIS: Correlation (-1 to 1) */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={[-1, 1]}
                                tick={{ fontSize: 10, fill: '#ff9800' }}
                                label={{ value: 'Correlation', angle: 90, position: 'insideRight', fill: '#ff9800', fontSize: 10 }}
                            />

                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: '1px solid #ddd' }}
                                labelStyle={{ fontWeight: 'bold' }}
                                formatter={(value, name) => [
                                    name === 'Correlation' ? value.toFixed(2) : `$${value}`,
                                    name
                                ]}
                            />
                            <Legend verticalAlign="top" height={36}/>

                            {/* Zero Line for Correlation */}
                            <ReferenceLine y={0} yAxisId="right" stroke="#666" strokeDasharray="3 3" />

                            {/* Correlation Area */}
                            <Area
                                yAxisId="right"
                                type="monotone"
                                dataKey="correlation"
                                fill="url(#colorCorr)"
                                stroke="#ff9800"
                                name="Correlation (USD)"
                            />

                            {/* Price Line */}
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="price"
                                stroke="#2196f3"
                                dot={false}
                                strokeWidth={2}
                                name="Brent Oil Price"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <Typography variant="caption" display="block" align="center" color="textSecondary" sx={{ mt: 1 }}>
                        Values near -1.0 indicate Oil moves opposite to the Dollar (Typical). Positive spikes suggest supply shocks.
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};