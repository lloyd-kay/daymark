import { getWorkspaceActor } from "./auth/membership";
import {
  createStaffAccount,
  resetStaffPassword,
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

export function workspaceService() {
  return createWorkspaceService({
    getActor: getWorkspaceActor,
    listSchedule,
    cancelAppointment,
    getEmployeeAvailability,
    replaceAvailabilityRules,
    addBlockedPeriod,
    listTeamProfiles,
    createStaffAccount,
    resetStaffPassword,
    setStaffActive,
  });
}
