### About
Prototype plugin to record visitation history of your notes.

Anytime you visit (focus) on a note will add visitation timestamp for that note under `_visit_history` directory.

### To Install
#### Build plugin
- Under your obsidian vault go to `.obsidian/plugins/`
- Clone the repo by running `git clone https://github.com/nickolay-kondratyev/obsidian-visit-history-plugin.git`
- Navigate to `.obsidian/plugins/obsidian-visit-history-plugin`
- Run `npm install && npm run build`

#### Enable plugin
- In Obsidian in Settings/Community Plugin, Enable `Visit History Plugin`

### To Use
#### Recording visit history
- After install anytime you open a note,canvas,excalidraw drawing. There will be addition of timestamp for that note under `_visit_history`.

#### Visualization
Visualization of last visit stamp as well as modified and created stamp can be used in vault heat map.

Command `Visit History Plugin: Open vault heatmap`

### READMEs
- [README_DEVELOPMENT.md](./README_DEVELOPMENT.md)
- [README_ORIGINAL.md](./README_ORIGINAL.md)