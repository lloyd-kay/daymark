import { getWorkspaceActor } from "./auth/membership";
import {
  addBlockedPeriod,
  cancelAppointment,
  createInvitation,
  getEmployeeAvailability,
  listSchedule,
  listTeamProfiles,
  replaceAvailabilityRules,
  setEmployeeActive,
} from "./data/repository";
import { createWorkspaceService } from "./workspace-service";

export function workspaceService() {
  return createWorkspaceService({
    getActor: getWorkspaceActor,
    listSchedule,
    cancelAppointment,
    getEmployeeAvailability,
    replaceAvailabilityRules,
    addBlockedPeriod,
    listTeamProfiles,
    createInvitation,
    setEmployeeActive,
  });
}
