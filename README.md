# now.gg Deployment System

A streaming proxy server using rotating proxies with scramjet for content delivery.

## Features

- Rotating proxy pool with automatic health checks
- Stream content through multiple proxy servers
- Support for HTTP and SOCKS5 proxies
- Configurable iframe embedding support
- Easy deployment to Vercel, Heroku, or Replit

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

### Environment Variables

- `PROXIES` - Comma-separated list of proxy URLs (http://user:pass@host:port or socks5://...)
- `TARGET_URL` - Default target URL to stream if none provided in query string
- `PORT` - Port to run the server on (default: 3000)
- `PROXY_HEALTH_INTERVAL` - How often (ms) to run proxy health checks (default: 30000)
- `DEBUG` - Enable debug logging (true/false)
- `MAX_TRIES` - Max proxy attempts before failing a request (default: 5)

### iframe Embedding Configuration

The server supports optional iframe embedding with configurable security headers:

- `ALLOW_IFRAME` - Set to `true` to allow embedding in iframes (default: false)
- `ALLOW_IFRAME_ORIGINS` - Comma-separated list of origins allowed to embed (default: `*`)
  - Use `*` to allow any origin
  - Use `self` to allow same origin only
  - Use specific origins like `https://example.com,https://another.com`
- `ALLOW_SANDBOX_IFRAME` - Set to `true` to add sandbox directive (default: false)
- `ALLOW_SANDBOX_DIRECTIVES` - Custom sandbox directives (default: `allow-forms allow-scripts allow-same-origin`)

**Note:** Browser support for Content-Security-Policy headers varies. Embedding now.gg content may require session pinning or other measures depending on the target service.

## Running Locally

```bash
npm start
```

Or with debug logging:

```bash
npm run dev
```

## API Endpoints

### GET /

Returns server status and number of configured proxies.

### GET /stream?url=<target>

Streams the requested target URL through the rotating proxy pool.

- If no `url` query parameter is provided, uses `TARGET_URL` from environment
- Returns 400 if no URL is configured
- Returns 502 if all proxy attempts fail

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard or using CLI:
   ```bash
   vercel env add PROXIES
   vercel env add TARGET_URL
   vercel env add ALLOW_IFRAME
   vercel env add ALLOW_IFRAME_ORIGINS
   ```

The `vercel.json` file configures the deployment to use Node.js serverless functions.

### Deploy to Heroku

1. Install Heroku CLI and login:
   ```bash
   heroku login
   ```

2. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```

3. Set environment variables:
   ```bash
   heroku config:set PROXIES="http://proxy1.example:8000,http://proxy2.example:8000"
   heroku config:set TARGET_URL="https://example.com/path"
   heroku config:set ALLOW_IFRAME=true
   heroku config:set ALLOW_IFRAME_ORIGINS="*"
   ```

4. Deploy:
   ```bash
   git push heroku main
   ```

The `Procfile` tells Heroku how to run the application.

### Deploy to Replit

1. Import this repository to Replit
2. The `.replit` file automatically configures the run command
3. Set environment variables in Replit's "Secrets" (environment) panel:
   - Add `PROXIES`
   - Add `TARGET_URL`
   - Add `ALLOW_IFRAME` (if needed)
   - Add `ALLOW_IFRAME_ORIGINS` (if needed)

4. Click "Run" to start the server

## How iframe Embedding Works

When `ALLOW_IFRAME=true`:
- The server sets `Content-Security-Policy: frame-ancestors <origins>` header
- This allows the page to be embedded in iframes from specified origins
- The deprecated `X-Frame-Options` header is not set (CSP takes precedence)

When `ALLOW_SANDBOX_IFRAME=true`:
- The server adds `sandbox <directives>` to the Content-Security-Policy
- Default directives: `allow-forms allow-scripts allow-same-origin`
- Custom directives can be set via `ALLOW_SANDBOX_DIRECTIVES`

Both options can be used together - the CSP header will combine both directives with `; ` separator.

**Important:** If neither option is enabled, the server operates normally without these headers (backwards compatible).

## License

MIT
