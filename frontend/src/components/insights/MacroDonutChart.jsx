import { useMemo } from 'react';
import { cn } from '../../utils/cn';
import ChartInsight from './ChartInsight';

const MACRO_CONFIG = [
    { key: 'protein', label: 'Protein', goalKey: 'targetProtein', color: 'var(--color-protein)', bgClass: 'bg-[var(--color-protein)]' },
    { key: 'carbs', label: 'Carbs', goalKey: 'targetCarbs', color: 'var(--color-carbs)', bgClass: 'bg-[var(--color-carbs)]' },
    { key: 'fat', label: 'Fat', goalKey: 'targetFat', color: 'var(--color-fat)', bgClass: 'bg-[var(--color-fat)]' }
];

export default function MacroDonutChart({ averages, goals }) {
    const macros = useMemo(() => {
        if (!averages) return [];
        return MACRO_CONFIG.map(m => {
            const value = Math.round(averages[m.key] || 0);
            const target = goals?.[m.goalKey] || 0;
            const pct = target > 0 ? Math.min(150, Math.round((value / target) * 100)) : 0;
            const onTarget = target > 0 && Math.abs(value - target) <= target * 0.1;
            return { ...m, value, target, pct, onTarget };
        });
    }, [averages, goals]);

    const score = useMemo(() => {
        const onTargetCount = macros.filter(m => m.onTarget).length;
        if (onTargetCount === 3) return { label: 'On Track', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
        if (onTargetCount === 2) return { label: 'Almost', className: 'bg-primary/10 text-primary dark:bg-white/10' };
        if (onTargetCount === 1) return { label: 'Getting There', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        return { label: 'Needs Work', className: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
    }, [macros]);

    const insightText = useMemo(() => {
        if (!goals || !averages) return null;
        const proteinPct = goals.targetProtein > 0
            ? Math.round(((goals.targetProtein - averages.protein) / goals.targetProtein) * 100)
            : 0;
        if (proteinPct > 15) {
            return `Protein is averaging ${proteinPct}% below target \u2014 adding eggs or Greek yogurt at breakfast would close most of this gap.`;
        }
        if (proteinPct < -15) {
            return `Great protein intake \u2014 you're ${Math.abs(proteinPct)}% above your goal.`;
        }
        return `Macros are well balanced \u2014 protein, carbs, and fat are all close to target.`;
    }, [averages, goals]);

    const hasData = macros.some(m => m.value > 0);

    if (!hasData) {
        return (
            <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
                <h3 className="font-serif font-bold text-lg text-primary mb-4">Macros</h3>
                <div className="flex items-center justify-center h-[120px] text-primary/30 font-sans text-sm">
                    No macro data yet
                </div>
            </section>
        );
    }

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            <div className="flex items-center gap-2.5 mb-4">
                <h3 className="font-serif font-bold text-lg text-primary">Macros</h3>
                <span className={cn("font-mono text-sm font-bold px-2.5 py-0.5 rounded-full", score.className)}>
                    {score.label}
                </span>
            </div>

            <div className="flex flex-col gap-4">
                {macros.map(macro => (
                    <div key={macro.key}>
                        <div className="flex items-baseline justify-between mb-1.5">
                            <span className="font-sans text-sm font-medium text-primary">{macro.label}</span>
                            <div className="flex items-baseline gap-1">
                                <span className={cn(
                                    "font-mono text-sm font-bold",
                                    macro.onTarget ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                                )}>
                                    {macro.value}g
                                </span>
                                {macro.target > 0 && (
                                    <span className="font-mono text-sm text-primary/40">/ {macro.target}g</span>
                                )}
                            </div>
                        </div>
                        {macro.target > 0 && (
                            <div className="relative h-2.5 bg-primary/8 dark:bg-white/8 rounded-full overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                    style={{
                                        width: `${Math.min(100, macro.pct)}%`,
                                        backgroundColor: macro.color
                                    }}
                                />
                                {/* Target marker at 100% */}
                                <div className="absolute top-0 bottom-0 w-0.5 bg-primary/25 dark:bg-white/25" style={{ left: '100%' }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ChartInsight text={insightText} />
        </section>
    );
}
