import { getClerkInstance } from "@clerk/expo";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_API_BASE_URL. Add it to your Expo environment before starting the app.",
  );
}

type HttpMethod = "GET" | "POST" | "PATCH";

type ApiRequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | undefined>;
};

type ApiResponseEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(path, apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
}

async function getAuthToken() {
  return getClerkInstance().session?.getToken();
}

async function request<T>(method: HttpMethod, path: string, options: ApiRequestOptions = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new ApiError("You must be signed in to use the app.", 401);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiResponseEnvelope<T>
    | { success?: boolean; message?: string; details?: unknown; requestId?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? "Request failed.",
      response.status,
      payload && "details" in payload ? payload.details : undefined,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ApiError("Invalid API response.", response.status);
  }

  return payload.data;
}

export const api = {
  get<T>(path: string, query?: Record<string, string | undefined>) {
    return request<T>("GET", path, { query });
  },
  post<T>(path: string, body?: unknown, headers?: Record<string, string>) {
    return request<T>("POST", path, { body, headers });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>("PATCH", path, { body });
  },
};
