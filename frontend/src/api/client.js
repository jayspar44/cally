import axios from 'axios';
import { getAuth } from 'firebase/auth';

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 60000,
});

let connectionStatusCallback = null;

export const setConnectionStatusCallback = (callback) => {
    connectionStatusCallback = callback;
};

const isNetworkError = (error) =>
    error.code === 'ECONNREFUSED' ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    error.message === 'Network Error' ||
    !error.response;

client.interceptors.request.use(async (config) => {
    const auth = getAuth();
    if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

client.interceptors.response.use(
    (response) => {
        connectionStatusCallback?.(true);
        return response;
    },
    (error) => {
        connectionStatusCallback?.(!isNetworkError(error));
        return Promise.reject(error);
    }
);

export default client;
