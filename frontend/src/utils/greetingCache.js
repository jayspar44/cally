const GREETING_TTL = 30 * 60 * 1000; // 30 minutes
let greetingCache = { data: null, timestamp: 0 };

export const getGreetingCache = () => greetingCache;
export const setGreetingCache = (data) => { greetingCache = { data, timestamp: Date.now() }; };
export const invalidateGreetingCache = () => { greetingCache = { data: null, timestamp: 0 }; };
export { GREETING_TTL };
