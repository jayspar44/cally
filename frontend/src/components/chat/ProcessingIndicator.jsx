import { useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

const TEXT_PHASES = [
    { label: 'Thinking...', duration: 4000 },
    { label: 'Analyzing your request...', duration: 6000 },
    { label: 'Looking up nutrition info...', duration: 8000 },
    { label: 'Crunching the numbers...', duration: 10000 },
    { label: 'Putting it all together...', duration: 12000 },
    { label: 'Almost there...', duration: null },
];

const IMAGE_PHASES = [
    { label: 'Uploading photo...', duration: 3000 },
    { label: 'Analyzing your photo...', duration: 6000 },
    { label: 'Identifying foods...', duration: 8000 },
    { label: 'Reading nutrition labels...', duration: 10000 },
    { label: 'Looking up nutrition details...', duration: 12000 },
    { label: 'Logging your meal...', duration: 15000 },
    { label: 'Putting it all together...', duration: 15000 },
    { label: 'Almost there...', duration: null },
];

export default function ProcessingIndicator({ hasImage, isVisible }) {
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [fading, setFading] = useState(false);
    const timerRef = useRef(null);
    const phases = hasImage ? IMAGE_PHASES : TEXT_PHASES;

    useEffect(() => {
        setPhaseIndex(0);
        setFading(false);
    }, [isVisible, hasImage]);

    useEffect(() => {
        if (!isVisible) return;

        const phase = phases[phaseIndex];
        if (!phase?.duration) return;

        timerRef.current = setTimeout(() => {
            if (phaseIndex < phases.length - 1) {
                setFading(true);
                setTimeout(() => {
                    setPhaseIndex(prev => prev + 1);
                    setFading(false);
                }, 200);
            }
        }, phase.duration);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [phaseIndex, isVisible, phases]);

    if (!isVisible) return null;

    const currentPhase = phases[phaseIndex] || phases[phases.length - 1];

    return (
        <div className="flex items-center gap-2.5 px-4 mb-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className={cn(
                "text-sm text-primary/60 transition-opacity duration-200",
                fading ? "opacity-0" : "opacity-100"
            )}>
                {currentPhase.label}
            </span>
        </div>
    );
}
