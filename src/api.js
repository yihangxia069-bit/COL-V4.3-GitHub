const KEY = "colApiBase";

function normalizeBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function getApiBase() {
  try {
    return normalizeBase(localStorage.getItem(KEY)) || normalizeBase(window.COL_CONFIG?.API_BASE_URL) || "/api";
  } catch {
    return "/api";
  }
}

export function setApiBase(value) {
  const base = normalizeBase(value);
  try {
    if (base) localStorage.setItem(KEY, base);
    else localStorage.removeItem(KEY);
  } catch {}
  return base || "/api";
}

async function request(path, body) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `API 请求失败（${res.status}）`);
  }
  return data;
}

export async function chat({ instruction, onPartial }) {
  const data = await request("/chat", { instruction });
  const text = String(data?.text ?? data?.response ?? data ?? "").trim();
  if (onPartial) onPartial(text, text);
  return { text };
}

export async function generateImage({ prompt, resolution, seed, negativePrompt = "" }) {
  return request("/image", { prompt, negativePrompt, resolution, seed });
}

export async function health() {
  const res = await fetch(`${getApiBase()}/health`);
  if (!res.ok) throw new Error(`API 健康检查失败（${res.status}）`);
  return res.json();
}
