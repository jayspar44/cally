import { useState, useEffect } from 'react';
import { api } from '../api/services';
import { logger } from '../utils/logger';
import MacroCard from '../components/ui/MacroCard';
import MealItem from '../components/ui/MealItem';

export default function Home() {
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
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
        <div className="font-serif text-primary/60 animate-pulse">Loading Cally...</div>
      </div>
    );
  }

  const summary = dailySummary?.summary || { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
  const goals = dailySummary?.goals || { targetCalories: 2000, targetProtein: 150, targetCarbs: 200, targetFat: 65 };
  const progress = dailySummary?.progress || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remainingCalories = Math.round(goals.targetCalories - summary.totalCalories);

  return (
    <div className="space-y-8 pb-8">

      {/* Daily Summary Card */}
      <section className="bg-surface rounded-[2.5rem] p-8 shadow-card relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="font-serif font-black text-3xl text-primary mb-1">Today's Fuel</h2>
            <p className="font-sans text-primary/60 text-sm">Summary of your nutrition.</p>
          </div>
          <div className="text-right">
            <span className="font-mono font-bold text-4xl text-primary block leading-none">
              {Math.round(summary.totalCalories)}
            </span>
            <span className="font-sans text-xs text-primary/40 uppercase tracking-widest font-semibold">
              Calories
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-mono text-primary/60 mb-2">
            <span>0</span>
            <span>Goal: {goals.targetCalories}</span>
          </div>
          <div className="w-full bg-primary/5 rounded-full h-4 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, progress.calories)}%` }}
            />
          </div>
          <div className="mt-2 text-right">
            <span className="font-sans text-sm font-medium text-accent">
              {remainingCalories > 0 ? `${remainingCalories} left` : `${Math.abs(remainingCalories)} over`}
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
          <h3 className="font-serif font-bold text-xl text-primary px-4">Recent Meals</h3>
          <div className="bg-surface rounded-[2.5rem] shadow-card overflow-hidden divide-y divide-border">
            {dailySummary.meals.map((meal, index) => (
              <MealItem key={index} meal={meal} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


