import { cn } from '../../utils/cn';

export default function ChartInsight({ text, className }) {
    if (!text) return null;

    return (
        <p className={cn(
            "text-xs text-primary/60 font-sans mt-3 px-1 leading-relaxed",
            className
        )}>
            {text}
        </p>
    );
}
