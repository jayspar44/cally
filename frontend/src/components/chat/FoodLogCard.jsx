import { cn } from '../../utils/cn';
import { Pencil, Trash2 } from 'lucide-react';

export default function FoodLogCard({ foodLog, onEdit, onDelete }) {
    if (!foodLog) return null;

    const { meal, items, totalCalories, totalProtein, totalCarbs, totalFat } = foodLog;

    return (
        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm my-2">
            {/* Header */}
            <div className="px-4 py-3 bg-primary/5 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-primary capitalize">
                        {meal}
                    </span>
                </div>
                <span className="font-mono font-bold text-primary">
                    {Math.round(totalCalories)} cal
                </span>
            </div>

            {/* Items */}
            <div className="px-4 py-3 space-y-2">
                {items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-start text-xs">
                        <div className="flex-1 pr-2">
                            <span className="font-mono text-primary/90 block">
                                {item.name}
                            </span>
                            <span className="font-sans text-primary/50">
                                {item.quantity} {item.unit}
                            </span>
                        </div>
                        <span className="font-mono text-primary/70">
                            {Math.round(item.calories)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Macros */}
            <div className="px-4 py-2 bg-primary/2 border-t border-border/50">
                <div className="flex justify-between text-[10px] font-mono tracking-tight">
                    <MacroStat label="PRO" value={totalProtein} color="text-primary" />
                    <MacroStat label="CARB" value={totalCarbs} color="text-accent" />
                    <MacroStat label="FAT" value={totalFat} color="text-amber-700" />
                </div>
            </div>

            {/* Actions */}
            {(onEdit || onDelete) && (
                <div className="px-2 py-1 border-t border-border/50 flex justify-end gap-1 bg-surface">
                    {onEdit && (
                        <button
                            onClick={() => onEdit(foodLog)}
                            className="p-1.5 text-primary/40 hover:text-accent rounded-lg transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(foodLog.id)}
                            className="p-1.5 text-primary/40 hover:text-red-500 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            )}
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
