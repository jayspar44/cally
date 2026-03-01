import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/services';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { Sparkles, Plus, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '../utils/cn';
import MacroCard from '../components/ui/MacroCard';
import MealItem from '../components/ui/MealItem';

// Module-level greeting cache (survives component remounts)
const GREETING_TTL = 30 * 60 * 1000; // 30 minutes
let greetingCache = { data: null, timestamp: 0 };

export function invalidateGreetingCache() {
  greetingCache = { data: null, timestamp: 0 };
}

// Invalidate cache on food changes even when Home is unmounted (registered once at module load)
window.addEventListener('food-log-changed', invalidateGreetingCache);

const getPacingText = (currentCalories, targetCalories) => {
  const now = new Date();
  const hour = now.getHours();
  const wakingHoursElapsed = Math.max(0, Math.min(16, hour - 7));
  const expectedByNow = Math.round((wakingHoursElapsed / 16) * targetCalories);

  if (currentCalories === 0) return null;
  const diff = currentCalories - expectedByNow;
  if (Math.abs(diff) < 100) return 'Right on pace for this time of day';
  if (diff > 0) return `~${Math.abs(diff)} cal ahead of typical pace`;
  return `~${Math.abs(diff)} cal behind typical pace`;
};

const getExpectedProgress = () => {
  const hour = new Date().getHours();
  const wakingHoursElapsed = Math.max(0, Math.min(16, hour - 7));
  return (wakingHoursElapsed / 16) * 100;
};

const getCtaLabel = (meals) => {
  const hour = new Date().getHours();
  const loggedMeals = new Set((meals || []).map(m => m.meal));

  if (hour >= 6 && hour < 11 && !loggedMeals.has('breakfast')) return 'Log breakfast';
  if (hour >= 11 && hour < 15 && !loggedMeals.has('lunch')) return 'Log lunch';
  if (hour >= 15 && hour < 17 && !loggedMeals.has('snack') && loggedMeals.has('lunch')) return 'Add a snack';
  if (hour >= 17 && hour < 22 && !loggedMeals.has('dinner')) return 'Log dinner';
  return 'Log something';
};

export default function Home() {
  const navigate = useNavigate();
  const { biometrics, profileLoading } = useUserPreferences();
  const needsOnboarding = !profileLoading && (!biometrics || !biometrics.weight);
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState(greetingCache.data);
  const [greetingLoading, setGreetingLoading] = useState(!greetingCache.data);
  const greetingFetched = useRef(false);

  const fetchGreeting = useCallback((force = false) => {
    const now = Date.now();
    if (!force && greetingCache.data && (now - greetingCache.timestamp) < GREETING_TTL) {
      setGreeting(greetingCache.data);
      setGreetingLoading(false);
      return;
    }

    setGreetingLoading(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    api.getHomeGreeting(timezone)
      .then(data => {
        greetingCache = { data, timestamp: Date.now() };
        setGreeting(data);
      })
      .catch(err => logger.error('Greeting fetch failed:', err))
      .finally(() => setGreetingLoading(false));
  }, []);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const today = toDateStr();
        const data = await api.getDailySummary(today);
        setDailySummary(data);
      } catch (error) {
        logger.error('Failed to fetch daily summary:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    if (greetingFetched.current) return;
    greetingFetched.current = true;
    fetchGreeting();
  }, [fetchGreeting]);

  // Refetch greeting when food changes (cache already invalidated by module-level listener)
  useEffect(() => {
    const onFoodChange = () => fetchGreeting(true);
    window.addEventListener('food-log-changed', onFoodChange);
    return () => window.removeEventListener('food-log-changed', onFoodChange);
  }, [fetchGreeting]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <div className="type-secondary animate-pulse">Loading Kalli...</div>
      </div>
    );
  }

  const summary = dailySummary?.summary || { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
  const goals = dailySummary?.goals || { targetCalories: 2000, targetProtein: 50, targetCarbs: 250, targetFat: 65 };
  const progress = dailySummary?.progress || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remainingCalories = Math.round(goals.targetCalories - summary.totalCalories);

  const pacingText = getPacingText(summary.totalCalories, goals.targetCalories);
  const expectedProgress = getExpectedProgress();
  const isOffTrack = (prog) => prog < expectedProgress * 0.6;

  return (
    <div className="space-y-6 pb-8">

      {/* Onboarding Card */}
      {needsOnboarding && (
        <section className="card-base relative overflow-hidden">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-accent/10 rounded-[1.75rem] flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-accent" />
            </div>
            <h2 className="type-page-title mb-2">Get Personalized Coaching</h2>
            <p className="type-secondary max-w-xs leading-snug mb-5">
              Share a few details and Kalli will calculate your ideal calorie and macro targets using science-backed formulas.
            </p>
            <button
              onClick={() => navigate('/chat', { state: { triggerOnboarding: true } })}
              className="px-8 py-3 bg-accent text-white font-sans font-semibold rounded-2xl shadow-sm hover:bg-accent/90 transition-all active:scale-95"
            >
              Get Started
            </button>
          </div>
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        </section>
      )}

      {/* AI Greeting */}
      {greetingLoading ? (
        <div className="card-accent h-16 animate-pulse" />
      ) : greeting?.greeting ? (
        <div className="card-accent relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="font-serif font-bold text-sm text-accent">Coach Kalli</span>
            <button
              onClick={() => fetchGreeting(true)}
              className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-accent/40 hover:text-accent transition-colors"
              aria-label="Refresh greeting"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="type-body text-primary/80 leading-relaxed">
            {greeting.greeting}
          </p>
        </div>
      ) : null}

      {/* Daily Summary Card */}
      <section className="card-base relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="type-page-title mb-1">Today's Fuel</h2>
            <p className="type-secondary">Summary of your nutrition.</p>
          </div>
          <div className="text-right">
            <span className="type-value text-3xl block leading-none">
              {Math.round(summary.totalCalories)}
            </span>
            <span className="type-label tracking-widest">
              Calories
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-end text-sm font-mono text-primary/70 mb-2">
            <span>Goal: {goals.targetCalories}</span>
          </div>
          <div className={cn(
            "w-full bg-primary/5 rounded-full h-4 relative overflow-hidden",
            progress.calories > 100 && "shadow-[0_0_10px_rgba(40,65,54,0.4)] dark:shadow-[0_0_10px_rgba(226,229,225,0.35)]"
          )}>
            {progress.calories <= 100 ? (
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out bg-primary"
                style={{ width: `${Math.min(100, progress.calories)}%` }}
              />
            ) : (
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-primary rounded-l-full transition-all duration-1000 ease-out"
                  style={{ width: `${(goals.targetCalories / summary.totalCalories) * 100}%` }}
                />
                <div className="w-0.5 h-full bg-primary/30 shrink-0" />
                <div
                  className="h-full bg-primary rounded-r-full transition-all duration-1000 ease-out"
                  style={{ flex: 1 }}
                />
              </div>
            )}
          </div>
          <div className="mt-2 text-right">
            <span className={cn(
              "type-secondary",
              remainingCalories >= 0 ? "text-primary" : "text-primary font-bold"
            )}>
              {remainingCalories > 0 ? `${remainingCalories} left` : remainingCalories === 0 ? 'Goal reached' : `${Math.abs(remainingCalories)} over`}
            </span>
          </div>
          {pacingText && (
            <p className="type-caption mt-1">{pacingText}</p>
          )}
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-4">
          <MacroCard
            label="Protein"
            current={summary.totalProtein}
            target={goals.targetProtein}
            progress={progress.protein}
            color="protein"
            compact={!isOffTrack(progress.protein)}
          />
          <MacroCard
            label="Carbs"
            current={summary.totalCarbs}
            target={goals.targetCarbs}
            progress={progress.carbs}
            color="carbs"
            compact={!isOffTrack(progress.carbs)}
          />
          <MacroCard
            label="Fat"
            current={summary.totalFat}
            target={goals.targetFat}
            progress={progress.fat}
            color="fat"
            compact={!isOffTrack(progress.fat)}
          />
        </div>

        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Weekly Focus Tracker */}
      {greeting?.activeFocus && (
        <Link to="/chat" className="block card-base">
          <div className="flex items-center justify-between">
            <div>
              <p className="type-label mb-1">This Week's Focus</p>
              <p className="type-body font-medium">{greeting.activeFocus}</p>
              {greeting.focusProgress && (
                <p className="type-secondary mt-1">{greeting.focusProgress}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-primary/30" />
          </div>
        </Link>
      )}

      {/* Meals Feed */}
      {dailySummary?.meals && dailySummary.meals.length > 0 && (
        <section className="space-y-4">
          <h3 className="type-label px-4">Today's Meals</h3>
          <div className="bg-surface rounded-[2rem] shadow-card overflow-hidden divide-y divide-border">
            {dailySummary.meals.map((meal, index) => (
              <MealItem key={index} meal={meal} />
            ))}
          </div>
        </section>
      )}

      {/* Log Food CTA */}
      <button
        onClick={() => {
          navigate('/chat');
          setTimeout(() => window.dispatchEvent(new CustomEvent('ghost-keyboard')), 100);
        }}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-white font-sans font-semibold text-sm shadow-sm hover:bg-accent/90 active:scale-[0.98] transition-all"
      >
        <Plus className="w-4.5 h-4.5" />
        {getCtaLabel(dailySummary?.meals)}
      </button>
    </div>
  );
}


