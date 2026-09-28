import { isLotBriefCard, rewriteLotBrief } from './src/model/lotBriefRewrite.ts'

interface PagesEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
}

const JAVASCRIPT_ASSETS = new Set([
  '/assets/maplibre-gl-worker.mjs',
  '/assets/maplibre-gl-shared.mjs',
])

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function withJavascriptType(pathname: string, response: Response): Response {
  if (!JAVASCRIPT_ASSETS.has(pathname)) return response
  const headers = new Headers(response.headers)
  headers.set('Content-Type', 'text/javascript')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Cloudflare Pages advanced-mode worker. It lives in the static build output
 * as `dist/_worker.js`. Only `/api/lot-brief` is handled here; every other
 * request is the static site.
 */
export default {
  async fetch(request: Request, env: PagesEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/lot-brief') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204 })
      if (request.method !== 'POST') return json({ error: 'POST only' }, 405)
      let card: unknown
      try {
        card = await request.json()
      } catch {
        return json({ error: 'invalid lot brief card' }, 400)
      }
      if (!isLotBriefCard(card)) return json({ error: 'invalid lot brief card' }, 400)
      return json(await rewriteLotBrief(card, env))
    }

    const asset = await env.ASSETS.fetch(request)
    if (asset.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      const index = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), request))
      return new Response(index.body, { status: 200, headers: index.headers })
    }
    return withJavascriptType(url.pathname, asset)
  },
}
