export interface TimeTrackingPluginSettings {
  autoCleanup: boolean;
  roundTimesToQuarterHour: boolean;
  projects: string[];
  migratedProjects?: boolean;
}

export const DEFAULT_SETTINGS: TimeTrackingPluginSettings = {
  autoCleanup: false,
  roundTimesToQuarterHour: false,
  projects: [],
  migratedProjects: false,
};
