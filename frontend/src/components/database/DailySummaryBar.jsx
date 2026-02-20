import { cn } from '../../utils/cn';

export default function DailySummaryBar({ summary, goals, progress }) {
    if (!summary) return null;

    const totalCal = Math.round(summary.totalCalories || 0);
    const remaining = Math.round((goals?.targetCalories || 2000) - totalCal);
    const pct = Math.min(100, progress?.calories || 0);

    return (
        <div className="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm">
            <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-bold text-2xl text-primary">{totalCal}</span>
                    <span className="font-sans text-xs text-primary/50 uppercase tracking-wider">cal</span>
                </div>
                <div className="flex gap-3 text-xs font-mono">
                    <span className="text-protein font-bold">{Math.round(summary.totalProtein || 0)}g P</span>
                    <span className="text-carbs font-bold">{Math.round(summary.totalCarbs || 0)}g C</span>
                    <span className="text-fat font-bold">{Math.round(summary.totalFat || 0)}g F</span>
                </div>
            </div>
            <div className={cn(
                "w-full bg-primary/5 rounded-full h-2.5 overflow-hidden",
                pct > 100 && "shadow-[0_0_8px_rgba(40,65,54,0.3)]"
            )}>
                <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
            </div>
            <div className="flex justify-between mt-1.5 text-xs font-mono text-primary/50">
                <span>{remaining > 0 ? `${remaining} left` : remaining === 0 ? 'Goal reached' : `${Math.abs(remaining)} over`}</span>
                <span>{goals?.targetCalories || 2000} goal</span>
            </div>
        </div>
    );
}
