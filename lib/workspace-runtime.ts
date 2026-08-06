import { getWorkspaceActor } from "./auth/membership";
import {
  createWorkspaceInvitation,
  setStaffActive,
} from "./auth/staff-accounts";
import {
  addBlockedPeriod,
  cancelAppointment,
  getEmployeeAvailability,
  listSchedule,
  listTeamProfiles,
  replaceAvailabilityRules,
} from "./data/repository";
import { createWorkspaceService } from "./workspace-service";

export function workspaceService(workspaceSlug: string, request?: Request) {
  return createWorkspaceService({
    getActor: () => getWorkspaceActor(workspaceSlug, request),
    listSchedule,
    cancelAppointment,
    getEmployeeAvailability,
    replaceAvailabilityRules,
    addBlockedPeriod,
    listTeamProfiles,
    createWorkspaceInvitation,
    setStaffActive,
  });
}
