import { Flame, Target } from 'lucide-react';

export default function StreakBanner({ stats, loading, nextBadge }) {
    if (loading) {
        return (
            <div className="bg-white/80 dark:bg-surface/80 rounded-2xl p-5 border border-border/40 shadow-sm animate-pulse">
                <div className="h-14 bg-primary/5 rounded-xl" />
            </div>
        );
    }

    const { currentStreak = 0, bestStreak = 0 } = stats || {};

    // State 1: New user — no logs ever
    if (currentStreak === 0 && bestStreak === 0) {
        return (
            <div className="bg-white/80 dark:bg-surface/80 rounded-2xl p-5 border border-border/40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Target className="w-6 h-6 text-primary/50" />
                    </div>
                    <div>
                        <h4 className="type-section-header">Start Your Journey</h4>
                        <p className="type-secondary">Log your first meal to begin tracking</p>
                    </div>
                </div>
            </div>
        );
    }

    // State 2: On best streak (current >= 3 and matching or exceeding best)
    if (currentStreak >= 3 && currentStreak >= bestStreak) {
        return (
            <div className="bg-accent/10 dark:bg-accent/15 rounded-2xl p-5 border border-accent/15 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Flame className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="type-value text-3xl leading-none">{currentStreak}</span>
                            <span className="type-secondary">Day Streak</span>
                        </div>
                        <p className="text-accent font-sans text-sm font-semibold mt-0.5">Personal Best!</p>
                    </div>
                </div>
                {nextBadge && (
                    <p className="type-caption mt-2">
                        {nextBadge.target - nextBadge.current} more {nextBadge.target - nextBadge.current === 1 ? 'day' : 'days'} to earn &ldquo;{nextBadge.name}&rdquo;
                    </p>
                )}
            </div>
        );
    }

    // State 3: Active streak, not best (current >= 3 but below best)
    if (currentStreak >= 3 && currentStreak < bestStreak) {
        return (
            <div className="bg-accent/10 dark:bg-accent/15 rounded-2xl p-5 border border-accent/15 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Flame className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="type-value text-3xl leading-none">{currentStreak}</span>
                            <span className="type-secondary">Day Streak</span>
                        </div>
                        <p className="type-secondary mt-0.5">Best: {bestStreak}d</p>
                    </div>
                </div>
                {nextBadge && (
                    <p className="type-caption mt-2">
                        {nextBadge.target - nextBadge.current} more {nextBadge.target - nextBadge.current === 1 ? 'day' : 'days'} to earn &ldquo;{nextBadge.name}&rdquo;
                    </p>
                )}
            </div>
        );
    }

    // State 4: Broken streak (current < 3, but has historical best)
    return (
        <div className="bg-white/80 dark:bg-surface/80 rounded-2xl p-5 border border-border/40 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Flame className="w-6 h-6 text-primary/40" />
                </div>
                <div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="type-value text-3xl leading-none">{currentStreak}d</span>
                        <span className="type-secondary">Current Streak</span>
                    </div>
                    <p className="type-secondary mt-0.5">Best: {bestStreak}d</p>
                </div>
            </div>
            {nextBadge && (
                <p className="type-caption mt-2">
                    {nextBadge.target - nextBadge.current} more {nextBadge.target - nextBadge.current === 1 ? 'day' : 'days'} to earn &ldquo;{nextBadge.name}&rdquo;
                </p>
            )}
        </div>
    );
}
