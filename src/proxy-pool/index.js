// Canonical proxy-pool module (index.js)
// Uses dynamic import for 'got' because got v12+ is ESM-only.
// We cache the imported got module to avoid re-importing on every call.

const { URL } = require('url');
const ProxyAgent = require('proxy-agent');

let _got = null;
async function ensureGot() {
  if (_got) return _got;
  // dynamic import returns the ESM module; default export may be on .default
  const mod = await import('got');
  _got = mod.default || mod;
  return _got;
}

class ProxyPool {
  constructor(proxyList = [], { healthInterval = 30000, logger = console } = {}) {
    this.logger = logger;
    this.proxies = proxyList.map(p => ({ url: p, healthy: true, lastChecked: 0, fails: 0 }));
    this.index = 0;
    this.healthInterval = healthInterval;
    this._startHealthChecks();
  }

  _startHealthChecks() {
    if (!this.healthInterval || this.proxies.length === 0) return;
    this.healthTimer = setInterval(() => this.checkAll(), this.healthInterval).unref();
    // initial immediate check
    this.checkAll().catch(() => {});
  }

  setProxies(proxyList) {
    this.proxies = proxyList.map(p => ({ url: p, healthy: true, lastChecked: 0, fails: 0 }));
  }

  async checkProxy(proxy) {
    const testUrl = 'https://httpbin.org/get';
    const agent = new ProxyAgent(proxy.url);

    try {
      const got = await ensureGot();
      const res = await got(testUrl, { agent: { https: agent, http: agent }, timeout: 5000 });
      proxy.healthy = res.statusCode === 200;
      proxy.lastChecked = Date.now();
      if (!proxy.healthy) proxy.fails++;
      else proxy.fails = 0;
      return proxy.healthy;
    } catch (err) {
      proxy.healthy = false;
      proxy.lastChecked = Date.now();
      proxy.fails++;
      this.logger.debug && this.logger.debug(`Health check failed for ${proxy.url}: ${err.message}`);
      return false;
    }
  }

  async checkAll() {
    const checks = this.proxies.map(p => this.checkProxy(p));
    await Promise.allSettled(checks);
    return this.proxies;
  }

  getNextProxy() {
    if (this.proxies.length === 0) return null;
    const start = this.index;
    for (let i = 0; i < this.proxies.length; i++) {
      const idx = (start + i) % this.proxies.length;
      this.index = (idx + 1) % this.proxies.length;
      const p = this.proxies[idx];
      if (p.healthy) return p;
    }
    // fallback if none healthy
    const fallback = this.proxies[this.index++];
    this.index = this.index % this.proxies.length;
    return fallback;
  }

  markFailed(proxyUrl) {
    const p = this.proxies.find(x => x.url === proxyUrl);
    if (!p) return;
    p.fails = (p.fails || 0) + 1;
    if (p.fails >= 3) p.healthy = false;
  }
}

module.exports = ProxyPool;
