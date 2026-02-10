import { useState, useEffect } from 'react';
import { api } from '../api/services';
import { cn } from '../utils/cn';
import { toDateStr, isToday as isTodayUtil, formatDateDisplay } from '../utils/dateUtils';
import MealItem from '../components/ui/MealItem';
import { HiChevronLeft, HiChevronRight, HiCalendarDays } from 'react-icons/hi2';

export default function Insights() {
    const [weeklyTrends, setWeeklyTrends] = useState(null);
    const [loading, setLoading] = useState(true);

    // Daily Log State
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dailySummary, setDailySummary] = useState(null);
    const [loadingDaily, setLoadingDaily] = useState(false);

    // Fetch Weekly Trends (Initial Load)
    useEffect(() => {
        const fetchTrends = async () => {
            try {
                const weekly = await api.getWeeklyTrends();
                setWeeklyTrends(weekly);
            } catch (error) {
                console.error('Failed to fetch insights:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTrends();
    }, []);

    // Fetch Daily Summary when selectedDate changes
    useEffect(() => {
        const fetchDaily = async () => {
            setLoadingDaily(true);
            try {
                const dateStr = toDateStr(selectedDate);

                const data = await api.getDailySummary(dateStr);
                setDailySummary(data);
            } catch (error) {
                console.error('Failed to fetch daily summary:', error);
            } finally {
                setLoadingDaily(false);
            }
        };
        fetchDaily();
    }, [selectedDate]);

    const handlePrevDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() - 1);
        setSelectedDate(newDate);
    };

    const handleNextDay = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + 1);
        setSelectedDate(newDate);
    };

    const isToday = (date) => isTodayUtil(date);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const goals = { targetCalories: 2000 };
    // Defensively handle null weeklyTrends
    const days = weeklyTrends?.days || [];
    const averages = weeklyTrends?.averages || { calories: 0 };
    const daysTracked = weeklyTrends?.daysTracked || 0;

    return (
        <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Weekly Overview Card */}
            <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30 relative overflow-hidden group">
                {/* Decorative background gradient */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors duration-1000" />

                <div className="flex justify-between items-start mb-10 relative">
                    <div>
                        <h2 className="font-serif font-bold text-3xl text-primary mb-1">Weekly Pulse</h2>
                        <p className="font-sans text-xs text-primary/40 font-medium tracking-wide uppercase">Last 7 Days</p>
                    </div>
                    <div className="text-right">
                        <span className="font-serif font-bold text-4xl text-primary block leading-none tracking-tight">
                            {Math.round(averages.calories)}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40 font-bold block mt-1">
                            Avg Cals
                        </span>
                    </div>
                </div>

                {/* Days Grid - Flexbox for better spacing control */}
                <div className="flex justify-between items-end gap-2 mb-8 h-32 relative z-10">
                    {days.map((day, index) => {
                        const heightPercent = Math.min(100, (day.calories / goals.targetCalories) * 100);
                        const isToday = isTodayUtil(day.date);
                        const hasData = day.calories > 0;

                        return (
                            <div key={index} className="flex flex-col items-center gap-3 flex-1 h-full justify-end group/bar cursor-default">
                                {/* Tooltip (Hover) */}
                                <div className="absolute mb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-primary text-white text-[10px] px-2 py-1 rounded-lg -translate-y-full font-mono whitespace-nowrap z-20 pointer-events-none">
                                    {Math.round(day.calories)} cal
                                </div>

                                {/* Capsule Bar */}
                                <div className={cn(
                                    "relative w-full max-w-[40px] bg-primary/5 rounded-[1rem] overflow-hidden transition-all duration-300",
                                    "h-full border border-transparent",
                                    hasData ? "hover:border-primary/10 hover:shadow-inner" : ""
                                )}>
                                    {/* Fill */}
                                    <div
                                        className={cn(
                                            "absolute bottom-0 left-0 w-full transition-all duration-1000 ease-[cubic-bezier(0.25,0.1,0.25,1)] rounded-[1rem]",
                                            isToday ? "bg-accent" : "bg-primary"
                                        )}
                                        style={{
                                            height: `${heightPercent}%`,
                                            opacity: hasData ? 1 : 0
                                        }}
                                    />
                                </div>

                                {/* Day Label */}
                                <span className={cn(
                                    "font-mono text-[10px] uppercase transition-colors",
                                    isToday ? "text-accent font-bold" : "text-primary/40"
                                )}>
                                    {formatDateDisplay(day.date, { weekday: 'narrow' })}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Stats Footer */}
                <div className="flex justify-start items-center gap-6 pt-6 border-t border-dashed border-primary/10 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                        <span className="font-sans text-xs text-primary/60 font-medium">
                            <span className="text-primary font-bold">{daysTracked}</span> Days Tracked
                        </span>
                    </div>
                    <div className="w-px h-3 bg-primary/10" />
                    <span className="font-sans text-xs text-primary/60">
                        Goal: <span className="font-mono text-primary font-medium">{goals.targetCalories}</span>
                    </span>
                </div>
            </section>

            {/* Placeholder for Future Charts */}
            <section className="bg-white/50 dark:bg-surface/50 border border-white/40 dark:border-border/30 rounded-[2.5rem] p-8 flex items-center justify-center min-h-[120px] mb-8">
                <div className="text-center">
                    <span className="font-serif text-lg text-primary/40 block mb-1">More Insights Coming Soon</span>
                    <span className="font-sans text-xs text-primary/30">Detailed macro analysis in next update</span>
                </div>
            </section>

            {/* Daily Log Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h3 className="font-serif font-bold text-2xl text-primary">Daily Log</h3>

                    {/* Date Navigation */}
                    <div className="flex items-center bg-surface rounded-full p-1 shadow-sm border border-border">
                        <button
                            onClick={handlePrevDay}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-primary/5 text-primary/60 transition-colors"
                        >
                            <HiChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex items-center px-3 gap-2">
                            <HiCalendarDays className="w-4 h-4 text-primary/40" />
                            <span className="font-mono text-sm font-medium text-primary">
                                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                        </div>

                        <button
                            onClick={handleNextDay}
                            disabled={isToday(selectedDate)}
                            className={cn(
                                "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                                isToday(selectedDate)
                                    ? "text-primary/20 cursor-not-allowed"
                                    : "hover:bg-primary/5 text-primary/60"
                            )}
                        >
                            <HiChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {loadingDaily ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : dailySummary?.meals && dailySummary.meals.length > 0 ? (
                    <div className="bg-surface rounded-[2.5rem] shadow-card overflow-hidden divide-y divide-border">
                        {dailySummary.meals.map((meal, index) => (
                            <MealItem key={index} meal={meal} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white/50 dark:bg-surface/50 rounded-[2.5rem] border border-dashed border-primary/10">
                        <p className="font-sans text-primary/40">No meals logged for this day.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
