import { getClerkInstance } from "@clerk/expo";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const REQUEST_TIMEOUT_MS = 12000;
const UPLOAD_TIMEOUT_MS = 120000;

if (!apiBaseUrl) {
  console.error(
    "Missing EXPO_PUBLIC_API_BASE_URL. Add it to your Expo environment before starting the app.",
  );
}

type HttpMethod = "GET" | "POST" | "PATCH";

type ApiRequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | undefined>;
};

type UploadOptions = {
  onProgress?: (progress: number) => void;
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
  const session = getClerkInstance().session;
  const token = await session?.getToken({ skipCache: true } as never);
  console.log("[api] Clerk auth token present", Boolean(token));
  return token;
}

async function request<T>(method: HttpMethod, path: string, options: ApiRequestOptions = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new ApiError("You must be signed in to use the app.", 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Backend request timed out. Check that the API server is running and reachable.", 0);
    }

    throw new ApiError("Network request failed. Check that the API server is running and your device is on the same network.", 0, error);
  } finally {
    clearTimeout(timeout);
  }

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

async function upload<T>(path: string, formData: FormData, options: UploadOptions = {}) {
  const token = await getAuthToken();

  if (!token) {
    throw new ApiError("You must be signed in to use the app.", 401);
  }

  const url = buildUrl(path);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded / event.total);
      }
    };

    xhr.onerror = () => {
      reject(new ApiError("Network request failed while uploading prescription. Check that the API server is reachable.", 0));
    };

    xhr.ontimeout = () => {
      reject(new ApiError("Prescription decoding timed out. Retry with a clearer image or check the backend logs.", 0));
    };

    xhr.onload = () => {
      const payload = (() => {
        try {
          return JSON.parse(xhr.responseText || "null") as
            | ApiResponseEnvelope<T>
            | { success?: boolean; message?: string; details?: unknown; requestId?: string }
            | null;
        } catch {
          return null;
        }
      })();

      if (xhr.status < 200 || xhr.status >= 300) {
        console.log("[api] upload failed", { path, status: xhr.status, payload });
        reject(
          new ApiError(
            payload?.message ?? "Upload failed.",
            xhr.status,
            payload && "details" in payload ? payload.details : undefined,
          ),
        );
        return;
      }

      if (!payload || !("data" in payload)) {
        reject(new ApiError("Invalid upload response.", xhr.status));
        return;
      }

      options.onProgress?.(1);
      console.log("[api] upload response", payload.data);
      resolve(payload.data);
    };

    xhr.send(formData);
  });
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
  upload,
};
