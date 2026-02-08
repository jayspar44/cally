import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import FoodEditModal from '../components/common/FoodEditModal'; // Correct import path
import { api } from '../api/services';

export default function Chat() {
    const { messages, setMessages, loading, sending, error, initialized, loadHistory, sendMessage } = useChat();
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [editingFoodLog, setEditingFoodLog] = useState(null);

    // Initial load
    useEffect(() => {
        if (!initialized) loadHistory();
    }, [initialized, loadHistory]);

    const isInitialLoad = useRef(true);

    // Auto-scroll
    const scrollToBottom = (behavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
        }
    };

    // Use layout effect for instant scroll before paint
    // This prevents the "jump" on initial load
    useLayoutEffect(() => {
        if (messages.length === 0) return;

        if (isInitialLoad.current) {
            scrollToBottom('auto');

            // Secondary check for image loading/layout shifts
            setTimeout(() => {
                scrollToBottom('auto');
                isInitialLoad.current = false;
            }, 100);
        } else {
            scrollToBottom('smooth');
        }
    }, [messages]);

    // Dynamic Sizing State
    const [spacerHeight, setSpacerHeight] = useState(200);
    const inputContainerRef = useRef(null);
    const initialHeightRef = useRef(null);
    const prevSpacerHeightRef = useRef(200);

    // 1. Separate Layout Effect for SCROLLING (Behavioral)
    // Triggers ONLY when spacerHeight updates (after render)
    useLayoutEffect(() => {
        const delta = spacerHeight - prevSpacerHeightRef.current;

        // If the spacer grew (e.g. image added), scroll DOWN by that amount
        // This effectively neutralizes the "push up" caused by the spacer expanding
        if (delta > 5) {
            console.log(`[Chat] Spacer Grew by ${delta}px. Scrolling down...`);
            window.scrollBy({ top: delta, behavior: 'smooth' });
        }

        prevSpacerHeightRef.current = spacerHeight;
    }, [spacerHeight]);

    // 2. Separate Layout Effect for OBSERVING (Sizing)
    useLayoutEffect(() => {
        if (!inputContainerRef.current) return;

        let observer;

        // Stabilize observation
        const setupObserver = () => {
            if (!inputContainerRef.current) return;

            observer = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const currentHeight = entry.contentRect.height;

                    // Capture initial 'stable' height once
                    if (initialHeightRef.current === null) {
                        initialHeightRef.current = currentHeight;
                        console.log('[Chat] Initial Input Height Locked:', currentHeight);
                    }

                    // Calculate Target Spacer Height
                    // Base: 200px + (Current - Initial)
                    const delta = currentHeight - initialHeightRef.current;
                    const newSpacer = 200 + delta;

                    // Only update state if changed significantly (avoids loops)
                    setSpacerHeight(prev => {
                        if (Math.abs(prev - newSpacer) < 1) return prev;
                        return newSpacer;
                    });
                }
            });

            observer.observe(inputContainerRef.current);
        };

        // Small delay to ensure layout is settled on mount (fonts, css)
        const timer = setTimeout(setupObserver, 50);

        return () => {
            clearTimeout(timer);
            if (observer) observer.disconnect();
        };
    }, []);

    const handleUpdateLog = async (itemId, updates) => {
        try {
            await api.updateFoodLog(itemId, updates);
            // Ideally notify user or optimistic update
        } catch (err) {
            console.error('Failed to update log:', err);
        }
    };

    const handleDeleteLog = async (itemId) => {
        try {
            await api.deleteFoodLog(itemId);
        } catch (err) {
            console.error('Failed to delete log:', err);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm('Are you sure you want to delete this message?')) return;
        try {
            await api.deleteMessage(messageId);
            // Optimistic update
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            console.error('Failed to delete message:', err);
        }
    };

    if (loading && !initialized) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col relative min-h-full">
            {/* Messages Area - No internal scroll, uses Layout scroll */}
            <div
                ref={containerRef}
                className="flex-1 px-2 py-4"
            >
                {/* Empty State / Welcome - Centered if no messages */}
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4 animate-in fade-in duration-700">
                        <div className="w-16 h-16 bg-primary/5 rounded-[2rem] flex items-center justify-center mb-6">
                            <span className="text-3xl">🥗</span>
                        </div>
                        <h2 className="font-serif font-black text-3xl text-primary mb-3">
                            Hello, User.
                        </h2>
                        <p className="font-sans text-primary/60 max-w-xs leading-relaxed mb-8">
                            I am ready to analyze your nutrition. Please share a meal description or photo.
                        </p>

                        <div className="grid gap-3 w-full max-w-xs">
                            <Suggestion
                                text="Log my breakfast (oatmeal & coffee)"
                                onClick={() => sendMessage('I had oatmeal and black coffee for breakfast')}
                                disabled={sending}
                            />
                            <Suggestion
                                text="How many calories today?"
                                onClick={() => sendMessage("What's my total calorie intake today?")}
                                disabled={sending}
                            />
                        </div>
                    </div>
                )}

                {/* Messages */}
                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        onEditLog={(log) => setEditingFoodLog(log)}
                        onDelete={() => handleDeleteMessage(message.id)}
                    />
                ))}

                {/* Typing Indicator */}
                {sending && (
                    <div className="flex justify-start mb-6 px-4">
                        <span className="font-mono text-xs text-primary/40 animate-pulse">
                            Analyzing input...
                        </span>
                    </div>
                )}

                {/* Error Bubble */}
                {error && (
                    <div className="mx-auto max-w-sm bg-red-50 text-red-600 text-xs px-4 py-2 rounded-full text-center mb-4 border border-red-100">
                        {error}
                    </div>
                )}

                {/* VISIBLE SPACER for Input Clearance */}
                {/* Robust Solution: Delta Approach
                    Base Spacer: 200px (Proven robust)
                    Adjusted by: (Current Input Height - Initial Input Height)
                */}
                <div
                    style={{ height: `${spacerHeight}px` }}
                    className="w-full transition-all duration-300 ease-out"
                    aria-hidden="true"
                />

                {/* Scroll Target */}
                <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Input Area - Floating Capsule */}
            {/* MATCH LAYOUT WIDTH: max-w-xl and px-4 to match Layout.jsx constraints */}
            <div
                ref={inputContainerRef}
                className="fixed left-1/2 -translate-x-1/2 w-full max-w-xl z-40 px-4 transition-all duration-300 pointer-events-auto"
                style={{ bottom: '7rem' }}
            >
                <ChatInput
                    onSend={sendMessage}
                    sending={sending}
                    disabled={loading}
                />
            </div>

            {/* Edit Modal (Reused Common Modal) */}
            <FoodEditModal
                isOpen={!!editingFoodLog}
                onClose={() => setEditingFoodLog(null)}
                // Map props: FoodEditModal expects `initialData` but chat might pass `foodLog`
                // Wait, FoodEditModal uses `initialData`. Let's assume it maps correctly or fix here.
                initialData={editingFoodLog}
                onSave={(data) => {
                    handleUpdateLog(editingFoodLog.realId || editingFoodLog.id, data);
                    setEditingFoodLog(null);
                }}
                onDelete={() => {
                    handleDeleteLog(editingFoodLog.realId || editingFoodLog.id);
                    setEditingFoodLog(null);
                }}
            />
        </div>
    );
}

function Suggestion({ text, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-full px-5 py-3 text-sm text-left font-medium text-primary/70 bg-white border border-border rounded-xl shadow-sm hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95 disabled:opacity-50"
        >
            {text}
        </button>
    );
}
