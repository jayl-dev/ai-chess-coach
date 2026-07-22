import { createApp } from "./app.js";
import { serverConfig } from "./config.js";
import { networkInterfaces } from "node:os";
import { pairingCode } from "./pairing.js";
import { publishHostOnLan, type HostPublication } from "./discovery.js";

const runtime = await createApp();
let publication: HostPublication | null = null;
runtime.server.listen(serverConfig.port, serverConfig.host, () => {
  console.info(
    `Chess Coach host listening on ${serverConfig.protocol}://${serverConfig.host}:${serverConfig.port}`,
  );
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => `${serverConfig.protocol}://${entry.address}:${serverConfig.port}`);
  addresses.forEach((address) => console.info(`Host address: ${address}`));
  console.info(`Pairing code: ${pairingCode}`);
  publication = publishHostOnLan();
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; closing service.`);
  await publication?.close();
  await new Promise<void>((resolve) => {
    runtime.server.close((error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
      resolve();
    });
  });
  await runtime.close();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
