import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createAppServer } from "./app.ts";

const development = process.argv.includes("--dev");
const port = Number(process.env.PORT ?? "8099");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid port number.");

const server = createAppServer({
  dataDir: process.env.DATA_DIR ?? (development ? resolve(".dev-data") : "/data"),
  staticDir: process.env.STATIC_DIR ?? fileURLToPath(new URL("./public/", import.meta.url)),
  development,
});

server.listen(port, development ? "127.0.0.1" : "0.0.0.0");
server.on("error", () => {
  console.error("Transit Board could not start its HTTP server.");
  process.exitCode = 1;
});

let stopping = false;
function stop(): void {
  if (stopping) return;
  stopping = true;
  server.close(() => { process.exitCode = 0; });
  server.closeIdleConnections();
  const timeout = setTimeout(() => process.exit(0), 10_000);
  timeout.unref();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
