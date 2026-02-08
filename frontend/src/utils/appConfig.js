/* global __BUILD_TIMESTAMP__ */

const getAppVersion = () => {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
};

export const getEnvironment = () => {
  if (import.meta.env.DEV) {
    return 'local';
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';

  if (apiUrl.includes('localhost') || apiUrl.includes('10.0.2.2')) {
    return 'local';
  }
  if (apiUrl.includes('-dev')) {
    return 'dev';
  }
  if (apiUrl.includes('-prod')) {
    return 'prod';
  }

  return import.meta.env.PROD ? 'prod' : 'local';
};

const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

const formatDateTime = (d, fallback = '') => {
  if (!isValidDate(d)) return fallback;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

let cachedBackendInfo = null;
let fetchPromise = null;
let lastCodeUpdate = new Date();

if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', () => {
    lastCodeUpdate = new Date();
  });
}

export const fetchBackendInfo = async () => {
  if (cachedBackendInfo) return cachedBackendInfo;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const { getHealth } = await import('../api/services');
      cachedBackendInfo = await getHealth();
      return cachedBackendInfo;
    } catch {
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

export const getBackendInfo = () => cachedBackendInfo;

export const getVersionString = () => {
  const env = getEnvironment();
  const version = cachedBackendInfo?.version || getAppVersion();

  if (import.meta.env.DEV) {
    const backendTime = cachedBackendInfo?.serverStartTime ? new Date(cachedBackendInfo.serverStartTime) : null;
    const latestTime = backendTime && isValidDate(backendTime) && backendTime > lastCodeUpdate ? backendTime : lastCodeUpdate;
    return `v${version} (${env}) ${formatDateTime(latestTime)}`;
  }

  if (cachedBackendInfo?.serverStartTime) {
    const d = new Date(cachedBackendInfo.serverStartTime);
    if (isValidDate(d)) {
      return `v${version} (${env}) ${formatDateTime(d)}`;
    }
  }

  const buildTime = typeof __BUILD_TIMESTAMP__ !== 'undefined'
    ? formatDateTime(new Date(__BUILD_TIMESTAMP__))
    : '';
  return `v${version} (${env}) ${buildTime}`;
};
