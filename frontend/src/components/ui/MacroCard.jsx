export default function MacroCard({ label, current, progress, color }) {
    const colorMap = {
        protein: {
            ring: 'stroke-[var(--color-primary)]',
            text: 'text-primary',
            bg: 'text-primary/10',
            glow: 'drop-shadow-[0_0_6px_rgba(40,65,54,0.35)]'
        },
        carbs: {
            ring: 'stroke-[var(--color-carbs)]',
            text: 'text-carbs',
            bg: 'text-carbs/10',
            glow: 'drop-shadow-[0_0_6px_rgba(212,149,12,0.35)]'
        },
        fat: {
            ring: 'stroke-[var(--color-fat)]',
            text: 'text-fat',
            bg: 'text-fat/10',
            glow: 'drop-shadow-[0_0_6px_rgba(123,79,191,0.35)]'
        }
    };

    const theme = colorMap[color] || colorMap.protein;

    // Ring geometry
    const innerRadius = 28;
    const outerRadius = 33;
    const innerCircumference = 2 * Math.PI * innerRadius;
    const outerCircumference = 2 * Math.PI * outerRadius;

    // Progress logic
    const rawProgress = Math.max(0, progress || 0);
    const isOver = rawProgress > 100;
    const visualProgress = Math.min(100, rawProgress);
    const excessProgress = isOver ? Math.min(100, rawProgress - 100) : 0;

    const innerDashoffset = innerCircumference - (visualProgress / 100) * innerCircumference;
    const outerDashoffset = outerCircumference - (excessProgress / 100) * outerCircumference;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative w-20 h-20">
                <svg className={`w-full h-full transform -rotate-90${isOver ? ` ${theme.glow}` : ''}`} viewBox="0 0 80 80">
                    {/* Background track */}
                    <circle
                        cx="40"
                        cy="40"
                        r={innerRadius}
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="none"
                        className={theme.bg}
                    />
                    {/* Inner ring — progress (full when over) */}
                    <circle
                        cx="40"
                        cy="40"
                        r={innerRadius}
                        stroke="currentColor"
                        strokeWidth="5"
                        fill="none"
                        strokeLinecap="round"
                        className={theme.ring}
                        style={{
                            strokeDasharray: innerCircumference,
                            strokeDashoffset: innerDashoffset,
                            transition: 'stroke-dashoffset 1s ease-out'
                        }}
                    />
                    {/* Outer ring — overflow (only when over 100%) */}
                    {isOver && (
                        <>
                            <circle
                                cx="40"
                                cy="40"
                                r={outerRadius}
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                                className={theme.ring}
                                style={{
                                    strokeDasharray: outerCircumference,
                                    strokeDashoffset: outerDashoffset,
                                    transition: 'stroke-dashoffset 1s ease-out'
                                }}
                            />
                        </>
                    )}
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
