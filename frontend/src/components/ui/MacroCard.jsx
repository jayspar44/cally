export default function MacroCard({ label, current, progress, color, compact = false }) {
    const colorMap = {
        protein: {
            ring: 'stroke-[var(--color-protein)]',
            text: 'text-protein',
            bg: 'text-protein/10',
            glow: 'drop-shadow-[0_0_6px_rgba(58,124,165,0.35)]'
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

    // Ring geometry — scale down when compact
    const innerRadius = compact ? 20 : 28;
    const outerRadius = compact ? 24 : 33;
    const innerCircumference = 2 * Math.PI * innerRadius;
    const outerCircumference = 2 * Math.PI * outerRadius;

    // Progress logic
    const rawProgress = Math.max(0, progress || 0);
    const isOver = rawProgress > 100;
    const visualProgress = Math.min(100, rawProgress);
    const excessProgress = isOver ? Math.min(100, rawProgress - 100) : 0;

    const innerDashoffset = innerCircumference - (visualProgress / 100) * innerCircumference;
    const outerDashoffset = outerCircumference - (excessProgress / 100) * outerCircumference;

    const ringSize = compact ? 'w-14 h-14' : 'w-20 h-20';
    const viewBox = compact ? '0 0 56 56' : '0 0 80 80';
    const center = compact ? 28 : 40;
    const strokeW = compact ? 4 : 5;
    const outerStrokeW = compact ? 2 : 3;

    return (
        <div className={`flex flex-col items-center ${compact ? 'gap-2' : 'gap-3'}`}>
            <div className={`relative ${ringSize}`}>
                <svg className={`w-full h-full transform -rotate-90${isOver ? ` ${theme.glow}` : ''}`} viewBox={viewBox}>
                    {/* Background track */}
                    <circle
                        cx={center}
                        cy={center}
                        r={innerRadius}
                        stroke="currentColor"
                        strokeWidth={strokeW}
                        fill="none"
                        className={theme.bg}
                    />
                    {/* Inner ring — progress (full when over) */}
                    <circle
                        cx={center}
                        cy={center}
                        r={innerRadius}
                        stroke="currentColor"
                        strokeWidth={strokeW}
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
                                cx={center}
                                cy={center}
                                r={outerRadius}
                                stroke="currentColor"
                                strokeWidth={outerStrokeW}
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

                {/* Centered Percentage — hidden in compact mode */}
                {!compact && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`type-value text-sm ${theme.text}`}>
                            {Math.round(rawProgress)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Label & Value */}
            <div className="text-center">
                <div className={`type-value leading-none mb-1 ${theme.text} ${compact ? 'text-base' : 'text-lg'}`}>
                    {Math.round(current)}g
                </div>
                <div className="type-label">
                    {label}
                </div>
            </div>
        </div>
    );
}
