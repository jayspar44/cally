import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseLocalDate, toDateStr, isToday } from '../../utils/dateUtils';
import { cn } from '../../utils/cn';

export default function DateNavigator({ selectedDate, onDateChange }) {
    const dateInputRef = useRef(null);
    const isTodayDate = isToday(selectedDate);

    const goToPrev = () => {
        const d = parseLocalDate(selectedDate);
        d.setDate(d.getDate() - 1);
        onDateChange(toDateStr(d));
    };
    const goToNext = () => {
        if (isTodayDate) return;
        const d = parseLocalDate(selectedDate);
        d.setDate(d.getDate() + 1);
        onDateChange(toDateStr(d));
    };

    const displayDate = (() => {
        const d = parseLocalDate(selectedDate);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    })();

    return (
        <div className="flex items-center justify-between py-2">
            <button
                onClick={goToPrev}
                className="p-2 rounded-xl text-primary/50 hover:text-primary hover:bg-primary/5 transition-colors"
                aria-label="Previous day"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
                <button
                    onClick={() => dateInputRef.current?.showPicker?.()}
                    className="font-serif font-bold text-lg text-primary hover:text-accent transition-colors"
                >
                    {displayDate}
                </button>
                {isTodayDate && (
                    <div className="font-mono text-xs text-accent font-bold">Today</div>
                )}
                <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate}
                    max={toDateStr()}
                    onChange={(e) => e.target.value && onDateChange(e.target.value)}
                    className="sr-only"
                    tabIndex={-1}
                />
            </div>
            <button
                onClick={goToNext}
                disabled={isTodayDate}
                className={cn(
                    "p-2 rounded-xl transition-colors",
                    isTodayDate
                        ? "text-primary/20 cursor-not-allowed"
                        : "text-primary/50 hover:text-primary hover:bg-primary/5"
                )}
                aria-label="Next day"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );
}
