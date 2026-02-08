import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/services';

const ChatContext = createContext();

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};

export const ChatProvider = ({ children }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const [initialized, setInitialized] = useState(false);

    // Load chat history
    const loadHistory = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const data = await api.getChatHistory(50);
            setMessages(data.messages || []);
            setInitialized(true);
        } catch (err) {
            console.error('Failed to load chat history:', err);
            setError('Failed to load messages');
            // Mark as initialized even on error to prevent infinite retry loops in UI
            setInitialized(true);
        } finally {
            setLoading(false);
        }
    }, [loading]);

    // Send a message
    const sendMessage = useCallback(async (messageText, imageBase64 = null, onUploadSuccess = null) => {
        if (sending || (!messageText?.trim() && !imageBase64)) return;

        setSending(true);
        setError(null);

        // Optimistic update - add user message immediately
        const tempUserMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: messageText || '',
            imageData: !!imageBase64,
            timestamp: new Date().toISOString(),
            pending: true
        };

        setMessages(prev => [...prev, tempUserMessage]);

        try {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            // Define progress handler
            const onUploadProgress = (progressEvent) => {
                // Check if upload is complete (approximate for 'sent')
                if (progressEvent.loaded === progressEvent.total) {
                    if (onUploadSuccess) onUploadSuccess();
                }
            };

            const response = await api.sendMessage(messageText, imageBase64, userTimezone, onUploadProgress);

            // Replace temp message with real ones
            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== tempUserMessage.id);
                return [
                    ...filtered,
                    {
                        id: response.userMessageId,
                        role: 'user',
                        content: messageText || '',
                        imageData: !!imageBase64,
                        timestamp: new Date().toISOString()
                    },
                    {
                        id: response.assistantMessageId,
                        role: 'assistant',
                        content: response.response,
                        timestamp: new Date().toISOString(),
                        foodLog: response.foodLog
                    }
                ];
            });

            return response;
        } catch (err) {
            console.error('Failed to send message:', err);
            setError('Failed to send message');

            // Remove optimistic message on error
            setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
            throw err;
        } finally {
            setSending(false);
        }
    }, [sending]);

    // Clear all history
    const clearHistory = useCallback(async () => {
        try {
            await api.clearChatHistory();
            setMessages([]);
        } catch (err) {
            console.error('Failed to clear history:', err);
            setError('Failed to clear history');
        }
    }, []);

    const value = {
        messages,
        setMessages, // Exposed for optimistic updates
        loading,
        sending,
        error,
        initialized,
        loadHistory,
        sendMessage,
        clearHistory
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
