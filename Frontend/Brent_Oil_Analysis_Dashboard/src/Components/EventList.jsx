import * as React from 'react';
import { List, Datagrid, TextField, NumberField, FunctionField, DateField } from 'react-admin';

// This component defines how the "List View" looks when you click "Events" in the sidebar
export const EventList = (props) => (
    <List {...props} sort={{ field: 'Detected_Date', order: 'DESC' }} title="Analyzed Market Events">
        <Datagrid rowClick="show" bulkActionButtons={false}>
            {/* 1. Event Name (Bold for emphasis) */}
            <TextField source="Event" label="Event Name" sx={{ fontWeight: 'bold' }} />

            {/* 2. Detected Date */}
            <DateField source="Detected_Date" label="Change Date" />

            {/* 3. Volatility Impact (Green if down, Red if up) */}
            <FunctionField
                label="Impact"
                render={record => {
                    const isBad = record.Volatility_Change_Pct > 0;
                    return (
                        <span style={{
                            color: isBad ? '#d32f2f' : '#2e7d32',
                            fontWeight: 'bold',
                            backgroundColor: isBad ? '#ffebee' : '#e8f5e9',
                            padding: '4px 8px',
                            borderRadius: '4px'
                        }}>
                            {isBad ? '🔺' : '🔻'} {Math.abs(record.Volatility_Change_Pct)}%
                        </span>
                    );
                }}
            />

            {/* 4. Technical Metrics */}
            <NumberField
                source="Pre_Event_Vol"
                label="Pre-Vol"
                options={{ maximumFractionDigits: 4 }}
                sx={{ color: '#555' }}
            />
            <NumberField
                source="Post_Event_Vol"
                label="Post-Vol"
                options={{ maximumFractionDigits: 4 }}
                sx={{ color: '#555' }}
            />
D
            {/* 5. Confidence Interval */}
            <TextField source="Confidence_Interval" label="HDI (94%)" />
        </Datagrid>
    </List>
);