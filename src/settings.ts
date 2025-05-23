export interface TimeTrackingPluginSettings {
  autoCleanup: boolean;
  roundTimesToQuarterHour: boolean;
}

export const DEFAULT_SETTINGS: TimeTrackingPluginSettings = {
  autoCleanup: false,
  roundTimesToQuarterHour: false,
};
