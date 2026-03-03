import { useMemo } from 'react';
import { cn } from '../../utils/cn';
import ChartInsight from './ChartInsight';

const MACRO_CONFIG = [
    { key: 'protein', label: 'Protein', goalKey: 'targetProtein', color: 'var(--color-protein)', bgClass: 'bg-[var(--color-protein)]' },
    { key: 'carbs', label: 'Carbs', goalKey: 'targetCarbs', color: 'var(--color-carbs)', bgClass: 'bg-[var(--color-carbs)]' },
    { key: 'fat', label: 'Fat', goalKey: 'targetFat', color: 'var(--color-fat)', bgClass: 'bg-[var(--color-fat)]' }
];

const TREND_ARROWS = { up: '\u2191', down: '\u2193', stable: '\u2192' };

export default function MacroTrends({ averages, goals, prevAverages }) {
    const macros = useMemo(() => {
        if (!averages) return [];
        return MACRO_CONFIG.map(m => {
            const avg = Math.round(averages[m.key] || 0);
            const target = goals?.[m.goalKey] || 0;
            const prevAvg = prevAverages?.[m.key] || 0;
            const diffPct = target > 0 ? Math.round(((avg - target) / target) * 100) : 0;
            const onTarget = target > 0 && Math.abs(diffPct) <= 10;
            const progress = target > 0 ? (avg / target) * 100 : 0;

            let delta, trend;
            if (prevAvg > 0) {
                delta = avg - Math.round(prevAvg);
                trend = delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable';
            } else if (target > 0) {
                delta = avg - target;
                trend = delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable';
            } else {
                delta = 0;
                trend = 'stable';
            }

            return { ...m, avg, target, delta, trend, onTarget, diffPct, progress };
        });
    }, [averages, goals, prevAverages]);

    const score = useMemo(() => {
        const onTargetCount = macros.filter(m => m.onTarget).length;
        if (onTargetCount === 3) return { label: 'On Track', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
        if (onTargetCount === 2) return { label: 'Almost', className: 'bg-primary/10 text-primary dark:bg-white/10' };
        if (onTargetCount === 1) return { label: 'Getting There', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        return { label: 'Needs Work', className: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
    }, [macros]);

    const insightText = useMemo(() => {
        if (!goals || !averages) return null;

        let worstMacro = null;
        let worstAbsDiff = 0;
        for (const m of macros) {
            if (m.target <= 0) continue;
            const absDiff = Math.abs(m.diffPct);
            if (absDiff > worstAbsDiff) {
                worstAbsDiff = absDiff;
                worstMacro = m;
            }
        }

        if (!worstMacro || worstAbsDiff <= 15) {
            return `Macros are well balanced \u2014 protein, carbs, and fat are all close to target.`;
        }

        if (worstMacro.diffPct > 10) {
            const tips = {
                fat: 'lighter cooking methods or smaller cheese portions would help',
                carbs: 'swapping refined carbs for veggies or protein would help',
                protein: 'you could scale back protein shakes or lean meat portions'
            };
            return `${worstMacro.label} is averaging ${worstAbsDiff}% over target \u2014 ${tips[worstMacro.key] || 'adjusting portions would help'}.`;
        }

        const tips = {
            protein: 'adding eggs or Greek yogurt at breakfast would close most of this gap',
            carbs: 'adding whole grains or fruit could help fill this gap',
            fat: 'nuts, avocado, or olive oil could help fill this gap'
        };
        return `${worstMacro.label} is averaging ${worstAbsDiff}% below target \u2014 ${tips[worstMacro.key] || 'adjusting portions would help'}.`;
    }, [averages, goals, macros]);

    const hasData = macros.some(m => m.avg > 0);

    if (!hasData) {
        return (
            <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
                <h3 className="type-section-header mb-4">Macros</h3>
                <div className="flex items-center justify-center h-[120px] type-secondary">
                    No macro data yet
                </div>
            </section>
        );
    }

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            <div className="flex items-center gap-2.5 mb-5">
                <h3 className="type-section-header">Macros</h3>
                <span className={cn("font-mono text-sm font-bold px-2.5 py-0.5 rounded-full", score.className)}>
                    {score.label}
                </span>
            </div>

            <div className="flex flex-col gap-4">
                {macros.map(macro => (
                    <div key={macro.key}>
                        {/* Label row: name + avg/target on left, delta on right */}
                        <div className="flex items-baseline justify-between mb-1.5">
                            <div className="flex items-baseline gap-1.5">
                                <span className="font-sans text-sm font-medium text-primary">
                                    {macro.label}
                                </span>
                                <span className="font-mono text-sm text-primary/70">
                                    {macro.avg}g
                                    {macro.target > 0 && (
                                        <span className="text-primary/40"> / {macro.target}g</span>
                                    )}
                                </span>
                            </div>

                            {macro.delta !== 0 ? (
                                <div className="flex items-center gap-1">
                                    <span className={cn(
                                        "font-mono text-xs font-bold",
                                        macro.trend === 'up' ? "text-emerald-600 dark:text-emerald-400"
                                            : macro.trend === 'down' ? "text-amber-600 dark:text-amber-400"
                                                : "text-primary/40"
                                    )}>
                                        {TREND_ARROWS[macro.trend]} {macro.delta > 0 ? '+' : ''}{macro.delta}g
                                    </span>
                                </div>
                            ) : (
                                <span className="font-mono text-xs text-primary/40">
                                    {TREND_ARROWS.stable}
                                </span>
                            )}
                        </div>

                        {/* Progress bar */}
                        {macro.target > 0 ? (
                            <div className={cn(
                                "w-full bg-primary/5 rounded-full h-3 relative overflow-hidden",
                                macro.progress > 100 && "shadow-[0_0_8px_rgba(40,65,54,0.3)] dark:shadow-[0_0_8px_rgba(226,229,225,0.25)]"
                            )}>
                                {macro.progress <= 100 ? (
                                    <div
                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                        style={{
                                            width: `${Math.min(100, macro.progress)}%`,
                                            backgroundColor: macro.color
                                        }}
                                    />
                                ) : (
                                    <div className="flex h-full w-full">
                                        <div
                                            className="h-full rounded-l-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${(macro.target / macro.avg) * 100}%`,
                                                backgroundColor: macro.color
                                            }}
                                        />
                                        <div className="w-0.5 h-full bg-primary/30 shrink-0" />
                                        <div
                                            className="h-full rounded-r-full transition-all duration-1000 ease-out"
                                            style={{
                                                flex: 1,
                                                backgroundColor: macro.color
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full bg-primary/5 rounded-full h-3">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: '100%',
                                        backgroundColor: macro.color,
                                        opacity: 0.3
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <ChartInsight text={insightText} />
        </section>
    );
}
