import { useState } from 'react';
import { ChevronDown, Utensils } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function MealItem({ meal }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="group transition-colors hover:bg-primary/5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center p-6 text-left outline-none"
            >
                {/* Icon */}
                <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mr-4 transition-colors",
                    "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white"
                )}>
                    <Utensils className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="font-serif font-bold text-lg text-primary capitalize">
                            {meal.meal}
                        </span>
                        <span className="font-mono font-bold text-primary">
                            {Math.round(meal.totalCalories)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className="font-sans text-sm text-primary/60 truncate pr-4">
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
                expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="px-6 pb-6 pt-2 space-y-3">
                    <div className="h-px w-full bg-border/50 mb-3" />
                    {meal.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-sm">
                            <div className="flex-1 pr-4">
                                <span className="font-mono text-primary/80 block">
                                    {item.name}
                                </span>
                                <span className="font-sans text-xs text-primary/50">
                                    {item.quantity} {item.unit}
                                </span>
                            </div>
                            <span className="font-mono font-medium text-primary/80">
                                {Math.round(item.calories)} cal
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
