import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import FoodEditModal from '../components/common/FoodEditModal';
import { api } from '../api/services';
import { logger } from '../utils/logger';
import { AlertCircle } from 'lucide-react';

export default function Chat() {
    const { messages, setMessages, loading, sending, error, setError, initialized, loadHistory, sendMessage, retryMessage } = useChat();
    const messagesEndRef = useRef(null);
    const [editingFoodLog, setEditingFoodLog] = useState(null);
    const errorTimerRef = useRef(null);

    useEffect(() => {
        if (!initialized) loadHistory();
    }, [initialized, loadHistory]);

    // Auto-dismiss error banner after 5 seconds
    useEffect(() => {
        if (error) {
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
            errorTimerRef.current = setTimeout(() => setError(null), 5000);
        }
        return () => {
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        };
    }, [error, setError]);

    const isInitialLoad = useRef(true);

    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    };

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

    const [spacerHeight, setSpacerHeight] = useState(200);
    const inputContainerRef = useRef(null);
    const initialHeightRef = useRef(null);
    const prevSpacerHeightRef = useRef(200);

    useLayoutEffect(() => {
        const delta = spacerHeight - prevSpacerHeightRef.current;
        if (delta > 5) {
            document.getElementById('layout-container')?.scrollBy({ top: delta, behavior: 'smooth' });
        }
        prevSpacerHeightRef.current = spacerHeight;
    }, [spacerHeight]);

    useLayoutEffect(() => {
        if (!inputContainerRef.current) return;

        let observer;
        let rafId = null;

        const setupObserver = () => {
            if (!inputContainerRef.current) return;

            observer = new ResizeObserver(entries => {
                const currentHeight = entries[0]?.contentRect.height;
                if (currentHeight == null) return;

                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    if (initialHeightRef.current === null) {
                        initialHeightRef.current = currentHeight;
                    }

                    const delta = currentHeight - initialHeightRef.current;
                    const newSpacer = 200 + delta;

                    setSpacerHeight(prev => {
                        if (Math.abs(prev - newSpacer) < 5) return prev;
                        return newSpacer;
                    });
                });
            });

            observer.observe(inputContainerRef.current);
        };

        const timer = setTimeout(setupObserver, 50);

        return () => {
            clearTimeout(timer);
            if (rafId) cancelAnimationFrame(rafId);
            if (observer) observer.disconnect();
        };
    }, [initialized]);

    const handleImageChange = (hasImage) => {
        if (hasImage) {
            setTimeout(() => scrollToBottom('smooth'), 350);
        }
    };

    const handleUpdateLog = async (itemId, updates) => {
        try {
            await api.updateFoodLog(itemId, updates);
        } catch (err) {
            logger.error('Failed to update log:', err);
            setError('Failed to update food log');
        }
    };

    const handleDeleteLog = async (itemId) => {
        try {
            await api.deleteFoodLog(itemId);
        } catch (err) {
            logger.error('Failed to delete log:', err);
            setError('Failed to delete food log');
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm('Are you sure you want to delete this message?')) return;
        try {
            await api.deleteMessage(messageId);
            // Optimistic update
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (err) {
            logger.error('Failed to delete message:', err);
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
            <div className="flex-1 px-2 py-4">
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

                {messages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        message={message}
                        onEditLog={(log) => setEditingFoodLog(log)}
                        onDelete={() => handleDeleteMessage(message.id)}
                        onRetry={retryMessage}
                    />
                ))}

                {/* Processing indicator */}
                {sending && !messages.some(m => m.status === 'sending') && (
                    <div className="flex items-center gap-2.5 px-4 mb-6 animate-in fade-in duration-300">
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                        <span className="text-sm text-primary/60">Kalli is thinking...</span>
                    </div>
                )}

                {error && (
                    <div className="mx-auto max-w-sm bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-2.5 rounded-xl text-center mb-4 border border-red-100 dark:border-red-500/20 flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div
                    style={{ height: `${spacerHeight}px` }}
                    className="w-full"
                    aria-hidden="true"
                />

                <div ref={messagesEndRef} className="h-1" />
            </div>

            <div
                ref={inputContainerRef}
                className="fixed left-1/2 -translate-x-1/2 w-full max-w-xl z-40 px-4 transition-all duration-300 pointer-events-auto"
                style={{ bottom: '7rem' }}
            >
                <ChatInput
                    onSend={sendMessage}
                    sending={sending}
                    disabled={loading}
                    onImageChange={handleImageChange}
                />
            </div>

            <FoodEditModal
                isOpen={!!editingFoodLog}
                onClose={() => setEditingFoodLog(null)}
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
            className="w-full px-5 py-3 text-sm text-left font-medium text-primary/70 bg-surface border border-border rounded-xl shadow-sm hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95 disabled:opacity-50"
        >
            {text}
        </button>
    );
}
