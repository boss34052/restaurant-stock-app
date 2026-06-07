// Server-only helper that proxies requests to the Google Apps Script Web app.
// Runs on the server, so there is no CORS — we POST JSON and read the real
// JSON response back (no `no-cors`, no JSONP). Apps Script `doPost` handles
// addBatchMovements, addMovement and compareUsage, all returning plain JSON.

export type AppsScriptResponse = {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
};

export async function callAppsScript(
  payload: Record<string, unknown>,
): Promise<AppsScriptResponse> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) {
    throw new Error(
      "APPS_SCRIPT_URL is not configured. Set it in .env.local (local) or in the Vercel project settings (production).",
    );
  }

  const response = await fetch(url, {
    method: "POST",
    // text/plain avoids Apps Script's stricter content-type handling; the
    // script reads e.postData.contents regardless of the declared type.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow",
    cache: "no-store",
  });

  const text = await response.text();

  let data: AppsScriptResponse;
  try {
    data = JSON.parse(text) as AppsScriptResponse;
  } catch {
    throw new Error(
      `Apps Script did not return JSON. This usually means the Web app is not deployed with the current Code.gs (missing doPost/doGet). First 200 chars: ${text.slice(0, 200)}`,
    );
  }

  if (!data.ok) {
    throw new Error(data.error || "Apps Script returned an error");
  }

  return data;
}
