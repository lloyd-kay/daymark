import type {
  PublicBookingScope,
  PublicEmployee,
  PublicService,
} from "../data/contracts";

export type PublicWidgetSelection = {
  initialServices: PublicService[];
  initialEmployees: PublicEmployee[];
  initialServiceId?: string;
  initialEmployeeId?: string;
};

type WidgetSelectionConfig = {
  employee: string;
  service: string;
};

type WidgetSelectionLoaders = {
  listServices: (
    scope: PublicBookingScope,
    employeeId?: string,
  ) => Promise<PublicService[]>;
  listEmployees: (
    scope: PublicBookingScope,
    serviceId?: string,
  ) => Promise<PublicEmployee[]>;
};

export async function resolveWidgetBooking(
  scope: PublicBookingScope,
  config: WidgetSelectionConfig,
  loaders: WidgetSelectionLoaders,
): Promise<PublicWidgetSelection | null> {
  const employeeId = config.employee === "all" ? undefined : config.employee;
  const services = await loaders.listServices(scope, employeeId);

  if (config.service === "all") {
    if (employeeId && services.length === 0) return null;
    return {
      initialServices: services,
      initialEmployees: [],
      initialEmployeeId: employeeId,
    };
  }

  const selectedService = services.find((service) => service.slug === config.service);
  if (!selectedService) return null;

  const qualifiedEmployees = await loaders.listEmployees(scope, selectedService.id);
  if (employeeId && !qualifiedEmployees.some((employee) => employee.id === employeeId)) {
    return null;
  }

  return {
    initialServices: [selectedService],
    initialEmployees: qualifiedEmployees,
    initialServiceId: selectedService.id,
    initialEmployeeId: employeeId,
  };
}
