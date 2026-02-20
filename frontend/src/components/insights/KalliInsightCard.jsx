import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../../api/services';
import { MessageCircle, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn';

const RANGE_LABELS = { '1W': 'weekly', '1M': 'monthly', '3M': 'quarterly' };

export default function KalliInsightCard({ timeRange = '1W', periodStart = null }) {
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    const fetchInsight = useCallback(async (refresh = false) => {
        if (refresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(false);
        try {
            const data = await api.getAISummary(timeRange, periodStart, { refresh });
            setInsight(data.insight || null);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [timeRange, periodStart]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(false);
            try {
                const data = await api.getAISummary(timeRange, periodStart);
                if (!cancelled) setInsight(data.insight || null);
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [timeRange, periodStart]);

    const handleChatAboutThis = () => {
        navigate('/chat', {
            state: { insightContext: { text: insight, range: timeRange } }
        });
    };

    if (loading) {
        return (
            <section className="bg-accent/5 dark:bg-accent/10 rounded-[2rem] p-5 border border-accent/15">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                    <span className="text-sm text-primary/50 font-sans">Generating your {RANGE_LABELS[timeRange]} insight...</span>
                </div>
            </section>
        );
    }

    if (error || !insight) return null;

    return (
        <section className="bg-accent/5 dark:bg-accent/10 rounded-[2rem] p-5 border border-accent/15 relative">
            {/* Decorative sparkle */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-3 relative">
                <div className="w-8 h-8 bg-accent/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-serif font-bold text-sm text-primary">Kalli's Insight</h3>
                        <button
                            onClick={() => fetchInsight(true)}
                            disabled={refreshing}
                            className="p-1.5 rounded-lg text-primary/40 hover:text-primary/70 hover:bg-primary/5 transition-all"
                            aria-label="Refresh insight"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
                        </button>
                    </div>
                    <div className="font-sans text-sm text-primary/75 leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:pl-4 [&_ul]:mb-1.5 [&_li]:mb-0.5 [&_strong]:text-primary [&_strong]:font-semibold [&_*]:text-inherit">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {insight}
                        </ReactMarkdown>
                    </div>

                    <button
                        onClick={handleChatAboutThis}
                        className="mt-3 flex items-center gap-1.5 text-accent text-sm font-sans font-medium hover:underline"
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat about this
                    </button>
                </div>
            </div>
        </section>
    );
}
