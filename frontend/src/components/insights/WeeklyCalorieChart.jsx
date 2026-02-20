import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { cn } from '../../utils/cn';
import { formatDateDisplay, isToday as isTodayUtil } from '../../utils/dateUtils';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import ChartInsight from './ChartInsight';

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;
    return (
        <div className="bg-primary text-white text-[10px] px-2.5 py-1.5 rounded-lg font-mono shadow-lg">
            <span className="font-bold">{Math.round(data.calories)}</span> cal
        </div>
    );
};

export default function WeeklyCalorieChart({ days, goals, startDate, endDate, bestDay, onPrev, onNext, isCurrentWeek }) {
    const targetCalories = goals?.targetCalories || 2000;

    const chartData = useMemo(() => {
        return (days || []).map(day => ({
            ...day,
            dayLabel: formatDateDisplay(day.date, { weekday: 'narrow' }),
            isToday: isTodayUtil(day.date),
            hasData: day.calories > 0,
            isOver: day.calories > targetCalories
        }));
    }, [days, targetCalories]);

    const maxCal = Math.max(targetCalories * 1.2, ...chartData.map(d => d.calories));

    const formatWeekRange = () => {
        if (!startDate || !endDate) return '';
        const start = formatDateDisplay(startDate, { month: 'short', day: 'numeric' });
        const end = formatDateDisplay(endDate, { month: 'short', day: 'numeric' });
        return `${start} - ${end}`;
    };

    const insightText = useMemo(() => {
        const tracked = chartData.filter(d => d.hasData);
        if (tracked.length === 0) return null;
        const onTarget = tracked.filter(d => Math.abs(d.calories - targetCalories) <= targetCalories * 0.1).length;
        const best = bestDay ? formatDateDisplay(bestDay.date, { weekday: 'long' }) : null;
        if (best) {
            return `${onTarget} of ${tracked.length} days hit your goal — best day was ${best}.`;
        }
        return `${onTarget} of ${tracked.length} days were on target this week.`;
    }, [chartData, targetCalories, bestDay]);

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            {/* Header with navigation */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-lg text-primary">Weekly Calories</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrev}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/5 text-primary/60 transition-colors"
                    >
                        <HiChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[11px] text-primary/60 min-w-[110px] text-center">
                        {formatWeekRange()}
                    </span>
                    <button
                        onClick={onNext}
                        disabled={isCurrentWeek}
                        className={cn(
                            "w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                            isCurrentWeek ? "text-primary/20 cursor-not-allowed" : "hover:bg-primary/5 text-primary/60"
                        )}
                    >
                        <HiChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                        <XAxis
                            dataKey="dayLabel"
                            tick={{ fontSize: 10, fill: 'var(--color-primary)', opacity: 0.5 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            domain={[0, maxCal]}
                            tick={{ fontSize: 9, fill: 'var(--color-primary)', opacity: 0.3 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                        <ReferenceLine
                            y={targetCalories}
                            stroke="var(--color-chart-goal)"
                            strokeDasharray="4 4"
                            strokeWidth={1}
                        />
                        <Bar dataKey="calories" radius={[8, 8, 0, 0]} maxBarSize={36}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={index}
                                    fill={
                                        !entry.hasData ? 'transparent'
                                            : entry.isOver ? 'var(--color-chart-over)'
                                                : entry.isToday ? 'var(--color-chart-bar-today)'
                                                    : 'var(--color-chart-bar)'
                                    }
                                    opacity={entry.hasData ? 1 : 0.1}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <ChartInsight text={insightText} />
        </section>
    );
}
