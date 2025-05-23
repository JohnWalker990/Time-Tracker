import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { TimeTrackingPlugin } from './main';
import { calculateDiffInMinutes, formatMinutesAsHM } from './utils/time';

export class TimeTrackingSettingTab extends PluginSettingTab {
  constructor(public app: App, private plugin: TimeTrackingPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Time Tracker Plugin Einstellungen' });

    new Setting(containerEl)
      .setName('Automatische Bereinigung')
      .setDesc('Wenn aktiviert, wird beim Ändern einer Datei automatisch verwaiste Daten bereinigt.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.autoCleanup).onChange(async value => {
          this.plugin.settings.autoCleanup = value;
          await this.plugin.saveSettings();
          new Notice('Automatische Bereinigung ' + (value ? 'aktiviert' : 'deaktiviert') + '.');
        })
      );

    new Setting(containerEl)
      .setName('Zeiten in 15-Minuten-Schritten runden')
      .setDesc('Aktiviert die Auf-/Abrundung aller erfassten Zeiten auf 15-Minuten-Blöcke.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.roundTimesToQuarterHour).onChange(async value => {
          this.plugin.settings.roundTimesToQuarterHour = value;
          await this.plugin.saveSettings();
          new Notice('Runden von Zeiten auf 15 Minuten ist jetzt ' + (value ? 'aktiviert' : 'deaktiviert') + '.');
        })
      );

    containerEl.createEl('h3', { text: 'Berichte' });

    let monthVal = '';
    let projectVal = '';

    new Setting(containerEl)
      .setName('Monat')
      .addText(text => {
        text.inputEl.type = 'month';
        text.onChange(value => {
          monthVal = value;
        });
      });

    new Setting(containerEl)
      .setName('Projekt')
      .addText(text => {
        text.onChange(value => {
          projectVal = value;
        });
      });

    new Setting(containerEl)
      .addButton(btn =>
        btn
          .setButtonText('Monat auswerten')
          .onClick(() => {
            if (!monthVal) {
              new Notice('Bitte Monat auswählen');
              return;
            }
            const [y, m] = monthVal.split('-');
            const start = `${y}-${m}-01`;
            const end = new Date(Number(y), Number(m), 0)
              .toISOString()
              .slice(0, 10);
            const entries = this.plugin.filterEntries(start, end, projectVal || undefined);
            const total = entries.reduce(
              (acc, e) =>
                acc +
                calculateDiffInMinutes(
                  e.start,
                  e.end,
                  this.plugin.settings.roundTimesToQuarterHour
                ),
              0
            );
            new Notice('Gesamtstunden: ' + formatMinutesAsHM(total));
          })
      );

    containerEl.createEl('h4', { text: 'CSV Export' });
    let exportStart = '';
    let exportEnd = '';
    let exportProject = '';

    new Setting(containerEl)
      .setName('Zeitraum')
      .addText(text => {
        text.inputEl.type = 'date';
        text.onChange(value => {
          exportStart = value;
        });
      })
      .addText(text => {
        text.inputEl.type = 'date';
        text.onChange(value => {
          exportEnd = value;
        });
      });

    new Setting(containerEl)
      .setName('Projektfilter')
      .addText(text => {
        text.onChange(value => {
          exportProject = value;
        });
      });

    new Setting(containerEl)
      .addButton(btn =>
        btn
          .setButtonText('CSV exportieren')
          .onClick(async () => {
            if (!exportStart || !exportEnd) {
              new Notice('Bitte Zeitraum wählen');
              return;
            }
            const csv = this.plugin.generateCsv(exportStart, exportEnd, exportProject || undefined);
            const fileName = `time-export-${exportStart}-bis-${exportEnd}.csv`;
            await this.app.vault.create(fileName, csv);
            new Notice('CSV exportiert: ' + fileName);
          })
      );
  }
}
