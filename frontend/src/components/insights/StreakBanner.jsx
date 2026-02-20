import { Flame, BarChart3, Target, Scale } from 'lucide-react';

function SecondaryStreaks({ calorieStreak, macroStreak }) {
    const bothZero = calorieStreak === 0 && macroStreak === 0;

    if (bothZero) {
        return (
            <div className="mt-3 pt-3 border-t border-dashed border-primary/10">
                <p className="font-sans text-sm text-primary/60 text-center">
                    <Target className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                    Hit your calorie or macro target to start a streak
                </p>
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-dashed border-primary/10 flex items-center gap-6">
            <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-primary/40" />
                {calorieStreak > 0 ? (
                    <>
                        <span className="font-mono text-sm font-bold text-primary">{calorieStreak}d</span>
                        <span className="font-sans text-sm text-primary/50">Calories</span>
                    </>
                ) : (
                    <>
                        <span className="font-mono text-sm font-bold text-primary/30">--</span>
                        <span className="font-sans text-sm text-primary/30">Calories</span>
                    </>
                )}
            </div>
            <div className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-primary/40" />
                {macroStreak > 0 ? (
                    <>
                        <span className="font-mono text-sm font-bold text-primary">{macroStreak}d</span>
                        <span className="font-sans text-sm text-primary/50">Macros</span>
                    </>
                ) : (
                    <>
                        <span className="font-mono text-sm font-bold text-primary/30">--</span>
                        <span className="font-sans text-sm text-primary/30">Macros</span>
                    </>
                )}
            </div>
        </div>
    );
}

export default function StreakBanner({ stats, loading }) {
    if (loading) {
        return (
            <div className="bg-white/80 dark:bg-surface/80 rounded-2xl p-4 border border-border/40 shadow-sm animate-pulse">
                <div className="h-14 bg-primary/5 rounded-xl" />
            </div>
        );
    }

    const { currentStreak = 0, bestStreak = 0, calorieStreak = 0, macroStreak = 0 } = stats || {};
    const hasLogs = currentStreak > 0 || bestStreak > 0;

    // State C: New User
    if (!hasLogs) {
        return (
            <div className="bg-white/80 dark:bg-surface/80 rounded-2xl p-4 border border-border/40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Target className="w-6 h-6 text-primary/50" />
                    </div>
                    <div>
                        <h4 className="font-serif font-bold text-base text-primary">Start Your Journey</h4>
                        <p className="font-sans text-sm text-primary/60">Log your first meal to begin tracking</p>
                    </div>
                </div>
            </div>
        );
    }

    // State A: Active Streak (>= 3 days)
    if (currentStreak >= 3) {
        return (
            <div className="bg-accent/10 dark:bg-accent/15 rounded-2xl p-4 border border-accent/15 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Flame className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-mono font-bold text-3xl text-primary leading-none">{currentStreak}</span>
                            <span className="font-sans text-sm font-medium text-primary/80">Day Streak</span>
                        </div>
                        <p className="font-sans text-sm text-primary/60 mt-0.5">Keep it going!</p>
                    </div>
                </div>
                <SecondaryStreaks calorieStreak={calorieStreak} macroStreak={macroStreak} />
            </div>
        );
    }

    // State B: No Active Streak (< 3 days, but has logged before)
    return (
        <div className="bg-white/80 dark:bg-surface/80 rounded-2xl p-4 border border-border/40 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/8 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-primary/70" />
                </div>
                <div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="font-mono font-bold text-3xl text-primary leading-none">{bestStreak}d</span>
                        <span className="font-sans text-sm font-medium text-primary/80">Best Streak</span>
                    </div>
                    <p className="font-sans text-sm text-primary/60 mt-0.5">Log daily to build a new one</p>
                </div>
            </div>
            <SecondaryStreaks calorieStreak={calorieStreak} macroStreak={macroStreak} />
        </div>
    );
}
