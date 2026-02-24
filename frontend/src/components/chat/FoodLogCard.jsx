import { useState } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';

const MEAL_ORDER = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };

function groupItemsByMeal(items, fallbackMeal) {
    const groups = {};
    for (const item of items) {
        const meal = item.meal || fallbackMeal || 'snack';
        if (!groups[meal]) groups[meal] = [];
        groups[meal].push(item);
    }
    return Object.entries(groups)
        .sort(([a], [b]) => (MEAL_ORDER[a] || 5) - (MEAL_ORDER[b] || 5));
}

export default function FoodLogCard({ foodLog, onEdit, onDelete, defaultExpanded = true }) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    if (!foodLog) return null;

    const { meal, items, totalCalories, totalProtein, totalCarbs, totalFat } = foodLog;
    const isMultiMeal = meal === 'mixed';
    const mealGroups = isMultiMeal ? groupItemsByMeal(items, meal) : null;

    // Collapsed: single header row with meal + total cal + chevron
    const headerLabel = isMultiMeal
        ? `${items?.length || 0} items`
        : meal;

    return (
        <div className={cn(
            "bg-primary/5 border border-border overflow-hidden shadow-sm my-2 transition-[border-radius] duration-200",
            expanded ? 'rounded-lg' : 'rounded-2xl'
        )}>
            {/* Clickable header — always visible */}
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full px-4 py-3 flex items-center justify-between cursor-pointer select-none"
            >
                <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-primary capitalize">
                        {headerLabel}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">
                        {Math.round(totalCalories)} cal
                    </span>
                    <ChevronDown
                        className={cn(
                            'w-4 h-4 text-primary/40 transition-transform duration-200',
                            expanded && 'rotate-180'
                        )}
                    />
                </div>
            </button>

            {/* Expandable content */}
            <div
                className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out bg-surface',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
            >
                <div className="overflow-hidden bg-surface">
                    {isMultiMeal ? (
                        <>
                            {mealGroups.map(([mealName, mealItems]) => {
                                const subtotal = mealItems.reduce((sum, i) => sum + (i.calories || 0), 0);
                                return (
                                    <div key={mealName}>
                                        <div className="px-4 py-2.5 bg-primary/5 border-t border-border/50 flex items-center justify-between">
                                            <span className="font-serif font-bold text-primary capitalize text-base">
                                                {mealName}
                                            </span>
                                            <span className="font-mono font-bold text-primary text-base">
                                                {Math.round(subtotal)} cal
                                            </span>
                                        </div>
                                        <ItemsList items={mealItems} onEdit={onEdit} />
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <ItemsList items={items} onEdit={onEdit} />
                    )}

                    {/* Macros */}
                    <div className="px-4 py-2 bg-primary/2 border-t border-border/50">
                        <div className="flex justify-between text-xs font-mono tracking-tight">
                            <MacroStat label="PRO" value={totalProtein} color="text-protein" />
                            <MacroStat label="CARB" value={totalCarbs} color="text-carbs" />
                            <MacroStat label="FAT" value={totalFat} color="text-fat" />
                        </div>
                    </div>

                    {/* Actions */}
                    {onDelete && (
                        <div className="px-2 py-1 border-t border-border/50 flex justify-end gap-1 bg-surface">
                            <button
                                onClick={() => onDelete(foodLog.id)}
                                className="p-1.5 text-primary/40 hover:text-red-500 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ItemsList({ items, onEdit }) {
    return (
        <div className="px-4 py-3 space-y-2">
            {items?.map((item, index) => (
                <div key={item.id || index} className="flex justify-between items-center text-sm">
                    <div className="flex-1 pr-2">
                        <span className="font-mono text-primary/90 block">
                            {item.name}
                        </span>
                        <span className="font-sans text-xs text-primary/65">
                            {item.quantity} {item.unit}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-primary/70">
                            {Math.round(item.calories)}
                        </span>
                        {onEdit && (
                            <button
                                onClick={() => onEdit(item)}
                                className="p-1 text-primary/30 hover:text-accent rounded transition-colors"
                            >
                                <Pencil className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function MacroStat({ label, value, color }) {
    return (
        <span className={cn('font-bold', color)}>
            {label} {Math.round(value)}g
        </span>
    );
}
