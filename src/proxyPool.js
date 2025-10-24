// Compatibility re-export: keeps require('./proxyPool') working.
// It delegates to the canonical module at ./proxy-pool

module.exports = require('./proxy-pool');
