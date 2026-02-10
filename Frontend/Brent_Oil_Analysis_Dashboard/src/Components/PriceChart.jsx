import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area
} from 'recharts';

export const PriceChart = ({ selectedEvent }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedEvent) return;

        setLoading(true);
        setError(null);

        // 1. Define the Window
        // Use the event's specific window, or default to +/- 2 years around the detection
        let start = selectedEvent.Window_Start;
        let end = selectedEvent.Window_End;

        if (!start || !end) {
            // Fallback logic if dates are missing
            const detectDate = new Date(selectedEvent.detected_date || selectedEvent.Detected_Date);
            const preDate = new Date(detectDate);
            preDate.setFullYear(detectDate.getFullYear() - 2);
            const postDate = new Date(detectDate);
            postDate.setFullYear(detectDate.getFullYear() + 2);

            start = preDate.toISOString().split('T')[0];
            end = postDate.toISOString().split('T')[0];
        }

        // 2. Fetch from the NEW "Ferrari" Endpoint
        // Note: We use /api/model/regimes, not /api/history
        const url = `http://127.0.0.1:5000/api/model/regimes?start=${start}&end=${end}`;
        console.log("Fetching Chart Data from:", url);

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("Backend connection failed");
                return res.json();
            })
            .then(apiData => {
                if (!Array.isArray(apiData) || apiData.length === 0) {
                    setData([]);
                    return;
                }

                // 3. Format Data for Recharts
                const formatted = apiData.map(d => ({
                    date: new Date(d.Date).toLocaleDateString(),
                    price: d.Price,
                    regime: d.regime, // 'Low_Vol' or 'High_Vol'
                    // We add a 'shock' value for the red area chart
                    shock: d.regime === 'High_Vol' ? d.Price : null
                }));

                setData(formatted);
                setLoading(false);
            })
            .catch(err => {
                console.error("Chart Error:", err);
                setError(err.message);
                setLoading(false);
            });
    }, [selectedEvent]);

    if (loading) return <div style={{ padding: 20, color: '#666' }}>Loading Market Dynamics...</div>;
    if (error) return <div style={{ padding: 20, color: '#d32f2f' }}>Error: {error}</div>;
    if (data.length === 0) return <div style={{ padding: 20, color: '#999' }}>No price data available for this range.</div>;

    const minPrice = Math.min(...data.map(d => d.price));
    const maxPrice = Math.max(...data.map(d => d.price));
return (
        <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    {/* ... (Keep your chart components exactly the same) ... */}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="date" minTickGap={60} tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis domain={[minPrice * 0.9, maxPrice * 1.1]} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={(val) => `$${val}`} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ddd', borderRadius: '4px' }} labelStyle={{ fontWeight: 'bold', color: '#333' }} />
                    <Line type="step" dataKey="shock" stroke="none" dot={false} activeDot={false} fill="url(#colorShock)" />
                    <Line type="monotone" dataKey="price" stroke="#2196f3" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    {selectedEvent && (
                        <ReferenceLine x={new Date(selectedEvent.detected_date || selectedEvent.Detected_Date).toLocaleDateString()} stroke="#d32f2f" strokeDasharray="5 5" label={{ value: 'STRUCTURAL BREAK', position: 'insideTopLeft', fill: '#d32f2f', fontSize: 10, fontWeight: 'bold' }} />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};