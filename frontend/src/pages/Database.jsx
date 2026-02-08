import { useState, useEffect } from 'react';
import { api } from '../api/services';
import FoodEditModal from '../components/common/FoodEditModal';
import { Pencil, Trash2, Search } from 'lucide-react';
import { cn } from '../utils/cn';

export default function Database() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
                const timeA = new Date(a.createdAt || a.date).getTime();
                const timeB = new Date(b.createdAt || b.date).getTime();
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

    if (loading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <div className="font-serif text-primary/60 animate-pulse">Loading technical data...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">
            {/* Search/Filter Bar (Placeholder for now) */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40" />
                <input
                    type="text"
                    placeholder="Search logs..."
                    className="w-full bg-white rounded-xl pl-10 pr-4 py-3 font-sans text-sm text-primary placeholder:text-primary/30 shadow-sm border border-transparent focus:border-border focus:ring-0 outline-none transition-all"
                />
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-card overflow-hidden border border-border/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-primary/5">
                            <tr>
                                {['Date', 'Time', 'Meal', 'Item', 'Qty', 'Cals', 'P', 'C', 'F'].map((header, i) => (
                                    <th
                                        key={header}
                                        className={cn(
                                            "px-4 py-4 font-sans text-[10px] uppercase tracking-widest text-primary/50 font-bold",
                                            (header === 'Cals' || header === 'Qty' || ['P', 'C', 'F'].includes(header)) && "text-right",
                                            ['P', 'C', 'F'].includes(header) && "hidden sm:table-cell",
                                            header === 'Item' && "w-[45%] min-w-[220px]",
                                            header === 'Qty' && "min-w-[80px]"
                                        )}
                                    >
                                        {header}
                                    </th>
                                ))}
                                <th className="px-4 py-4 font-sans text-[10px] uppercase tracking-widest text-primary/50 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-4 py-12 text-center text-primary/40 font-mono text-sm">
                                        No logs found. Initialize sequence via Chat.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="group hover:bg-primary/5 transition-colors duration-200">
                                        <td className="px-4 py-3 font-mono text-xs text-primary/70 whitespace-nowrap">
                                            {new Date(log.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-primary/40 whitespace-nowrap">
                                            {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                        </td>
                                        <td className="px-4 py-3 font-sans text-xs font-semibold text-primary/80 capitalize">
                                            {log.meal}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm font-medium text-primary">
                                            {log.name}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-primary/70">
                                            {log.quantity} {log.unit}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-primary">
                                            {Math.round(log.calories)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-primary/60 hidden sm:table-cell">
                                            {Math.round(log.protein)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-primary/60 hidden sm:table-cell">
                                            {Math.round(log.carbs)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-primary/60 hidden sm:table-cell">
                                            {Math.round(log.fat)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(log)}
                                                    className="p-1.5 text-primary/40 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(log)}
                                                    className="p-1.5 text-primary/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
