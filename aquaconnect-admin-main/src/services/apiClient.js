const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001";
const REQUEST_TIMEOUT_MS = 12000;
const GET_CACHE_TTL_MS = 15000;
const responseCache = new Map();

function getAccessToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("accessToken") || "";
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    query,
    body,
    useAuth = false,
    token,
    timeoutMs = REQUEST_TIMEOUT_MS,
    retries,
  } = options;
  const normalizedMethod = String(method).toUpperCase();

  const headers = {
    "Content-Type": "application/json",
  };

  const requestUrl = buildUrl(path, query);

  // Cache only unauthenticated GET requests for a short period.
  const canUseCache = normalizedMethod === "GET" && !useAuth && !token;
  if (canUseCache) {
    const cached = responseCache.get(requestUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return JSON.parse(JSON.stringify(cached.payload));
    }
    if (cached) {
      responseCache.delete(requestUrl);
    }
  }

  if (useAuth) {
    const authToken = token || getAccessToken();
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
  }

  const retryCount =
    typeof retries === "number"
      ? Math.max(0, retries)
      : normalizedMethod === "GET"
        ? 1
        : 0;
  const connectionIssueMessage =
    "Unable to connect to AquaConnect services right now. This may be due to internet instability or a temporary database connection issue. Please check your connection and try again.";

  let response;
  let lastError = null;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      response = await fetch(requestUrl, {
        method: normalizedMethod,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) {
        continue;
      }

      if (error?.name === "AbortError") {
        throw new Error(
          "Request timed out while contacting AquaConnect services. Please check your internet connection and try again.",
        );
      }

      const wrappedError = new Error(connectionIssueMessage);
      wrappedError.cause = error;
      throw wrappedError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!response) {
    const wrappedError = new Error(connectionIssueMessage);
    wrappedError.cause = lastError;
    throw wrappedError;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const rawMessage = payload?.message || payload?.error || "Request failed";
    const isLikelyDbConnectivityIssue =
      response.status >= 500 &&
      /database|db|connect|connection|timeout|econn|network/i.test(
        String(rawMessage),
      );
    const message = isLikelyDbConnectivityIssue
      ? connectionIssueMessage
      : rawMessage;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (canUseCache) {
    responseCache.set(requestUrl, {
      payload,
      expiresAt: Date.now() + GET_CACHE_TTL_MS,
    });
  }

  return payload;
}

export function getJwtPayload() {
  const token = getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const payloadPart = token.split(".")[1] || "";
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (_error) {
    return null;
  }
}
