import { cn } from '../../utils/cn';
import { HiArrowTrendingUp, HiArrowTrendingDown } from 'react-icons/hi2';

function StatCard({ label, value, unit, delta, deltaLabel, positive }) {
    const showDelta = delta != null && delta !== 0;
    const isPositive = positive != null ? positive : delta < 0;

    return (
        <div className="flex-1 bg-white/80 dark:bg-surface/80 rounded-2xl p-3.5 border border-border/40 shadow-sm">
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary/45 font-bold block mb-1">
                {label}
            </span>
            <div className="flex items-baseline gap-1">
                <span className="font-serif font-bold text-xl text-primary leading-none">{value}</span>
                {unit && <span className="font-mono text-[10px] text-primary/40">{unit}</span>}
            </div>
            {showDelta && (
                <div className={cn(
                    "flex items-center gap-1 mt-1.5",
                    isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                )}>
                    {delta > 0 ? (
                        <HiArrowTrendingUp className="w-3 h-3" />
                    ) : (
                        <HiArrowTrendingDown className="w-3 h-3" />
                    )}
                    <span className="font-mono text-[10px] font-medium">
                        {delta > 0 ? '+' : ''}{delta} {deltaLabel || ''}
                    </span>
                </div>
            )}
        </div>
    );
}

export default function SummaryStats({ averages, goals, calorieDelta, daysOnTarget, streak }) {
    return (
        <div className="flex gap-2.5">
            <StatCard
                label="Avg Cals"
                value={Math.round(averages?.calories || 0)}
                delta={calorieDelta}
                deltaLabel="vs last wk"
                positive={calorieDelta != null ? Math.abs(averages?.calories + calorieDelta - (goals?.targetCalories || 2000)) > Math.abs(averages?.calories - (goals?.targetCalories || 2000)) : null}
            />
            <StatCard
                label="On Target"
                value={daysOnTarget || 0}
                unit="days"
            />
            <StatCard
                label="Streak"
                value={streak || 0}
                unit="days"
            />
        </div>
    );
}
