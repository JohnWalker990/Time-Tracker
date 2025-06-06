import { MarkdownRenderChild } from 'obsidian';
import { TimeEntry } from '../models/TimeEntry';
import { TimeTrackingPlugin } from '../main';
import { calculateDiffInMinutes, formatMinutesAsHM, parseTimeToMinutes } from '../utils/time';

export class TimeTrackerBlock extends MarkdownRenderChild {
  constructor(
    public container: HTMLElement,
    private plugin: TimeTrackingPlugin,
    private trackerId: string
  ) {
    super(container);
  }

  private tableEl!: HTMLTableElement;
  private tbody!: HTMLTableSectionElement;
  private sumRow!: HTMLTableRowElement;
  private projectSummaryContainer!: HTMLElement;
  private activitySummaryContainer!: HTMLElement;
  private sortSelect!: HTMLSelectElement;

  initialize(): void {
    this.container.empty();

    if (!this.plugin.data.instances[this.trackerId]) {
      this.plugin.data.instances[this.trackerId] = [];
    }
    if (!this.plugin.data.sortSettings[this.trackerId]) {
      this.plugin.data.sortSettings[this.trackerId] = null;
    }
    if (!this.plugin.data.trackerDates[this.trackerId]) {
      const first = this.plugin.data.instances[this.trackerId][0];
      this.plugin.data.trackerDates[this.trackerId] =
        first?.date || new Date().toISOString().slice(0, 10);
    }

    const sortWrapper = this.container.createDiv({ cls: 'time-tracker-sort-wrapper' });
    sortWrapper.createSpan({ text: 'Sortieren nach: ' });
    this.sortSelect = sortWrapper.createEl('select');
    this.sortSelect.createEl('option', { text: 'Keine', value: '' });
    this.sortSelect.createEl('option', { text: 'Startzeit', value: 'start' });
    this.sortSelect.createEl('option', { text: 'Projekt', value: 'project' });

    const currentSort = this.plugin.data.sortSettings[this.trackerId];
    if (currentSort) this.sortSelect.value = currentSort;

    this.sortSelect.onchange = () => {
      const val = this.sortSelect.value as 'start' | 'project' | '';
      this.plugin.data.sortSettings[this.trackerId] = val === '' ? null : (val as any);
      this.plugin.savePluginData();
      this.renderTableRows();
      this.updateAllSums();
    };

    const dateWrapper = this.container.createDiv({ cls: 'time-tracker-date-wrapper' });
    dateWrapper.createSpan({ text: 'Datum: ' });
    const headerDateInput = dateWrapper.createEl('input');
    headerDateInput.type = 'date';
    headerDateInput.value = this.plugin.data.trackerDates[this.trackerId];
    headerDateInput.onchange = () => {
      const val = headerDateInput.value;
      this.plugin.data.trackerDates[this.trackerId] = val;
      this.plugin.data.instances[this.trackerId].forEach(e => (e.date = val));
      this.plugin.savePluginData();
    };

    this.tableEl = this.container.createEl('table', { cls: 'time-tracker-table' });
    const headerRow = this.tableEl.createEl('tr');
    ['Startzeit', 'Endzeit', 'Stunden', 'Projekt', 'Tätigkeit', 'Aktion'].forEach(h =>
      headerRow.createEl('th', { text: h })
    );

    this.tbody = this.tableEl.createEl('tbody');
    this.renderTableRows();

    this.sumRow = this.tableEl.createEl('tr', { cls: 'sum-row' });
    const sumLabelCell = this.sumRow.createEl('td', { attr: { colspan: '2' } });
    sumLabelCell.setText('Gesamt-Summe');
    const sumHoursCell = this.sumRow.createEl('td', { cls: 'sum-hours' });
    sumHoursCell.setText(this.calculateSumAll());
    this.sumRow.createEl('td');
    this.sumRow.createEl('td');
    this.sumRow.createEl('td');

    this.container.appendChild(this.tableEl);

    this.projectSummaryContainer = this.container.createDiv({ cls: 'time-tracker-project-sums' });
    this.activitySummaryContainer = this.container.createDiv({ cls: 'time-tracker-activity-sums' });
    this.renderProjectSummaries();
    this.renderActivitySummaries();

    const addButton = this.container.createEl('button', { text: 'Zeile hinzufügen' });
    addButton.onclick = () => {
      const d = this.plugin.data.trackerDates[this.trackerId];
      this.plugin.data.instances[this.trackerId].push({ date: d, start: '', end: '', project: '', activity: '' });
      this.plugin.savePluginData();
      this.renderTableRows();
      this.updateAllSums();
    };
    this.container.appendChild(addButton);
  }

  private renderTableRows(): void {
    this.tbody.empty();
    const entries = this.plugin.data.instances[this.trackerId];
    const sortMethod = this.plugin.data.sortSettings[this.trackerId];
    const sortedEntries = [...entries];

    if (sortMethod === 'start') {
      sortedEntries.sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
    } else if (sortMethod === 'project') {
      sortedEntries.sort((a, b) => (a.project || '').localeCompare(b.project || ''));
    }

    sortedEntries.forEach(entry => this.createRow(entry));
  }

  private createRow(entry: TimeEntry): void {
    const row = this.tbody.insertRow(-1);

    const startCell = row.insertCell(-1);
    const startInput = startCell.createEl('input');
    startInput.type = 'text';
    startInput.placeholder = 'HH:MM';
    startInput.style.width = '60px';
    startInput.value = entry.start;
    startInput.addEventListener('change', () => {
      entry.start = startInput.value;
      this.plugin.savePluginData();
      this.updateRow(row, entry);
      this.updateAllSums();
    });

    const endCell = row.insertCell(-1);
    const endInput = endCell.createEl('input');
    endInput.type = 'text';
    endInput.placeholder = 'HH:MM';
    endInput.style.width = '60px';
    endInput.value = entry.end;
    endInput.addEventListener('change', () => {
      entry.end = endInput.value;
      this.plugin.savePluginData();
      this.updateRow(row, entry);
      this.updateAllSums();
    });

    const hoursCell = row.insertCell(-1);
    hoursCell.textContent = this.calculateTime(entry.start, entry.end);

    const projectCell = row.insertCell(-1);
    const projectSelect = projectCell.createEl('select');
    projectSelect.createEl('option', { value: '', text: '' });
    this.plugin.settings.projects.forEach(p => {
      projectSelect.createEl('option', { value: p, text: p });
    });
    projectSelect.value = entry.project;
    projectSelect.addEventListener('change', () => {
      entry.project = projectSelect.value;
      this.plugin.savePluginData();
      if (this.plugin.data.sortSettings[this.trackerId] === 'project') {
        this.renderTableRows();
      }
      this.updateAllSums();
    });

    const activityCell = row.insertCell(-1);
    const activityInput = activityCell.createEl('input');
    activityInput.type = 'text';
    activityInput.style.width = '200px';
    activityInput.value = entry.activity;
    activityInput.addEventListener('change', () => {
      entry.activity = activityInput.value;
      this.plugin.savePluginData();
      this.updateAllSums();
    });

    const actionCell = row.insertCell(-1);
    const deleteButton = actionCell.createEl('button', { text: '✕' });
    deleteButton.style.color = 'red';
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

  private updateRow(row: HTMLTableRowElement, entry: TimeEntry): void {
    const hoursCell = row.cells[2];
    hoursCell.textContent = this.calculateTime(entry.start, entry.end);
  }

  private updateAllSums(): void {
    const sumCell = this.sumRow.cells[1];
    sumCell.textContent = this.calculateSumAll();
    this.projectSummaryContainer.empty();
    this.activitySummaryContainer.empty();
    this.renderProjectSummaries();
    this.renderActivitySummaries();
  }

  private calculateSumAll(): string {
    const entries = this.plugin.data.instances[this.trackerId];
    const total = entries.reduce(
      (acc, e) => acc + calculateDiffInMinutes(e.start, e.end, this.plugin.settings.roundTimesToQuarterHour),
      0
    );
    return formatMinutesAsHM(total);
  }

  private renderProjectSummaries(): void {
    const entries = this.plugin.data.instances[this.trackerId];
    const projectMap = new Map<string, number>();

    entries.forEach(e => {
      const proj = e.project.trim();
      if (!proj) return;
      const diff = calculateDiffInMinutes(e.start, e.end, this.plugin.settings.roundTimesToQuarterHour);
      projectMap.set(proj, (projectMap.get(proj) || 0) + diff);
    });

    if (projectMap.size > 1) {
      this.projectSummaryContainer.createEl('h4', { text: 'Projekt-Summen:' });
      const table = this.projectSummaryContainer.createEl('table', {
        cls: 'time-tracker-project-sum-table',
      });
      const headerRow = table.createEl('tr');
      headerRow.createEl('th', { text: 'Projekt' });
      headerRow.createEl('th', { text: 'Stunden' });

      projectMap.forEach((minutes, projectName) => {
        const row = table.createEl('tr');
        row.createEl('td', { text: projectName });
        row.createEl('td', { text: formatMinutesAsHM(minutes) });
      });
    }
  }

  private renderActivitySummaries(): void {
    const entries = this.plugin.data.instances[this.trackerId];
    const activityMap = new Map<string, number>();

    entries.forEach(e => {
      const act = e.activity.trim();
      if (!act) return;
      const diff = calculateDiffInMinutes(
        e.start,
        e.end,
        this.plugin.settings.roundTimesToQuarterHour
      );
      activityMap.set(act, (activityMap.get(act) || 0) + diff);
    });

    if (activityMap.size > 1) {
      this.activitySummaryContainer.createEl('h4', { text: 'Aufgaben-Summen:' });
      const table = this.activitySummaryContainer.createEl('table', {
        cls: 'time-tracker-activity-sum-table',
      });
      const headerRow = table.createEl('tr');
      headerRow.createEl('th', { text: 'Tätigkeit' });
      headerRow.createEl('th', { text: 'Stunden' });

      activityMap.forEach((minutes, activityName) => {
        const row = table.createEl('tr');
        row.createEl('td', { text: activityName });
        row.createEl('td', { text: formatMinutesAsHM(minutes) });
      });
    }
  }

  private calculateTime(start: string, end: string): string {
    const diff = calculateDiffInMinutes(start, end, this.plugin.settings.roundTimesToQuarterHour);
    return formatMinutesAsHM(diff);
  }
}
