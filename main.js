const { app, BrowserWindow, shell, ipcMain, dialog, globalShortcut, clipboard } = require("electron");

const path = require("path");
const fs = require("fs");
const { runInThisContext } = require("vm");
const CONFIG_NAME = "dfpom-config.json";
const ORDERS_NAME = "dfpom-orders.json";
const CONFIG_PATH = path.join(app.getPath("userData"), CONFIG_NAME);
const { execFile } = require('node:child_process');
const { ref } = require("node:process");
let config = {};
var mainWindow;
var saveWindowsPosTimeout = null;
var stocksReaderStartIndex = 0;
var stocksReaderMaxScans = 5000;
var readingStuff = false;
var jobsInfosStartIndex = 0;
var jobsInfosMaxScans = 1000;
var gameInfoLuaUpdated = false;



function cl(msg) { console.log(msg); }


app.whenReady().then(async () => {

    //read config file if exists
    await ReadConfig();

    while (!PathsReady()) {
        await RequirePaths();
    }

    CreateWindow();
})


ipcMain.handle("GetFileHandle", async () => {
    return config.ordersFilePath;
});


async function ReadConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        cl("Reading existing config...");
        const configData = fs.readFileSync(CONFIG_PATH, "utf-8");
        try {
            config = JSON.parse(configData);
        } catch (e) {
            CreateConfigFile();
        }
    } else {
        cl("Creating new config...");
        CreateConfigFile();
    }

    if (!config.ignoredItems) {
        config.ignoredItems = ["ENT%d", "HF%d"];
        SaveConfig()
    }
}

async function SaveConfig() {
    cl("Saving config...");
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
}

function CreateConfigFile() {
    config = {};
    config.ordersFilePath = "";
    config.dwarfPath = "";
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
}

ipcMain.handle("ResetApp", async (e) => {
    jobsInfosStartIndex = 0;
    gameInfoLuaUpdated = false;
    readingStuff = false;
    stocksReaderStartIndex = 0;
});

ipcMain.handle("GetGameStatus", async (e) => {
    if (!PathsReady())
        return;


    return new Promise(async (resolve, reject) => {
        let path = config.dwarfPath + "\\dfhack-run.exe";

        let luaScriptPath = app.getAppPath() + "\\gameStatus.lua";
        cl("Executing dfhack-run... " + luaScriptPath);
        let args = ["lua", "-f", luaScriptPath];

        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                data = {
                    error: {
                        title: "Waiting for Dwarf Fortress...",
                        msg: "Please start the game and load a Fortress.",
                        context: "GetGameStatus1",
                        buttons: ["WAIT", "RESET APP PATHS"]
                    }
                };
                resolve(data);
                return;
            }

            var oldClipboard = clipboard.readText();
            execFile(path, args, (error, stdout, stderr) => {
                let data = clipboard.readText();

                if (error) {
                    data = {
                        error: {
                            title: "Waiting for Dwarf Fortress...",
                            msg: "Please start the game and load a Fortress.",
                            context: "GetGameStatus2",
                            buttons: ["WAIT", "RESET APP PATHS"]
                        }
                    };
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                    return;
                }

                try {
                    data = data.replace(/(,)+}/g, "}");
                    data = data.replace(/(,)+]/g, "]");
                    data = JSON.parse(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);

                } catch (e) {
                    data = {
                        error: {
                            title: "Data parsing error",
                            msg: "An error occurred while parsing data pulled from Dwarf Fortress. <br>" + e + "<br><br>" + data,
                            context: "GetGameStatus3",
                            buttons: ["CONTINUE", "RESET APP PATHS"]
                        }
                    };
                    readingStuff = false;
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                }
            });
            clipboard.writeText(oldClipboard);

        });

    }).finally(() => {
        readingStuff = false;
    });

});

ipcMain.handle("GetGameInfos", async (e) => {
    if (!PathsReady())
        return;

    if (readingStuff)
        return "wait"
    readingStuff = true;

    return new Promise(async (resolve, reject) => {
        let path = config.dwarfPath + "\\dfhack-run.exe";

        let luaScriptUsePath = app.getAppPath() + "\\gameInfo_use.lua";
        if (!gameInfoLuaUpdated) {
            //read template, prepare used model
            let luaScriptPath = app.getAppPath() + "\\gameInfo.lua";

            let luaScriptContent = fs.readFileSync(luaScriptPath, "utf-8");
            if (!config.ignoredItems)
                config.ignoredItems = [];
            luaScriptContent = luaScriptContent.replace("'IGNORED_ITEMS_LIST'", `'` + config.ignoredItems.join(`','`) + `'`);
            fs.writeFileSync(luaScriptUsePath, luaScriptContent, "utf-8");
            gameInfoLuaUpdated = true;
        }

        //write used model

        cl("Executing dfhack-run... " + luaScriptUsePath);
        let args = ["lua", "-f", luaScriptUsePath];

        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                data = {
                    error: {
                        title: "Waiting for Dwarf Fortress...",
                        msg: "Please start the game and load a Fortress.",
                        context: "GetGameInfos1",
                        buttons: ["WAIT", "RESET APP PATHS"]
                    }
                };
                resolve(data);
                return;
            }

            var oldClipboard = clipboard.readText();
            execFile(path, args, (error, stdout, stderr) => {
                if (error) {
                    data = {
                        error: {
                            title: "Waiting for Dwarf Fortress...",
                            msg: "Please start the game and load a Fortress.",
                            context: "GetGameInfos2",
                            buttons: ["WAIT", "RESET APP PATHS"]
                        }
                    };
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                    return;
                }

                try {
                    //read from clipboard file
                    let data = clipboard.readText();
                    //replace ",}" with "}" to fix invalid JSON
                    data = data.replace(/(,)+}/g, "}");
                    data = data.replace(/(,)+]/g, "]");
                    data = JSON.parse(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);

                } catch (e) {
                    data = {
                        error: {
                            title: "Data parsing error",
                            msg: "An error occurred while parsing data pulled from Dwarf Fortress. <br>" + e,
                            context: "GetGameInfos3",
                            buttons: ["CONTINUE", "RESET APP PATHS"]
                        }
                    };
                    readingStuff = false;
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                }
            });
            clipboard.writeText(oldClipboard);
        });

    }).finally(() => {
        readingStuff = false;
    });
});


ipcMain.handle("GetJobsInfos", async () => {
    if (!PathsReady())
        return;

    if (readingStuff)
        return "wait"

    readingStuff = true;

    return new Promise(async (resolve, reject) => {
        let path = config.dwarfPath + "\\dfhack-run.exe";

        //read template
        let luaScriptPath = app.getAppPath() + "\\jobInfos.lua";
        let luaScriptContent = fs.readFileSync(luaScriptPath, "utf-8");
        luaScriptContent = luaScriptContent.replace("69420;", jobsInfosStartIndex + ";");
        luaScriptContent = luaScriptContent.replace("69421;", jobsInfosMaxScans + ";");

        //write used model
        luaScriptPath = app.getAppPath() + "\\jobInfos_use.lua";
        fs.writeFileSync(luaScriptPath, luaScriptContent, "utf-8");

        cl("Executing dfhack-run... " + luaScriptPath);
        cl("> Getting job infos from index " + jobsInfosStartIndex);
        let args = ["lua", "-f", luaScriptPath];

        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                data = {
                    error: {
                        title: "Could not access dfhack-run.exe",
                        msg: "Cannot access dfhack-run.exe. Please check the Dwarf Fortress path in settings.",
                        context: "GetJobsInfos1",
                        buttons: ["CONTINUE", "RESET APP PATHS"]
                    }
                };
                cl(data)
                resolve(data);
            }

            var oldClipboard = clipboard.readText();
            execFile(path, args, (error) => {
                if (error) {
                    data = {
                        error: {
                            title: "Waiting for Dwarf Fortress...",
                            msg: "Please open the 'Job Orders > Create Task' menu once to allow data extraction.",
                            context: "GetJobsInfos2a",
                            buttons: ["WAIT", "RESET APP PATHS"]
                        }
                    };
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                    return;
                }

                try {
                    //read from clipboard file
                    let data = clipboard.readText();

                    data = data.replace(/,}/g, "}");
                    data = data.replace(/,]/g, "]");

                    data = JSON.parse(data);
                    if (data.jobs.length == 0 && data.completed == false) {
                        data = {
                            error: {
                                title: "Waiting for Job Orders",
                                msg: "Please open the 'Job Orders > Create Task' menu once to allow data extraction.",
                                context: "GetJobsInfos2b",
                                buttons: ["WAIT", "RESET APP PATHS"]
                            }
                        };
                        cl(data);
                        clipboard.writeText(oldClipboard);
                        resolve(data);
                        return;
                    }
                    jobsInfosStartIndex = data.pauseAtIndex;
                    clipboard.writeText(oldClipboard);
                    resolve(data);

                } catch (e) {
                    data = "wait"
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                    readingStuff = false;
                    return;

                }
            });
            clipboard.writeText(oldClipboard);
        });

    }).finally(() => {
        readingStuff = false;
    });
});



ipcMain.handle("GetStocks", async () => {
    if (!PathsReady())
        return;

    if (readingStuff)
        return "wait"
    readingStuff = true;

    return new Promise(async (resolve, reject) => {
        let path = config.dwarfPath + "\\dfhack-run.exe";

        //read template
        let luaScriptPath = app.getAppPath() + "\\exportStocks.lua";
        let luaScriptContent = fs.readFileSync(luaScriptPath, "utf-8");
        luaScriptContent = luaScriptContent.replace("69420;", stocksReaderStartIndex + ";");
        luaScriptContent = luaScriptContent.replace("69421;", stocksReaderMaxScans + ";");
        //write used model
        luaScriptPath = app.getAppPath() + "\\exportStocks_temp.lua";
        fs.writeFileSync(luaScriptPath, luaScriptContent, "utf-8");

        let args = ["lua", "-f", luaScriptPath];

        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                data = {
                    error: {
                        title: "Waiting for Dwarf Fortress...",
                        msg: "Please start the game and load a Fortress.",
                        context: "GetStocks1",
                        buttons: ["WAIT", "RESET APP PATHS"]
                    }
                };
                cl(data)
                resolve(data);
                return;
            }

            var oldClipboard = clipboard.readText();
            execFile(path, args, async (error) => {
                if (error) {
                    data = {
                        error: {
                            title: "Waiting for Dwarf Fortress...",
                            msg: "Please start the game and load a Fortress.",
                            context: "GetStocks2",
                            buttons: ["WAIT", "RESET APP PATHS"]
                        }
                    };
                    cl(data);
                    clipboard.writeText(oldClipboard);
                    resolve(data);
                    return;
                }

                try {
                    //read from clipboard file
                    let data = ProcessStockData(clipboard.readText())
                    if (Object.keys(data.stocks).length == 0) {
                        data = {
                            error: {
                                title: "Waiting for Dwarf Fortress...",
                                msg: "Please start the game and load a Fortress.",
                                context: "GetStocks3a",
                                buttons: ["WAIT", "RESET APP PATHS"]
                            }
                        };
                        cl(data);
                        readingStuff = false;
                        clipboard.writeText(oldClipboard);
                        resolve(data);
                        return;
                    }
                    clipboard.writeText(oldClipboard);
                    resolve(data);

                } catch (e) {
                    if (error) {
                        data = {
                            error: {
                                title: "Waiting for Dwarf Fortress...",
                                msg: "Please start the game and load a Fortress.",
                                context: "GetStocks3b",
                                buttons: ["WAIT", "RESET APP PATHS"]
                            }
                        };
                        cl(data);
                        readingStuff = false;
                        clipboard.writeText(oldClipboard);
                        resolve(data);
                        return;
                    }
                    reject(e);
                }
            });
            clipboard.writeText(oldClipboard);

        });
    }).finally(() => {
        readingStuff = false;
    });
});



ipcMain.handle("ResetAppPaths", async () => {
    ReadConfig();
    config.dwarfPath = "";
    config.ordersFilePath = "";
    SaveConfig();

    while (!PathsReady()) {
        await RequirePaths();
    }
    mainWindow.close();
    mainWindow = null;
    CreateWindow();
});

ipcMain.handle("ReadOrdersFile", async () => {
    if (!PathsReady()) {
        cl("Paths not ready, requesting paths...");
        RequirePaths();
        return;
    }

    if (readingStuff)
        return "wait"

    readingStuff = true;

    cl("Reading orders file...");

    return new Promise((resolve, reject) => {
        let path = config.dwarfPath + "\\dfhack-run.exe";
        let filename = config.ordersFilePath.substring(
            config.ordersFilePath.lastIndexOf("\\") + 1,
            config.ordersFilePath.length - 5
        );
        let args = ["orders", "export", filename];

        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                data = {
                    error: {
                        title: "Could not access dfhack-run.exe",
                        msg: "Cannot access dfhack-run.exe. Please check the Dwarf Fortress path in settings.",
                        context: "ReadFile1",
                        buttons: ["CONTINUE", "RESET APP PATHS"]
                    }
                };
                cl(data)
                resolve(data);
                readingStuff = false
                return;
            }

            execFile(path, args, (error) => {
                if (error) {
                    data = {
                        error: {
                            title: "Waiting for Dwarf Fortress...",
                            msg: "Please start the game and load a Fortress.",
                            context: "ReadFile2",
                            buttons: ["WAIT", "RESET APP PATHS"]
                        }
                    };
                    cl(data);
                    resolve(data);
                    return;
                }

                try {
                    const data = fs.readFileSync(config.ordersFilePath, "utf-8");
                    resolve(data);
                } catch (e) {
                    data = {
                        error: {
                            title: "Execution error",
                            msg: "An error occurred while trying to read exported orders." + e,
                            context: "ReadFile3",
                        }
                    };
                    readingStuff = false;
                    cl(data);
                    reject(e);
                }
            });
        });
    }).finally(() => {
        readingStuff = false;
    });
});



ipcMain.handle("WriteOrdersFile", async (e, content) => {
    const fs = require("fs").promises;
    cl("Writing orders file...");
    var exportPath = config.ordersFilePath.replace(".json", "_out.json");
    if (config.ordersFilePath) {
        await fs.writeFile(exportPath, content, "utf-8");
        await SendToDF();
    }
});

async function SendToDF() {
    if (!PathsReady())
        return;

    if (readingStuff)
        return "wait"

    readingStuff = true;

    let path = config.dwarfPath + "\\dfhack-run.exe";
    let filename = config.ordersFilePath.substring(config.ordersFilePath.lastIndexOf("\\") + 1, config.ordersFilePath.length - 5); //remove .json
    let args1 = ["orders", "clear"];
    let args2 = ["orders", "import", filename + "_out"];

    try {
        fs.access(path, fs.constants.F_OK | fs.constants.X_OK, (err) => {
            if (err) {
                data = {
                    error: {
                        title: "Could not access dfhack-run.exe",
                        msg: "Cannot access dfhack-run.exe. Please check the Dwarf Fortress path in settings.",
                        context: "SendToDF1",
                        buttons: ["CONTINUE", "RESET APP PATHS"]
                    }
                };
                cl(data)
                resolve(data);
                return;
            }

            //clear orders command
            execFile(path, args1, (error) => {
                if (error) {
                    data = {
                        error: {
                            title: "Execution error",
                            msg: "An error occurred while executing dfhack-run.exe. Check if DFHack installed and if a Fortress mode game is running.",
                            context: "SendToDF2",
                            buttons: ["CONTINUE", "RESET APP PATHS"]
                        }
                    };
                    cl(data);
                    resolve(data);
                    readingStuff = false;
                    return;
                }

                //import orders command
                execFile(path, args2, (error) => {
                    if (error) {
                        data = {
                            error: {
                                title: "Execution error",
                                msg: "An error occurred while executing dfhack-run.exe. Check if DFHack installed and if a Fortress mode game is running.\n" + error,
                                context: "SendToDF3",
                                buttons: ["CONTINUE", "RESET APP PATHS"]
                            }
                        };
                        cl(data);
                        resolve(data);
                        readingStuff = false;
                        return;
                    }
                });

                readingStuff = false;
            })

        });
    } catch (e) {
        cl(e);
        readingStuff = false;
    }
}

ipcMain.handle("GetSetConfig", async (e, newConfig) => {
    await ReadConfig();

    if (newConfig != null) {
        if (config.ignoredItems.toString() != newConfig.ignoredItems.toString())
            gameInfoLuaUpdated = false;

        config = newConfig;
        await SaveConfig();
    }

    return config;
});


function PathsReady() {
    if (!config.dwarfPath || config.dwarfPath.length == 0)
        return false;

    var requiredFile = path.join(config.dwarfPath, "Dwarf Fortress.exe");
    if (!fs.existsSync(requiredFile)) {
        cl("Dwarf Fortress.exe not found in " + config.dwarfPath);
        return false;
    }

    requiredFile = path.join(config.dwarfPath, "dfhack-run.exe");
    if (!fs.existsSync(requiredFile)) {
        cl("dfhack-run.exe not found in " + config.dwarfPath);
        return false;
    }
    return true;
}

async function RequirePaths() {
    //prompt user to select Dwarf Fortress folder

    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Select Dwarf Fortress exectutable folder (must contain dfhack-run.exe)",
        properties: ["openDirectory"]
    });

    if (canceled)
        app.quit();

    config.dwarfPath = canceled ? null : filePaths[0];
    config.ordersFilePath = path.join(config.dwarfPath, "dfhack-config", "orders", ORDERS_NAME);
    await SaveConfig();
}

const CreateWindow = () => {
    mainWindow = new BrowserWindow({
        width: config.windowPosition ? config.windowPosition.width : 1000,
        height: config.windowPosition ? config.windowPosition.height : 800,
        x: config.windowPosition ? config.windowPosition.x : undefined,
        y: config.windowPosition ? config.windowPosition.y : undefined,
        setAutoHideMenuBar: true,
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    })
    if (config?.windowState === "maximized") {
        mainWindow.once("ready-to-show", () => {
            mainWindow.webContents.openDevTools();
            mainWindow.maximize()
        });
    }

    globalShortcut.register("CommandOrControl+R", () => { });
    globalShortcut.register("CommandOrControl+Shift+R", () => { });
    globalShortcut.register("CommandOrControl+W", () => { });
    globalShortcut.register("F5", () => { });

    mainWindow.loadFile('index.html')


    mainWindow.on('new-window', function (e, url) {
        e.preventDefault();
        cl(url);
        shell.openExternal(url);
    });

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

        line = line.replace("[", "");
        line = line.split("]")[0];

        if (createNewItem) {
            items.push(line.split(":")[1]);
            createNewItem = false;
        }

    });
    return items;
}

function ProcessStockData(rawData) {
    let completed = false;
    let stocks = {};
    let parts = rawData.split("/");
    stocksReaderStartIndex = 0;
    parts.forEach(part => {
        if (part.trim().length == 0)
            return;
        if (part.startsWith("lastIndex=")) {
            let indexPart = part.replace("lastIndex=", "");
            let indexParts = indexPart.split("/");
            stocksReaderStartIndex = parseInt(indexParts[0]);
            return;
        }
        if (part == "completed") {
            completed = true;
            return;
        }
        let itemParts = part.split("*");
        let quantity = parseInt(itemParts[0]);
        let itemKey = itemParts[1];
        stocks[itemKey] = quantity;
    });

    var response = { completed: completed, nextIndex: stocksReaderStartIndex, batchSize: stocksReaderMaxScans, stocks: stocks };
    return response;
}


async function pause(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

