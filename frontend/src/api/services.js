import axios from 'axios';
import client from './client';
import { logger } from '../utils/logger';

// Public API client (no auth required) - used for health endpoint before Firebase init
const publicClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 5000,
});

/**
 * Get backend health info (public endpoint, no auth required)
 * @returns {Promise<{status: string, version: string, serverStartTime: string}|null>}
 */
export const getHealth = async () => {
    try {
        const response = await publicClient.get('/health');
        return response.data;
    } catch {
        return null;
    }
};

export const api = {
    // User Profile
    getUserProfile: async () => {
        const response = await client.get('/user/profile');
        return response.data;
    },

    updateUserProfile: async (data) => {
        const response = await client.post('/user/profile', data);
        return response.data;
    },

    // Chat
    sendMessage: async (message, imageBase64 = null, userTimezone = null) => {
        logger.debug('Sending message to Cally');
        const response = await client.post('/chat/message', { message, imageBase64, userTimezone });
        return response.data;
    },

    getChatHistory: async (limit = 50, before = null) => {
        logger.debug('Fetching chat history');
        const params = { limit };
        if (before) params.before = before;
        const response = await client.get('/chat/history', { params });
        return response.data;
    },

    clearChatHistory: async () => {
        logger.debug('Clearing chat history');
        const response = await client.delete('/chat/history');
        return response.data;
    },

    // Food Logs
    getFoodLogs: async (startDate = null, endDate = null, meal = null) => {
        logger.debug('Fetching food logs');
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        if (meal) params.meal = meal;
        const response = await client.get('/food/logs', { params });
        return response.data;
    },

    getFoodLog: async (id) => {
        logger.debug(`Fetching food log ${id}`);
        const response = await client.get(`/food/logs/${id}`);
        return response.data;
    },

    createFoodLog: async (data) => {
        logger.debug('Creating food log', data);
        const response = await client.post('/food/logs', data);
        return response.data;
    },

    updateFoodLog: async (id, data) => {
        logger.debug(`Updating food log ${id}`, data);
        const response = await client.put(`/food/logs/${id}`, data);
        return response.data;
    },

    deleteFoodLog: async (id) => {
        logger.debug(`Deleting food log ${id}`);
        const response = await client.delete(`/food/logs/${id}`);
        return response.data;
    },

    // Insights
    getDailySummary: async (date) => {
        logger.debug(`Fetching daily summary for ${date}`);
        const response = await client.get(`/insights/daily/${date}`);
        return response.data;
    },

    getWeeklyTrends: async () => {
        logger.debug('Fetching weekly trends');
        const response = await client.get('/insights/weekly');
        return response.data;
    },

    getMonthlyTrends: async () => {
        logger.debug('Fetching monthly trends');
        const response = await client.get('/insights/monthly');
        return response.data;
    },
};
