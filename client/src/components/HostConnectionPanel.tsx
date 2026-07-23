import { useState } from "react";
import { pairHost, probeHost, scanForHosts, type HostInfo } from "../api/host";
import { savePairedHost, type PairedHost } from "../state/host";
import styles from "./HostConnectionPanel.module.css";

type Props = {
  host: PairedHost | null;
  onHostChange: (host: PairedHost | null) => void;
  prompt?: string;
};

export function HostConnectionPanel({ host, onHostChange, prompt }: Props) {
  const [address, setAddress] = useState(host?.baseUrl ?? "");
  const [candidate, setCandidate] = useState<HostInfo | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const discover = async () => {
    setBusy(true);
    setMessage("Looking for a Chess Coach host… Allow local network access if your browser asks.");
    try {
      const hosts = address.trim() ? [await probeHost(address)] : await scanForHosts(host?.baseUrl);
      if (!hosts.length) {
        setCandidate(null);
        setMessage(
          "No host was found automatically. Enter the host address shown on its terminal.",
        );
        return;
      }
      setCandidate(hosts[0]);
      setAddress(hosts[0].baseUrl);
      setMessage(`Found ${hosts[0].name}. Enter its six-digit pairing code.`);
    } catch (error) {
      setCandidate(null);
      setMessage(error instanceof Error ? error.message : "Could not find the host.");
    } finally {
      setBusy(false);
    }
  };

  const pair = async () => {
    if (!candidate) return;
    setBusy(true);
    setMessage("Pairing…");
    try {
      const pairedHost = await pairHost(candidate, code);
      if (!savePairedHost(pairedHost)) throw new Error("This app could not save the paired host.");
      onHostChange(pairedHost);
      setCode("");
      setMessage(`Connected to ${pairedHost.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pairing failed.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    savePairedHost(null);
    onHostChange(null);
    setCandidate(null);
    setMessage("Host disconnected.");
  };

  return (
    <section className={styles.panel} aria-label="Screenshot host connection">
      <div className={styles.titleRow}>
        <span className={`${styles.dot}${host ? ` ${styles.connected}` : ""}`} aria-hidden="true" />
        <h3>{host ? host.name : "Connect Screenshot Host"}</h3>
      </div>
      {host ? (
        <div className={styles.connectedRow}>
          <span>Connected · {host.baseUrl}</span>
          <button type="button" className={styles.linkButton} onClick={disconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <>
          <div className={styles.addressRow}>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Host address, or scan known hosts"
              aria-label="Screenshot host address"
            />
            <button type="button" className="bubbly-accent-button" onClick={() => void discover()} disabled={busy}>
              {busy ? "Scanning…" : "Scan"}
            </button>
          </div>
          {candidate && (
            <div className={styles.addressRow}>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                aria-label="Pairing code"
              />
              <button
                type="button"
                className="bubbly-accent-button"
                onClick={() => void pair()}
                disabled={busy || code.length !== 6}
              >
                Pair
              </button>
            </div>
          )}
        </>
      )}
      {(message || prompt) && (
        <p className={styles.message} role="status">
          {message || prompt}
        </p>
      )}
    </section>
  );
}
