import { useState } from 'react';
import { cn } from '../../utils/cn';

const TIER_COLORS = {
    bronze: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    silver: 'bg-gray-100 text-gray-600 dark:bg-gray-700/30 dark:text-gray-300',
    gold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    platinum: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    diamond: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
};

function BadgeCard({ badge, earned, onClick }) {
    const dateStr = earned && badge.earnedAt
        ? new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    return (
        <div
            onClick={onClick}
            className={cn(
                "w-28 flex-shrink-0 rounded-2xl border p-3 flex flex-col items-center text-center gap-1.5 cursor-pointer active:scale-95 transition-transform",
                earned
                    ? "bg-accent/[0.06] dark:bg-accent/[0.08] border-accent/25 shadow-sm"
                    : "bg-primary/[0.03] dark:bg-white/[0.03] border-dashed border-primary/25"
            )}
        >
            {/* Icon */}
            <div className="relative">
                <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center text-xl",
                    earned
                        ? "bg-accent/15"
                        : "border-2 border-dashed border-primary/20"
                )}>
                    <span className={cn(!earned && "opacity-40")}>{badge.icon}</span>
                </div>
                {earned && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-white dark:ring-surface">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
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

function BadgeDetailModal({ badge, earned, onClose }) {
    if (!badge) return null;

    const dateStr = earned && badge.earnedAt
        ? new Date(badge.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom sm:zoom-in duration-200 sm:m-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header with close */}
                <div className="flex justify-end p-4 pb-0">
                    <button onClick={onClose} className="text-primary/50 hover:text-primary/80 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col items-center text-center gap-3">
                    {/* Large icon */}
                    <div className="relative">
                        <div className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center text-4xl",
                            earned ? "bg-accent/15" : "border-2 border-dashed border-primary/20"
                        )}>
                            <span className={cn(!earned && "opacity-40")}>{badge.icon}</span>
                        </div>
                        {earned && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-surface">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <h3 className="font-serif font-bold text-lg text-primary">{badge.name}</h3>

                    {/* Tier badge */}
                    {badge.tier && (
                        <span className={cn(
                            "font-mono text-xs font-bold px-2.5 py-0.5 rounded-full capitalize",
                            TIER_COLORS[badge.tier] || 'bg-primary/10 text-primary'
                        )}>
                            {badge.tier}
                        </span>
                    )}

                    {/* Description */}
                    <p className="font-sans text-sm text-primary/70 leading-relaxed">
                        {badge.description}
                    </p>

                    {/* Progress or earned date */}
                    {earned && dateStr ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-mono text-sm font-medium">Unlocked {dateStr}</span>
                        </div>
                    ) : badge.percentage != null ? (
                        <div className="w-full mt-1">
                            <div className="h-2.5 bg-primary/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent rounded-full transition-all"
                                    style={{ width: `${badge.percentage}%` }}
                                />
                            </div>
                            <span className="font-mono text-sm text-primary/50 mt-1.5 block">
                                {badge.current} / {badge.target} ({badge.percentage}%)
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function BadgesSection({ badgeData, loading }) {
    const [selectedBadge, setSelectedBadge] = useState(null);

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
        <>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                {earned.map(badge => (
                    <BadgeCard
                        key={badge.badgeId}
                        badge={badge}
                        earned
                        onClick={() => setSelectedBadge({ badge, earned: true })}
                    />
                ))}
                {progress.map(badge => (
                    <BadgeCard
                        key={badge.badgeId}
                        badge={badge}
                        earned={false}
                        onClick={() => setSelectedBadge({ badge, earned: false })}
                    />
                ))}
            </div>

            <BadgeDetailModal
                badge={selectedBadge?.badge}
                earned={selectedBadge?.earned}
                onClose={() => setSelectedBadge(null)}
            />
        </>
    );
}
