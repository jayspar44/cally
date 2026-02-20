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
    if (err.response?.status === 504) {
        return 'That took too long. Try a simpler message or fewer photos.';
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

    const sendMessage = useCallback(async (messageText, images = null, onUploadSuccess = null, metadata = null) => {
        // Support both single string (legacy) and array of base64 strings
        const imageArray = Array.isArray(images) ? images : (images ? [images] : []);
        const hasImages = imageArray.length > 0;

        if (sending || (!messageText?.trim() && !hasImages)) return;

        setSending(true);
        setError(null);

        const tempUserMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content: messageText || '',
            imageData: hasImages,
            imageCount: imageArray.length,
            timestamp: new Date().toISOString(),
            status: 'sending',
            _retryImages: hasImages ? imageArray : null,
            ...(metadata || {})
        };

        setMessages(prev => [...prev, tempUserMessage]);

        try {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const onUploadProgress = (progressEvent) => {
                if (progressEvent.loaded === progressEvent.total) {
                    setMessages(prev => prev.map(m =>
                        m.id === tempUserMessage.id
                            ? { ...m, status: undefined }
                            : m
                    ));
                    onUploadSuccess?.();
                }
            };

            const response = await api.sendMessage(messageText, imageArray, userTimezone, onUploadProgress, false, metadata);

            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== tempUserMessage.id);
                return [
                    ...filtered,
                    {
                        id: response.userMessageId,
                        role: 'user',
                        content: messageText || '',
                        imageData: hasImages,
                        imageCount: imageArray.length,
                        timestamp: new Date().toISOString(),
                        ...(metadata || {})
                    },
                    {
                        id: response.assistantMessageId,
                        role: 'assistant',
                        content: response.response,
                        timestamp: new Date().toISOString(),
                        foodLog: response.foodLog,
                        partialSuccess: response.partialSuccess || false,
                        profileUpdated: (response.toolsUsed || []).includes('updateUserProfile')
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
            const retryImages = failedMessage._retryImages || [];
            const onRetryUploadProgress = (progressEvent) => {
                if (progressEvent.loaded === progressEvent.total) {
                    setMessages(prev => prev.map(m =>
                        m.id === messageId
                            ? { ...m, status: undefined }
                            : m
                    ));
                }
            };

            const response = await api.sendMessage(failedMessage.content, retryImages, userTimezone, onRetryUploadProgress, true);

            setMessages(prev => {
                const filtered = prev.filter(m => m.id !== messageId);
                return [
                    ...filtered,
                    {
                        id: response.userMessageId,
                        role: 'user',
                        content: failedMessage.content,
                        imageData: retryImages.length > 0,
                        imageCount: retryImages.length,
                        timestamp: new Date().toISOString()
                    },
                    {
                        id: response.assistantMessageId,
                        role: 'assistant',
                        content: response.response,
                        timestamp: new Date().toISOString(),
                        foodLog: response.foodLog,
                        partialSuccess: response.partialSuccess || false,
                        profileUpdated: (response.toolsUsed || []).includes('updateUserProfile')
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
