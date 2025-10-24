const { DataStream } = require('scramjet');
const ProxyAgent = require('proxy-agent');
const stream = require('stream');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pump = promisify(pipeline);

/**
 * streamThroughProxy
 * - url: target URL to fetch
 * - proxyUrl: proxy to use (http[s]://... or socks5://...)
 * - res: Express response to pipe output into
 * - opts: { headers, timeout }
 *
 * Returns a Promise that resolves when streaming completes or rejects on failure.
 */
async function streamThroughProxy(url, proxyUrl, res, opts = {}) {
  // dynamic import/caching of got (v12+ is ESM-only)
  let _got = null;
  async function ensureGot() {
    if (_got) return _got;
    const mod = await import('got');
    _got = mod.default || mod;
    return _got;
  }

  const got = await ensureGot();

  const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  const gotOptions = {
    // do not decompress if you want raw bytes; by default got will decompress content-encoding. adjust as needed.
    decompress: false,
    headers: opts.headers || {},
    timeout: { request: opts.timeout || 30000 },
    agent: agent ? { http: agent, https: agent } : undefined,
    isStream: true
  };

  const upstream = got.stream(url, { ...gotOptions });

  // When upstream errors, forward to caller
  upstream.on('error', (err) => {
    // upstream will be handled by pump's rejection; keep for logging
    // Note: do not call res.end() here because caller handles errors
  });

  // Wrap upstream in a scramjet DataStream so we can e.g. monitor, transform or filter
  const ds = DataStream.from(upstream)
    .map(async (chunk) => {
      return chunk;
    })
    .tap(chunk => {
      // minimal logging per-chunk (disabled by default)
    });

  try {
    await pump(
      ds,
      res
    );
  } catch (err) {
    throw err;
  }
}

module.exports = { streamThroughProxy };
