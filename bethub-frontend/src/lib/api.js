const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const API_ORIGIN = API_BASE || window.location.origin;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE || window.location.origin;
export const TOKEN_KEY = "bethub_token";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
};

const parse = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

export async function api(path, { method = "GET", body, headers = {}, auth = true, signal } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = { Accept: "application/json", ...headers };
  if (!isForm && body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Network unreachable. Is the Bethub API running?", 0);
  }

  const data = await parse(response);
  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status, data);
  }
  return data;
}

export function uploadFile(path, file, { fields = {}, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null && value !== "") form.append(key, value);
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = { message: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(data?.message || `Upload failed (${xhr.status})`, xhr.status, data));
    };
    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection.", 0));
    xhr.send(form);
  });
}

export const uploadImage = (file, folder = "misc", onProgress) =>
  uploadFile("/api/media/image", file, { fields: { folder }, onProgress }).then((data) => data.media);

export const uploadVideo = (file, fields = {}, onProgress) =>
  uploadFile("/api/media/video", file, { fields, onProgress }).then((data) => data.video);
