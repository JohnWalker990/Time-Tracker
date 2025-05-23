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
} from './utils/time';
import { PluginStorage } from './store';
import { TimeTrackingSettingTab } from './settingsTab';

export default class TimeTrackingPlugin extends Plugin {
  data: {
    instances: { [trackerId: string]: import('./models/TimeEntry').TimeEntry[] };
    sortSettings: { [trackerId: string]: 'start' | 'project' | null };
  } = { instances: {}, sortSettings: {} };

  settings: TimeTrackingPluginSettings = DEFAULT_SETTINGS;
  private processedFiles: Set<string> = new Set();

  async onload() {
    await this.loadSettings();

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
      settings: this.settings,
    };
    await this.saveData(toSave);
  }

  async loadSettings() {
    const stored = (await this.loadData()) as PluginStorage;
    if (stored) {
      this.data.instances = stored.instances || {};
      this.data.sortSettings = stored.sortSettings || {};
      this.settings = stored.settings || DEFAULT_SETTINGS;
    } else {
      this.data.instances = {};
      this.data.sortSettings = {};
      this.settings = DEFAULT_SETTINGS;
    }
  }

  async saveSettings() {
    await this.savePluginData();
  }
}

export type { TimeTrackingPlugin };
