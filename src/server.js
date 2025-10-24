require('dotenv').config();
const express = require('express');
const ProxyPool = require('./proxyPool');
const { streamThroughProxy } = require('./streamer');
const Pino = require('pino');

const logger = Pino({ level: process.env.DEBUG === 'true' ? 'debug' : 'info' });

const PROXIES = (process.env.PROXIES || '').split(',').filter(Boolean);
const TARGET_URL = process.env.TARGET_URL || '';
const PORT = parseInt(process.env.PORT || '3000', 10);
const PROXY_HEALTH_INTERVAL = parseInt(process.env.PROXY_HEALTH_INTERVAL || '30000', 10);
const MAX_TRIES = parseInt(process.env.MAX_TRIES || '5', 10);

const proxyPool = new ProxyPool(PROXIES, { healthInterval: PROXY_HEALTH_INTERVAL, logger });

const app = express();

// Middleware for iframe embedding and CSP headers
app.use((req, res, next) => {
  const allowIframe = process.env.ALLOW_IFRAME === 'true';
  const allowSandboxIframe = process.env.ALLOW_SANDBOX_IFRAME === 'true';
  
  if (allowIframe || allowSandboxIframe) {
    const cspDirectives = [];
    
    // Add frame-ancestors directive if iframe embedding is allowed
    if (allowIframe) {
      const origins = process.env.ALLOW_IFRAME_ORIGINS || '*';
      cspDirectives.push(`frame-ancestors ${origins}`);
    }
    
    // Add sandbox directive if sandboxed iframes are allowed
    if (allowSandboxIframe) {
      const sandboxDirectives = process.env.ALLOW_SANDBOX_DIRECTIVES || 'allow-forms allow-scripts allow-same-origin';
      cspDirectives.push(`sandbox ${sandboxDirectives}`);
    }
    
    // Set Content-Security-Policy header with combined directives
    if (cspDirectives.length > 0) {
      res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
    }
  }
  
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'scramjet + rotating-proxy streamer', proxiesConfigured: PROXIES.length });
});

/**
 * /stream?url=<target>
 *
 * Streams the requested target through a rotating proxy.
 * If no url query is provided, uses TARGET_URL from .env
 */
app.get('/stream', async (req, res) => {
  const target = req.query.url || TARGET_URL;
  if (!target) {
    return res.status(400).json({ error: 'No url provided (query param "url" or TARGET_URL env required).' });
  }

  // set headers suitable for streaming passthrough
  // do not set content-length for chunked relays
  res.setHeader('Cache-Control', 'no-cache');
  // optional: forward content type from upstream once known. For now, set to octet-stream
  res.setHeader('Content-Type', 'application/octet-stream');

  let attempt = 0;
  let lastErr = null;

  while (attempt < MAX_TRIES) {
    attempt++;
    const proxy = proxyPool.getNextProxy();
    const proxyUrl = proxy ? proxy.url : null;
    logger.info({ attempt, proxy: proxyUrl }, `Attempting stream for ${target}`);

    try {
      await streamThroughProxy(target, proxyUrl, res, { timeout: 45000 });
      // streaming finished successfully (client closed stream when done)
      logger.info({ target }, 'Stream completed successfully');
      return; // pipeline closed normally
    } catch (err) {
      // If response has been partially sent, we cannot re-send; ensure connection closed.
      lastErr = err;
      logger.warn({ err: err.message, proxy: proxyUrl }, 'Streaming attempt failed, marking proxy failed and trying next one.');
      if (proxyUrl) proxyPool.markFailed(proxyUrl);

      // If client disconnected, stop trying
      if (res.finished || res.headersSent && res.socket.destroyed) {
        logger.info('Client disconnected; aborting tries.');
        return;
      }

      // try next proxy (loop)
      // small backoff
      await new Promise(r => setTimeout(r, 500));
    }
  }

  logger.error({ lastErr: lastErr && lastErr.message }, `All ${MAX_TRIES} attempts failed for ${target}`);
  // If nothing has been sent, return error json
  if (!res.headersSent) {
    res.status(502).json({ error: 'Failed to fetch stream through proxy pool', detail: lastErr && lastErr.message });
  } else {
    // headers were sent, terminate
    try { res.end(); } catch (e) {}
  }
});

app.listen(PORT, () => {
  logger.info(`Server listening on ${PORT}`);
});
