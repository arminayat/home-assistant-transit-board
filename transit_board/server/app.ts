import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MAX_BODY_BYTES } from "../src/config.ts";
import { ConfigStore, HttpError } from "./store.ts";

export interface AppServerOptions {
  dataDir: string;
  staticDir: string;
  development?: boolean;
}

const STATIC_FILES: Record<string, { filename: string; type: string }> = {
  "/": { filename: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { filename: "app.js", type: "text/javascript; charset=utf-8" },
  "/app.css": { filename: "app.css", type: "text/css; charset=utf-8" },
};

function trustedPeer(address: string | undefined, development: boolean): boolean {
  const normalized = address?.startsWith("::ffff:") ? address.slice(7) : address;
  return development ? normalized === "127.0.0.1" || normalized === "::1" : normalized === "172.30.32.2";
}

function securityHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", [
    "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://v6.bvg.transport.rest", "img-src 'self' data:",
    "font-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'self'",
  ].join("; "));
}

function json(response: ServerResponse, status: number, body: string, etag?: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (etag) response.setHeader("ETag", etag);
  response.end(body);
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let finished = false;
    const fail = (error: Error): void => {
      if (finished) return;
      finished = true;
      reject(error);
    };
    request.on("data", (chunk: Buffer) => {
      if (finished) return;
      size += chunk.byteLength;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        fail(new HttpError(413, "The configuration exceeds the 64 KiB request limit."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (finished) return;
      finished = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "The request must contain valid JSON."));
      }
    });
    request.on("error", () => fail(new HttpError(400, "The configuration request was interrupted.")));
    request.on("aborted", () => fail(new HttpError(400, "The configuration request was interrupted.")));
  });
}

export function createAppServer(options: AppServerOptions): Server {
  const store = new ConfigStore(options.dataDir);
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    securityHeaders(response);
    if (!trustedPeer(request.socket.remoteAddress, options.development === true)) {
      throw new HttpError(403, "Access is available only through Home Assistant Ingress.");
    }
    const path = (request.url ?? "").split("?")[0];
    if (path === "/api/config") {
      if (request.method === "GET") {
        const current = await store.get();
        if (request.headers["if-none-match"] === current.etag) {
          response.statusCode = 304;
          response.setHeader("ETag", current.etag);
          response.end();
        } else json(response, 200, current.json, current.etag);
        return;
      }
      if (request.method !== "PUT") {
        response.setHeader("Allow", "GET, PUT");
        throw new HttpError(405, "Use GET to read or PUT to save the shared board.");
      }
      if (request.headers["x-transit-board"] !== "1") {
        throw new HttpError(403, "The configuration request is missing its same-origin header.");
      }
      if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
        throw new HttpError(415, "Use application/json to save the board.");
      }
      const expected = request.headers["if-match"];
      if (typeof expected !== "string" || !expected) {
        throw new HttpError(428, "Reload the saved board before saving changes.");
      }
      const length = Number(request.headers["content-length"]);
      if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
        throw new HttpError(413, "The configuration exceeds the 64 KiB request limit.");
      }
      const current = await store.save(await readJson(request), expected);
      json(response, 200, current.json, current.etag);
      return;
    }
    if (path !== "/health" && !Object.hasOwn(STATIC_FILES, path)) {
      throw new HttpError(404, "Not found.");
    }
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      throw new HttpError(405, "Use GET for this resource.");
    }
    if (path === "/health") {
      await store.get();
      json(response, 200, JSON.stringify({ status: "ok" }));
      return;
    }
    const asset = STATIC_FILES[path];
    const content = await readFile(join(options.staticDir, asset.filename));
    response.setHeader("Content-Type", asset.type);
    response.end(content);
  }
  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      request.resume();
      if (response.destroyed || response.headersSent) return;
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 413) {
        response.setHeader("Connection", "close");
        response.shouldKeepAlive = false;
      }
      json(response, status, JSON.stringify({ error: error instanceof HttpError ? error.message : "The App could not complete this request." }));
    });
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  return server;
}
