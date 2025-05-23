# Time-Tracker
Time-Tracker Plugin for Obsidian

# Obsidian Time Tracker Plugin

This **Time Tracker Plugin** for Obsidian lets you track time entries directly within your Markdown notes. It automatically assigns each ` ```time-tracker``` ` code block a unique ID, allowing you to have multiple independent trackers even within the same note.  

## Features

- **Multiple Tracker Blocks**: Add as many ` ```time-tracker``` ` blocks to a single note as you want. Each block has its own data set.  
- **Configurable 15-Minute Rounding**: Optionally round all calculated times (start/end difference) to the nearest quarter hour.  
- **Project Summaries**: If multiple projects are logged in a single block, the plugin shows a per-project sum.
- **Task Summaries**: Times for entries sharing the same task name are aggregated so you can see per-task totals within each block.
- **Sorting & Filtering**: Sort entries by start time or by project name.  
- **Seamless Tab Navigation**: Use the `Tab` key to move through input fields in a logical order.

## Installation

1. **Obtain the Plugin Files**  
   - Clone or download this repository into your local machine.  
   - Install dependencies:
     ```bash
     npm install
     ```
   - Build the plugin (development mode with auto-rebuild):
     ```bash
     npm run dev
     ```
   - For a production build:
     ```bash
     npm run build
     ```
   This generates `main.js` and possibly `styles.css` and/or `manifest.json` inside the build output folder.

2. **Place Files in Your Obsidian Vault**  
   - Copy (or symlink) the generated files (`main.js`, `manifest.json`, etc.) into a folder named `time-tracker` (or similar) under:
     ```
     <YourVault>/.obsidian/plugins/time-tracker/
     ```
   - Open Obsidian, go to **Settings → Community Plugins**, enable *Restricted Mode off* or *Developer Mode on* (if required), and then enable the **Time Tracker Plugin** from the list of installed plugins.

3. **Usage**  
   - In any Markdown note, insert a code block of type `time-tracker`:
     \```time-tracker
     \```
   - Once saved, the plugin automatically inserts a `<!-- tracker-id: ... -->` comment into that code block.  
   - Switch to preview mode (or just collapse the code block) to see the interactive time tracking table.  
   - Enter start/end times, projects, and activities. Multiple blocks remain independent.

## Settings

Go to **Settings → Time Tracker Plugin** in Obsidian to find:
- **Auto Cleanup**: Reserved for orphaned data cleanup (currently not used).  
- **Round Times to 15 Minutes**: Toggle whether the plugin rounds all start/end time differences to quarter hours.  

Within each time-tracker block, you can also choose how to **sort** your entries:
- **No sorting**  
- **Sort by Start Time**  
- **Sort by Project**  

## Development

- The main logic is in `main.ts`, which handles the code block processor and the `TimeTrackerBlock` class for the UI.  
- The plugin uses `this.saveData()`/`this.loadData()` to persist user preferences and any needed stored entries.  
- If you make changes, run `npm run dev` to continuously rebuild, and reload your plugin in Obsidian to see the updates. For faster iteration, you might use the [Hot Reload plugin](https://github.com/pjeby/hot-reload).

## Known Limitations

- **Manual Start/Stop**: There is no built-in timer button. You must manually enter times.  
- **No Multi-User Sync**: Each user’s data is local. If you use Obsidian Sync or Git to sync your vault, the data will be transferred as part of the vault’s contents, but there’s no dedicated multi-user merging strategy.  

## License

This plugin is released under the [GPL 3 LICENSE](LICENSE).  

## Feedback & Contributions

- Please file an [issue](https://github.com/JohnWalker990/Time-Tracker/issues) on GitHub if you find bugs or have feature requests.  
- Contributions are welcome—feel free to open a pull request if you’d like to add or improve functionality.
