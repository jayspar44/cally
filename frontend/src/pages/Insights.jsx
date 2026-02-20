import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/services';
import { cn } from '../utils/cn';
import { toDateStr, isToday as isTodayUtil, parseLocalDate } from '../utils/dateUtils';
import MealItem from '../components/ui/MealItem';
import KalliInsightCard from '../components/insights/KalliInsightCard';
import SummaryStats from '../components/insights/SummaryStats';
import WeeklyCalorieChart from '../components/insights/WeeklyCalorieChart';
import CalorieTrendChart from '../components/insights/CalorieTrendChart';
import MacroDonutChart from '../components/insights/MacroDonutChart';
import { HiChevronLeft, HiChevronRight, HiCalendarDays } from 'react-icons/hi2';

const getDefaultWeekStart = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - 6);
    return toDateStr(d);
};

export default function Insights() {
    // Week navigation
    const [selectedWeekStart, setSelectedWeekStart] = useState(getDefaultWeekStart);
    const [weeklyData, setWeeklyData] = useState(null);
    const [loadingWeekly, setLoadingWeekly] = useState(true);

    // Trend data
    const [monthlyData, setMonthlyData] = useState(null);
    const [quarterlyData, setQuarterlyData] = useState(null);

    // Daily Log State
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dailySummary, setDailySummary] = useState(null);
    const [loadingDaily, setLoadingDaily] = useState(false);

    const isCurrentWeek = useCallback(() => {
        const defaultStart = getDefaultWeekStart();
        return selectedWeekStart === defaultStart;
    }, [selectedWeekStart]);

    // Fetch weekly data when week changes
    useEffect(() => {
        let cancelled = false;
        const fetchWeekly = async () => {
            setLoadingWeekly(true);
            try {
                const data = await api.getWeeklyTrends(selectedWeekStart);
                if (!cancelled) setWeeklyData(data);
            } catch (error) {
                console.error('Failed to fetch weekly trends:', error);
            } finally {
                if (!cancelled) setLoadingWeekly(false);
            }
        };
        fetchWeekly();
        return () => { cancelled = true; };
    }, [selectedWeekStart]);

    // Fetch monthly and quarterly (once on mount)
    useEffect(() => {
        const fetchTrends = async () => {
            try {
                const [monthly, quarterly] = await Promise.all([
                    api.getMonthlyTrends(),
                    api.getQuarterlyTrends()
                ]);
                setMonthlyData(monthly);
                setQuarterlyData(quarterly);
            } catch (error) {
                console.error('Failed to fetch trends:', error);
            }
        };
        fetchTrends();
    }, []);

    // Fetch Daily Summary when selectedDate changes
    useEffect(() => {
        let cancelled = false;
        const fetchDaily = async () => {
            setLoadingDaily(true);
            try {
                const dateStr = toDateStr(selectedDate);
                const data = await api.getDailySummary(dateStr);
                if (!cancelled) setDailySummary(data);
            } catch (error) {
                console.error('Failed to fetch daily summary:', error);
            } finally {
                if (!cancelled) setLoadingDaily(false);
            }
        };
        fetchDaily();
        return () => { cancelled = true; };
    }, [selectedDate]);

    const handlePrevWeek = () => {
        const current = parseLocalDate(selectedWeekStart);
        current.setDate(current.getDate() - 7);
        setSelectedWeekStart(toDateStr(current));
    };

    const handleNextWeek = () => {
        if (isCurrentWeek()) return;
        const current = parseLocalDate(selectedWeekStart);
        current.setDate(current.getDate() + 7);
        setSelectedWeekStart(toDateStr(current));
    };

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

    if (loadingWeekly && !weeklyData) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const goals = weeklyData?.goals || { targetCalories: 2000, targetProtein: 120, targetCarbs: 250, targetFat: 65 };

    return (
        <div className="space-y-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Kalli's Weekly Insight */}
            <KalliInsightCard weekStart={selectedWeekStart} />

            {/* Summary Stats Row */}
            <SummaryStats
                averages={weeklyData?.averages}
                goals={goals}
                calorieDelta={weeklyData?.calorieDelta}
                daysOnTarget={weeklyData?.daysOnTarget}
                streak={weeklyData?.streak}
            />

            {/* Weekly Calorie Chart */}
            <WeeklyCalorieChart
                days={weeklyData?.days || []}
                goals={goals}
                startDate={weeklyData?.startDate}
                endDate={weeklyData?.endDate}
                bestDay={weeklyData?.bestDay}
                onPrev={handlePrevWeek}
                onNext={handleNextWeek}
                isCurrentWeek={isCurrentWeek()}
            />

            {/* Calorie Trend Chart */}
            <CalorieTrendChart
                monthlyData={monthlyData}
                quarterlyData={quarterlyData}
                goals={goals}
            />

            {/* Macro Donut Chart */}
            <MacroDonutChart
                averages={weeklyData?.averages}
                goals={goals}
            />

            {/* Daily Log Section */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="font-serif font-bold text-xl text-primary">Daily Log</h3>

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
                    <div className="bg-surface rounded-[2rem] shadow-card overflow-hidden divide-y divide-border">
                        {dailySummary.meals.map((meal, index) => (
                            <MealItem key={index} meal={meal} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white/50 dark:bg-surface/50 rounded-[2rem] border border-dashed border-primary/10">
                        <p className="font-sans text-primary/40">No meals logged for this day.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
