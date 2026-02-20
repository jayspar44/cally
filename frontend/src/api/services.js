import axios from 'axios';
import client from './client';
import { logger } from '../utils/logger';

const publicClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 5000,
});

export const getHealth = async () => {
    try {
        const response = await publicClient.get('/health');
        return response.data;
    } catch {
        return null;
    }
};

export const api = {
    getUserProfile: async () => {
        const response = await client.get('/user/profile');
        return response.data;
    },

    updateUserProfile: async (data) => {
        const response = await client.post('/user/profile', data);
        return response.data;
    },

    sendMessage: async (message, images = null, userTimezone = null, onUploadProgress = null, isRetry = false, metadata = null) => {
        logger.debug('Sending message to Cally');
        // Support both single string (legacy) and array
        const imageArray = Array.isArray(images) ? images : (images ? [images] : []);
        const body = { message, userTimezone, isRetry };
        if (metadata) body.metadata = metadata;
        if (imageArray.length > 0) {
            body.images = imageArray;
            // Backward compat: also send imageBase64 if single image
            if (imageArray.length === 1) body.imageBase64 = imageArray[0];
        }
        const config = {
            timeout: 180000,
            ...(onUploadProgress ? { onUploadProgress } : {})
        };
        const response = await client.post('/chat/message', body, config);
        return response.data;
    },

    getChatHistory: async (limit = 50, before = null) => {
        const params = { limit };
        if (before) params.before = before;
        const response = await client.get('/chat/history', { params });
        return response.data;
    },

    clearChatHistory: async () => {
        const response = await client.delete('/chat/history');
        return response.data;
    },

    deleteMessage: async (id) => {
        const response = await client.delete(`/chat/message/${id}`);
        return response.data;
    },

    getFoodLogs: async (startDate = null, endDate = null, meal = null) => {
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (meal) params.meal = meal;
        const response = await client.get('/food/logs', { params });
        return response.data;
    },

    getFoodLog: async (id) => {
        const response = await client.get(`/food/logs/${id}`);
        return response.data;
    },

    createFoodLog: async (data) => {
        const response = await client.post('/food/logs', data);
        return response.data;
    },

    updateFoodLog: async (id, data) => {
        const response = await client.put(`/food/logs/${id}`, data);
        return response.data;
    },

    deleteFoodLog: async (id) => {
        const response = await client.delete(`/food/logs/${id}`);
        return response.data;
    },

    getDailySummary: async (date) => {
        const response = await client.get(`/insights/daily/${date}`);
        return response.data;
    },

    getWeeklyTrends: async (weekStart = null) => {
        const params = weekStart ? { weekStart } : {};
        const response = await client.get('/insights/weekly', { params });
        return response.data;
    },

    getMonthlyTrends: async (monthStart = null) => {
        const params = monthStart ? { monthStart } : {};
        const response = await client.get('/insights/monthly', { params });
        return response.data;
    },

    getQuarterlyTrends: async (quarterStart = null) => {
        const params = quarterStart ? { quarterStart } : {};
        const response = await client.get('/insights/quarterly', { params });
        return response.data;
    },

    getAISummary: async (range = '1W', periodStart = null, { refresh = false } = {}) => {
        const params = { range };
        if (periodStart) {
            if (range === '1W') params.week = periodStart;
            else if (range === '1M') params.monthStart = periodStart;
            else if (range === '3M') params.quarterStart = periodStart;
        }
        if (refresh) params.refresh = 'true';
        const response = await client.get('/insights/ai-summary', { params });
        return response.data;
    },

    getUserBadges: async () => {
        const response = await client.get('/user/badges');
        return response.data;
    },

    getRecommendedTargets: async () => {
        const response = await client.get('/user/recommended-targets');
        return response.data;
    },
};
