import { useMemo } from 'react';
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, ReferenceLine,
    ResponsiveContainer, Cell, Tooltip
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { formatDateDisplay, isToday as isTodayUtil } from '../../utils/dateUtils';
import ChartInsight from './ChartInsight';

const METRIC_CONFIG = {
    calories: { label: 'Calories', unit: 'cal', color: 'var(--color-calories)', todayColor: 'var(--color-calories-today)', overColor: 'var(--color-calories-over)', goalKey: 'targetCalories' },
    protein: { label: 'Protein', unit: 'g', color: 'var(--color-protein)', todayColor: 'var(--color-protein-today)', overColor: 'var(--color-protein-over)', goalKey: 'targetProtein' },
    carbs: { label: 'Carbs', unit: 'g', color: 'var(--color-carbs)', todayColor: 'var(--color-carbs-today)', overColor: 'var(--color-carbs-over)', goalKey: 'targetCarbs' },
    fat: { label: 'Fat', unit: 'g', color: 'var(--color-fat)', todayColor: 'var(--color-fat-today)', overColor: 'var(--color-fat-over)', goalKey: 'targetFat' }
};

const METRICS = ['calories', 'protein', 'carbs', 'fat'];

const CustomTooltip = ({ active, payload, metric }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    const config = METRIC_CONFIG[metric];
    const value = Math.round(data.displayValue || 0);
    return (
        <div className="bg-primary text-white text-sm px-2.5 py-1.5 rounded-lg font-mono shadow-lg">
            <span className="font-bold">{value}</span> {config.unit}
            {data.label && <div className="opacity-70">{data.label}</div>}
        </div>
    );
};

const RANGE_LABELS = { '1W': '1W', '1M': '1M', '3M': '3M' };

export default function TrendsChart({
    timeRange, selectedMetric, onMetricChange,
    weeklyData, monthlyData, quarterlyData, goals,
    averages, prevAverages,
    periodOffset, onPeriodBack, onPeriodForward, periodLabel
}) {
    const config = METRIC_CONFIG[selectedMetric];
    const targetValue = goals?.[config.goalKey] || 0;

    const chartData = useMemo(() => {
        if (timeRange === '1W' && weeklyData?.days) {
            return weeklyData.days.map(day => ({
                ...day,
                displayValue: day[selectedMetric] || 0,
                dayLabel: formatDateDisplay(day.date, { weekday: 'narrow' }),
                label: formatDateDisplay(day.date, { month: 'short', day: 'numeric' }),
                isToday: isTodayUtil(day.date),
                hasData: (day.meals || day.calories) > 0,
                isOver: (day[selectedMetric] || 0) > targetValue
            }));
        }
        if (timeRange === '1M' && monthlyData?.days) {
            return monthlyData.days.map(day => ({
                ...day,
                displayValue: day[selectedMetric] || 0,
                dayLabel: day.date.slice(8),
                label: formatDateDisplay(day.date, { month: 'short', day: 'numeric' }),
                isToday: isTodayUtil(day.date),
                hasData: day.tracked,
                isOver: (day[selectedMetric] || 0) > targetValue
            }));
        }
        if (timeRange === '3M' && quarterlyData?.weeks) {
            return quarterlyData.weeks.map(w => ({
                ...w,
                displayValue: w[`avg${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}`] || 0,
                dayLabel: formatDateDisplay(w.weekStart, { month: 'short', day: 'numeric' }),
                label: `${formatDateDisplay(w.weekStart, { month: 'short', day: 'numeric' })}`,
                hasData: w.daysTracked > 0
            }));
        }
        return [];
    }, [timeRange, selectedMetric, weeklyData, monthlyData, quarterlyData, targetValue]);

    const maxValue = useMemo(() => {
        const dataMax = Math.max(0, ...chartData.map(d => d.displayValue));
        return Math.max(targetValue * 1.2, dataMax * 1.1) || 100;
    }, [chartData, targetValue]);

    const insightText = useMemo(() => {
        const tracked = chartData.filter(d => d.hasData);
        if (tracked.length === 0) return null;
        const avg = Math.round(tracked.reduce((s, d) => s + d.displayValue, 0) / tracked.length);
        const diff = avg - targetValue;
        const pct = targetValue > 0 ? Math.abs(Math.round((diff / targetValue) * 100)) : 0;
        const rangeLabel = timeRange === '1W' ? 'week' : timeRange === '1M' ? '30-day' : '3-month';

        if (targetValue > 0 && Math.abs(diff) <= targetValue * 0.05) {
            return `Your ${rangeLabel} avg ${config.label.toLowerCase()} is ${avg}${config.unit} \u2014 right on target.`;
        }
        if (targetValue > 0) {
            return `Your ${rangeLabel} avg ${config.label.toLowerCase()} is ${avg}${config.unit} \u2014 ${pct}% ${diff < 0 ? 'below' : 'above'} your ${targetValue}${config.unit} goal.`;
        }
        return `Your ${rangeLabel} avg ${config.label.toLowerCase()} is ${avg}${config.unit}.`;
    }, [chartData, targetValue, config, timeRange]);

    const useAreaChart = timeRange === '3M';
    const xAxisInterval = timeRange === '1W' ? 0 : timeRange === '1M' ? 6 : 2;
    const gradientId = `trendGradient-${selectedMetric}`;

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-lg text-primary">Trends</h3>
            </div>

            {/* Period Navigation */}
            <div className="flex items-center justify-between mb-3">
                <button onClick={onPeriodBack} className="p-1.5 rounded-lg text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors" aria-label="Previous period">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-mono text-sm text-primary/70 font-medium">{periodLabel}</span>
                <button onClick={onPeriodForward} disabled={periodOffset === 0} className={cn("p-1.5 rounded-lg transition-colors", periodOffset === 0 ? "text-primary/20 cursor-not-allowed" : "text-primary/50 hover:text-primary hover:bg-primary/5")} aria-label="Next period">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Metric Switcher Pills */}
            <div className="flex gap-1.5 mb-3">
                {METRICS.map(m => {
                    const mc = METRIC_CONFIG[m];
                    const isActive = selectedMetric === m;
                    return (
                        <button
                            key={m}
                            onClick={() => onMetricChange(m)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-sm font-mono font-bold uppercase tracking-wider transition-all",
                                isActive
                                    ? "text-white shadow-sm"
                                    : "border border-primary/20 text-primary/60 hover:text-primary/80"
                            )}
                            style={isActive ? { backgroundColor: mc.color } : undefined}
                        >
                            {mc.label}
                        </button>
                    );
                })}
            </div>

            {/* Avg Stat Line */}
            {averages && (
                <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 mb-3 px-0.5">
                    <span className="font-mono text-sm text-primary/50 uppercase">Avg {RANGE_LABELS[timeRange]}</span>
                    <span className="font-mono font-bold text-lg text-primary">
                        {Math.round(averages[selectedMetric] || 0).toLocaleString()}{config.unit}
                    </span>
                    {targetValue > 0 && (
                        <span className="font-mono text-sm text-primary/45">
                            / {targetValue.toLocaleString()}{config.unit} target
                        </span>
                    )}
                    {prevAverages?.[selectedMetric] != null && (() => {
                        const prev = Math.round(prevAverages[selectedMetric]);
                        const avg = Math.round(averages[selectedMetric] || 0);
                        const delta = avg - prev;
                        if (delta === 0) return null;
                        const deltaLabel = timeRange === '1W' ? 'vs prev wk' : timeRange === '1M' ? 'vs prev mo' : 'vs prev qtr';
                        return (
                            <span className={cn(
                                "font-mono text-sm font-medium",
                                delta > 0 ? "text-emerald-600" : "text-amber-600"
                            )}>
                                {delta > 0 ? '+' : ''}{delta}{config.unit} {deltaLabel}
                            </span>
                        );
                    })()}
                </div>
            )}

            {/* Chart */}
            <div className="h-[200px]">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        {useAreaChart ? (
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={config.color} stopOpacity={0.15} />
                                        <stop offset="100%" stopColor={config.color} stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="dayLabel"
                                    tick={{ fontSize: 11, fill: 'var(--color-primary)', opacity: 0.6 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={xAxisInterval}
                                />
                                <YAxis
                                    domain={[0, maxValue]}
                                    tick={{ fontSize: 11, fill: 'var(--color-primary)', opacity: 0.5 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={v => selectedMetric === 'calories' && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
                                />
                                <Tooltip content={<CustomTooltip metric={selectedMetric} />} />
                                {targetValue > 0 && (
                                    <ReferenceLine
                                        y={targetValue}
                                        stroke="var(--color-chart-goal)"
                                        strokeDasharray="4 4"
                                        strokeWidth={1}
                                        label={{ value: 'TARGET', position: 'right', fontSize: 10, fill: 'var(--color-chart-goal)' }}
                                    />
                                )}
                                <Area
                                    type="monotone"
                                    dataKey="displayValue"
                                    stroke={config.color}
                                    strokeWidth={2}
                                    fill={`url(#${gradientId})`}
                                />
                            </AreaChart>
                        ) : (
                            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                <XAxis
                                    dataKey="dayLabel"
                                    tick={{ fontSize: 11, fill: 'var(--color-primary)', opacity: 0.6 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={xAxisInterval}
                                />
                                <YAxis
                                    domain={[0, maxValue]}
                                    tick={{ fontSize: 11, fill: 'var(--color-primary)', opacity: 0.5 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={v => selectedMetric === 'calories' && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
                                />
                                <Tooltip content={<CustomTooltip metric={selectedMetric} />} cursor={false} />
                                {targetValue > 0 && (
                                    <ReferenceLine
                                        y={targetValue}
                                        stroke="var(--color-chart-goal)"
                                        strokeDasharray="4 4"
                                        strokeWidth={1}
                                        label={{ value: 'TARGET', position: 'right', fontSize: 10, fill: 'var(--color-chart-goal)' }}
                                    />
                                )}
                                <Bar dataKey="displayValue" radius={[6, 6, 0, 0]} maxBarSize={timeRange === '1M' ? 14 : 36}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={index}
                                            fill={
                                                !entry.hasData ? 'transparent'
                                                    : entry.isOver ? config.overColor
                                                        : entry.isToday ? config.todayColor
                                                            : config.color
                                            }
                                            opacity={entry.hasData ? 1 : 0.1}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
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
