import { createAuth, type Env } from "./auth";

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ status: "ok" });
    if (!url.pathname.startsWith("/api/auth/")) return Response.json({ error: "Not found" }, { status: 404 });
    if (!env.BETTER_AUTH_SECRET || !env.DB) return Response.json({ error: "Auth is not configured" }, { status: 503 });
    return createAuth(env, url.origin).handler(request);
  },
};
