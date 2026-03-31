/**
 * Performs an authenticated fetch to the backend, including Clerk token and client-side credentials.
 */
export async function authenticatedFetch(
  url: string,
  token: string | null,
  options: RequestInit = {}
) {
  const creds = localStorage.getItem("credentials");
  const headers = new Headers(options.headers || {});

  // PRE-CHECK: If no credentials in localStorage, and this is a sensitive API call (common for drive apps)
  // We throw a user-friendly error that will be caught and toasted by the UI.
  if (!creds && !url.includes("/health") && !url.includes("/api/accounts")) {
     const err = new Error("Please upload your Google Cloud credentials.json first to perform this action.");
     (err as any).isMissingCredentials = true;
     throw err;
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  
  // Headers as backup
  if (creds) {
    headers.set("X-Credentials", creds);
  }

  let body = options.body;
  let finalUrl = url;

  if (options.method === "POST") {
    // If it's a POST and we have credentials, ensure they are in the body for reliability
    if (creds) {
      try {
        let currentBody = {};
        if (typeof body === "string") {
          currentBody = JSON.parse(body);
        }
        // Inject credentials into body
        const newBody = { ...currentBody, xCredentials: JSON.parse(creds) };
        body = JSON.stringify(newBody);
        headers.set("Content-Type", "application/json");
      } catch (e) {
        // If body isn't JSON or other error, fallback to headers only
        console.warn("[API] Could not inject credentials into POST body", e);
      }
    }
  }

  // Ultimate fallback: Query String (for Download/View/Thumbnail)
  // This cannot be stripped by most proxies.
  if (creds && (url.includes("/download") || url.includes("/view") || url.includes("/thumbnail"))) {
    try {
      const b64 = btoa(creds);
      const separator = url.includes("?") ? "&" : "?";
      finalUrl = `${url}${separator}xCreds=${encodeURIComponent(b64)}`;
    } catch (e) {
      console.warn("[API] Could not encode credentials for query string", e);
    }
  }

  return fetch(finalUrl, {
    ...options,
    headers,
    body,
  });
}

/**
 * Downloads a file by fetching it as a Blob and triggering a browser download.
 */
export async function downloadFileAuthenticated(
  fileId: string,
  fileName: string,
  token: string | null,
  customPath?: string
) {
  const path = customPath || `/api/files/${fileId}/download`;
  const res = await authenticatedFetch(path, token, { method: "POST" });
  if (!res.ok) throw new Error("Failed to download file");

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Fetches media (thumbnail or image) and returns a local Object URL.
 * Remember to call URL.revokeObjectURL(url) to prevent memory leaks if reused many times.
 */
export async function fetchMediaBlobUrl(
  path: string,
  token: string | null
): Promise<string> {
  const res = await authenticatedFetch(path, token, { method: "POST" });
  if (!res.ok) throw new Error("Failed to fetch media");
  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
}
