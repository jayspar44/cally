import { useEffect, useRef, useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import FoodEditModal from '../components/common/FoodEditModal'; // Correct import path
import { api } from '../api/services';

export default function Chat() {
    const { messages, loading, sending, error, initialized, loadHistory, sendMessage } = useChat();
    const messagesEndRef = useRef(null);
    const containerRef = useRef(null);
    const [editingFoodLog, setEditingFoodLog] = useState(null);

    // Initial load
    useEffect(() => {
        if (!initialized) loadHistory();
    }, [initialized, loadHistory]);

    const isInitialLoad = useRef(true);

    // Auto-scroll
    useEffect(() => {
        if (messagesEndRef.current) {
            // If it's the first time messages are loaded (history), scroll instantly
            if (isInitialLoad.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
                // Only mark initial load as done if we actually have messages
                if (messages.length > 0) {
                    isInitialLoad.current = false;
                }
            } else {
                // For new messages, scroll smoothly
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);

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

    if (loading && !initialized) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* Messages Area */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth pb-48"
            >
                {/* Empty State / Welcome */}
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-in fade-in duration-700">
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
                    />
                ))}

                {/* Typing Indicator */}
                {sending && (
                    <div className="flex justify-start mb-6 px-5">
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

                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area - Floating Capsule */}
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-[90%] max-w-[600px] z-40 px-2 sm:px-0">
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
