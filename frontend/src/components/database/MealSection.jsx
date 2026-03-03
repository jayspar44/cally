import FoodItemRow from './FoodItemRow';

export default function MealSection({ meal, items, totalCalories, onEditItem }) {
    return (
        <div>
            <div className="flex items-center justify-between px-1 mb-2">
                <span className="type-section-header capitalize">{meal}</span>
                {items.length > 0 && (
                    <span className="type-value text-sm">{Math.round(totalCalories)} cal</span>
                )}
            </div>
            {items.length > 0 ? (
                <div className="bg-surface rounded-2xl border border-border/50 divide-y divide-border/30 overflow-hidden shadow-sm">
                    {items.map(item => (
                        <FoodItemRow key={item.id} item={item} onEdit={() => onEditItem(item)} />
                    ))}
                </div>
            ) : (
                <div className="bg-surface/50 rounded-2xl border border-dashed border-border/30 p-5 text-center">
                    <span className="type-secondary">No {meal} logged</span>
                </div>
            )}
        </div>
    );
}
