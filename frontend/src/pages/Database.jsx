import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/services';
import { toDateStr } from '../utils/dateUtils';
import { Search } from 'lucide-react';
import DateNavigator from '../components/database/DateNavigator';
import DailySummaryBar from '../components/database/DailySummaryBar';
import MealSection from '../components/database/MealSection';
import FoodEditModal from '../components/common/FoodEditModal';
import SearchOverlay from '../components/database/SearchOverlay';

const ALL_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Database() {
    const [selectedDate, setSelectedDate] = useState(toDateStr());
    const [summary, setSummary] = useState(null);
    const [foodLogs, setFoodLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    const fetchDayData = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryData, logsData] = await Promise.all([
                api.getDailySummary(selectedDate),
                api.getFoodLogs(selectedDate, selectedDate)
            ]);
            setSummary(summaryData);
            const rawLogs = logsData.logs || [];
            const flat = rawLogs.flatMap(log => {
                if (log.items && Array.isArray(log.items)) {
                    return log.items.map(item => ({
                        ...item, date: log.date, meal: log.meal, id: item.id || log.id
                    }));
                }
                return [log];
            });
            setFoodLogs(flat);
        } catch (error) {
            console.error('Failed to fetch day data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => { fetchDayData(); }, [fetchDayData]);

    const mealGroups = useMemo(() => {
        const groups = {};
        ALL_MEALS.forEach(m => { groups[m] = []; });
        foodLogs.forEach(log => {
            const meal = log.meal || 'snack';
            if (!groups[meal]) groups[meal] = [];
            groups[meal].push(log);
        });
        return ALL_MEALS.map(meal => ({
            meal,
            items: groups[meal],
            totalCalories: groups[meal].reduce((sum, l) => sum + (l.calories || 0), 0)
        }));
    }, [foodLogs]);

    const handleEdit = (log) => {
        setSelectedLog(log);
        setIsEditModalOpen(true);
    };

    const handleSave = async (updatedData) => {
        if (!selectedLog?.id) return;
        try {
            await api.updateFoodLog(selectedLog.id, updatedData);
            setIsEditModalOpen(false);
            setSelectedLog(null);
            fetchDayData();
        } catch (error) {
            console.error('Failed to update food log:', error);
        }
    };

    const handleDelete = async () => {
        if (!selectedLog?.id) return;
        try {
            await api.deleteFoodLog(selectedLog.id);
            setIsEditModalOpen(false);
            setSelectedLog(null);
            fetchDayData();
        } catch (error) {
            console.error('Failed to delete food log:', error);
        }
    };

    return (
        <div className="space-y-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    <DailySummaryBar summary={summary?.summary} goals={summary?.goals} progress={summary?.progress} />
                    <div className="space-y-4">
                        {mealGroups.map(group => (
                            <MealSection key={group.meal} meal={group.meal} items={group.items} totalCalories={group.totalCalories} onEditItem={handleEdit} />
                        ))}
                    </div>
                    <button onClick={() => setShowSearch(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-border/40 text-primary/40 hover:text-primary/60 hover:border-border/60 transition-colors">
                        <Search className="w-4 h-4" />
                        <span className="font-sans text-sm">Search all logs</span>
                    </button>
                </>
            )}
            <FoodEditModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setSelectedLog(null); }} onSave={handleSave} onDelete={handleDelete} initialData={selectedLog} />
            {showSearch && (
                <SearchOverlay onClose={() => setShowSearch(false)} onNavigateToDate={(date) => { setSelectedDate(date); setShowSearch(false); }} />
            )}
        </div>
    );
}
