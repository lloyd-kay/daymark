import { getWorkspaceActor } from "./auth/membership";
import {
  createWorkspaceService,
  listWorkspaceServices,
  setEmployeeServiceQualification,
  setWorkspaceServiceActive,
  updateWorkspaceService,
} from "./data/service-repository";
import { createServiceManagement } from "./service-management";

export function serviceManagement(workspaceSlug: string, request?: Request) {
  return createServiceManagement({
    getActor: () => getWorkspaceActor(workspaceSlug, request),
    listWorkspaceServices,
    createWorkspaceService,
    updateWorkspaceService,
    setWorkspaceServiceActive,
    setEmployeeServiceQualification,
  });
}
