const { AsyncLocalStorage } = require('node:async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

const getRequestContext = () => asyncLocalStorage.getStore() || {};
const runWithContext = (context, fn) => asyncLocalStorage.run(context, fn);

module.exports = { getRequestContext, runWithContext };
