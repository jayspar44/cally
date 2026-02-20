import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '../../utils/cn';
import { formatDateDisplay } from '../../utils/dateUtils';
import ChartInsight from './ChartInsight';

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    return (
        <div className="bg-primary text-white text-[10px] px-2.5 py-1.5 rounded-lg font-mono shadow-lg">
            <div className="font-bold">{Math.round(data.displayCalories)} cal</div>
            <div className="opacity-70">{data.label}</div>
        </div>
    );
};

export default function CalorieTrendChart({ monthlyData, quarterlyData, goals }) {
    const [period, setPeriod] = useState('month');
    const targetCalories = goals?.targetCalories || 2000;

    const chartData = useMemo(() => {
        if (period === 'month' && monthlyData?.days) {
            return monthlyData.days
                .filter(d => d.tracked)
                .map(d => ({
                    ...d,
                    displayCalories: d.calories,
                    label: formatDateDisplay(d.date, { month: 'short', day: 'numeric' })
                }));
        }
        if (period === '3month' && quarterlyData?.weeks) {
            return quarterlyData.weeks.map(w => ({
                ...w,
                displayCalories: w.avgCalories,
                label: formatDateDisplay(w.weekStart, { month: 'short', day: 'numeric' })
            }));
        }
        return [];
    }, [period, monthlyData, quarterlyData]);

    const insightText = useMemo(() => {
        if (chartData.length === 0) return null;
        const avg = Math.round(chartData.reduce((s, d) => s + d.displayCalories, 0) / chartData.length);
        const diff = avg - targetCalories;
        const pct = Math.abs(Math.round((diff / targetCalories) * 100));
        const periodLabel = period === 'month' ? '30-day' : '3-month';
        if (Math.abs(diff) <= targetCalories * 0.05) {
            return `Your ${periodLabel} average is ${avg} cal — right on target.`;
        }
        return `Your ${periodLabel} average is ${avg} cal — ${pct}% ${diff < 0 ? 'below' : 'above'} your ${targetCalories} cal goal.`;
    }, [chartData, targetCalories, period]);

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-lg text-primary">Calorie Trend</h3>
                <div className="flex bg-primary/5 dark:bg-white/5 rounded-full p-0.5">
                    {['month', '3month'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all",
                                period === p
                                    ? "bg-primary text-white dark:bg-white dark:text-primary shadow-sm"
                                    : "text-primary/50 hover:text-primary/70"
                            )}
                        >
                            {p === 'month' ? 'Month' : '3 Month'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[200px]">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <defs>
                                <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--color-chart-area)" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="var(--color-chart-area)" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 9, fill: 'var(--color-primary)', opacity: 0.4 }}
                                tickLine={false}
                                axisLine={false}
                                interval={period === 'month' ? 6 : 2}
                            />
                            <YAxis
                                tick={{ fontSize: 9, fill: 'var(--color-primary)', opacity: 0.3 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine
                                y={targetCalories}
                                stroke="var(--color-chart-goal)"
                                strokeDasharray="4 4"
                                strokeWidth={1}
                            />
                            <Area
                                type="monotone"
                                dataKey="displayCalories"
                                stroke="var(--color-chart-area)"
                                strokeWidth={2}
                                fill="url(#calorieGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-primary/30 font-sans text-sm">
                        Not enough data yet
                    </div>
                )}
            </div>

            <ChartInsight text={insightText} />
        </section>
    );
}
