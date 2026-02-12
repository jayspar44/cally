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

    sendMessage: async (message, imageBase64 = null, userTimezone = null, onUploadProgress = null) => {
        logger.debug('Sending message to Cally');
        const config = onUploadProgress ? { onUploadProgress } : {};
        const response = await client.post('/chat/message', { message, imageBase64, userTimezone }, config);
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

    getWeeklyTrends: async () => {
        const response = await client.get('/insights/weekly');
        return response.data;
    },

    getMonthlyTrends: async () => {
        const response = await client.get('/insights/monthly');
        return response.data;
    },

    getRecommendedTargets: async () => {
        const response = await client.get('/user/recommended-targets');
        return response.data;
    },
};
