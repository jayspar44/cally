import { cn } from '../../utils/cn';

function BadgeCard({ badge, earned }) {
    const dateStr = earned && badge.earnedAt
        ? new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    return (
        <div className={cn(
            "w-28 flex-shrink-0 rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5",
            earned
                ? "bg-white dark:bg-surface border-border/50 shadow-sm"
                : "bg-primary/[0.03] dark:bg-white/[0.03] border-dashed border-primary/25"
        )}>
            {/* Icon */}
            <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-xl",
                earned
                    ? "bg-accent/15"
                    : "border-2 border-dashed border-primary/20"
            )}>
                <span className={cn(!earned && "opacity-40")}>{badge.icon}</span>
            </div>

            {/* Name */}
            <span className={cn(
                "font-sans text-sm font-medium leading-tight",
                earned ? "text-primary" : "text-primary/50"
            )}>
                {badge.name}
            </span>

            {/* Status — pinned to bottom */}
            {earned && dateStr && (
                <span className="font-mono text-sm text-primary/45 mt-auto">{dateStr}</span>
            )}
            {!earned && badge.percentage != null && (
                <div className="w-full mt-auto">
                    <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent/60 rounded-full transition-all"
                            style={{ width: `${badge.percentage}%` }}
                        />
                    </div>
                    <span className="font-mono text-sm text-primary/45 mt-0.5 block">
                        {badge.current}/{badge.target}
                    </span>
                </div>
            )}
        </div>
    );
}

export default function BadgesSection({ badgeData, loading }) {
    if (loading) {
        return (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-28 h-32 flex-shrink-0 rounded-2xl bg-primary/5 animate-pulse" />
                ))}
            </div>
        );
    }

    const earned = badgeData?.earned || [];
    const progress = badgeData?.progress || [];
    const hasBadges = earned.length > 0 || progress.length > 0;

    if (!hasBadges) {
        return (
            <div className="text-center py-8 bg-primary/[0.03] dark:bg-white/[0.03] rounded-2xl border border-dashed border-primary/15">
                <p className="font-sans text-sm text-primary/50">Start logging to earn badges</p>
            </div>
        );
    }

    return (
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
            {earned.map(badge => (
                <BadgeCard key={badge.badgeId} badge={badge} earned />
            ))}
            {progress.map(badge => (
                <BadgeCard key={badge.badgeId} badge={badge} earned={false} />
            ))}
        </div>
    );
}
