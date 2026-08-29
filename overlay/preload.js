const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onState: (callback) => ipcRenderer.on('overlay-state', (_event, state) => callback(state)),
  stop: () => ipcRenderer.send('overlay-stop'),
  dragStart: () => ipcRenderer.send('overlay-drag-start'),
  drag: (dx, dy) => ipcRenderer.send('overlay-drag', { dx, dy }),
});