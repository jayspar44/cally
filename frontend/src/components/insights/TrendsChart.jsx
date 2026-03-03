import { useMemo } from 'react';
import {
    BarChart, Bar, AreaChart, Area, XAxis, YAxis, ReferenceLine,
    CartesianGrid, ResponsiveContainer, Cell, Tooltip
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
        <div className="bg-[#1C1D1D] backdrop-blur-sm px-3 py-2 rounded-xl shadow-lg border border-white/10">
            <span className="font-mono font-bold text-sm text-white">{value}</span>
            <span className="font-sans text-xs font-medium text-white/70 ml-1">{config.unit}</span>
            {data.label && <div className="font-sans text-xs font-medium text-white/60 mt-0.5">{data.label}</div>}
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
                dayLabel: formatDateDisplay(day.date, { weekday: 'short' }).slice(0, 2),
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
                dayLabel: day.date,
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

    // Annotations: personal best bar + goal-hit bars
    const annotations = useMemo(() => {
        if (!chartData?.length) return {};
        const goalVal = targetValue;

        let bestIdx = -1;
        let bestVal = 0;
        const goalHits = new Set();

        chartData.forEach((d, i) => {
            const val = d.displayValue || 0;
            if (val > bestVal && val > 0 && d.hasData) { bestVal = val; bestIdx = i; }
            if (goalVal > 0 && val > 0 && d.hasData && Math.abs(val - goalVal) / goalVal <= 0.05) {
                goalHits.add(i);
            }
        });

        return { bestIdx, bestVal, goalHits };
    }, [chartData, targetValue]);

    const insightText = useMemo(() => {
        if (!averages || !goals) return null;
        const avg = averages[selectedMetric] || 0;
        const goalKey = METRIC_CONFIG[selectedMetric].goalKey;
        const goal = goals[goalKey] || 0;
        if (!goal || !avg) return null;

        const diff = avg - goal;
        const absDiff = Math.abs(Math.round(diff));
        const unit = selectedMetric === 'calories' ? 'cal' : 'g';
        const direction = diff > 0 ? 'over' : 'under';

        return `Averaging ${Math.round(avg)}${unit} \u2014 ${absDiff}${unit} ${direction} your ${Math.round(goal)}${unit} target`;
    }, [averages, goals, selectedMetric]);

    const useAreaChart = timeRange === '3M';
    const xAxisInterval = timeRange === '1W' ? 0 : timeRange === '1M' ? 6 : 2;
    const gradientId = `trendGradient-${selectedMetric}`;

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            <div className="flex items-center justify-between mb-4">
                <h3 className="type-section-header">Trends</h3>
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
                    <span className="type-label">Avg {RANGE_LABELS[timeRange]}</span>
                    <span className="type-value text-lg">
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
                                        <stop offset="0%" stopColor={config.color} stopOpacity={0.12} />
                                        <stop offset="100%" stopColor={config.color} stopOpacity={0.01} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-primary)" opacity={0.06} vertical={false} />
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
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-primary)" opacity={0.06} vertical={false} />
                                <XAxis
                                    dataKey="dayLabel"
                                    tick={{ fontSize: 11, fill: 'var(--color-primary)', opacity: 0.6 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={xAxisInterval}
                                    tickFormatter={timeRange === '1M' ? v => v.slice(8) : undefined}
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
                                    {chartData.map((entry, index) => {
                                        const isBest = annotations.bestIdx === index;
                                        const isGoalHit = annotations.goalHits?.has(index);
                                        return (
                                            <Cell
                                                key={index}
                                                fill={
                                                    !entry.hasData ? 'transparent'
                                                        : entry.isOver ? config.overColor
                                                            : entry.isToday ? config.todayColor
                                                                : config.color
                                                }
                                                opacity={entry.hasData ? (isBest ? 1 : isGoalHit ? 0.95 : 0.85) : 0.1}
                                                stroke={isBest ? config.todayColor : isGoalHit ? 'var(--color-chart-goal)' : 'none'}
                                                strokeWidth={isBest || isGoalHit ? 2 : 0}
                                            />
                                        );
                                    })}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full type-secondary">
                        Not enough data yet
                    </div>
                )}
            </div>

            <ChartInsight text={insightText} />
        </section>
    );
}
