export default function MacroCard({ label, current, progress, color }) {
    // Map colors to the new design system
    // We use arbitrary values for now to match the specific palette if needed, 
    // or map to variables defined in index.css

    const colorMap = {
        protein: {
            ring: 'stroke-[var(--color-primary)]',
            text: 'text-primary',
            bg: 'text-primary/10'
        },
        carbs: {
            ring: 'stroke-[var(--color-accent)]',
            text: 'text-accent',
            bg: 'text-accent/10'
        },
        fat: {
            ring: 'stroke-amber-600 dark:stroke-[#D9A05B]',
            text: 'text-amber-700 dark:text-[#D9A05B]',
            bg: 'text-amber-600/10'
        }
    };

    const theme = colorMap[color] || colorMap.protein;

    // Circular Progress Logic
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const safeProgress = Math.min(100, Math.max(0, progress || 0));
    const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-20 h-20">
                {/* Background Circle */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        className={theme.bg}
                    />
                    {/* Progress Circle */}
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="none"
                        strokeLinecap="round"
                        className={theme.ring}
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset,
                            transition: 'stroke-dashoffset 1s ease-out'
                        }}
                    />
                </svg>

                {/* Centered Percentage */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-mono font-bold text-sm ${theme.text}`}>
                        {Math.round(safeProgress)}%
                    </span>
                </div>
            </div>

            {/* Label & Value */}
            <div className="text-center">
                <div className={`font-mono font-bold text-lg leading-none mb-1 ${theme.text}`}>
                    {Math.round(current)}g
                </div>
                <div className="font-sans font-medium text-primary/60 text-xs tracking-wide uppercase">
                    {label}
                </div>
            </div>
        </div>
    );
}
