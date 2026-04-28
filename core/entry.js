export const config = { runtime: "edge" };

const UPSTREAM = (process.env.BACKEND_URL || "").replace(/\/$/, "");

const SKIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function main(req) {
  if (!UPSTREAM) {
    return new Response("Missing BACKEND_URL env", { status: 500 });
  }

  try {
    const idx = req.url.indexOf("/", 8);
    const targetUrl =
      idx === -1 ? UPSTREAM + "/" : UPSTREAM + req.url.slice(idx);

    const outHeaders = new Headers();
    let realIp = null;

    for (const [k, v] of req.headers) {
      if (SKIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        realIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!realIp) realIp = v;
        continue;
      }
      outHeaders.set(k, v);
    }

    if (realIp) outHeaders.set("x-forwarded-for", realIp);

    const method = req.method;
    const hasPayload = method !== "GET" && method !== "HEAD";

    const resp = await fetch(targetUrl, {
      method,
      headers: outHeaders,
      body: hasPayload ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

    return resp;
  } catch (err) {
    console.error("proxy error:", err);
    return new Response("Edge connection failed", { status: 502 });
  }
}
