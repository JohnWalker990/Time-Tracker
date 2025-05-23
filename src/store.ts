import { TimeEntry } from './models/TimeEntry';
import { TimeTrackingPluginSettings } from './settings';

export interface PluginStorage {
  instances: { [trackerId: string]: TimeEntry[] };
  sortSettings: { [trackerId: string]: 'start' | 'project' | null };
  trackerDates: { [trackerId: string]: string };
  settings: TimeTrackingPluginSettings;
}
