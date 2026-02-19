import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/services';
import { logger } from '../utils/logger';
import { toDateStr } from '../utils/dateUtils';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import MacroCard from '../components/ui/MacroCard';
import MealItem from '../components/ui/MealItem';

export default function Home() {
  const navigate = useNavigate();
  const { biometrics, profileLoading } = useUserPreferences();
  const needsOnboarding = !profileLoading && (!biometrics || !biometrics.weight);
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <div className="font-serif text-primary/60 animate-pulse">Loading Kalli...</div>
      </div>
    );
  }

  const summary = dailySummary?.summary || { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
  const goals = dailySummary?.goals || { targetCalories: 2000, targetProtein: 50, targetCarbs: 250, targetFat: 65 };
  const progress = dailySummary?.progress || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remainingCalories = Math.round(goals.targetCalories - summary.totalCalories);

  return (
    <div className="space-y-6 pb-8">

      {/* Onboarding Card */}
      {needsOnboarding && (
        <section className="bg-surface rounded-[2rem] p-6 shadow-card relative overflow-hidden">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-accent/10 rounded-[1.75rem] flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-accent" />
            </div>
            <h2 className="font-serif font-black text-2xl text-primary mb-2">Get Personalized Coaching</h2>
            <p className="font-sans text-primary/60 text-sm max-w-xs leading-snug mb-5">
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

      {/* Daily Summary Card */}
      <section className="bg-surface rounded-[2rem] p-6 shadow-card relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="font-serif font-black text-2xl text-primary mb-1">Today's Fuel</h2>
            <p className="font-sans text-primary/70 text-sm">Summary of your nutrition.</p>
          </div>
          <div className="text-right">
            <span className="font-mono font-bold text-3xl text-primary block leading-none">
              {Math.round(summary.totalCalories)}
            </span>
            <span className="font-sans text-xs text-primary/55 uppercase tracking-widest font-semibold">
              Calories
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-end text-sm font-mono text-primary/70 mb-2">
            <span>Goal: {goals.targetCalories}</span>
          </div>
          <div className="w-full bg-primary/5 rounded-full h-4 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out bg-primary",
                progress.calories > 100 && "shadow-[0_0_12px_var(--color-primary)]"
              )}
              style={{ width: `${Math.min(100, progress.calories)}%` }}
            />
          </div>
          <div className="mt-2 text-right">
            <span className={cn(
              "font-sans text-sm font-medium",
              remainingCalories >= 0 ? "text-primary" : "text-primary font-bold"
            )}>
              {remainingCalories > 0 ? `${remainingCalories} left` : remainingCalories === 0 ? 'Goal reached' : `${Math.abs(remainingCalories)} over`}
            </span>
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-4">
          <MacroCard
            label="Protein"
            current={summary.totalProtein}
            target={goals.targetProtein}
            progress={progress.protein}
            color="protein"
          />
          <MacroCard
            label="Carbs"
            current={summary.totalCarbs}
            target={goals.targetCarbs}
            progress={progress.carbs}
            color="carbs"
          />
          <MacroCard
            label="Fat"
            current={summary.totalFat}
            target={goals.targetFat}
            progress={progress.fat}
            color="fat"
          />
        </div>

        {/* Decorative background element */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Meals Feed */}
      {dailySummary?.meals && dailySummary.meals.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-serif font-bold text-xl text-primary px-4">Today's Meals</h3>
          <div className="bg-surface rounded-[2rem] shadow-card overflow-hidden divide-y divide-border">
            {dailySummary.meals.map((meal, index) => (
              <MealItem key={index} meal={meal} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


