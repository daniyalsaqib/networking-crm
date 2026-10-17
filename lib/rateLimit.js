import { LRUCache } from "lru-cache";

// Cache storing fixed-window entries: { count: number, resetAt: number }
// Max 5000 items, TTL 5 minutes to allow natural eviction of expired windows
const tokenCache = new LRUCache({
  max: 5000,
  ttl: 5 * 60 * 1000,
});

/**
 * Checks and increments rate limit using a fixed-time window.
 * The window reset time does NOT slide on subsequent requests, preventing
 * starvation / infinite lockout for clients that keep sending requests.
 *
 * @param {string} key - Unique rate limit identifier
 * @param {number} limit - Maximum allowed requests in window
 * @param {number} windowMs - Window duration in milliseconds (default: 60,000ms / 1 min)
 * @returns {boolean} - true if rate limit exceeded, false if allowed
 */
export function rateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const entry = tokenCache.get(key);

  if (!entry || now >= entry.resetAt) {
    // Window expired or first request: start fresh fixed window
    tokenCache.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= limit) {
    // Over the limit. Do NOT advance resetAt (prevents sliding-window starvation lockout)
    return true;
  }

  // Increment counter within current fixed window without extending resetAt
  entry.count += 1;
  tokenCache.set(key, entry);
  return false;
}

// Basic IPv4 / IPv6 validation regex to avoid key injection from arbitrary header payloads
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

function isValidIP(ip) {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || (trimmed.includes(":") && IPV6_REGEX.test(trimmed));
}

/**
 * Selects the client address from the trusted proxy chain.
 *
 * Rules:
 * 1. Trust `x-real-ip` ONLY when running behind a trusted reverse proxy that overwrites it
 *    (e.g., Vercel edge, Cloudflare, or an explicitly configured TRUST_PROXY environment).
 *    On direct/untrusted connections, client-supplied x-real-ip is ignored to prevent spoofing.
 * 2. When inspecting `x-forwarded-for`, select the client address from the trusted proxy chain
 *    by walking back from the right by the number of trusted proxy hops (default 1).
 *
 * @param {Request|Object} request
 * @returns {string} Safe validated client address
 */
export function getIP(request) {
  if (!request) return "127.0.0.1";

  const headers = request.headers;
  const getHeader = (name) => {
    if (!headers) return null;
    if (typeof headers.get === "function") {
      return headers.get(name);
    }
    if (typeof headers === "object") {
      return headers[name.toLowerCase()] || headers[name] || null;
    }
    return null;
  };

  // Determine whether this request is being served behind a trusted reverse proxy
  // that is verified to overwrite/strip client headers.
  const isVercel = Boolean(process.env.VERCEL || getHeader("x-vercel-id"));
  const isCloudflare = Boolean(getHeader("cf-ray"));
  const trustProxyEnv = process.env.TRUST_PROXY;
  const isTrustedProxy =
    isVercel || isCloudflare || trustProxyEnv === "true" || trustProxyEnv === "1";

  // 1. Trust x-real-ip ONLY when the proxy overwrites it
  if (isTrustedProxy) {
    const realIp = getHeader("x-real-ip") || getHeader("x-vercel-ip") || getHeader("cf-connecting-ip");
    if (isValidIP(realIp)) {
      return realIp.trim();
    }
  }

  // 2. Select client address from the trusted proxy chain in X-Forwarded-For
  const forwardedFor = getHeader("x-forwarded-for");
  if (forwardedFor && typeof forwardedFor === "string") {
    const chain = forwardedFor
      .split(",")
      .map((p) => p.trim())
      .filter(isValidIP);

    if (chain.length > 0 && isTrustedProxy) {
      // In a trusted reverse-proxy chain, each trusted proxy appends the remote address.
      // Stepping back by the number of trusted hops gives the actual client address.
      const trustedHops = Math.max(1, parseInt(process.env.TRUSTED_PROXY_HOPS || "1", 10));
      const clientIndex = Math.max(0, chain.length - trustedHops);
      return chain[clientIndex];
    }
  }

  return "127.0.0.1";
}
