import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import os from "node:os";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { GameManager } from "./gameManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*"
  }
});

const game = new GameManager(io);

app.use(express.static(path.join(projectRoot, "client")));

app.use(
  "/vendor/three",
  express.static(path.join(projectRoot, "node_modules", "three"))
);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  game.attachSocket(socket);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4") continue;
      if (addr.internal) continue;
      results.push(addr.address);
    }
  }
  return [...new Set(results)];
}

server.listen(PORT, HOST, () => {
  const lan = getLanAddresses();
  console.log(`Hide or Hack server running at http://localhost:${PORT}`);
  for (const ip of lan) console.log(`LAN: http://${ip}:${PORT}`);
});
