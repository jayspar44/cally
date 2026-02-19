export default function MacroCard({ label, current, progress, color }) {
    const colorMap = {
        protein: {
            ring: 'stroke-[var(--color-primary)]',
            text: 'text-primary',
            bg: 'text-primary/10',
            glow: 'drop-shadow-[0_0_6px_rgba(40,65,54,0.35)]'
        },
        carbs: {
            ring: 'stroke-[var(--color-accent)]',
            text: 'text-accent',
            bg: 'text-accent/10',
            glow: 'drop-shadow-[0_0_6px_rgba(166,114,88,0.35)]'
        },
        fat: {
            ring: 'stroke-[var(--color-fat)]',
            text: 'text-fat',
            bg: 'text-fat/10',
            glow: 'drop-shadow-[0_0_6px_rgba(195,150,52,0.35)]'
        }
    };

    const theme = colorMap[color] || colorMap.protein;

    // Circular Progress Logic
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const rawProgress = Math.max(0, progress || 0);
    const isOver = rawProgress > 100;
    const visualProgress = Math.min(100, rawProgress);
    const strokeDashoffset = circumference - (visualProgress / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-20 h-20">
                {/* Background Circle */}
                <svg className={`w-full h-full transform -rotate-90${isOver ? ` ${theme.glow}` : ''}`}>
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
                        {Math.round(rawProgress)}%
                    </span>
                </div>
            </div>

            {/* Label & Value */}
            <div className="text-center">
                <div className={`font-mono font-bold text-lg leading-none mb-1 ${theme.text}`}>
                    {Math.round(current)}g
                </div>
                <div className="font-sans font-medium text-primary/70 text-xs tracking-wide uppercase">
                    {label}
                </div>
            </div>
        </div>
    );
}
