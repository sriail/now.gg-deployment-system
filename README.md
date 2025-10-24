# Now.gg Deployment System
Alows for simple Now.gg deployment across platform, useing a Scramjet proxy agent, and a rotateing ip config

## Fetures
- Rotates outgoing IPs through a configurable proxy pool
- Fetches an HTTP(S) stream from Now.gg
- Pipes the incoming stream through scramjet (for processing, observability, or transformation)
- Relays the stream to requesting clients via an Express endpoint

Usage
1. Copy `.env.example` to `.env` and fill in settings (proxy list, target, etc).
2. Install dependencies:
   npm install
3. Start:
   npm start
4. Request:
   GET /stream?url=<target-url>
   or
   GET /stream (uses TARGET_URL from .env)

# Deployment
- Vercel
  1. Add the repository to your Vercel account.
  2. Ensure Environment Variables from `.env.example` are set in the Vercel Project settings.
  3. This repository includes `vercel.json` which builds `src/server.js` using `@vercel/node`.
  4. Deploy from the Vercel dashboard or `vercel` CLI.

- Heroku
  1. Add the repository to a Heroku app or push the code to Heroku via Git.
  2. The root `Procfile` contains `web: node src/server.js` so Heroku will start the server.
  3. Set environment variables on your Heroku app (these correspond to the keys in `.env.example`).

- Replit
  1. Import/clone the repository into Replit.
  2. `.replit` is configured to run `npm start`.
  3. Set environment variables in Replit's Secrets tab.

Iframe embedding and sandbox controls for use in iframes if the site is inesessable
- The server supports optional, environment-driven iframe embedding controls.
- Relevant environment variables:
  - ALLOW_IFRAME (true/false) — when true the server will set a Content-Security-Policy header that includes a frame-ancestors directive. This allows embedding the site in <iframe> elements from the configured origins.
  - ALLOW_IFRAME_ORIGINS — comma-separated origins for frame-ancestors (defaults to `*` in the example, but you should set specific origins for production).
  - ALLOW_SANDBOX_IFRAME (true/false) — when true the server will add a sandbox directive to the Content-Security-Policy header. Default sandbox directives are `allow-forms allow-scripts allow-same-origin` unless overridden by ALLOW_SANDBOX_DIRECTIVES.
  - ALLOW_SANDBOX_DIRECTIVES — optional, space-separated sandbox tokens (e.g. `allow-forms allow-scripts`).
- Notes:
  - The server will set or merge the Content-Security-Policy header when ALLOW_IFRAME or ALLOW_SANDBOX_IFRAME is enabled.
  - X-Frame-Options is not set by this server (CSP frame-ancestors is the preferred mechanism).
  - Browser behavior varies; embedding services that require session affinity (cookies, pinned proxies, WebRTC) may require extra configuration.

Security and operational notes
- Only allow embedding and sandbox directives after carefully considering the security implications.
- If you allow `frame-ancestors *` you are allowing any origin to embed the app — use specific origins for production.
- For now.gg-like content that relies on session affinity or browser features (WebRTC), you may need per-client session pinning or a different proxying strategy.
```
