const { URL } = require('url');
const got = require('got');
const ProxyAgent = require('proxy-agent');

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
    // perform a light request to a known fast site using the proxy to determine liveness.
    // Note: keep the check target lightweight and allowed by your proxies provider.
    const testUrl = 'https://httpbin.org/get';
    const agent = new ProxyAgent(proxy.url);

    try {
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
    // rotate until we find a healthy proxy
    const start = this.index;
    for (let i = 0; i < this.proxies.length; i++) {
      const idx = (start + i) % this.proxies.length;
      this.index = (idx + 1) % this.proxies.length;
      const p = this.proxies[idx];
      if (p.healthy) return p;
    }
    // if none healthy, return next anyway (best-effort)
    const fallback = this.proxies[this.index++];
    this.index = this.index % this.proxies.length;
    return fallback;
  }

  markFailed(proxyUrl) {
    const p = this.proxies.find(x => x.url === proxyUrl);
    if (!p) return;
    p.fails = (p.fails || 0) + 1;
    // mark unhealthy early if fail count high
    if (p.fails >= 3) p.healthy = false;
  }
}

module.exports = ProxyPool;
