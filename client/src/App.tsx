import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import HomeRoute from "./routes/HomeRoute";
import SettingsRoute from "./routes/SettingsRoute";
import {
  DEFAULT_SETTINGS,
  defaultModelFor,
  loadApiKey,
  loadSettings,
  saveApiKey,
  saveSettings,
} from "./state/settings";
import { testVisionConnection } from "./api/settings";
import { InitializationChecklist } from "./components/InitializationChecklist";
import type { AppSettings, AsyncStatus, ConnectionTestResponse } from "./types/app";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(window.localStorage));
  const [hasApiKey, setHasApiKey] = useState(() =>
    Boolean(loadApiKey(settings.provider, window.localStorage)),
  );

  useEffect(() => {
    setHasApiKey(Boolean(loadApiKey(settings.provider, window.localStorage)));
  }, [settings.provider]);
  const [syncStatus, setSyncStatus] = useState<AsyncStatus>({
    phase: "success",
    message: "Settings are saved in this app.",
  });
  const [showInitialization, setShowInitialization] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.accentTheme);
    const saved = saveSettings(settings, window.localStorage);
    setSyncStatus(
      saved
        ? { phase: "success", message: "Settings are saved in this app." }
        : { phase: "error", message: "This browser could not save settings locally." },
    );
  }, [settings]);

  const updateSettings = (patch: Partial<AppSettings>) => {
    if (patch.provider !== undefined && patch.provider !== settings.provider) {
      setHasApiKey(Boolean(loadApiKey(patch.provider, window.localStorage)));
    }
    setSettings((current) => {
      if (patch.provider === undefined || patch.provider === current.provider) {
        return { ...current, ...patch };
      }
      const next: AppSettings = { ...current, provider: patch.provider };
      if (patch.model === undefined) {
        next.model = defaultModelFor(patch.provider);
      }
      return next;
    });
  };

  const saveAndTestApiKey = async (apiKey: string): Promise<ConnectionTestResponse> => {
    const trimmedKey = apiKey.trim();
    const result = await testVisionConnection(settings.provider, trimmedKey || undefined);
    if (trimmedKey) {
      if (!saveApiKey(settings.provider, trimmedKey, window.localStorage)) {
        throw new Error("This browser could not save the API key locally.");
      }
      setHasApiKey(true);
    }
    return result;
  };

  const removeApiKey = async () => {
    if (!saveApiKey(settings.provider, null, window.localStorage)) {
      throw new Error("This browser could not remove the locally saved API key.");
    }
    setHasApiKey(Boolean(loadApiKey(settings.provider, window.localStorage)));
  };

  const restoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    const saved = saveSettings(DEFAULT_SETTINGS, window.localStorage);
    setSyncStatus(
      saved
        ? { phase: "success", message: "Default settings restored in this app." }
        : { phase: "error", message: "This browser could not save the default settings." },
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <>
        <Routes>
          <Route path="/" element={<HomeRoute settings={settings} />} />
          <Route
            path="/settings"
            element={
              <SettingsRoute
                settings={settings}
                hasApiKey={hasApiKey}
                syncStatus={syncStatus}
                onSettingsChange={updateSettings}
                onRestore={restoreDefaults}
                onSaveAndTestApiKey={saveAndTestApiKey}
                onRemoveApiKey={removeApiKey}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {showInitialization ? (
          <InitializationChecklist
            autoCropBoard={settings.autoCropBoard}
            liveBoardGuide={settings.liveBoardGuide}
            provider={settings.provider}
            onAutoCropBoardChange={(autoCropBoard) => updateSettings({ autoCropBoard })}
            onContinue={() => setShowInitialization(false)}
          />
        ) : null}
      </>
    </MotionConfig>
  );
}
