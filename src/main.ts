import {
  MarkdownPostProcessorContext,
  Plugin,
  TFile,
} from 'obsidian';
import { TimeTrackerBlock } from './ui/TimeTrackerBlock';
import {
  DEFAULT_SETTINGS,
  TimeTrackingPluginSettings,
} from './settings';
import {
  generateNewId,
  extractTrackerId,
  calculateDiffInMinutes,
  formatMinutesAsHM,
  isDateInRange,
} from './utils/time';
import { PluginStorage } from './store';
import { TimeTrackingSettingTab } from './settingsTab';

export default class TimeTrackingPlugin extends Plugin {
  data: {
    instances: { [trackerId: string]: import('./models/TimeEntry').TimeEntry[] };
    sortSettings: { [trackerId: string]: 'start' | 'project' | null };
    trackerDates: { [trackerId: string]: string };
  } = { instances: {}, sortSettings: {}, trackerDates: {} };

  settings: TimeTrackingPluginSettings = DEFAULT_SETTINGS;
  private processedFiles: Set<string> = new Set();

  async onload() {
    await this.loadSettings();
    this.migrateProjectsFromEntries();

    this.registerEvent(
      this.app.vault.on('modify', changedFile => {
        if (this.processedFiles.has(changedFile.path)) {
          this.processedFiles.delete(changedFile.path);
        }
      })
    );

    this.registerMarkdownCodeBlockProcessor(
      'time-tracker',
      async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const filePath = ctx.sourcePath;

        if (!this.processedFiles.has(filePath)) {
          await this.fixAllTrackerBlocksInFile(filePath);
          this.processedFiles.add(filePath);
        }

        let trackerId: string | null = null;
        const sectionInfo = ctx.getSectionInfo(el);
        if (sectionInfo) {
          const file = this.app.vault.getAbstractFileByPath(filePath);
          if (file instanceof TFile) {
            const fullContent = await this.app.vault.read(file);
            const lines = fullContent.split('\n');
            const blockLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
            const blockText = blockLines.join('\n');
            trackerId = extractTrackerId(blockText);
          }
        }

        if (!trackerId) {
          trackerId = generateNewId();
        }

        new TimeTrackerBlock(el, this, trackerId).initialize();
      }
    );

    if (this.settings.autoCleanup) {
      this.registerEvent(this.app.vault.on('modify', async (_file: TFile) => {
        // placeholder for cleanup logic
      }));
    }

    this.addCommand({
      id: 'cleanup-orphaned-data',
      name: 'Bereinige verwaiste Time Tracker Daten',
      callback: () => {
        // placeholder cleanup
      },
    });

    this.addSettingTab(new TimeTrackingSettingTab(this.app, this));
  }

  private async fixAllTrackerBlocksInFile(filePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    let content = await this.app.vault.read(file);
    const codeBlockRegex = /```time-tracker([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let updatedContent = content;
    let updated = false;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const blockContent = match[1];
      if (!extractTrackerId(blockContent)) {
        const newId = generateNewId();
        const updatedBlockContent = `\n<!-- tracker-id: ${newId} -->\n${blockContent}`;
        const oldBlock = match[0];
        const newBlock = '```time-tracker' + updatedBlockContent + '```';
        updatedContent = updatedContent.replace(oldBlock, newBlock);
        updated = true;
      }
    }

    if (updated) {
      try {
        await this.app.vault.modify(file, updatedContent);
      } catch (error) {
        console.error('File update error:', error);
      }
    }
  }

  async savePluginData() {
    const toSave: PluginStorage = {
      instances: this.data.instances,
      sortSettings: this.data.sortSettings,
      trackerDates: this.data.trackerDates,
      settings: this.settings,
    };
    await this.saveData(toSave);
  }

  getAllEntries() {
    const all: import('./models/TimeEntry').TimeEntry[] = [];
    Object.values(this.data.instances).forEach(arr => all.push(...arr));
    return all;
  }

  filterEntries(start: string, end: string, project?: string) {
    return this.getAllEntries().filter(e =>
      isDateInRange(e.date, start, end) && (!project || e.project === project)
    );
  }

  generateCsv(start: string, end: string, project?: string): string {
    const entries = this.filterEntries(start, end, project);
    const lines = ['date,start,end,project,activity,hours'];
    for (const e of entries) {
      const minutes = calculateDiffInMinutes(
        e.start,
        e.end,
        this.settings.roundTimesToQuarterHour
      );
      lines.push(
        `${e.date},${e.start},${e.end},${e.project},${e.activity},${formatMinutesAsHM(minutes)}`
      );
    }
    return lines.join('\n');
  }

  async loadSettings() {
    const stored = (await this.loadData()) as PluginStorage;
    if (stored) {
      this.data.instances = stored.instances || {};
      this.data.sortSettings = stored.sortSettings || {};
      this.data.trackerDates = stored.trackerDates || {};
      this.settings = stored.settings || DEFAULT_SETTINGS;
      if (!this.settings.projects) this.settings.projects = [];
      if (this.settings.migratedProjects === undefined) this.settings.migratedProjects = false;
      Object.values(this.data.instances).forEach(entries => {
        entries.forEach(e => {
          if (!(e as any).date) {
            (e as any).date = new Date().toISOString().slice(0, 10);
          }
        });
      });
    } else {
      this.data.instances = {};
      this.data.sortSettings = {};
      this.data.trackerDates = {};
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings() {
    await this.savePluginData();
  }

  private migrateProjectsFromEntries(): void {
    if (this.settings.migratedProjects) return;
    const set = new Set(this.settings.projects);
    Object.values(this.data.instances).forEach(entries => {
      entries.forEach(e => {
        const proj = e.project?.trim();
        if (proj) set.add(proj);
      });
    });
    this.settings.projects = Array.from(set);
    this.settings.migratedProjects = true;
    void this.saveSettings();
  }
}

export type { TimeTrackingPlugin };
