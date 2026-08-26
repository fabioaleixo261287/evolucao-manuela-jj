const APPWRITE_ORIGIN = "https://nyc.cloud.appwrite.io";

export async function onRequest({ request }) {
  const incomingUrl = new URL(request.url);
  const upstreamPath = incomingUrl.pathname.replace(/^\/api\/appwrite/, "");
  const upstreamUrl = new URL(`${APPWRITE_ORIGIN}${upstreamPath}${incomingUrl.search}`);
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("cf-connecting-ip");
  headers.delete("cf-ipcountry");
  headers.delete("cf-ray");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-proto");

  const upstreamResponse = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "follow"
  });

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.set("cache-control", "no-store");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}
