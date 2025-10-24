const { DataStream } = require('scramjet');
const got = require('got');
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
      // chunk is Buffer (or String if encoding set). We can do light processing here:
      // e.g., do a lightweight pass-through while counting bytes.
      // Using async map allows integrating more complex I/O if needed.
      // For performance-critical streaming, avoid heavy async work in map.
      return chunk;
    })
    // Optional: tap for logging
    .tap(chunk => {
      // minimal logging per-chunk (disabled by default)
      // console.debug && console.debug('chunk length', chunk.length);
    });

  // Convert DataStream back to a Node.js readable stream and pipe to res
  // DataStream is itself a Node Transform stream, so it can be piped directly.
  // However, to ensure full pipeline piping with proper error handling, use stream.pipeline
  try {
    await pump(
      ds,
      res
    );
  } catch (err) {
    // pipeline error
    throw err;
  }
}

module.exports = { streamThroughProxy };
