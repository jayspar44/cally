import FoodItemRow from './FoodItemRow';

const MEAL_ICONS = { breakfast: '\u{1F305}', lunch: '\u2600\uFE0F', dinner: '\u{1F319}', snack: '\u{1F37F}' };

export default function MealSection({ meal, items, totalCalories, onEditItem }) {
    return (
        <div>
            <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-base">{MEAL_ICONS[meal] || '\u{1F37D}\uFE0F'}</span>
                    <span className="font-serif font-bold text-base text-primary capitalize">{meal}</span>
                </div>
                {items.length > 0 && (
                    <span className="font-mono font-bold text-sm text-primary">{Math.round(totalCalories)} cal</span>
                )}
            </div>
            {items.length > 0 ? (
                <div className="bg-surface rounded-2xl border border-border/50 divide-y divide-border/30 overflow-hidden shadow-sm">
                    {items.map(item => (
                        <FoodItemRow key={item.id} item={item} onEdit={() => onEditItem(item)} />
                    ))}
                </div>
            ) : (
                <div className="bg-surface/50 rounded-2xl border border-dashed border-border/30 p-4 text-center">
                    <span className="font-sans text-sm text-primary/30">No {meal} logged</span>
                </div>
            )}
        </div>
    );
}
