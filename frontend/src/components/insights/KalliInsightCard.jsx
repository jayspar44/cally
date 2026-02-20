import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/services';
import { MessageCircle, Sparkles, Loader2 } from 'lucide-react';

export default function KalliInsightCard({ weekStart }) {
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;

        const fetchInsight = async () => {
            setLoading(true);
            setError(false);
            try {
                const data = await api.getAISummary(weekStart);
                if (!cancelled) {
                    setInsight(data.insight || null);
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchInsight();
        return () => { cancelled = true; };
    }, [weekStart]);

    const handleChatAboutThis = () => {
        navigate('/chat', {
            state: { prefillMessage: `Tell me more about my nutrition insight: ${insight}` }
        });
    };

    if (loading) {
        return (
            <section className="bg-accent/5 dark:bg-accent/10 rounded-[2rem] p-5 border border-accent/15">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                    <span className="text-sm text-primary/50 font-sans">Generating your weekly insight...</span>
                </div>
            </section>
        );
    }

    if (error || !insight) return null;

    return (
        <section className="bg-accent/5 dark:bg-accent/10 rounded-[2rem] p-5 border border-accent/15 relative overflow-hidden">
            {/* Decorative sparkle */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent/5 rounded-full blur-3xl" />

            <div className="flex items-start gap-3 relative">
                <div className="w-8 h-8 bg-accent/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-bold text-sm text-primary mb-1.5">Kalli's Insight</h3>
                    <p className="font-sans text-sm text-primary/75 leading-relaxed">{insight}</p>

                    <button
                        onClick={handleChatAboutThis}
                        className="mt-3 flex items-center gap-1.5 text-accent text-xs font-sans font-medium hover:underline"
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat about this
                    </button>
                </div>
            </div>
        </section>
    );
}
