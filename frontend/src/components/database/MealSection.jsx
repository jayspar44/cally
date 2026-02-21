import FoodItemRow from './FoodItemRow';

export default function MealSection({ meal, items, totalCalories, onEditItem }) {
    return (
        <div>
            <div className="flex items-center justify-between px-1 mb-2">
                <span className="font-serif font-bold text-base text-primary capitalize">{meal}</span>
                {items.length > 0 && (
                    <span className="font-mono font-bold text-sm text-primary">{Math.round(totalCalories)} cal</span>
                )}
            </div>
            {items.length > 0 ? (
                <div className="bg-surface rounded-xl border border-border/50 divide-y divide-border/30 overflow-hidden shadow-sm">
                    {items.map(item => (
                        <FoodItemRow key={item.id} item={item} onEdit={() => onEditItem(item)} />
                    ))}
                </div>
            ) : (
                <div className="bg-surface/50 rounded-xl border border-dashed border-border/30 p-4 text-center">
                    <span className="font-sans text-sm text-primary/30">No {meal} logged</span>
                </div>
            )}
        </div>
    );
}
