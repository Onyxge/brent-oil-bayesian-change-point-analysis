import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Grid, Typography, Box, TextField, MenuItem, CircularProgress } from '@mui/material';
import { Title } from 'react-admin';
import { PriceChart } from './PriceChart';
import { Filter, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import { ChangePointInspector } from './ChangePointInspector';
import { MacroSensitivityPanel } from './MacroSensitivityPanel';

// Metric Card Component
const MetricCard = ({ title, value, color, icon }) => (
    <Card sx={{ height: '100%', borderLeft: `5px solid ${color}`, position: 'relative' }}>
        <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography color="textSecondary" variant="subtitle2">{title}</Typography>
                {icon}
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: color }}>
                {value}
            </Typography>
        </CardContent>
    </Card>
);

export const Dashboard = () => {
    const [events, setEvents] = useState([]);
    const [selectedEventName, setSelectedEventName] = useState('');
    const [analysisData, setAnalysisData] = useState(null);
    const [loading, setLoading] = useState(true);

    // 1. Load the List of Events on Startup
    useEffect(() => {
        fetch('http://127.0.0.1:5000/api/events')
            .then(res => res.json())
            .then(data => {
                setEvents(data);
                // Default to the first event (usually the most recent)
                if (data.length > 0) {
                    setSelectedEventName(data[0].Event);
                }
            })
            .catch(err => console.error("Failed to load event list", err));
    }, []);

    // 2. Fetch Deep Analysis when Selection Changes
    useEffect(() => {
        if (!selectedEventName) return;
        setLoading(true);

        // Fetch the distribution/stats data
        fetch(`http://127.0.0.1:5000/api/model/event/${encodeURIComponent(selectedEventName)}`)
            .then(res => res.json())
            .then(data => {
                // We merge the list data with the deep analysis data
                // Find the event in the list to get Window dates (which might not be in the analysis endpoint)
                const listEvent = events.find(e => e.Event === selectedEventName);

                setAnalysisData({
                    ...data,
                    Window_Start: listEvent?.Window_Start || '2000-01-01', // Fallbacks
                    Window_End: listEvent?.Window_End || '2023-01-01'
                });
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load analysis", err);
                setLoading(false);
            });
    }, [selectedEventName, events]);

    if (!analysisData && loading) return <Box p={4}><CircularProgress /></Box>;
    if (!analysisData) return <Box p={4}>No Data Available</Box>;

    const impactColor = analysisData.stats.volatility_change_pct > 0 ? '#d32f2f' : '#2e7d32';
    const isHighRisk = analysisData.distributions.post.std > 0.03;

    return (
        <Box sx={{ flexGrow: 1, padding: 3, maxWidth: '100%', overflowX: 'hidden' }}>
            <Title title="Brent Oil Analysis Dashboard" />

            {/* 1. CONTROL BAR */}
            <Card sx={{ mb: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Filter size={20} color="#666" />
                <TextField
                    select
                    label="Select Market Event"
                    value={selectedEventName}
                    onChange={(e) => setSelectedEventName(e.target.value)}
                    sx={{ minWidth: 300 }}
                    size="small"
                >
                    {events.map((ev) => (
                        <MenuItem key={ev.id} value={ev.Event}>
                            {ev.Event} ({ev.Detected_Date})
                        </MenuItem>
                    ))}
                </TextField>
            </Card>

            {/* 2. METRICS ROW */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Volatility Impact"
                        value={`${analysisData.stats.volatility_change_pct > 0 ? '+' : ''}${analysisData.stats.volatility_change_pct}%`}
                        color={impactColor}
                        icon={<TrendingUp size={24} color={impactColor} />}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Pre-Event Volatility"
                        value={analysisData.distributions.pre.std.toFixed(4)}
                        color="#2e7d32"
                        icon={<BarChart2 size={24} color="#2e7d32" />}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Post-Event Volatility"
                        value={analysisData.distributions.post.std.toFixed(4)}
                        color="#ff9800"
                        icon={<AlertTriangle size={24} color="#ff9800" />}
                    />
                </Grid>
                 <Grid item xs={12} sm={6} md={3}>
                    <MetricCard
                        title="Risk Regime"
                        value={isHighRisk ? "HIGH" : "STABLE"}
                        color={isHighRisk ? "#d32f2f" : "#2196f3"}
                        icon={<BarChart2 size={24} color={isHighRisk ? "#d32f2f" : "#2196f3"} />}
                    />
                </Grid>
            </Grid>

            {/* 3. MAIN CHART ROW (THE FIX) */}
            {/* We use a separate Grid container to force a new row */}
            <Box sx={{ mb: 3, width: '100%' }}>
                <Card sx={{ height: 500, display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <CardHeader
                        title={`Structural Break Analysis: ${analysisData.event_name}`}
                        subheader={`Detected on ${analysisData.detected_date}`}
                    />
                    {/* Explicitly set flex: 1 and width: 100% to fill the card */}
                    <CardContent sx={{ flex: 1, p: 0, position: 'relative' }}>
                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                            <PriceChart selectedEvent={analysisData} />
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* 4. ANALYTICAL PANELS ROW */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <ChangePointInspector selectedEvent={analysisData} />
                </Grid>
                <Grid item xs={12} md={6}>
                    <MacroSensitivityPanel />
                </Grid>
            </Grid>
        </Box>
    );
};