import { useState } from 'react';
import { ChevronDown, Utensils } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function MealItem({ meal }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="group transition-colors hover:bg-primary/5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center px-5 py-4 text-left outline-none"
            >
                {/* Icon */}
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mr-3 transition-colors",
                    "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white"
                )}>
                    <Utensils className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="type-section-header capitalize">
                            {meal.meal}
                        </span>
                        <span className="type-value">
                            {Math.round(meal.totalCalories)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="type-secondary truncate pr-4">
                            {meal.description || 'No description'}
                        </p>
                        <ChevronDown className={cn(
                            "w-4 h-4 text-primary/40 transition-transform duration-300",
                            expanded && "rotate-180"
                        )} />
                    </div>
                </div>
            </button>

            {/* Expanded Details */}
            <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out bg-primary/5",
                expanded ? "max-h-[32rem] opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="px-5 pb-4 pt-2 space-y-3">
                    <div className="h-px w-full bg-border/50 mb-3" />
                    {meal.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm">
                            <div className="flex-1 pr-4">
                                <span className="font-mono text-primary/80 block">
                                    {item.name}
                                </span>
                                <span className="type-caption">
                                    {item.quantity} {item.unit}
                                </span>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="font-mono font-medium text-primary/80 block">
                                    {Math.round(item.calories)} cal
                                </span>
                                <div className="flex gap-2 mt-0.5 justify-end">
                                    <span className="font-mono text-[10px] text-protein/65">P {Math.round(item.protein || 0)}g</span>
                                    <span className="font-mono text-[10px] text-carbs/80">C {Math.round(item.carbs || 0)}g</span>
                                    <span className="font-mono text-[10px] text-fat/80">F {Math.round(item.fat || 0)}g</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
