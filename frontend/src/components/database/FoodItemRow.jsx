export default function FoodItemRow({ item, onEdit }) {
    return (
        <button
            onClick={onEdit}
            className="w-full flex items-center justify-between p-3 hover:bg-primary/5 active:bg-primary/8 transition-colors text-left"
        >
            <div className="flex-1 min-w-0 pr-3">
                <span className="font-sans text-sm text-primary block truncate">{item.name}</span>
                {item.quantity && (
                    <span className="font-mono text-xs text-primary/40">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </span>
                )}
            </div>
            <div className="text-right shrink-0">
                <span className="font-mono text-sm font-bold text-primary">{Math.round(item.calories || 0)}</span>
                <div className="flex gap-1.5 mt-0.5 justify-end">
                    <span className="font-mono text-[10px] text-protein">P{Math.round(item.protein || 0)}</span>
                    <span className="font-mono text-[10px] text-carbs">C{Math.round(item.carbs || 0)}</span>
                    <span className="font-mono text-[10px] text-fat">F{Math.round(item.fat || 0)}</span>
                </div>
            </div>
        </button>
    );
}
