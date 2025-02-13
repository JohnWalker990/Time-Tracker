// Summary: This plugin registers a markdown code block processor for "time-tracker" blocks,
// stores time entries keyed by a unique ID, and implements extended features:
// 1) Optional rounding of times to 15-min increments,
// 2) Per-project sum display if multiple projects exist in one block,
// 3) Sorting the entries by project or start time,
// 4) Proper tab focus by partial row updates rather than full re-render.

import {
	Plugin,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	PluginSettingTab,
	App,
	Setting,
	TFile
   } from 'obsidian';
   
   interface TimeEntry {
	start: string;
	end: string;
	project: string;
	activity: string;
   }
   
   interface TimeTrackingPluginSettings {
	autoCleanup: boolean;
	roundTimesToQuarterHour: boolean; // new setting for 15-min rounding
   }
   
   const DEFAULT_SETTINGS: TimeTrackingPluginSettings = {
	autoCleanup: false,
	roundTimesToQuarterHour: false
   };
   
   interface PluginStorage {
	instances: { [trackerId: string]: TimeEntry[] };
	sortSettings: { [trackerId: string]: 'start' | 'project' | null }; // store chosen sort for each block
	settings: TimeTrackingPluginSettings;
   }
   
   function generateNewId(): string {
	return Math.random().toString(36).substr(2, 9);
   }
   
   function extractTrackerId(text: string): string | null {
	const regex = /<!--\s*tracker-id:\s*(\S+)\s*-->/;
	const match = regex.exec(text);
	return match ? match[1] : null;
   }
   
   export default class TimeTrackingPlugin extends Plugin {
	data: {
	  instances: { [trackerId: string]: TimeEntry[] };
	  sortSettings: { [trackerId: string]: 'start' | 'project' | null };
	} = {
	  instances: {},
	  sortSettings: {}
	};
   
	settings: TimeTrackingPluginSettings = DEFAULT_SETTINGS;
	private processedFiles: Set<string> = new Set();
   
	async onload() {
	  console.log("TimeTrackingPlugin loading");
	  await this.loadSettings();
   
	  // Re-check IDs if file changes externally
	  this.registerEvent(this.app.vault.on('modify', (changedFile) => {
	    if (this.processedFiles.has(changedFile.path)) {
		 this.processedFiles.delete(changedFile.path);
	    }
	  }));
   
	  // Codeblock processor
	  this.registerMarkdownCodeBlockProcessor("time-tracker", async (source, el, ctx) => {
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
		   const lines = fullContent.split("\n");
		   const blockLines = lines.slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
		   const blockText = blockLines.join("\n");
		   trackerId = extractTrackerId(blockText);
		 }
	    }
   
	    if (!trackerId) {
		 trackerId = generateNewId();
	    }
   
	    new TimeTrackerBlock(el, this, trackerId).initialize();
	  });
   
	  if (this.settings.autoCleanup) {
	    this.registerEvent(
		 this.app.vault.on('modify', async (file: TFile) => {
		   // placeholder for cleanup logic
		 })
	    );
	  }
   
	  this.addCommand({
	    id: 'cleanup-orphaned-data',
	    name: 'Bereinige verwaiste Time Tracker Daten',
	    callback: () => {
		 new Notice("Manuelle Bereinigung wurde ausgeführt (aktuell leer).");
	    }
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
		 const newBlock = "```time-tracker" + updatedBlockContent + "```";
		 updatedContent = updatedContent.replace(oldBlock, newBlock);
		 updated = true;
	    }
	  }
   
	  if (updated) {
	    try {
		 await this.app.vault.modify(file, updatedContent);
	    } catch (error) {
		 console.error("File update error:", error);
		 new Notice("Fehler beim Einfügen der Time-Tracker IDs.");
	    }
	  }
	}
   
	async savePluginData() {
	  const toSave: PluginStorage = {
	    instances: this.data.instances,
	    sortSettings: this.data.sortSettings,
	    settings: this.settings
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
   
   class TimeTrackerBlock extends MarkdownRenderChild {
	plugin: TimeTrackingPlugin;
	container: HTMLElement;
	trackerId: string;
   
	private tableEl: HTMLTableElement;
	private tbody: HTMLTableSectionElement;
	private sumRow: HTMLTableRowElement;
	private projectSummaryContainer: HTMLElement; 
	private sortSelect: HTMLSelectElement;
   
	constructor(containerEl: HTMLElement, plugin: TimeTrackingPlugin, trackerId: string) {
	  super(containerEl);
	  this.plugin = plugin;
	  this.container = containerEl;
	  this.trackerId = trackerId;
	}
   
	initialize() {
	  this.container.empty();
   
	  if (!this.plugin.data.instances[this.trackerId]) {
	    this.plugin.data.instances[this.trackerId] = [];
	  }
	  if (!this.plugin.data.sortSettings[this.trackerId]) {
	    this.plugin.data.sortSettings[this.trackerId] = null;
	  }
   
	  // Sorting UI
	  const sortWrapper = this.container.createDiv({ cls: 'time-tracker-sort-wrapper' });
	  sortWrapper.createSpan({ text: 'Sortieren nach: ' });
	  this.sortSelect = sortWrapper.createEl('select');
	  this.sortSelect.createEl('option', { text: 'Keine', value: '' });
	  this.sortSelect.createEl('option', { text: 'Startzeit', value: 'start' });
	  this.sortSelect.createEl('option', { text: 'Projekt', value: 'project' });
   
	  const currentSort = this.plugin.data.sortSettings[this.trackerId];
	  if (currentSort === 'start') this.sortSelect.value = 'start';
	  if (currentSort === 'project') this.sortSelect.value = 'project';
   
	  this.sortSelect.onchange = () => {
	    let val = this.sortSelect.value;
	    if (val === '') {
		 this.plugin.data.sortSettings[this.trackerId] = null;
	    } else if (val === 'start') {
		 this.plugin.data.sortSettings[this.trackerId] = 'start';
	    } else {
		 this.plugin.data.sortSettings[this.trackerId] = 'project';
	    }
	    this.plugin.savePluginData();
   
	    // Old call was: this.renderTable();
	    // Instead, we do partial re-render:
	    this.renderTableRows();
	    this.updateAllSums();
	  };
   
	  // Table
	  this.tableEl = this.container.createEl('table', { cls: 'time-tracker-table' });
	  const headerRow = this.tableEl.createEl('tr');
	  headerRow.createEl('th', { text: 'Startzeit' });
	  headerRow.createEl('th', { text: 'Endzeit' });
	  headerRow.createEl('th', { text: 'Stunden' });
	  headerRow.createEl('th', { text: 'Projekt' });
	  headerRow.createEl('th', { text: 'Tätigkeit' });
	  headerRow.createEl('th', { text: 'Aktion' });
   
	  this.tbody = this.tableEl.createEl('tbody');
	  this.renderTableRows();
   
	  // Summation row
	  this.sumRow = this.tableEl.createEl('tr', { cls: 'sum-row' });
	  const sumLabelCell = this.sumRow.createEl('td', { attr: { colspan: "2" } });
	  sumLabelCell.setText('Gesamt-Summe');
	  const sumHoursCell = this.sumRow.createEl('td', { cls: 'sum-hours' });
	  sumHoursCell.setText(this.calculateSumAll());
	  this.sumRow.createEl('td');
	  this.sumRow.createEl('td');
	  this.sumRow.createEl('td');
   
	  this.container.appendChild(this.tableEl);
   
	  // Project-based summary
	  this.projectSummaryContainer = this.container.createDiv({ cls: 'time-tracker-project-sums' });
	  this.renderProjectSummaries();
   
	  // Add entry button
	  const addButton = this.container.createEl('button', { text: 'Zeile hinzufügen' });
	  addButton.onclick = () => {
	    const newEntry: TimeEntry = { start: '', end: '', project: '', activity: '' };
	    this.plugin.data.instances[this.trackerId].push(newEntry);
	    this.plugin.savePluginData();
   
	    this.renderTableRows();
	    this.updateAllSums();
	  };
	  this.container.appendChild(addButton);
	}
   
	renderTableRows() {
	  this.tbody.empty();
	  const entries = this.plugin.data.instances[this.trackerId];
	  const sortMethod = this.plugin.data.sortSettings[this.trackerId];
	  let sortedEntries = [...entries];
   
	  if (sortMethod === 'start') {
	    // Sort by start time ascending
	    sortedEntries.sort((a, b) => {
		 const ma = this.parseTimeToMinutes(a.start);
		 const mb = this.parseTimeToMinutes(b.start);
		 return ma - mb;
	    });
	  } else if (sortMethod === 'project') {
	    // Sort by project name
	    sortedEntries.sort((a, b) => (a.project || '').localeCompare(b.project || ''));
	  }
   
	  sortedEntries.forEach((entry) => {
	    this.createRow(entry);
	  });
	}
   
	createRow(entry: TimeEntry) {
	  const row = this.tbody.insertRow(-1);
   
	  // Start time
	  const startCell = row.insertCell(-1);
	  const startInput = startCell.createEl('input');
	  startInput.type = 'text';
	  startInput.placeholder = 'HH:MM';
	  startInput.style.width = '60px';
	  startInput.value = entry.start;
	  startInput.tabIndex = 0;
	  startInput.addEventListener('change', () => {
	    entry.start = startInput.value;
	    this.plugin.savePluginData();
	    this.updateRow(row, entry);
	    this.updateAllSums();
	  });
   
	  // End time
	  const endCell = row.insertCell(-1);
	  const endInput = endCell.createEl('input');
	  endInput.type = 'text';
	  endInput.placeholder = 'HH:MM';
	  endInput.style.width = '60px';
	  endInput.value = entry.end;
	  endInput.tabIndex = 0;
	  endInput.addEventListener('change', () => {
	    entry.end = endInput.value;
	    this.plugin.savePluginData();
	    this.updateRow(row, entry);
	    this.updateAllSums();
	  });
   
	  // Hours
	  const hoursCell = row.insertCell(-1);
	  hoursCell.textContent = this.calculateTime(entry.start, entry.end);
   
	  // Project
	  const projectCell = row.insertCell(-1);
	  const projectInput = projectCell.createEl('input');
	  projectInput.type = 'text';
	  projectInput.value = entry.project;
	  projectInput.tabIndex = 0;
	  projectInput.addEventListener('change', () => {
	    entry.project = projectInput.value;
	    this.plugin.savePluginData();
	    // If sorting by project, re-render
	    if (this.plugin.data.sortSettings[this.trackerId] === 'project') {
		 this.renderTableRows();
		 this.updateAllSums();
	    } else {
		 this.updateAllSums();
	    }
	  });
   
	  // Activity
	  const activityCell = row.insertCell(-1);
	  const activityInput = activityCell.createEl('input');
	  activityInput.type = 'text';
	  activityInput.value = entry.activity;
	  activityInput.style.width = '200px';
	  activityInput.tabIndex = 0;
	  activityInput.addEventListener('change', () => {
	    entry.activity = activityInput.value;
	    this.plugin.savePluginData();
	  });
   
	  // Actions
	  const actionCell = row.insertCell(-1);
	  const deleteButton = actionCell.createEl('button', { text: 'Löschen' });
	  deleteButton.onclick = () => {
	    const arr = this.plugin.data.instances[this.trackerId];
	    const idx = arr.indexOf(entry);
	    if (idx !== -1) {
		 arr.splice(idx, 1);
		 this.plugin.savePluginData();
	    }
	    this.renderTableRows();
	    this.updateAllSums();
	  };
	}
   
	updateRow(row: HTMLTableRowElement, entry: TimeEntry) {
	  const hoursCell = row.cells[2];
	  hoursCell.textContent = this.calculateTime(entry.start, entry.end);
	}
   
	updateAllSums() {
	  const sumCell = this.sumRow.cells[1];
	  sumCell.textContent = this.calculateSumAll();
   
	  this.projectSummaryContainer.empty();
	  this.renderProjectSummaries();
	}
   
	calculateSumAll(): string {
	  const entries = this.plugin.data.instances[this.trackerId];
	  let total = 0;
	  entries.forEach((e) => {
	    const minutes = this.calculateDiffInMinutes(e.start, e.end);
	    total += minutes;
	  });
	  return this.formatMinutesAsHM(total);
	}
   
	renderProjectSummaries() {
	  const entries = this.plugin.data.instances[this.trackerId];
	  const projectMap: Map<string, number> = new Map();
   
	  entries.forEach((e) => {
	    const proj = e.project.trim();
	    if (!proj) return;
	    const diff = this.calculateDiffInMinutes(e.start, e.end);
	    if (!projectMap.has(proj)) {
		 projectMap.set(proj, diff);
	    } else {
		 projectMap.set(proj, projectMap.get(proj)! + diff);
	    }
	  });
   
	  if (projectMap.size > 1) {
	    const title = this.projectSummaryContainer.createEl('h4');
	    title.textContent = 'Projekt-Summen:';
   
	    projectMap.forEach((minutes, projectName) => {
		 const row = this.projectSummaryContainer.createDiv({ cls: 'time-tracker-project-sum-row' });
		 row.createSpan({ text: `Projekt: ${projectName} = ` });
		 row.createSpan({ text: this.formatMinutesAsHM(minutes) });
	    });
	  }
	}
   
	calculateTime(start: string, end: string): string {
	  const diffMinutes = this.calculateDiffInMinutes(start, end);
	  return this.formatMinutesAsHM(diffMinutes);
	}
   
	parseTimeToMinutes(timestr: string): number {
	  if (!timestr || !timestr.includes(':')) return 0;
	  const [h, m] = timestr.split(':').map(Number);
	  if (isNaN(h) || isNaN(m)) return 0;
	  return h * 60 + m;
	}
   
	calculateDiffInMinutes(start: string, end: string): number {
	  let startM = this.parseTimeToMinutes(start);
	  let endM = this.parseTimeToMinutes(end);
	  if (endM < startM) {
	    endM += 24 * 60;
	  }
	  let diff = endM - startM;
	  if (diff < 0) diff = 0;
   
	  // Round to nearest 15 min if setting is on
	  if (this.plugin.settings.roundTimesToQuarterHour) {
	    const quarter = 15;
	    diff = Math.round(diff / quarter) * quarter;
	  }
	  return diff;
	}
   
	formatMinutesAsHM(totalMinutes: number): string {
	  const h = Math.floor(totalMinutes / 60);
	  const m = totalMinutes % 60;
	  return `${h}:${m < 10 ? '0' + m : m}`;
	}
   }
   
   class TimeTrackingSettingTab extends PluginSettingTab {
	plugin: TimeTrackingPlugin;
   
	constructor(app: App, plugin: TimeTrackingPlugin) {
	  super(app, plugin);
	  this.plugin = plugin;
	}
   
	display(): void {
	  const { containerEl } = this;
	  containerEl.empty();
	  containerEl.createEl('h2', { text: 'Time Tracker Plugin Einstellungen' });
   
	  new Setting(containerEl)
	    .setName('Automatische Bereinigung')
	    .setDesc('Wenn aktiviert, wird beim Ändern einer Datei automatisch verwaiste Daten bereinigt. (Standard: deaktiviert)')
	    .addToggle(toggle => toggle
		 .setValue(this.plugin.settings.autoCleanup)
		 .onChange(async (value) => {
		   this.plugin.settings.autoCleanup = value;
		   await this.plugin.saveSettings();
		   new Notice('Automatische Bereinigung ' + (value ? 'aktiviert' : 'deaktiviert') + '.');
		 })
	    );
   
	  new Setting(containerEl)
	    .setName('Zeiten in 15-Minuten-Schritten runden')
	    .setDesc('Aktiviert die Auf-/Abrundung aller erfassten Zeiten auf 15-Minuten-Blöcke.')
	    .addToggle(toggle => toggle
		 .setValue(this.plugin.settings.roundTimesToQuarterHour)
		 .onChange(async (value) => {
		   this.plugin.settings.roundTimesToQuarterHour = value;
		   await this.plugin.saveSettings();
		   new Notice('Runden von Zeiten auf 15 Minuten ist jetzt ' + (value ? 'aktiviert' : 'deaktiviert') + '.');
		 })
	    );
   
	  new Setting(containerEl)
	    .setName('Manuelle Bereinigung')
	    .setDesc('Führe die Bereinigung von verwaisten Daten manuell aus.')
	    .addButton(btn => btn
		 .setButtonText('Bereinigen')
		 .onClick(() => {
		   new Notice("Manuelle Bereinigung wurde ausgeführt (aktuell kein Inhalt).");
		 })
	    );
	}
   }
   