const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { runInThisContext } = require("vm");
const CONFIG_NAME = "dfpom-config.json";
const CONFIG_PATH = path.join(app.getPath("userData"), CONFIG_NAME);
var dwarfPath = "";
const { execFile } = require('node:child_process');
const { ref } = require("node:process");
let config = {};
var mainWindow;
var saveWindowsPosTimeout = null;

function cl(msg) { console.log(msg); }


ipcMain.handle("GetFileHandle", async () => {
    return config.ordersFilePath;
});

ipcMain.handle("PickFile", async () => {
    const { dialog } = require("electron");

    //set default folder to last used orders file folder
    let defaultPath = config.ordersFilePath ? path.dirname(config.ordersFilePath) : undefined;
    const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: defaultPath,
        properties: ["openFile"]
    });
    config.ordersFilePath = canceled ? null : filePaths[0];
    if (canceled)
        return null;

    //check if file content is valid JSON
    try {
        const data = fs.readFileSync(config.ordersFilePath, "utf-8");
        JSON.parse(data);
    } catch (error) {
        dialog.showErrorBox("Invalid JSON", "The selected file does not contain valid JSON.");
        return null;
    }

    //save path to config file
    ReadConfig();
    config.ordersFilePath = config.ordersFilePath;
    SaveConfig();

    return config.ordersFilePath;
});

function ReadConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, "utf-8");
        config = JSON.parse(configData);
    } else {
        CreateConfigFile();
    }
}

function SaveConfig() {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
}

function CreateConfigFile() {
    config = {};
    config.ordersFilePath = "";
    config.dwarfPath = "";
    config.compactMode = false;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
}


ipcMain.handle("PopError", (e, { title, msg }) => {
    dialog.showErrorBox(title, msg);
});

ipcMain.handle("GetGameDefs", async (e, defsPath) => {
    const fullPath = path.join(config.dwarfPath, defsPath);
    let definitions = [];
    if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
            const filePath = path.join(fullPath, file);
            const data = fs.readFileSync(filePath, "utf-8");
            try {
                const dfData = DFDataParse(data);
                definitions.push(...dfData);
            } catch (error) {
                console.error(`Error parsing JSON from file ${filePath}:`, error);
            }
        }
    }
    return definitions;
});



ipcMain.handle("ReadFile", async () => {
    return new Promise((resolve, reject) => {
        let path = config.dwarfPath + "\\dfhack-run.exe";
        let filename = config.ordersFilePath.substring(
            config.ordersFilePath.lastIndexOf("\\") + 1,
            config.ordersFilePath.length - 5
        );
        let args = ["orders", "export", filename];

        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                reject(err);
                return;
            }

            execFile(path, args, (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                try {
                    const data = fs.readFileSync(config.ordersFilePath, "utf-8");
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
});



ipcMain.handle("WriteFile", async (e, content) => {
    const fs = require("fs").promises;
    var exportPath = config.ordersFilePath.replace(".json", "_out.json");
    if (config.ordersFilePath) {
        await fs.writeFile(exportPath, content, "utf-8");
        SendToDF();
    }
});

function SendToDF() {
    let path = config.dwarfPath + "\\dfhack-run.exe";
    let filename = config.ordersFilePath.substring(config.ordersFilePath.lastIndexOf("\\") + 1, config.ordersFilePath.length - 5); //remove .json
    let args1 = ["orders", "clear"];
    let args2 = ["orders", "import", filename + "_out"];

    fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.error('File does NOT exist at the path. Check the path again.');
            } else if (err.code === 'EACCES') {
                console.error('Permission denied (EACCES). The user account running this process cannot execute the file.');
            }
            return;
        }

        execFile(path, args1, (error) => {
            if (error) {
                cl("Error executing dfhack-run: " + error.message);
                return;
            }
            execFile(path, args2, (error) => {
                if (error) {
                    cl("Error executing dfhack-run: " + error.message);
                    return;
                }
            });
        })

    });
}

ipcMain.handle("ToggleCompactMode", (e, noSwitch) => {
    ReadConfig();

    if (!noSwitch) {
        config.compactMode = !config.compactMode;
        SaveConfig();
    }
    return config.compactMode;
});

app.whenReady().then(async () => {

    //read config file if exists
    ReadConfig();

    if (StartAppIfPossible())
        return;

    //prompt user to select Dwarf Fortress folder
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Select Dwarf Fortress Folder",
        properties: ["openDirectory"]
    });
    dwarfPath = canceled ? null : filePaths[0];

    if (dwarfPath == null) {
        app.quit();
        return;
    }

    if (!StartAppIfPossible()) {
        dialog.showErrorBox("Error", "The selected folder does not contain 'Dwarf Fortress.exe'. The application will now quit.");
        app.quit();
        return;
    }

    CreateWindow();
})



function StartAppIfPossible() {
    const requiredFile = path.join(config.dwarfPath, "Dwarf Fortress.exe");

    if (fs.existsSync(requiredFile)) {
        CreateWindow();
        return true;
    }
    return false;
}

const CreateWindow = () => {
    mainWindow = new BrowserWindow({
        width: config.windowPosition ? config.windowPosition.width : 1000,
        height: config.windowPosition ? config.windowPosition.height : 800,
        x: config.windowPosition ? config.windowPosition.x : undefined,
        y: config.windowPosition ? config.windowPosition.y : undefined,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    })

    if (config?.windowState === "maximized") {
        mainWindow.once("ready-to-show", () => mainWindow.maximize());
    }

    mainWindow.loadFile('index.html')

    mainWindow.on("move", () => {
        const b = mainWindow.getBounds();
        SaveWindowPos(b);
    });
    mainWindow.on("resize", () => {
        const b = mainWindow.getBounds();
        SaveWindowPos(b);
    });
    mainWindow.on("maximize", () => {
        const b = mainWindow.getBounds();
        SaveWindowPos(b);
    });
    mainWindow.on("unmaximize", () => {
        const b = mainWindow.getBounds();
        SaveWindowPos(b);
    });
}

function SaveWindowPos(bounds) {
    if (saveWindowsPosTimeout) {
        clearTimeout(saveWindowsPosTimeout);
    }

    saveWindowsPosTimeout = setTimeout(() => {
        config.windowPosition = bounds;
        config.windowState = mainWindow.isMaximized() ? "maximized" : mainWindow.isMinimized() ? "minimized" : "normal";
        SaveConfig();
    }, 500);
}


function DFDataParse(data) {
    //ignore first 4 lines
    var lines = data.split("\n");
    var items = [];
    createNewItem = true;
    lines.forEach(rawLine => {
        var line = rawLine.trim();

        if (line.trim().length == 0) {
            createNewItem = true;
        }

        if (line.indexOf("[") == -1)
            return;

        if (line.startsWith("[OBJECT:"))
            return;

        line = line.replace("[", "").replace("]", "");

        if (createNewItem) {
            items.push(line.split(":")[1]);
            createNewItem = false;
        }

    });
    return items;
}
