import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/services';
import { logger } from '../utils/logger';

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

    const loadHistory = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        setError(null);

        try {
            const data = await api.getChatHistory(50);
            setMessages(data.messages || []);
            setInitialized(true);
        } catch (err) {
            logger.error('Failed to load chat history:', err);
            setError('Failed to load messages');
            setInitialized(true);
        } finally {
            setLoading(false);
        }
    }, [loading]);

    const sendMessage = useCallback(async (messageText, imageBase64 = null, onUploadSuccess = null) => {
        if (sending || (!messageText?.trim() && !imageBase64)) return;

        setSending(true);
        setError(null);

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

            const onUploadProgress = (progressEvent) => {
                if (progressEvent.loaded === progressEvent.total) {
                    onUploadSuccess?.();
                }
            };

            const response = await api.sendMessage(messageText, imageBase64, userTimezone, onUploadProgress);

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
            logger.error('Failed to send message:', err);
            setError('Failed to send message');
            setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
            throw err;
        } finally {
            setSending(false);
        }
    }, [sending]);

    const clearHistory = useCallback(async () => {
        try {
            await api.clearChatHistory();
            setMessages([]);
        } catch (err) {
            logger.error('Failed to clear history:', err);
            setError('Failed to clear history');
        }
    }, []);

    const value = {
        messages,
        setMessages,
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
