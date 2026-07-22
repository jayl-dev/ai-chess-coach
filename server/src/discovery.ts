import Bonjour from "bonjour-service";
import { hostIdentity } from "./pairing.js";
import { serverConfig } from "./config.js";

const DISCOVERY_HOSTNAME = "chess-coach.local";

export type HostPublication = {
  close: () => Promise<void>;
};

export function publishHostOnLan(): HostPublication {
  let bonjour: Bonjour | null = null;

  try {
    bonjour = new Bonjour(undefined, (error: unknown) => {
      console.warn(
        `Chess Coach LAN publication error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
    const service = bonjour.publish({
      name: hostIdentity.name,
      type: "chess-coach",
      protocol: "tcp",
      host: DISCOVERY_HOSTNAME,
      port: serverConfig.port,
      probe: true,
      disableIPv6: true,
      txt: {
        id: hostIdentity.id,
        path: "/api/host/info",
        protocol: serverConfig.protocol,
        version: "1",
      },
    });
    service.on("up", () => {
      console.info(
        `Host published as ${serverConfig.protocol}://${DISCOVERY_HOSTNAME}:${serverConfig.port}`,
      );
    });
    service.on("error", (error: unknown) => {
      console.warn(
        `Chess Coach LAN publication failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  } catch (error) {
    console.warn(
      `Chess Coach LAN publication is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    close: () =>
      new Promise<void>((resolve) => {
        if (!bonjour) {
          resolve();
          return;
        }
        bonjour.destroy(() => resolve());
        bonjour = null;
      }),
  };
}
