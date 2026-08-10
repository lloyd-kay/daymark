import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invoke } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { listenForSetupProfileLinks } from "./deep-links";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  getCurrent: vi.fn(),
  onOpenUrl: vi.fn(),
}));

const floatingUri = "daymark://import-setup?code=DM1-C-F-2ZE7";
const inlineUri = "daymark://import-setup?code=DM1-C-I-355C";

beforeEach(() => {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
  vi.mocked(invoke).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
});

describe("Daymark setup deep links", () => {
  it("forwards initial and later URLs individually in arrival order and unsubscribes", async () => {
    let openHandler: ((urls: string[]) => void) | undefined;
    const unsubscribe = vi.fn();
    vi.mocked(onOpenUrl).mockImplementation(async (handler) => {
      openHandler = handler;
      return unsubscribe;
    });
    vi.mocked(getCurrent).mockResolvedValue([floatingUri, inlineUri]);

    const stop = await listenForSetupProfileLinks(vi.fn());

    expect(invoke).toHaveBeenNthCalledWith(1, "open_setup_profile_import", {
      uri: floatingUri,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "open_setup_profile_import", {
      uri: inlineUri,
    });

    openHandler?.([inlineUri, floatingUri]);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(4));
    expect(invoke).toHaveBeenNthCalledWith(3, "open_setup_profile_import", {
      uri: inlineUri,
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "open_setup_profile_import", {
      uri: floatingUri,
    });

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("does not install a listener outside Tauri", async () => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");

    const stop = await listenForSetupProfileLinks(vi.fn());

    expect(onOpenUrl).not.toHaveBeenCalled();
    expect(getCurrent).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(stop()).toBeUndefined();
  });

  it("reports only a generic callback when native validation rejects a URI", async () => {
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(onOpenUrl).mockResolvedValue(vi.fn());
    vi.mocked(getCurrent).mockResolvedValue([floatingUri]);
    vi.mocked(invoke).mockRejectedValue({
      code: "private_native_detail",
      message: `${floatingUri} was rejected`,
    });

    await listenForSetupProfileLinks(onError);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
