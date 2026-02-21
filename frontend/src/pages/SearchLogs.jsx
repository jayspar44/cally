import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { api } from '../api/services';

export default function SearchLogs() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [allLogs, setAllLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchLogs = async () => {
            try {
                const data = await api.getFoodLogs();
                if (!cancelled) {
                    const flat = (data.logs || []).flatMap(log => {
                        if (log.items && Array.isArray(log.items)) {
                            return log.items.map(item => ({ ...item, date: log.date, meal: log.meal, id: item.id || log.id }));
                        }
                        return [log];
                    });
                    setAllLogs(flat.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
                }
            } catch (error) {
                console.error('Failed to fetch logs for search:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchLogs();
        return () => { cancelled = true; };
    }, []);

    const filtered = query.trim()
        ? allLogs.filter(log =>
            (log.name || '').toLowerCase().includes(query.toLowerCase()) ||
            (log.meal || '').toLowerCase().includes(query.toLowerCase())
        )
        : allLogs;

    const displayed = filtered.slice(0, 50);

    return (
        <div className="flex flex-col -mx-4 sm:-mx-6 min-h-full">
            <div className="flex items-center gap-3 p-4 border-b border-border/50">
                <button onClick={() => navigate(-1)} className="p-2 rounded-xl text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search food logs..."
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-primary/5 rounded-xl font-sans text-sm text-primary placeholder:text-primary/30 outline-none focus:ring-2 focus:ring-accent/30"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="font-sans text-sm text-primary/40">{query ? 'No matching logs found' : 'No food logs yet'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {displayed.map((log, i) => (
                            <button
                                key={log.id || i}
                                onClick={() => navigate(`/database?date=${log.date}`)}
                                className="w-full flex items-center justify-between p-4 hover:bg-primary/5 active:bg-primary/8 transition-colors text-left"
                            >
                                <div className="flex-1 min-w-0 pr-3">
                                    <span className="font-sans text-sm text-primary block truncate">{log.name}</span>
                                    <span className="font-mono text-xs text-primary/40">{log.date} · {log.meal}</span>
                                </div>
                                <span className="font-mono text-sm font-bold text-primary shrink-0">{Math.round(log.calories || 0)} cal</span>
                            </button>
                        ))}
                        {filtered.length > 50 && (
                            <div className="text-center py-3">
                                <span className="font-sans text-xs text-primary/40">Showing 50 of {filtered.length} results</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
