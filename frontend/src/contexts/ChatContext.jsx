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

function classifyError(err) {
    if (err.code === 'ERR_NETWORK' || !err.response) {
        return 'Connection lost. Check your internet.';
    }
    if (err.code === 'ECONNABORTED') {
        return 'Request timed out. Try again.';
    }
    if (err.response?.status >= 500) {
        return 'Something went wrong. Try again.';
    }
    if (err.response?.status === 400) {
        return err.response.data?.error || 'Invalid request. Try again.';
    }
    return 'Failed to send message. Try again.';
}

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
            status: 'sending',
            _retryImageBase64: imageBase64 || null
        };

        setMessages(prev => [...prev, tempUserMessage]);

        try {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const onUploadProgress = (progressEvent) => {
                if (progressEvent.loaded === progressEvent.total) {
                    // Upload complete — mark message as delivered, triggers "Kalli is thinking..."
                    setMessages(prev => prev.map(m =>
                        m.id === tempUserMessage.id
                            ? { ...m, status: undefined }
                            : m
                    ));
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
            const errorMessage = classifyError(err);
            setMessages(prev => prev.map(m =>
                m.id === tempUserMessage.id
                    ? { ...m, status: 'failed', errorMessage }
                    : m
            ));
            throw err;
        } finally {
            setSending(false);
        }
    }, [sending]);

    const retryMessage = useCallback(async (messageId) => {
        const failedMessage = messages.find(m => m.id === messageId && m.status === 'failed');
        if (!failedMessage || sending) return;

        setSending(true);
        setError(null);

        setMessages(prev => prev.map(m =>
            m.id === messageId
                ? { ...m, status: 'sending', errorMessage: undefined }
                : m
        ));

        try {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const imageBase64 = failedMessage._retryImageBase64 || null;
            const onRetryUploadProgress = (progressEvent) => {
                if (progressEvent.loaded === progressEvent.total) {
                    setMessages(prev => prev.map(m =>
                        m.id === messageId
                            ? { ...m, status: undefined }
                            : m
                    ));
                }
            };

            const response = await api.sendMessage(failedMessage.content, imageBase64, userTimezone, onRetryUploadProgress);

            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== messageId);
                return [
                    ...filtered,
                    {
                        id: response.userMessageId,
                        role: 'user',
                        content: failedMessage.content,
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
        } catch (err) {
            logger.error('Failed to retry message:', err);
            const errorMessage = classifyError(err);
            setMessages(prev => prev.map(m =>
                m.id === messageId
                    ? { ...m, status: 'failed', errorMessage }
                    : m
            ));
        } finally {
            setSending(false);
        }
    }, [messages, sending]);

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
        setError,
        initialized,
        loadHistory,
        sendMessage,
        retryMessage,
        clearHistory
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};
