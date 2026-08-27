import { getWorkspaceActor } from "./auth/membership";
import {
  getWorkspaceEmbedPreference,
  setWorkspaceEmbedPreference,
} from "./data/embed-preference-repository";
import { createEmbedPreferences } from "./embed-preferences";

export function embedPreferences(workspaceSlug: string, request?: Request) {
  return createEmbedPreferences({
    getActor: () => getWorkspaceActor(workspaceSlug, request),
    getWorkspaceEmbedPreference,
    setWorkspaceEmbedPreference,
  });
}
