import { useState, useEffect } from 'react';
import { api } from '../api/services';
import FoodEditModal from '../components/common/FoodEditModal';
import { Pencil, Trash2, Search, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { parseLocalDate, formatDateDisplay, formatTime } from '../utils/dateUtils';

export default function Database() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Fetch last 100 logs (no date filter)
            const data = await api.getFoodLogs();
            const rawLogs = data.logs || [];

            // FLATTEN LOGS: Handle legacy data where items are in an array
            const flattenedLogs = rawLogs.flatMap(log => {
                if (log.items && Array.isArray(log.items) && log.items.length > 0) {
                    // Legacy format: Expand items
                    return log.items.map((item, index) => ({
                        ...log,
                        ...item, // Flatten item properties (name, calories, etc.) to top level
                        realId: log.id, // Keep real ID for API
                        id: `${log.id}-${index}`, // Create unique key
                    }));
                }
                // New format: Already flat
                return [{ ...log, realId: log.id }];
            });

            setLogs(flattenedLogs.sort((a, b) => {
                const timeA = (a.createdAt ? new Date(a.createdAt) : parseLocalDate(a.date)).getTime();
                const timeB = (b.createdAt ? new Date(b.createdAt) : parseLocalDate(b.date)).getTime();
                return timeB - timeA; // Descending
            }));
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleEdit = (log) => {
        setSelectedLog(log);
        setIsEditModalOpen(true);
    };

    const handleSave = async (updatedData) => {
        try {
            const id = selectedLog.realId;
            await api.updateFoodLog(id, updatedData);
            setIsEditModalOpen(false);
            fetchLogs(); // Refresh
        } catch (error) {
            console.error('Failed to update log:', error);
            alert('Failed to update log. Please try again.');
        }
    };

    const handleDelete = async (log = null) => {
        const targetLog = log?.realId ? log : selectedLog;
        if (!targetLog) return;

        if (!confirm('Are you sure you want to delete this log?')) return;

        try {
            const id = targetLog.realId;
            await api.deleteFoodLog(id);
            setIsEditModalOpen(false);
            fetchLogs(); // Refresh
        } catch (error) {
            console.error('Failed to delete log:', error);
            alert('Failed to delete log.');
        }
    };

    const filteredLogs = searchQuery.trim()
        ? logs.filter(log => {
            const q = searchQuery.toLowerCase();
            return log.name?.toLowerCase().includes(q) || log.meal?.toLowerCase().includes(q);
        })
        : logs;

    if (loading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <div className="font-serif text-primary/60 animate-pulse">Loading technical data...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Search/Filter Bar (Placeholder for now) */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface rounded-xl pl-10 pr-10 py-3 font-sans text-sm text-primary placeholder:text-primary/30 shadow-sm border border-transparent focus:border-border focus:ring-0 outline-none transition-all"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary/60 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="bg-surface rounded-2xl shadow-card overflow-hidden border border-border/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-primary/5">
                            <tr>
                                {['Date', 'Time', 'Meal', 'Item', 'Qty', 'Cals', 'P', 'C', 'F'].map((header) => (
                                    <th
                                        key={header}
                                        className={cn(
                                            "px-1.5 py-3 font-sans text-[10px] uppercase tracking-widest text-primary/65 font-bold first:pl-3",
                                            (header === 'Cals' || header === 'Qty' || ['P', 'C', 'F'].includes(header)) && "text-right",
                                            header === 'Time' && "hidden xl:table-cell",
                                            header === 'Qty' && "hidden xl:table-cell"
                                        )}
                                    >
                                        {header}
                                    </th>
                                ))}
                                <th className="px-1.5 py-3 pr-3 font-sans text-[10px] uppercase tracking-widest text-primary/65 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-4 py-12 text-center text-primary/40 font-mono text-sm">
                                        {searchQuery.trim() ? 'No logs match your search.' : 'No logs found. Initialize sequence via Chat.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="group hover:bg-primary/5 transition-colors duration-200">
                                        <td className="pl-3 pr-1.5 py-2.5 font-mono text-xs text-primary/70 whitespace-nowrap">
                                            {formatDateDisplay(log.date, { month: '2-digit', day: '2-digit' })}
                                        </td>
                                        <td className="px-1.5 py-2.5 font-mono text-xs text-primary/55 whitespace-nowrap hidden xl:table-cell">
                                            {log.createdAt ? formatTime(log.createdAt) : '-'}
                                        </td>
                                        <td className="px-1.5 py-2.5 font-mono text-xs text-primary/70 capitalize">
                                            {log.meal}
                                        </td>
                                        <td className="px-1.5 py-2.5 max-w-[180px]">
                                            <span className="font-mono text-xs font-medium text-primary block truncate" title={log.name}>{log.name}</span>
                                        </td>
                                        <td className="px-1.5 py-2.5 text-right font-mono text-xs text-primary/70 whitespace-nowrap hidden xl:table-cell">
                                            {log.quantity} {log.unit}
                                        </td>
                                        <td className="px-1.5 py-2.5 text-right font-mono text-xs font-bold text-primary">
                                            {Math.round(log.calories)}
                                        </td>
                                        <td className="px-1.5 py-2.5 text-right font-mono text-xs text-primary/60">
                                            {Math.round(log.protein)}
                                        </td>
                                        <td className="px-1.5 py-2.5 text-right font-mono text-xs text-primary/60">
                                            {Math.round(log.carbs)}
                                        </td>
                                        <td className="px-1.5 py-2.5 text-right font-mono text-xs text-primary/60">
                                            {Math.round(log.fat)}
                                        </td>
                                        <td className="px-1.5 pr-3 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(log)}
                                                    className="p-1.5 text-primary/40 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(log)}
                                                    className="p-1.5 text-primary/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <FoodEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSave}
                onDelete={handleDelete}
                initialData={selectedLog}
            />
        </div>
    );
}
