import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ChartInsight from './ChartInsight';

const MACRO_COLORS = {
    protein: 'var(--color-protein)',
    carbs: 'var(--color-carbs)',
    fat: 'var(--color-fat)'
};

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.[0]) return null;
    const { name, value, percent } = payload[0].payload;
    return (
        <div className="bg-primary text-white text-[10px] px-2.5 py-1.5 rounded-lg font-mono shadow-lg">
            <span className="font-bold capitalize">{name}</span>: {Math.round(value)}g ({Math.round(percent)}%)
        </div>
    );
};

export default function MacroDonutChart({ averages, goals }) {
    const data = useMemo(() => {
        const protein = averages?.protein || 0;
        const carbs = averages?.carbs || 0;
        const fat = averages?.fat || 0;
        const total = protein + carbs + fat;
        if (total === 0) return [];
        return [
            { name: 'protein', value: protein, percent: (protein / total) * 100 },
            { name: 'carbs', value: carbs, percent: (carbs / total) * 100 },
            { name: 'fat', value: fat, percent: (fat / total) * 100 },
        ];
    }, [averages]);

    const insightText = useMemo(() => {
        if (!goals || !averages) return null;
        const proteinPct = goals.targetProtein > 0
            ? Math.round(((goals.targetProtein - averages.protein) / goals.targetProtein) * 100)
            : 0;
        if (proteinPct > 15) {
            return `Protein is averaging ${proteinPct}% below target — adding eggs or Greek yogurt at breakfast would close most of this gap.`;
        }
        if (proteinPct < -15) {
            return `Great protein intake — you're ${Math.abs(proteinPct)}% above your goal.`;
        }
        return `Macros are well balanced — protein, carbs, and fat are all close to target.`;
    }, [averages, goals]);

    if (data.length === 0) {
        return (
            <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
                <h3 className="font-serif font-bold text-lg text-primary mb-4">Macro Balance</h3>
                <div className="flex items-center justify-center h-[180px] text-primary/30 font-sans text-sm">
                    No macro data yet
                </div>
            </section>
        );
    }

    return (
        <section className="bg-white/90 dark:bg-surface/90 backdrop-blur-xl rounded-[2rem] p-5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white/50 dark:border-border/30">
            <h3 className="font-serif font-bold text-lg text-primary mb-4">Macro Balance</h3>

            <div className="flex items-center gap-4">
                <div className="w-[140px] h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={38}
                                outerRadius={62}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {data.map((entry) => (
                                    <Cell key={entry.name} fill={MACRO_COLORS[entry.name]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2.5 flex-1">
                    {data.map(macro => (
                        <div key={macro.name} className="flex items-center gap-2">
                            <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: MACRO_COLORS[macro.name] }}
                            />
                            <div className="flex-1">
                                <span className="font-sans text-xs text-primary/70 capitalize">{macro.name}</span>
                            </div>
                            <div className="text-right">
                                <span className="font-mono text-xs font-medium text-primary">{Math.round(macro.value)}g</span>
                                <span className="font-mono text-[9px] text-primary/40 ml-1">{Math.round(macro.percent)}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <ChartInsight text={insightText} />
        </section>
    );
}
