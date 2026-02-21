import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/services';
import { cn } from '../utils/cn';
import { parseLocalDate, toDateStr } from '../utils/dateUtils';
import { BarChart3, Plus } from 'lucide-react';
import KalliInsightCard from '../components/insights/KalliInsightCard';
import TrendsChart from '../components/insights/TrendsChart';
import MacroDonutChart from '../components/insights/MacroDonutChart';
import StreakBanner from '../components/insights/StreakBanner';
import BadgesSection from '../components/insights/BadgesSection';

export default function Insights() {
    const navigate = useNavigate();
    // Global state
    const [timeRange, setTimeRange] = useState('1W');
    const [selectedMetric, setSelectedMetric] = useState('calories');

    const [periodOffset, setPeriodOffset] = useState(0);
    const hasNavigatedRef = useRef(false);

    // Data stores (one fetch per range type, cached in state)
    const [weeklyData, setWeeklyData] = useState(null);
    const [monthlyData, setMonthlyData] = useState(null);
    const [quarterlyData, setQuarterlyData] = useState(null);
    const [loadingData, setLoadingData] = useState(true);

    // Badge data (decoupled from timeRange)
    const [badgeData, setBadgeData] = useState(null);
    const [loadingBadges, setLoadingBadges] = useState(true);

    // Reset offset when timeRange changes
    useEffect(() => { setPeriodOffset(0); hasNavigatedRef.current = false; }, [timeRange]);

    // Fetch all trend data on mount
    useEffect(() => {
        let cancelled = false;
        const fetchAllData = async () => {
            setLoadingData(true);
            try {
                const [weekly, monthly, quarterly] = await Promise.all([
                    api.getWeeklyTrends(),
                    api.getMonthlyTrends(),
                    api.getQuarterlyTrends()
                ]);
                if (!cancelled) {
                    setWeeklyData(weekly);
                    setMonthlyData(monthly);
                    setQuarterlyData(quarterly);
                }
            } catch (error) {
                console.error('Failed to fetch trends:', error);
            } finally {
                if (!cancelled) setLoadingData(false);
            }
        };
        fetchAllData();
        return () => { cancelled = true; };
    }, []);

    // Fetch badges on mount (decoupled from timeRange)
    useEffect(() => {
        let cancelled = false;
        const fetchBadges = async () => {
            setLoadingBadges(true);
            try {
                const data = await api.getUserBadges();
                if (!cancelled) setBadgeData(data);
            } catch (error) {
                console.error('Failed to fetch badges:', error);
            } finally {
                if (!cancelled) setLoadingBadges(false);
            }
        };
        fetchBadges();
        return () => { cancelled = true; };
    }, []);

    function computePeriodStart(range, offset) {
        if (offset === 0) return null;
        const now = new Date();
        let start;
        if (range === '1W') {
            start = new Date(now);
            start.setDate(start.getDate() - 6 + (offset * 7));
        } else if (range === '1M') {
            start = new Date(now);
            start.setDate(start.getDate() - 29 + (offset * 30));
        } else {
            start = new Date(now);
            start.setDate(start.getDate() - 89 + (offset * 90));
        }
        return toDateStr(start);
    }

    function formatPeriodLabel(startStr, endStr) {
        if (!startStr || !endStr) return '';
        const fmt = { month: 'short', day: 'numeric' };
        const start = parseLocalDate(startStr);
        const end = parseLocalDate(endStr);
        return `${start.toLocaleDateString('en-US', fmt)} – ${end.toLocaleDateString('en-US', fmt)}`;
    }

    // Fetch period data when navigating to a different period
    useEffect(() => {
        if (periodOffset !== 0) hasNavigatedRef.current = true;
        if (periodOffset === 0 && !hasNavigatedRef.current) return;
        let cancelled = false;
        const fetchPeriodData = async () => {
            const startDate = computePeriodStart(timeRange, periodOffset);
            setLoadingData(true);
            try {
                if (timeRange === '1W') {
                    const data = await api.getWeeklyTrends(startDate);
                    if (!cancelled) setWeeklyData(data);
                } else if (timeRange === '1M') {
                    const data = await api.getMonthlyTrends(startDate);
                    if (!cancelled) setMonthlyData(data);
                } else if (timeRange === '3M') {
                    const data = await api.getQuarterlyTrends(startDate);
                    if (!cancelled) setQuarterlyData(data);
                }
            } catch (error) {
                console.error('Failed to fetch period data:', error);
            } finally {
                if (!cancelled) setLoadingData(false);
            }
        };
        fetchPeriodData();
        return () => { cancelled = true; };
    }, [timeRange, periodOffset]);

    // Compute available time ranges based on actual data
    const availableRanges = useMemo(() => {
        const ranges = ['1W'];
        if (monthlyData?.daysTracked > 7) ranges.push('1M');
        const quarterlyDays = quarterlyData?.weeks?.reduce((s, w) => s + w.daysTracked, 0) || 0;
        if (quarterlyDays > 30) ranges.push('3M');
        return ranges;
    }, [monthlyData, quarterlyData]);

    // Fall back if current timeRange is no longer valid
    useEffect(() => {
        if (!availableRanges.includes(timeRange)) {
            setTimeRange(availableRanges[availableRanges.length - 1]);
        }
    }, [availableRanges, timeRange]);

    // Derive the right data based on timeRange
    const activeData = useMemo(() => {
        switch (timeRange) {
            case '1W': return weeklyData;
            case '1M': return monthlyData;
            case '3M': return quarterlyData;
            default: return weeklyData;
        }
    }, [timeRange, weeklyData, monthlyData, quarterlyData]);

    // Get averages for the current time range
    const averages = useMemo(() => {
        if (timeRange === '3M' && quarterlyData?.weeks) {
            // Compute averages from weekly buckets
            const weeks = quarterlyData.weeks;
            if (weeks.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
            const totalDays = weeks.reduce((s, w) => s + w.daysTracked, 0) || 1;
            const totals = weeks.reduce((acc, w) => ({
                calories: acc.calories + (w.avgCalories * w.daysTracked),
                protein: acc.protein + (w.avgProtein * w.daysTracked),
                carbs: acc.carbs + (w.avgCarbs * w.daysTracked),
                fat: acc.fat + (w.avgFat * w.daysTracked)
            }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
            return {
                calories: Math.round(totals.calories / totalDays),
                protein: Math.round(totals.protein / totalDays),
                carbs: Math.round(totals.carbs / totalDays),
                fat: Math.round(totals.fat / totalDays)
            };
        }
        return activeData?.averages || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }, [timeRange, activeData, quarterlyData]);

    // Previous period averages for delta comparison
    const prevAverages = useMemo(() => {
        if (timeRange === '1W' && weeklyData) {
            // Weekly data already provides calorieDelta + prevAvgCalories
            // We can reconstruct previous averages for calories
            if (weeklyData.prevAvgCalories != null) {
                return { calories: weeklyData.prevAvgCalories };
            }
        }
        // For 1M and 3M we don't have previous-period data from backend yet
        return null;
    }, [timeRange, weeklyData]);

    const goals = useMemo(() => {
        return activeData?.goals || weeklyData?.goals || {
            targetCalories: 2000, targetProtein: 120, targetCarbs: 250, targetFat: 65
        };
    }, [activeData, weeklyData]);

    const periodLabel = useMemo(() => formatPeriodLabel(activeData?.startDate, activeData?.endDate), [activeData]);
    const periodStart = useMemo(() => computePeriodStart(timeRange, periodOffset), [timeRange, periodOffset]);

    if (loadingData && !weeklyData) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    const hasData = (weeklyData?.daysTracked > 0)
        || (monthlyData?.daysTracked > 0)
        || (quarterlyData?.weeks?.some(w => w.daysTracked > 0));

    if (!hasData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 animate-in fade-in duration-700">
                <div className="w-16 h-16 bg-accent/10 rounded-[1.75rem] flex items-center justify-center mb-5">
                    <BarChart3 className="w-8 h-8 text-accent" />
                </div>
                <h2 className="font-serif font-black text-2xl text-primary mb-2 text-center">No insights yet</h2>
                <p className="font-sans text-primary/60 text-sm text-center max-w-xs leading-snug mb-6">
                    Log your first meal and your trends, averages, and achievements will show up here.
                </p>
                <button
                    onClick={() => {
                        navigate('/chat');
                        setTimeout(() => window.dispatchEvent(new CustomEvent('ghost-keyboard')), 100);
                    }}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-accent text-white font-sans font-semibold text-sm shadow-sm hover:bg-accent/90 active:scale-95 transition-all"
                >
                    <Plus className="w-4.5 h-4.5" />
                    Log something
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Time Range Selector (only show when multiple ranges available) */}
            {availableRanges.length > 1 && (
                <div className="flex justify-center">
                    <div className="bg-surface rounded-full p-1 border border-border inline-flex">
                        {availableRanges.map(range => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    "px-6 py-2 rounded-full text-sm font-mono font-bold transition-all",
                                    timeRange === range
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-primary/50 hover:text-primary/70"
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Kalli's Insight (adapts to time range) */}
            <KalliInsightCard timeRange={timeRange} periodStart={periodStart} />

            {/* Trends Chart with Metric Switcher */}
            <TrendsChart
                timeRange={timeRange}
                selectedMetric={selectedMetric}
                onMetricChange={setSelectedMetric}
                weeklyData={weeklyData}
                monthlyData={monthlyData}
                quarterlyData={quarterlyData}
                goals={goals}
                averages={averages}
                prevAverages={prevAverages}
                periodOffset={periodOffset}
                onPeriodBack={() => setPeriodOffset(o => o - 1)}
                onPeriodForward={() => setPeriodOffset(o => Math.min(0, o + 1))}
                periodLabel={periodLabel}
            />

            {/* Macro Donut Chart */}
            <MacroDonutChart
                averages={averages}
                goals={goals}
            />

            {/* Divider */}
            <div className="h-px bg-border/50" />

            {/* Achievements Section (decoupled from timeRange) */}
            <div className="space-y-3">
                <h3 className="font-serif font-bold text-lg text-primary px-1">Achievements</h3>

                <StreakBanner
                    stats={badgeData?.stats}
                    loading={loadingBadges}
                />

                <BadgesSection
                    badgeData={badgeData}
                    loading={loadingBadges}
                />
            </div>
        </div>
    );
}
