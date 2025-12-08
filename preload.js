const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    PickFile: () => ipcRenderer.invoke("PickFile"),
    PopError: (title, msg) => ipcRenderer.invoke("PopError", { title, msg }),
    ReadFile: () => ipcRenderer.invoke("ReadFile"),
    GetGameDefs: (path) => ipcRenderer.invoke("GetGameDefs", path),
    GetFileHandle: () => ipcRenderer.invoke("GetFileHandle"),
    WriteFile: (content) => ipcRenderer.invoke("WriteFile", content),
    ToggleCompactMode: (noSwitch) => ipcRenderer.invoke("ToggleCompactMode", noSwitch),
});