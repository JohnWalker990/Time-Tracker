import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import { TimeTrackingPlugin } from './main';

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
  }
}
