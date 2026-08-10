import { invoke } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";

import { isTauriRuntime } from "./runtime";

type StopListening = () => void;

export async function listenForSetupProfileLinks(
  onError: () => void,
): Promise<StopListening> {
  if (!isTauriRuntime()) return () => undefined;

  let active = true;
  let queue = Promise.resolve();
  const enqueue = (uri: string) => {
    queue = queue
      .then(async () => {
        if (active) await invoke("open_setup_profile_import", { uri });
      })
      .catch(() => {
        if (active) onError();
      });
  };

  let unsubscribe: StopListening;
  try {
    unsubscribe = await onOpenUrl((urls) => {
      for (const uri of urls) enqueue(uri);
    });
  } catch {
    onError();
    return () => undefined;
  }

  try {
    const current = await getCurrent();
    for (const uri of current ?? []) enqueue(uri);
    await queue;
  } catch {
    onError();
  }

  return () => {
    active = false;
    unsubscribe();
  };
}
