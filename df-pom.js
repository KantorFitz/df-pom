const $ = (selector) => document.querySelectorAll(selector);

var json;
var clonedOrders;
var fileHandle;
var orders = [];
var config = {}

var conditionJustCopied = false;
var currentHoverOrder = null;
var copiedCondition = null;
var displayedTab = "orders";

var mustReadOrders = false;
var mustWriteOrders = false;
var mustReadStocks = false;

var ordersTable;
var allOrdersPaused = false;
var waitForOrdersOperation = false;
var autoFillSource = {};
var errorCallback;
var autoReadStocks = false;

var lastInventoryFilter = "";
var lastFilterChange = 0;
var filterDelayer = null;
var hoveredNumInput = null;
var hoveredConditionsOrder;
var gameStatus;
var lastGameStatusCheck = 0;

var materialNames = [];
var itemJob = [];
var itemHasJob = {};
var jobSortedNames = [];
var itemTypesRequiringSubtypes = [];
var itemMatStockChanges = [];

var emptyCellsCreated = false;
var wasShiftPressed = false;
var wasCtrlPressed = false;
const PAUSECHANNEL_ALLSTASKS = -2;
const PAUSECHANNEL_FROMTASK = -1;
const PAUSECHANNEL_ONETASK = 0;
const PAUSECHANNEL_ANY = -99;
const MAX_MATERIALS_COLS = 20;
const pauseAll = GetPauseCondition(PAUSECHANNEL_ALLSTASKS);
const pauseFrom = GetPauseCondition(PAUSECHANNEL_FROMTASK);
const pauseOne = GetPauseCondition(PAUSECHANNEL_ONETASK);

var manualWriteOrders = false;
var manualReadOrders = false;
var manualReadStocks = false;
var currendFuseInput;
var previousSizeMode;
var fuses = [];
var keysDown = [];
const DELAY_BETWEEN_FILE_OPS_MS = 3500;
var multiFill = false;
var forceAllItemsVisible = false;
var openedConditionsOrder;
var openedConditionsIndex;
var lastFileAccess;
var readingStocks = false;
var readingJobs = false;
var inventoryDisplayedMaterials = [];
var inventoryStaticHeader;
var inventoryStaticHeaderCorner;
var oldStocks;
var stocks = [];
var tempStocks = [];
var stocksMaterials = [];
var jobs = null;
var tempJobs = [];
var gm = {};
var sortedItemsAllIds = [];
var sortedItemSubTypesIds = [];
var sortedItemTypesIds = [];
var sortedItemsAndTypesNames = [];
var sortedJobTypes = [];
var itemTypesMembers = {};
var stockCellsLabels = {}
var stockCellsHeaders = {}
var stockMatCols = {}
var stockCells = {}

var sideA;
var sideB;

var materialGroups = [
    "ALL",
    "STONE",
    "METAL",
    "GEM",
    "COAL",
    "WOOD",
    "LEATHER",
    "GLASS",
    "CERAMIC",
    "BONE",
    "OTHER",
]

var cl = console.log


setInterval(ReloadCss, 2500);

document.addEventListener("DOMContentLoaded", async (event) => { InitDOM() });
document.addEventListener("mouseover", function (e) {
    hoveredNumInput = null;
    hoveredNumInputTime = Date.now();
    if (e.target instanceof HTMLInputElement && e.target.getAttribute("type") == "number")
        hoveredNumInput = e.target;
});

async function InitDOM() {
    fileHandle = await window.api.GetFileHandle();

    SetTab("orders");
    sideA = $(".inventoryBody .itemsSide")[0];
    sideB = $(".inventoryBody .valuesSide")[0];
    inventoryStaticHeader = $(".inventoryTableHeader")[0];
    ordersTable = $(".ordersTable")[0];

    document.addEventListener("keydown", (e) => { OnGeneralKeyDown(e) });
    document.addEventListener("keyup", (e) => { OnGeneralKeyUp(e) });
    $("#inventoryMaterialsFilter")[0].addEventListener("mouseup", (e) => { e.stopPropagation(); });
    $(".inventoryMaterialsPicker")[0].addEventListener("mouseup", (e) => { e.stopPropagation(); });
    $(".inventoryTable")[0].addEventListener("scroll", (e) => {
        inventoryStaticHeader.style.transform = `translateX(-${e.target.scrollLeft}px)`;
        inventoryStaticHeaderCorner ??= $(".inventoryTableHeader .corner")[0];
        if (inventoryStaticHeaderCorner)
            inventoryStaticHeaderCorner.style.transform = `translateX(${e.target.scrollLeft}px)`;
    });
    window.addEventListener("focus", (event) => { ClearKeys() });
    PrepareInput($("input#conditionValue")[0]);

    await InitData();
}

async function InitData() {

    Toast("Initializing...");
    await GetConfig();
    ApplyConfigClasses();

    let ok = false;
    while (!ok) {
        ok = await GetGameStatus();
        if (!ok)
            await pause(300);
    }

    ok = false;
    while (!ok) {
        Toast("Getting game infos...");
        ok = await GetGameInfos();
        if (!ok)
            await pause(300);
    }

    ok = false;
    while (!ok) {
        Toast("Reading jobs...");
        ok = await ReadJobs();
        if (!ok)
            await pause(300);
    }

    initDone = true;

    await QueueOrdersRead(true);
    await QueueStocksRead(true);
    await DataAutoUpdater();
    Toast("<b>Ready</b>");
}

function QueueOrdersRead(immediate = false, manual = false) {
    manualReadOrders = manual;
    mustReadOrders = true;
    if (immediate)
        TryReadWriteOrders(true);
}

function QueueOrdersSave(immediate = false, manual = false) {
    manualWriteOrders = manual;
    mustWriteOrders = true;
    if (immediate)
        TryReadWriteOrders(true);
}

function QueueStocksRead(immediate = false, manual = false) {
    manualReadStocks = manual;
    mustReadStocks = true;
    if (immediate)
        TryReadStocks();
}

async function DataAutoUpdater() {
    if (initDone) {

        if (lastGameStatusCheck < Date.now() - 1500) {
            lastGameStatusCheck = Date.now();
            ok = await GetGameStatus();
            if (!ok) {
                //game closed
                ResetApp();
                return;
            }
        }

        await TryReadWriteOrders();
        await TryReadStocks();
    }

    setTimeout(DataAutoUpdater, 150);
}

function ResetApp() {
    cl("Resetting app data...");
    Trace("Resetting app data...");
    window.api.ResetApp();
    gm = {};
    orders = [];
    stocks = [];

    allOrdersPaused = false;
    wasShiftPressed = false;
    wasCtrlPressed = false;

    currendFuseInput = null;
    fuses = [];
    keysDown = [];
    openedConditionsOrder = null;
    openedConditionsIndex = 0;
    lastFileAccess = 0;
    readingStocks = false;
    readingJobs = false;
    inventoryDisplayedMaterials = [];
    oldStocks = {};
    stocks = [];
    tempStocks = [];
    stocksMaterials = [];
    jobs = null;
    tempJobs = [];
    gm = {};
    sortedItemsAllIds = [];
    sortedItemSubTypesIds = [];
    sortedItemTypesIds = [];
    sortedItemsAndTypesNames = [];
    sortedJobTypes = [];
    itemTypesMembers = {};

    $(".ordersTable")[0].innerHTML = "";

    ClearStockTable();
    InitData();
}

function ClearStockTable() {
    itemMatStockChanges = [];
    stockCellsLabels = {}
    stockCellsHeaders = {}
    stockMatCols = {}
    stockCells = {}
    emptyCellsCreated = false;

    $(".inventoryTableHeader")[0].innerHTML = "";
    $(".inventoryBody .itemsSide")[0].innerHTML = "";
    $(".inventoryBody .valuesSide")[0].innerHTML = "";
    $(".materialsList.hozScroll")[0].innerHTML = "";
}

async function TryReadWriteOrders(immediate = false) {
    if (immediate)
        lastFileAccess = 0;

    var currentFileAccess = Date.now();
    if (lastFileAccess == undefined)
        lastFileAccess = 0;

    var timePassed = currentFileAccess - lastFileAccess;
    if (timePassed < DELAY_BETWEEN_FILE_OPS_MS)
        return;

    //check if any condition editor is opened
    var conditionEdited = openedConditionsOrder != null || document.querySelector(".conditionEditor:hover") || document.querySelector(".item_conditions:hover");
    if (!conditionEdited) {
        if (mustWriteOrders) {

            if (manualWriteOrders)
                Toast("Saving orders...");

            mustWriteOrders = false;
            lastFileAccess = Date.now();
            await WriteOrders();
            lastFileAccess = Date.now();

            manualWriteOrders = false;

        } else if (mustReadOrders || config.toggleAutoReadOrders) {

            if (manualReadOrders)
                Toast("Reading orders...");

            mustReadOrders = false;
            lastFileAccess = Date.now();
            await ReadOrders();
            lastFileAccess = Date.now();

            manualReadOrders = false;

        }
    }
}



document.addEventListener("wheel", e => {
    if (hoveredNumInput != null && TimeSinceInputHovered() > 300) {
        e.preventDefault();

        var delta = Math.sign(e.deltaY);
        if (IsCtrlPressed())
            delta *= 5;
        var curVal = e.target.value;
        curVal = curVal === "" ? 0 : curVal;
        var newValue = Math.max(0, parseInt(curVal) - delta);
        e.target.value = newValue;
        var event = new Event('change');
        e.target.dispatchEvent(event);

        return;
    }

    if (IsShiftPressed() || IsCtrlPressed())
        return false;

    var host = e.target.closest(".hozScroll");
    if (!host)
        return;

    e.preventDefault();
    host.scrollLeft += e.deltaY;

}, { passive: false });

function TimeSinceInputHovered() {
    return Date.now() - hoveredNumInputTime;
}

function CheckError(data, waitingToken) {
    if (data == "wait")
        return true;

    if (data == null) {
        //output error to console
        console.error("No data received from main process.");

        PopInfo("Error", "No data received from main process.");
        return true;
    }

    if (data.error != undefined) {
        setTimeout(() => {
            const d = data.error;
            const cb = errorCallback;
            const wt = waitingToken;
            PopInfo(d.title, d.msg, d.context, d.buttons, errorCallback, wt);
        });
        return true;
    }

    return false;
}

async function GetGameStatus() {
    Trace("Checking game status...");
    gameStatus = await window.api.GetGameStatus();

    if (CheckError(gameStatus, "GetGameStatus"))
        return false;

    var status = "";
    if (!gameStatus.isFortress) {
        status = "The current Dwarf Fortress mode is not Fortress Mode.";
    } else if (gameStatus.site == "nil") {
        status = "No fortress site is currently loaded in Dwarf Fortress.";
    }

    if (status != "") {
        PopInfo("Game not ready", status + "<br><br> Please load a fortress and try again.", "", [], null, "GetGameStatus");
        return false;
    }

    ClosePopInfoWaiting("GetGameStatus")
    return true
}

async function GetGameInfos() {
    gm = await window.api.GetGameInfos();

    if (CheckError(gm, "GetGameInfo"))
        return false;
    ClosePopInfoWaiting("GetGameInfo");

    sortedItemSubTypesIds = Object.keys(gm.items);
    sortedItemSubTypesIds.sort((a, b) => { return a.localeCompare(b); });

    sortedItemTypesIds = Object.values(gm.item_types);
    sortedItemTypesIds.sort((a, b) => { return a.localeCompare(b); });

    var itemNames = Object.keys(gm.items).map(key => gm.items[key].name);
    itemNames = [...new Set(itemNames)];

    sortedItemsAndTypesNames = sortedItemTypesIds.map(name => name.toLowerCase()).concat(itemNames);
    sortedItemsAndTypesNames.sort((a, b) => { return a.localeCompare(b); });

    sortedItemsAllIds = sortedItemSubTypesIds.concat(sortedItemTypesIds);
    sortedItemsAllIds.sort((a, b) => { return a.localeCompare(b); });
    sortedItemsAllIds = [...new Set(sortedItemsAllIds)];

    gm["material_types"] = {}
    materialNames = []

    gm.materials["GLASS_GREEN"] = { Types: ["GLASS"] };
    gm.materials["GLASS_CLEAR"] = { Types: ["GLASS"] };
    gm.materials["GLASS_CRYSTAL"] = { Types: ["GLASS"] };
    gm.materials["COAL:CHARCOAL"] = { Types: ["COAL"] };
    gm.materials["COAL:COKE"] = { Types: ["COAL"] };
    gm.materials["SILK"] = { Types: ["SILK"] };
    Object.keys(gm.materials).forEach((mat) => {
        matI = gm.materials[mat]

        if (!matI.Types)
            matI.Types = [];

        matI.id = mat;
        matI.Types.forEach((mt) => {
            if (!gm["material_types"][mt])
                gm["material_types"][mt] = []
            gm["material_types"][mt].push(mat)
        });
        gm.materials[mat] = matI;
        materialNames.push(matI.name);
    });

    itemTypesRequiringSubtypes = []
    Object.keys(gm.items).forEach((itemId) => {
        var item = gm.items[itemId];
        var group = item.typeName.toUpperCase();
        itemTypesMembers[group] = itemTypesMembers[group] || [];
        itemTypesMembers[group].push(item);
        itemTypesRequiringSubtypes.push(item.typeName);
    });

    Object.values(gm.item_types).forEach((itemType) => {
        gm.items[itemType] = {
            subtypeName: "",
            typeName: itemType,
            name: itemType.toLowerCase(),
            isTypeOnly: true
        };
    });

    gm.items["CRAFTS"] = {
        name: "crafts",
        subtypeName: "",
        typeName: "CRAFTS"
    };

    var flags = [];
    Object.keys(gm.job_item_flags1).forEach(key => { flags.push(gm.job_item_flags1[key]) });
    Object.keys(gm.job_item_flags2).forEach(key => { flags.push(gm.job_item_flags2[key]) });
    Object.keys(gm.job_item_flags3).forEach(key => { flags.push(gm.job_item_flags3[key]) });
    flags = [...new Set(flags)];
    gm.itemFlags = flags.filter(f => f != "nil");

    return true;
}


async function ReadJobs() {

    let ok = false;
    readJobsCompleted = false;

    Trace("Reading jobs...");
    while (!ok) {
        ok = await ReadJobsBatch();
        if (!ok)
            await pause(100);
    }
    Trace("Reading jobs: completed.");

    return true;
}


async function ReadJobsBatch() {
    data = await window.api.GetJobsInfos();

    if (data == null) {
        cl("error: null data");
        return false;
    }

    if (CheckError(data, "Jobs")) {
        await pause(2500);
        return false;
    }
    ClosePopInfoWaiting("Jobs");

    data.jobs.forEach(job => {
        tempJobs.push(job);
    });

    if (data.jobs.length == 0) {
        await pause(400);
        return false;
    }

    if (data.completed) {
        jobs = tempJobs;
        CleanupJobsData();
        return true;
    }

    return false;
}

function DragStart(e) {
    e.dataTransfer.setData("text/plain", null);
    var myRow = e.target.closest(".orderRow");
    if (myRow) {
        var siblings = Array.from(myRow.parentElement.children);
        e.dataTransfer.setData("orderIndex", siblings.indexOf(myRow));
        setTimeout(() => { $("body")[0].classList.add("dragging") }, 10);
    } else {
        //cancel drag
        e.preventDefault();
    }
}

function DragOver(e) {
    e.preventDefault();
    var myRow = e.target.closest(".orderRow");
    if (myRow)
        myRow.classList.add("dragOver");
}

function DragLeave(e) {
    e.preventDefault();
    $(".dragOver").forEach(el => el.classList.remove("dragOver"));
}

function DragEnd(e) {
    setTimeout(() => { $("body")[0].classList.remove("dragging") }, 10);

}

function DragDrop(e) {
    e.preventDefault();
    $(".dragOver").forEach(el => el.classList.remove("dragOver"));

    var targetRow = e.target.closest(".orderRow");
    if (!targetRow)
        return;

    const fromIndex = e.dataTransfer.getData("orderIndex");
    const toIndex = Array.from(ordersTable.children).indexOf(targetRow);
    if (fromIndex === toIndex)
        return;

    const movedOrder = orders.splice(fromIndex, 1)[0];

    orders.splice(toIndex, 0, movedOrder);

    MarkEdited(movedOrder);
    UpdateOrdersTable();
    /*
    if (toIndex > fromIndex) {
        ordersTable.insertBefore(ordersTable.children[fromIndex + 1], ordersTable.children[toIndex + 2]);
    } else {
        ordersTable.insertBefore(ordersTable.children[fromIndex + 1], ordersTable.children[toIndex + 1]);
    }
    */

    if (config.toggleAutoSaveOrders)
        QueueOrdersSave(true);
}


function UpdateOrdersTable() {
    if (!ordersTable)
        return;

    var orderlines = ordersTable.querySelectorAll(".orderRow")
    orderlines.forEach(line => { line.remove() });

    orders.forEach(order => {

        var editedLine = ordersTable.querySelector(`div[orderId='${order.id}']`);
        var orderIndex = orders.indexOf(order);

        if (editedLine == null) {
            editedLine = document.createElement("div");
            editedLine.classList.add("orderRow");
            editedLine.draggable = true;
            editedLine.setAttribute("orderId", order.id);

            editedLine.addEventListener("click", (e) => { const o = order; EditOrder(o); });
            editedLine.addEventListener("dragstart", (e) => { DragStart(e); });
            editedLine.addEventListener("dragover", (e) => { DragOver(e); });
            editedLine.addEventListener("dragleave", (e) => { DragLeave(e); });
            editedLine.addEventListener("drop", (e) => { DragDrop(e); });
            editedLine.addEventListener("dragend", (e) => { DragEnd(e); });
            editedLine.addEventListener("mouseenter", (e) => { currentHoverOrder = GetOrderFromElement(e.currentTarget); SetOrderTools(e.currentTarget); });
            editedLine.addEventListener("mousemove", (e) => { currentHoverOrder = GetOrderFromElement(e.currentTarget); SetOrderTools(e.currentTarget); });
            editedLine.addEventListener("mouseleave", (e) => { currentHoverOrder = null;; SetOrderTools(null) });

            //place edited line at the right order in parent
            const referenceNode = ordersTable.children[orderIndex + 1]; //+1 to skip header
            if (referenceNode) {
                ordersTable.insertBefore(editedLine, referenceNode);
            } else {
                ordersTable.appendChild(editedLine);
            }
        }

        if (order.deleted) {
            editedLine.classList.add("deleted");
        } else {
            editedLine.classList.remove("deleted");
        }

        if (order.edited) {
            editedLine.classList.add("edited");
        } else {
            editedLine.classList.remove("edited");
        }

        if (order.isNew) {
            editedLine.classList.add("new");
        } else {
            editedLine.classList.remove("new");
        }

        if (order.is_active) {
            editedLine.classList.add("active");
        } else {
            editedLine.classList.remove("active");
        }

        if (order.is_validated) {
            editedLine.classList.add("validated");
        } else {
            editedLine.classList.remove("validated");
        }


        if (order.max_workshops === undefined)
            order.max_workshops = 0;

        if (order.item_conditions === undefined)
            order.item_conditions = [];

        var possibleProperties = propertiesInfos.filter(prop => prop.visible);
        for (const property in order) {

            if (property.endsWith("_cell"))
                continue;

            var propInfo = propertiesInfos.find(prop => prop.name === property);
            if (propInfo == null || !propInfo.visible)
                continue;

            var cell = editedLine.querySelector(`.property.${property}`);
            if (!cell) {
                cell = document.createElement("div");
                cell.classList.add("property", property);
                if (propInfo.numeric) {
                    cell.classList.add("num");
                } else {
                    cell.classList.remove("num");
                }
                if (propInfo.yesno) {
                    cell.classList.add("yesno");
                } else {
                    cell.classList.remove("yesno");
                }

                if (property == "amount_total") {
                    editedLine.insertBefore(cell, editedLine.querySelector(`.property.amount_left`));
                } else {
                    editedLine.appendChild(cell);
                }
            }

            cell.setAttribute("title", propInfo.displayName);

            if (propInfo.compactable)
                cell.classList.add("optionalCol");

            if (propInfo.isToggle) {
                cell.classList.add("toggleable");
                cell.addEventListener("mouseup", (e) => {
                    e.stopPropagation();
                    if (e.button != 0)
                        return;

                    order[property] = !order[property];
                    if (order[property] === true) {
                        order[property + "_cell"].textContent = "YES";
                        order[property + "_cell"].classList.add("isTrue");
                        order[property + "_cell"].classList.remove("isFalse");
                    } else {
                        order[property + "_cell"].textContent = "NO";
                        order[property + "_cell"].classList.add("isFalse");
                        order[property + "_cell"].classList.remove("isTrue");
                    }
                });
            }

            var cellText = order[property];

            if (property == "job") {
                cellText = GetOrderJobLabel(order);

                var progressBar = editedLine.querySelector(`.property.${property} .progressBar`);
                if (!progressBar) {
                    progressBar = document.createElement("div");
                    progressBar.classList.add("progressBar");
                    progressBar.text = "."
                    cell.appendChild(progressBar);
                }
                progressBar.style.width = ((order.amount_total - order.amount_left) / order.amount_total * 100) + "%";
            }

            if (property === "material") {
                cellText = GetOrderMaterialLabel(order);
            }

            if (cellText === true) {
                cellText = "YES";
                cell.classList.add("isTrue");
            } else if (cellText === false) {
                cellText = "NO";
                cell.classList.add("isFalse");
            }

            order[property + "_cell"] = cell;

            if (propInfo && propInfo.isInput) {

                var input = editedLine.querySelector(`.property.${property} .inputNumber`);
                if (!input) {
                    input = CreateInputForOrders(InputChangeCallback_PropertyValue, order, property, -1);
                    if (property != "amount_total")
                        input.setAttribute("tabindex", "-1");

                    cell.appendChild(input);

                }
                input.value = order[property];

            } else if (property == "item_conditions") {


                var numDiv = editedLine.querySelector(`.property.${property} .conditionsNum`);
                if (!numDiv) {
                    numDiv = document.createElement("div");
                    numDiv.classList.add("conditionsNum");
                    numDiv.addEventListener("mouseenter", (e) => { ConditionEditHover(e); });
                    cell.appendChild(numDiv);
                }

                var conditions = GetOrderConditions(order);
                UpdateConditionsContainer(order);

            } else {

                cell.innerHTML = "<div>" + cellText + "</div>";

                if (property == "job") {
                    var progressBar = editedLine.querySelector(`.property.${property} .progressBar`);
                    if (!progressBar) {
                        progressBar = document.createElement("div");
                        progressBar.classList.add("progressBar");
                        progressBar.text = "."
                        cell.appendChild(progressBar);
                    }
                    progressBar.style.width = ((order.amount_total - order.amount_left) / order.amount_total * 100) + "%";
                }

            }

            possibleProperties = possibleProperties.filter(prop => prop.name !== property);
        }

        possibleProperties.forEach(prop => {
            var cell = editedLine.querySelector(`.property.${prop.name}`);
            if (!cell) {
                cell = document.createElement("div");
                cell.classList.add("property", prop.name);
                editedLine.appendChild(cell);
            }
            cell.textContent = "";
        });

    });


    //sort the table so that non-header rows respect the orders array order
    Array.from(ordersTable.children)
        .filter(row => !row.classList.contains("header"))
        .sort((a, b) => {
            const idA = parseInt(a.getAttribute("orderId"));
            const idB = parseInt(b.getAttribute("orderId"));
            const indexA = orders.findIndex(o => o.id === idA);
            const indexB = orders.findIndex(o => o.id === idB);
            return indexA - indexB;
        })
        .forEach(row => ordersTable.appendChild(row));


    orders.forEach(order => {
        if (IsTaskPaused(order, PAUSECHANNEL_ONETASK)) {
            ordersTable.querySelector(`div[orderId='${order.id}']`).classList.add("pauseOne");
        } else {
            ordersTable.querySelector(`div[orderId='${order.id}']`).classList.remove("pauseOne");
        }

        if (IsTaskPaused(order, PAUSECHANNEL_FROMTASK)) {
            ordersTable.querySelector(`div[orderId='${order.id}']`).classList.add("pauseFrom");
        } else {
            ordersTable.querySelector(`div[orderId='${order.id}']`).classList.remove("pauseFrom");
        }

        if (IsTaskPaused(order, PAUSECHANNEL_ALLSTASKS)) {
            ordersTable.querySelector(`div[orderId='${order.id}']`).classList.add("pauseAll");
        } else {
            ordersTable.querySelector(`div[orderId='${order.id}']`).classList.remove("pauseAll");
        }
    });

}

function GetOrderConditions(order) {
    var conditions = order.item_conditions;
    //remove all conditions that correspond to a PauseCondition object
    conditions = conditions.filter(cond => !(cond.condition === pauseAll.condition && cond.value === pauseAll.value));
    conditions = conditions.filter(cond => !(cond.condition === pauseFrom.condition && cond.value === pauseFrom.value));
    conditions = conditions.filter(cond => !(cond.condition === pauseOne.condition && cond.value === pauseOne.value));
    return conditions;
}

function UpdateConditionsContainer(order) {
    var conditions = GetOrderConditions(order);
    var editedLine = ordersTable.querySelector(`div[orderId='${order.id}']`);
    var cell = editedLine.querySelector(`.property.item_conditions`);
    var property = "item_conditions"
    //remove container if exists
    container = editedLine.querySelector(`.property.${property} .conditionsContainer`);

    if (container)
        container.remove();

    container = document.createElement("div");
    container.classList.add("conditionsContainer");
    cell.appendChild(container);

    var i = 0;
    conditions.forEach(condition => {
        var conditionElement = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}']`);
        if (!conditionElement) {
            conditionElement = document.createElement("div");
            conditionElement.classList.add("condition");
            conditionElement.setAttribute("conditionIndex", i);
            container.appendChild(conditionElement);
        }

        var partsHost = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}'] .conditionPartsHost`);
        if (!partsHost) {
            partsHost = document.createElement("div");
            partsHost.classList.add("conditionPartsHost");
            partsHost.setAttribute("conditionIndex", conditions.indexOf(condition));

            var delButton = document.createElement("button");
            delButton.classList.add("btnCopy");
            delButton.textContent = "📋";
            delButton.addEventListener("mouseup", (e) => {
                e.stopPropagation();
                if (e.button == 0)
                    CopyCondition(order, conditions.indexOf(condition));
            });
            partsHost.appendChild(delButton);

            var delButton = document.createElement("button");
            delButton.classList.add("btnDelete");
            delButton.textContent = "✖";
            delButton.addEventListener("mouseup", (e) => {
                e.stopPropagation();
                if (e.button == 0)
                    DeleteCondition(order, conditions.indexOf(condition));
            });
            partsHost.appendChild(delButton);
            conditionElement.appendChild(partsHost);
        }


        for (const key of conditionParts) {
            if (key.endsWith("_element"))
                continue;

            condPartElement = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}'] .conditionPartsHost .conditionPart.cond_${key}`);
            var mustAddListener = false;
            if (!condPartElement) {
                condPartElement = document.createElement("div");
                condPartElement.classList.add("conditionPart", "cond_" + key);
                mustAddListener = true;
                partsHost.appendChild(condPartElement);
            }

            var value = condition[key] ?? "";

            if (key == "value") {
                var input = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}'] .conditionPartsHost .conditionPart.cond_value input`);
                if (!input) {
                    input = CreateInputForOrders(InputChangeCallback_ConditionValue, order, property, i);
                    condPartElement.appendChild(input);
                }
                condition.value_element = input;
            } else {
                if (key == "condition") {
                    condPartElement.textContent = condOperators.find(op => op.name === condition[key]).symbol;
                } else {
                    condPartElement.textContent = value;
                }
                if (mustAddListener)
                    (function (order, index) {
                        condPartElement.addEventListener("mouseup", (e) => {
                            e.stopPropagation();
                            if (e.button == 0)
                                OpenConditionEditor(order, index);
                        });
                    })(order, conditions.indexOf(condition));

            }
        };
        if (condition.item_type == undefined) {
            var condPartElement = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}'] .conditionPartsHost .conditionPart.cond_item_type`);

            if (!condPartElement) {
                condPartElement = document.createElement("div");
                condPartElement.classList.add("conditionPart", "cond_item_type");
                partsHost.appendChild(condPartElement);
            }
            condPartElement.textContent = "ANY_ITEM";
        }
        i++;
    });

    var buts = container.querySelectorAll(".buttons");
    if (buts.length == 0) {
        buts = document.createElement("div");
        buts.classList.add("buttons");
    } else {
        buts = buts[0];
    }

    var pasteCondButton = container.querySelectorAll(".btnAddCondition");
    if (pasteCondButton.length == 0) {
        var button = document.createElement("button");
        button.textContent = "Paste";
        button.classList.add("btnPaste");
        button.addEventListener("mouseup", (e) => {
            e.stopPropagation();
            if (e.button == 0)
                PasteCondition(order);
        });
        buts.appendChild(button);
    } else {
        buts.appendChild(pasteCondButton[0]);
    }
    var addCondButton = container.querySelectorAll(".btnAddCondition");
    if (addCondButton.length == 0) {
        var button = document.createElement("button");
        button.textContent = "+";
        button.classList.add("btnAddCondition");
        button.addEventListener("mouseup", (e) => {
            e.stopPropagation();
            if (e.button == 0) AddCondition(order);
        });
        buts.appendChild(button);
    } else {
        buts.appendChild(addCondButton[0]);
    }

    var numDiv = editedLine.querySelector(`.property.${property} .conditionsNum`);
    numDiv.textContent = conditions.length > 0 ? "" + conditions.length + "c" : "-";

    container.appendChild(buts);
    container.querySelectorAll(".btnPaste")[0].classList.toggle("disabled", copiedCondition == null);
}

function UpdateOrdersLabels() {
    var labels = document.querySelectorAll(".orderRow .property.job");
    labels.forEach(label => {
        var order = GetOrderFromElement(label.closest(".orderRow"));
        if (order)
            label.innerHTML = GetOrderJobLabel(order);
    });
}


function AddCondition(order) {
    condition = {
        "condition": "GreaterThan",
        "flags": [""],
        "item_type": "",
        "reaction_id": "",
        "material": "INORGANIC",
        "reaction_product": "",
        "value": 10
    }
    order.item_conditions.push(condition);

    MarkEdited(order);
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave(true);

    UpdateOrdersTable();
    OpenConditionEditor(order, order.item_conditions.length - 1);
}

function DeleteCondition(order, conditionIndex) {
    order.item_conditions.splice(conditionIndex, 1);
    MarkEdited(order);
    UpdateConditionsContainer(order);

    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
}

function CopyCondition(order, conditionIndex) {
    copiedCondition = order.item_conditions[conditionIndex];
    conditionJustCopied = true;
    UpdateConditionsContainer(order);
}

function PasteCondition(order) {
    if (copiedCondition == null)
        return;

    order.item_conditions.push(copiedCondition);
    MarkEdited(order);
    UpdateConditionsContainer(order);

    if (config.toggleAutoSaveOrders)
        QueueOrdersSave(true);
}




function CancelOrderChanges() {
    orders = [];
    Toast("Cleared changes");
    ReadOrders();
}

async function ReadOrders() {
    if (waitForOrdersOperation)
        return;

    waitForOrdersOperation = true;

    Trace("Reading production orders...");
    json = await window.api.ReadOrdersFile();

    if (json == null) {
        waitForOrdersOperation = false;
        return;
    }

    if (CheckError(json, "ReadOrders")) {
        waitForOrdersOperation = false;
        return;
    }
    ClosePopInfoWaiting("ReadOrders");

    newOrders = JSON.parse(json);
    if (orders != null && orders.length > 0) {
        //update old lines
        orders.forEach(oldLine => {
            var matchingNewLine = newOrders.find(nl => nl.id == oldLine.id);
            if (matchingNewLine == null) {
                //remove obsolete line
                if (!oldLine.isNew && !oldLine.edited)
                    orders = orders.filter(ol => ol.id != oldLine.id);
            } else {
                //dont update values on edited lines
                if (oldLine.edited)
                    return;

                //update values
                propertiesInfos.forEach(prop => {
                    if (JSON.stringify(oldLine[prop.name]) != JSON.stringify(matchingNewLine[prop.name])) {
                        oldLine[prop.name] = matchingNewLine[prop.name];
                        if (prop.name === "item_conditions" && openedConditionsOrder != null && openedConditionsOrder.id == oldLine.id) {
                            //order conditions have changed game side, close condition editor if open
                            BackgroundClicked();
                        }
                    }
                });
            }
        });
        //add new lines
        newOrders.forEach(newLine => {
            var matchingOldLine = orders.find(ol => ol.id == newLine.id);
            if (matchingOldLine == null) {
                //insert at proper index
                var index = newOrders.indexOf(newLine);
                orders.splice(index, 0, newLine);
            }
        });
    } else {
        orders = newOrders;
    }

    orders.forEach(order => {
        if (order.item_subtype == "ITEM_ARMOR_ROBE")
            order.item_subtype = "ITEM_ARMOR_DRESS";
    });

    UpdateOrdersTable();
    UpdateStocksWanted();

    Trace("Reading production: completed.");
    waitForOrdersOperation = false;
}

function UpdateStocksWanted() {
    var cellsWanted = $(".cell.editable.hasJob[want]")

    var itemsToUpdate = []
    //update cells with wanted qtt (update value or remove wanted flag if job no longer exists)
    cellsWanted.forEach(cell => {
        var jobId = parseInt(cell.getAttribute("jobId"));
        var job = jobs[jobId];
        if (!job)
            return;
        itemsToUpdate.push(JobItemName(job));
    });

    orders.forEach(order => {
        if (order.foundJob)
            itemsToUpdate.push(JobItemName(order.foundJob));
    });

    itemsToUpdate = [...new Set(itemsToUpdate)];
    itemsToUpdate.forEach(itemName => {
        UpdateStockItemLine(itemName);
    });
}

async function WriteOrders() {
    //check if any new, edited or deleted orders exist
    var hasChanges = orders.some(o => o.edited === true || o.deleted === true || o.isNew === true);
    if (!hasChanges)
        return;

    Trace("Writing orders...");

    fileHandle ??= await window.api.GetFileHandle();
    if (!fileHandle) {
        $("body")[0].classList.add("noFileSelected");
        return;
    }
    $("body")[0].classList.remove("noFileSelected");

    waitForOrdersOperation = true;

    //remove deleted
    orders = orders.filter(o => o.deleted !== true);

    //clear edited flags
    //remove "edited" property from all orders
    orders.forEach(order => { if (order.edited) delete order.edited; });

    //remove empty properties
    clonedOrders = CloneOrdersNoDom(orders);
    clonedOrders.forEach(order => {
        DeleteEmptyKeys(order);
    });

    if (config.debugNoWrite) {
        cl(JSON.stringify(clonedOrders, null, 2));
    } else {
        await window.api.WriteOrdersFile(JSON.stringify(clonedOrders, null, 2));
    }
    Trace("Writing orders: completed.");
    waitForOrdersOperation = false;

    //clear new pushed orders
    var news = $(".orderRow.new").length;
    if (news) {
        await pause(300);
        await ReadOrders();
        orders.filter(o => o.isNew).forEach(o => orders.splice(orders.indexOf(o), 1));
        $(".orderRow.new").forEach(el => el.remove());
    }
    $(".editable.updating").forEach(el => el.classList.remove("updating"));

    UpdateOrdersTable();
    UpdateStocksWanted();
}

function DeleteEmptyKeys(obj) {
    //go recursively through object properties and delete all properties with no, null, or empty string values
    for (const key in obj) {
        if (obj[key] && typeof obj[key] === "object") {
            DeleteEmptyKeys(obj[key]);
            //if object is now empty, delete it
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        } else if (obj[key] === null || obj[key] === "") {
            delete obj[key];
        }
    }
}

function CloneOrdersNoDom(orders) {
    if (Array.isArray(orders)) {
        return orders
            .map(CloneOrdersNoDom)
            .filter(v => v !== undefined);
    }

    if (orders && typeof orders === "object") {
        const out = {};
        for (const k in orders) {
            if (k.endsWith("_cell") || k.endsWith("_element"))
                continue;
            if (k == "isNew" || k == "orderHovered")
                continue;
            if (k == "max_workshops" && orders[k] === 0)
                continue;
            const v = CloneOrdersNoDom(orders[k]);
            if (v !== undefined)
                out[k] = v;
        }
        return out;
    }

    return orders;
}

onmessage = async (e) => {
    // Retrieve message sent to work from main script
    const message = e.data;

    // Get handle to draft file
    const root = await navigator.storage.getDirectory();
    const draftHandle = await root.getFileHandle("draft.txt", { create: true });
    // Get sync access handle
    const accessHandle = await draftHandle.createSyncAccessHandle();

    // Get size of the file.
    const fileSize = accessHandle.getSize();
    // Read file content to a buffer.
    const buffer = new DataView(new ArrayBuffer(fileSize));
    const readBuffer = accessHandle.read(buffer, { at: 0 });

    // Write the message to the end of the file.
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);
    const writeBuffer = accessHandle.write(encodedMessage, { at: readBuffer });

    // Persist changes to disk.
    accessHandle.flush();

    // Always close FileSystemSyncAccessHandle if done.
    accessHandle.close();
};


function ReloadCss() {
    const links = document.getElementsByTagName('link');
    const timestamp = Date.now();

    for (let i = 0; i < links.length; i++) {
        const link = links[i];

        // Check if the link is a stylesheet
        if (link.rel === 'stylesheet') {
            let href = link.href.replace(/(\?.*)|(#.*)/g, ''); // Remove existing query/hash

            // Append the unique timestamp as a query parameter
            link.href = `${href}?v=${timestamp}`;
        }
    }
}


function CreateInputForOrders(onChangeCallback, orderObject, affectedProperty, conditionIndex = -1) {
    input = document.createElement("input");
    input.type = "number";
    input.value = conditionIndex > -1 ? orderObject["item_conditions"][conditionIndex].value : orderObject[affectedProperty];
    input.classList.add("inputNumber");

    input.setAttribute("orderId", orderObject.id);
    input.setAttribute("affectedProp", affectedProperty);
    input.setAttribute("conditionIndex", conditionIndex);

    PrepareInput(input, onChangeCallback);
    return input;
}

function PrepareInput(input, onChangeCallback) {
    input.addEventListener("focus", (e) => {
        e.target.select();
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === " ") {
            e.preventDefault();
            const formElements = Array.from(document.querySelectorAll("input.inputNumber"));
            const currentIndex = formElements.indexOf(e.target);
            const nextIndex = (currentIndex + 1) % formElements.length;
            formElements[nextIndex].focus();
        }
    });
    input.addEventListener("mouseup", (e) => {
        e.stopPropagation();
    });

    if (onChangeCallback != null) {
        input.addEventListener("change", (e) => { onChangeCallback(e); });
        input.addEventListener("blur", (e) => { onChangeCallback(e); });
    }
}

function InputChangeCallback_PropertyValue(e) {
    var id = e.target.getAttribute("orderId");
    var order = orders.find(o => o.id == id);

    MarkEdited(order);
    var prop = e.target.getAttribute("affectedProp");
    order[prop] = parseInt(e.target.value);
    order[prop + "_cell"].childNodes[0].nodeValue = order[prop];
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
}

function InputChangeCallback_ConditionValue(e) {
    var id = e.target.getAttribute("orderId");
    var order = orders.find(o => o.id == id);
    var condIndex = e.target.getAttribute("conditionIndex");

    MarkEdited(order);
    var condition = order["item_conditions"][condIndex];
    condition.value = parseInt(e.target.value);
    condition.value_element.value = condition.value;
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
}

function MarkEdited(order) {
    order.edited = true;
    var line = ordersTable.querySelector(`div[orderId='${order.id}']`);

    if (line)
        line.classList.add("edited");

    var outItem = order.foundJob?.io?.out?.[0];
    if (outItem?.item) {
        var itemName = JobItemName(order.foundJob);
        UpdateStockItemLine(itemName);
    }
}


function UpdateStockItemLine(itemName) {
    CreateStockCell(itemName, "ALL");
    config.selectedStocksMaterialsCols.forEach(matName => {
        CreateStockCell(itemName, matName);
    });
}

function GetOrderFromElement(element) {
    var id = element.closest(".orderRow")?.getAttribute("orderId");;
    return orders.find(o => o != null && o.id == id);
}


function PauseAllTasks() {
    allOrdersPaused = !allOrdersPaused;
    const pauseAllBtn = document.getElementById("pauseAll");
    pauseAllBtn.classList.toggle("active", allOrdersPaused);

    orders.forEach(order => {
        if (allOrdersPaused) {
            PauseTask(order, PAUSECHANNEL_ALLSTASKS);
        } else {
            ResumeTask(order, PAUSECHANNEL_ALLSTASKS);
        }
    });
    UpdateOrdersTable();
}

function PauseAllTasksFrom(myOrder) {
    var index = orders.findIndex(o => o.id === myOrder.id);

    if (index === -1)
        return;

    var paused = IsTaskPaused(myOrder, PAUSECHANNEL_FROMTASK);

    for (let i = index; i < orders.length; i++) {
        var order = orders[i];
        if (paused) {
            ResumeTask(order, PAUSECHANNEL_FROMTASK);
        } else {
            PauseTask(order, PAUSECHANNEL_FROMTASK);
        }
    }
    UpdateOrdersTable();
}

function PauseTask(order, stopChannel = 0) {
    var pauseCondition = GetPauseCondition(stopChannel);

    if (!order.item_conditions)
        order.item_conditions = [];

    if (order.item_conditions.findIndex(cond => cond.condition === pauseCondition.condition && cond.value === pauseCondition.value) === -1) {
        order.item_conditions.push(pauseCondition);
    }

    MarkEdited(order);
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
}

function ResumeTask(order, stopChannel = 0) {
    var pauseCondition = GetPauseCondition(stopChannel);

    if (!order.item_conditions)
        order.item_conditions = [];
    order.item_conditions = order.item_conditions.filter(cond => !(cond.condition === pauseCondition.condition && cond.value === pauseCondition.value));

    MarkEdited(order);
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
}

function IsTaskPaused(order, stopChannel = 0) {
    if (stopChannel === PAUSECHANNEL_ANY)
        return order.item_conditions.findIndex(cond => cond.condition === pauseCondition.condition && cond.value <= 0) !== -1;

    var pauseCondition = GetPauseCondition(stopChannel);

    if (!order.item_conditions)
        return false;
    return order.item_conditions.findIndex(cond => cond.condition === pauseCondition.condition && cond.value === pauseCondition.value) !== -1;
}

function GetPauseCondition(stopChannel = 0) {
    return {
        condition: "LessThan",
        value: stopChannel
    };
}

function Hide(elements) {
    elements.forEach(el => {
        el.classList.add("hidden");
    });
}

function Show(elements) {
    elements.forEach(el => {
        el.classList.remove("hidden");
    });
}


function OnRightClickOrEscape() {
    var stockMatPicker = $(".inventoryMaterialsPickerHost:not(.hidden)")[0];
    if (stockMatPicker) {
        var pickerInput = $("#inventoryMaterialsFilter")[0];
        if (pickerInput.value != "") {
            pickerInput.value = "";
            pickerInput.dispatchEvent(new Event("change"));
            return;
        }
        stockMatPicker.classList.add("hidden");
        ApplyInventoryMaterialFilters();
    }

    var conditionEditor = $(".conditionEditor:not(.hidden)")[0];
    if (conditionEditor) {
        CloseConditionEditor();
        return;
    }

    var orderEditor = $(".orderEditor:not(.hidden)")[0];
    if (orderEditor) {
        CloseOrderEditor();
        return;
    }

    $("#generalFilter")[0].value = "";
    $("#generalFilter")[0].dispatchEvent(new Event("change"));

}

function FilterChanged(search) {
    var timeSinceLastchange = Date.now() - lastFilterChange;
    if (timeSinceLastchange < 300) {
        //debounce
        if (filterDelayer)
            clearTimeout(filterDelayer);
        filterDelayer = setTimeout(() => { FilterChanged(search); }, 300 - timeSinceLastchange);
        return;
    }
    search = search.toLowerCase();
    FilterJobs(search);
    UpdateInventoryItemFilter(search);
    lastFilterChange = Date.now();
}


function FilterJobs(searchTerm) {
    var orderLines = ordersTable.querySelectorAll(".orderRow");
    orderLines.forEach(line => {
        var jobCell = line.querySelector(".property.job");
        var jobName = jobCell ? jobCell.textContent.toLowerCase() : "";
        if (jobName.includes(searchTerm)) {
            line.classList.remove("hidden");
        } else {
            line.classList.add("hidden");
        }
    });
}


function SetAutoFill(input, sourceData, allowMultiples) {
    $(".autocompleteList").forEach(el => el.innerHTML = "");

    multiFill = allowMultiples;
    autoFillSource[input.getAttribute("id")] = sourceData;
    fuses[input.getAttribute("id")] = new Fuse(sourceData);
    currendFuseInput = input;
    if (currendFuseInput != null)
        currendFuseInput.removeEventListener("input", AutoFillFieldChanged);
    currendFuseInput.addEventListener("input", AutoFillFieldChanged);
}

function AutoFillFieldChanged(event) {
    var input = event.target;
    var id = input.getAttribute("id");
    var data = autoFillSource[input.getAttribute("id")];
    var tags = input.value.split(",");
    var results = fuses[id].search(tags[tags.length - 1].trim());
    var list = input.nextElementSibling;
    list.innerHTML = "";
    results.slice(0, 10).forEach(result => {
        var line = document.createElement("div");
        line.classList.add("autocompleteItem");
        line.textContent = result.item;
        list.appendChild(line);
        line.addEventListener("mouseup", (e) => {
            e.stopPropagation();
            if (e.button != 0)
                return;

            if (multiFill && input.value.trim() != "") {
                input.value += "," + result.item;
            } else {
                input.value = result.item;
            }
            list.innerHTML = "";
            var event = new Event("change");
            input.dispatchEvent(event);
        });
    });
    list.style.display = results.length > 0 ? "block" : "none";


}

function CloseAutoFill(input) {
    var sourceData = autoFillSource[input.getAttribute("id")];

    var list = input.nextElementSibling;
    if (input.getAttribute("pickOnBlur")) {
        var firstItem = list.querySelector(".autocompleteItem");
        if (firstItem) {
            if (multiFill && input.value.trim() != "") {
                input.value += "," + firstItem.textContent;
            } else {
                input.value = firstItem.textContent;
            }
        }
    }

    if (input.getAttribute("tagsMode")) {
        var tags = input.value.split(",");
        tags = tags.map(t => t.trim());
        tags = tags.filter(t => t !== "");
        tags = [...new Set(tags)];

        var validTags = [];

        if (tags) {
            tags.forEach(tag => {
                if (sourceData.findIndex(v => v == tag) != -1) {
                    validTags.push(tag);
                    if (!multiFill)
                        return;
                }
            });
        }

        input.value = validTags.join(",");
    }
    list.innerHTML = "";
    var event = new Event("change");
    input.dispatchEvent(event);

}


function ConditionEdited(elem) {
    var order = openedConditionsOrder;
    var condition = order.item_conditions[openedConditionsIndex];
    var property = elem.getAttribute("property");
    MarkEdited(order);

    if (property == "flags") {
        if (elem.value != "") {
            var elems = elem.value.split(",");
            elems = elems.map(e => e.trim());
            condition[property] = elems;
        }
    } else if (property == "value") {
        condition[property] = parseInt(elem.value);
    } else {
        condition[property] = elem.value;
    }

    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
}

function ConditionEditHover(e) {
    var order = GetOrderFromElement(e.currentTarget);

    hoveredConditionsOrder = order;
    UpdateConditionsContainer(order);
}

function OpenConditionEditor(order, conditionIndex) {
    if (conditionJustCopied) {
        conditionJustCopied = false;
        return;
    }

    condition = order.item_conditions[conditionIndex];
    if (!condition)
        return;
    openedConditionsOrder = order;
    openedConditionsIndex = conditionIndex;
    var editor = $(".conditionEditor")[0];

    $("#conditionEditorTitle")[0].textContent = GetOrderJobLabel(order) + " : " + GetOrderMaterialLabel(order);

    editor.querySelector("#itemType").value = condition.item_subtype ? condition.item_subtype : condition.item_type ?? "";
    editor.querySelector("#itemFlag").value = condition.flags ? condition.flags.join(",") : "";
    editor.querySelector("#itemMaterial").value = condition.material ? condition.material : "";
    editor.querySelector("#itemReactable").value = condition.reaction_product ? condition.reaction_product : "";
    editor.querySelector("#operator").value = condition.condition;
    editor.querySelector("#conditionValue").value = condition.value;
    Show($(".conditionEditor"));
}

function CloseConditionEditor() {
    $(".conditionEditor")[0].classList.add("hidden");

    if (openedConditionsOrder != null)
        UpdateOrdersTable();

    openedConditionsOrder = null;
}

function CreateNewOrder(orderToDuplicate = null) {
    var myOrder;
    if (orderToDuplicate = null) {
        //clone current hover order
        myOrder = JSON.parse(JSON.stringify(orderToDuplicate = null));
        myOrder.isNew = true;
        myOrder.edited = true;
        myOrder.amount_left = myOrder.amount_total;
    } else {
        myOrder = {
            job: "",
            amount_left: 10,
            amount_total: 10,
            material_category: [],
            material: "",
            frequency: "OneTime",
            max_workshops: 0,
            is_active: false,
            is_validated: false,
            isNew: true,
            edited: true,
        }
    }

    return myOrder;
}

function AddNewOrder(newOrder, afterOrder = null) {
    if (afterOrder) {
        //insert after hovered order (for duplications)
        var index = orders.findIndex(o => o.id === afterOrder.id);
        orders.splice(index + 1, 0, newOrder);
    } else {
        orders.push(newOrder);
    }

    newOrder.id = Math.max(...orders.filter(o => o.id != null).map(o => o.id), 10) + 1;
    if (isNaN(newOrder.id))
        newOrder.id = 10;

    MarkEdited(newOrder);
    UpdateOrdersTable();

    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();

    //scroll to new order
    setTimeout(() => {
        var newLine = ordersTable.querySelector(`div[orderId='${newOrder.id}']`);
        newLine.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
}

async function GetConfig() {

    config = await window.api.GetSetConfig();

    var mustSave = false;
    if (config.selectedStocksMaterialsCols == undefined) {
        config.selectedStocksMaterialsCols = [];
        mustSave = true;
    }

    if (!config.selectedStocksMaterialsCols.includes("ALL")) {
        config.selectedStocksMaterialsCols.unshift("ALL");
        mustSave = true;
    }

    if (config.selectedStocksMaterialsCols.length > MAX_MATERIALS_COLS) {
        config.selectedStocksMaterialsCols = config.selectedStocksMaterialsCols.slice(0, MAX_MATERIALS_COLS);
    }

    if (mustSave)
        config = await window.api.GetSetConfig(config);

    return true;
}

async function SaveConfig() {
    config = await window.api.GetSetConfig(config);
    return config;
}

async function ToggleOption(name, noSwitch = false) {
    name = name.charAt(0).toUpperCase() + name.slice(1);
    name = "toggle" + name;

    if (!config[name]) {
        config[name] = true;
    } else if (!noSwitch) {
        config[name] = !config[name];
    }

    config = await window.api.GetSetConfig(config);

    if (CheckError(config))
        return;


    if (name == "toggleAutoReadOrders" && config.toggleAutoReadOrders) {
        mustReadOrders = true
    }
    if (name == "toggleAutoSaveOrders" && config.toggleAutoSaveOrders) {
        QueueOrdersSave(true);
    }

    ApplyConfigClasses()
}

async function ApplyConfigClasses() {
    //remove all toggle classes from body
    var togClasses = Array.from($("body")[0].classList).filter(c => c.startsWith("toggle_"));
    togClasses.forEach(c => $("body")[0].classList.remove(c));

    Object.keys(config).forEach(optionName => {
        if (optionName.startsWith("toggle"))
            $("body")[0].classList.toggle(optionName, config[optionName] === true);
    });

    await CycleSizeMode(true);
}

function ToggleAutoRead() {
    config.autoReadWorkOrders = !config.autoReadWorkOrders;
    const autoReadBtn = document.getElementById("autoRead");
    autoReadBtn.classList.toggle("active", config.autoReadWorkOrders);
}



function DeleteTask(order) {
    if (!order)
        return;

    if (order.deleted) {
        //remove property
        delete order.deleted;
    }
    else {
        if (order.isNew) {
            //remove from orders array
            orders = orders.filter(o => o.id !== order.id);
        } else {
            order.deleted = true;
        }
    }
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
    UpdateOrdersTable();
}



function SetTab(tab) {
    displayedTab = tab;

    $("body")[0].classList.remove("tab_inventoryOpened");
    $("body")[0].classList.remove("tab_ordersOpened");

    switch (tab) {
        case "inventory":
            $("body")[0].classList.add("tab_inventoryOpened");
            break;

        default:
            $("body")[0].classList.add("tab_ordersOpened");
            break;
    }
}

async function CycleSizeMode(noChange) {
    if (previousSizeMode != undefined)
        $("body")[0].classList.remove("sizemode_" + previousSizeMode);

    if (!noChange)
        config.sizeMode++;

    if (config.sizeMode > 3)
        config.sizeMode = 0;
    SaveConfig();

    $("body")[0].classList.add("sizemode_" + config.sizeMode);
    previousSizeMode = config.sizeMode;
}

function CreateRowButton(classes, text, callback) {
    var buttonHost = document.createElement("button");
    buttonHost.classList.add("rowTool");
    classes.forEach(c => buttonHost.classList.add(c));

    var button = document.createElement("div");
    var span = document.createElement("span");
    span.textContent = text;
    button.appendChild(span);
    buttonHost.appendChild(button);

    buttonHost.addEventListener("mouseup", (e) => {
        if (e.button != 0)
            return;
        e.stopPropagation();
        callback(e)
    });

    return buttonHost;
}


function GetOrderMaterialLabel(order) {
    var text = "";
    if (order["material_category"] != null) {
        text = order["material_category"].toString();
    } else {
        text = order["material"] ?? "";
    }
    text = text.toLocaleLowerCase();
    text = text.replace("native_", "");
    text = text.replace("inorganic:", "");
    text = text.replace("inorganic", "Rock (Inorganic)");

    return text;
}



function ChangeWantedProduction(e) {

    var input = e.target;
    var qttDesired = parseInt(input.value);
    var cell = input.closest(".editable");
    var jobId = cell.getAttribute("jobId");

    cell.classList.add("updating");
    cell.setAttribute("totalWant", qttDesired);

    var job = jobs[jobId];
    if (!job) {
        cl("Unknown job: " + jobId);
        return;
    }

    var matchingOrders = FindActiveOrdersForJob(job);

    var ord;
    if (matchingOrders.length > 0) {
        ord = matchingOrders[0];

    } else {
        if (qttDesired <= 0)
            return;

        ord = CreateNewOrder();
        ord.job = job.jobTypeName;
        var item = job.io?.out?.[0]?.item;
        if (item && item.subtypeName)
            ord.item_subtype = item.subtypeName;
        ord.frequency = "Daily";
        if (job.material_category)
            ord.material_category = job.material_category;
        if (job.material)
            ord.material = job.material;

        if (job.reactionName)
            ord.reaction = job.reactionName;

        AddNewOrder(ord);
    }

    let min = Math.min(GetOrderBatchSize(), qttDesired);
    ord.amount_total = min;
    ord.amount_left = min;

    ChangeDesiredOrderQuantity(ord, qttDesired, job);
}

function ChangeDesiredOrderQuantity(order, qttDesired, stockTask) {

    if (qttDesired <= 0) {

        DeleteTask(order);

    } else {

        if (stockTask) {

            //stock goal: change the conditions for the order for when to stop producing
            order.item_conditions = GetJobConditions(stockTask, qttDesired);

        } else {

            //direct quantity order : change the amount_total and amount_left
            var oldQtt = order.amount_total;
            order.amount_total = qttDesired;
            var diff = qttDesired - oldQtt;
            if (diff == 0)
                return;
            order.amount_left += diff;
        }

        var orderLine = ordersTable.querySelector(`div[orderId='${order.id}']`);
        if (!orderLine)
            return;

        orderLine.querySelector(".property.amount_left .inputNumber").value = order.amount_left;
        orderLine.querySelector(".property.amount_total .inputNumber").value = order.amount_total;
        MarkEdited(order);
    }
}

function GetJobConditions(job, qttDesired) {

    //cl("Getting conditions for job: " + job.jobTypeName + " desired qtt: " + qttDesired);

    var conditions = [];
    job.io.in.forEach(inp => {
        var condition = {
            "condition": "GreaterThan",
            "value": Math.min(GetOrderBatchSize(), qttDesired)
        }

        Object.keys(inp).forEach(key => {
            if (key == "item") {
                var item = inp[key];
                if (item.typeName)
                    condition["item_type"] = item.typeName;
                if (item.subtypeName)
                    condition["item_subtype"] = item.subtypeName;
                if (item.flags)
                    condition["flags"] = item.flags;

                return;
            }

            if (key == "quantity") {
                return;
            } else {
                condition[key] = inp[key];
            }
        });

        conditions.push(condition);
    });

    if (job.isCrafts) {
        craftTypes.forEach(craftType => {
            var condition = {
                "condition": "LessThan",
                "item_type": craftType.toUpperCase(),
                "value": qttDesired,
            }
            if (job.material)
                condition["material"] = job.material;
            if (job.material_category && job.material_category.length > 0)
                condition["material_category"] = job.material_category;
            conditions.push(condition);
        });
    } else {
        job.io.out.forEach(outp => {
            var condition = {
                "condition": "LessThan",
                "value": qttDesired
            }
            Object.keys(outp).forEach(key => {
                if (key == "item") {
                    var item = outp[key];
                    if (item.typeName)
                        condition["item_type"] = NoS(item.typeName.toUpperCase());
                    if (item.subtypeName)
                        condition["item_subtype"] = item.subtypeName;
                    if (item.material)
                        condition["material"] = item.material;

                    return;
                }
            });
            conditions.push(condition);
        });
    }

    //cl("Conditions generated: " + JSON.stringify(conditions, null, 2));
    return conditions;
}

function GetOrderBatchSize() {
    if (!config.orderBatchSize) {
        config.orderBatchSize = 6;
        SaveConfig();
    }
    return config.orderBatchSize;
}

function FindActiveOrdersForJob(job) {
    if (!job)
        return [];

    return orders.filter(order => {
        if (order.job != job.jobTypeName)
            return false;

        if ((order.item_subtype ?? '') != (job.item_typeName ?? ''))
            return false;

        if (order.material_category != null && order.material_category.length > 0) {
            if (!job.material_category || job.material_category.length == 0 || (order.material_category[0] != job.material_category[0]))
                return false;
        }

        if (order.material != job.material && job.material != '')
            return false;

        return true;
    });
}

function CleanupDuplicateJobs() {
    var totalMerges = 0;
    Object.values(orders).forEach(orderA => {
        if (orderA.deleted)
            return;

        let targetCount = orderA.amount_total;
        let leftCount = orderA.amount_left;
        let mergeds = [];

        Object.values(orders).forEach(orderB => {
            if (orderB.deleted)
                return;

            if (orderA.id == orderB.id)
                return;

            if (orderA.job != orderB.job
                || orderA.material != orderB.material
                || (orderA.material_category && orderB.material_category && orderA.material_category.toString() != orderB.material_category.toString())
                || orderA.item_type != orderB.item_type
                || orderA.item_subtype != orderB.item_subtype
                || orderA.reaction != orderB.reaction)
                return;

            targetCount += orderB.amount_total;
            leftCount += orderB.amount_left;
            totalMerges++;
            DeleteTask(orderB);
            mergeds.push(orderB.id)
        });

        if (orderA.amount_total != targetCount || orderA.amount_left != leftCount) {
            orderA.amount_total = targetCount;
            orderA.amount_left = leftCount;
            MarkEdited(orderA);
        }

        if (mergeds.length > 0) {
            Trace("Merged " + mergeds.length + " '" + orderA.id + "' order(s)");
        }
    });

    if (totalMerges > 0) {
        Toast("Merged " + totalMerges + " duplicate(s)");
        UpdateOrdersTable();
    } else {
        Toast("No duplicate orders found");
    }
}


function StockEntryLabelGroup(fullName) {
    let itemName = fullName.split("!").last();
    var item = gm.items[itemName]
    if (!item) {
        cl("Unknown item: " + itemName);
        return fullName;
    }

    itemName = item.name.toUpperCase();
    itemName = itemName.replace("ITEM_", "");
    itemName = itemName.replace("WEAPON_", "");
    itemName = itemName.replace("TOOL_", "");
    itemName = itemName.replace("AMMO_", "");
    itemName = itemName.replace("ARMOR_", "");
    itemName = itemName.replace("HELM_", "");
    itemName = itemName.replace("PANTS_", "");
    itemName = itemName.replace("SHIELD_", "");
    itemName = itemName.replace("SHOES_", "");
    itemName = itemName.replace("SIEGEAMMO_", "");
    itemName = itemName.replace(/_/g, " ");
    itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1).toLowerCase();

    if (!item.isTypeOnly) {
        let groupName = ItemGroupName(item);
        return (groupName != "" ? "<b>" + groupName + "</b>" : "") + itemName;
    } else {
        return itemName;
    }

}

function ItemGroupName(item) {
    let name = item.typeName;
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}


function ItemNameWithoutPrefix(itemName) {
    itemName = itemName.replace("ITEM_", "");
    itemName = itemName.replace(/_/g, " ");
    return itemName;
}

function CleanupJobsData() {

    sortedJobTypes = [];
    Object.values(gm.job_type).forEach(jobType => {
        sortedJobTypes.push(jobType);
    });
    sortedJobTypes.sort();

    itemJob = []
    jobSortedNames = []
    var i = 0;
    jobs.forEach(job => {
        CompleteJobInfos(job);

        jobSortedNames.push(job.name);

        job.index = i;
        i++;
    });
    jobSortedNames.sort();

    //CheckJobsValidity();
}

async function TryReadStocks() {
    if (!config.toggleAutoReadStocks && !mustReadStocks)
        return;

    if (readingStocks)
        return;

    mustReadStocks = false;
    readingStocks = true;
    tempStocks = {};

    let ok = false;

    while (!ok) {
        ok = await ReadStocksBatch();
        if (!ok)
            await pause(150);
    }

    if (manualReadStocks)
        Toast("Stocks acquired.");
    manualReadStocks = false;

    readingStocks = false;
}

async function ReadStocksBatch() {
    //Trace("Reading stocks...");

    data = await window.api.GetStocks()

    if (data == null)
        return false;

    if (CheckError(data, "Stocks")) {
        await pause(1500);
        return false;
    }
    ClosePopInfoWaiting("Stocks");

    Object.keys(data.stocks).forEach(key => {
        var itemName = key.split("@")[0];
        var matName = key.split("@")[1];
        var quantity = data.stocks[key];
        tempStocks[itemName] ??= {};
        tempStocks[itemName][matName] = quantity;

        if (TypeIsCraft(itemName)) {
            tempStocks["CRAFTS"] ??= {};
            tempStocks["CRAFTS"][matName] = quantity;
        }
    });

    if (data.completed) {
        Trace("Reading stocks: completed.");
        FinalizeStocks();
        if (!emptyCellsCreated)
            CreateEmptyStocksCells();
        await pause(1000);
        return true;
    }

    return false;
}

function ResetStocksDisplay() {
    emptyCellsCreated = false;
    ClearStockTable();
    CreateEmptyStocksCells();
}

function FinalizeStocks() {
    stocksMaterials = [];
    stockArray = []
    stocks = {};

    for (const item in tempStocks)
        stockArray.push({ item: item, mats: tempStocks[item] });

    stockArray.sort((a, b) => {
        return ItemNameWithoutPrefix(a.item).localeCompare(ItemNameWithoutPrefix(b.item));
    });

    stockArray.forEach(obj => {
        ProcessStockLine(obj.item, obj.mats);
    });

    gm.craftableMaterials = Object.keys(gm.materials).filter(mat => {
        return CraftableMaterialName(mat) != "";
    });

    if (oldStocks == null)
        oldStocks = {};

    stocksMaterials.forEach(mat => {
        if (materialGroups.indexOf(mat) != -1)
            return;

        if (!gm.materials[mat] || gm.materials[mat].Types == null || gm.materials[mat].Types.length == 0) {
            gm.materials[mat] ??= {};
            gm.materials[mat]["Types"] ??= [];

            if (mat.endsWith(":WOOD")) {
                gm.materials[mat].Types.push("WOOD");
            } else if (mat.endsWith(":BONE")) {
                gm.materials[mat].Types.push("BONE");
            } else if (mat.endsWith(":LEATHER")) {
                gm.materials[mat].Types.push("LEATHER");
            } else if (mat.startsWith("GLASS")) {
                gm.materials[mat].Types.push("GLASS");
            } else if (mat.startsWith("COAL:")) {
                gm.materials[mat].Types.push("COAL");
            } else if (mat.endsWith(":DRINK")) {
                gm.materials[mat].Types.push("DRINK");
            } else if (Object.keys(gm.materials[mat].Types).length == 0) {
                if (materialGroups.indexOf(mat) == -1)
                    gm.materials[mat].Types.push("OTHER");
            }
        }
    });

    materialGroups.forEach(group => {
        if (!stocksMaterials.includes(group))
            stocksMaterials.push(group);
    });

    //count regrouped materials qtt for each item (-> 12 Metal Axes, -> 8 Wooden Door)
    Object.keys(stocks).forEach(item => {
        materialGroups.forEach(group => {
            stocks[item][group] = 0;
        });

        Object.keys(stocks[item]).forEach(itemMat => {
            if (materialGroups.indexOf(itemMat) != -1)
                return;

            var itemMaterialGroups = GetMaterialTypes(itemMat);

            qtt = stocks[item][itemMat];
            stocks[item]["ALL"] += stocks[item][itemMat];
            itemMaterialGroups.forEach(groupName => {
                stocks[item][groupName] += qtt;
            });
        });
    });



    //manages cells flashing on stock changes

    var pool = GetStockPool();

    pool.forEach(stockItemName => {
        if (!stockItemName)
            return;

        stock = stocks[stockItemName];
        if (oldStocks[stockItemName] == null)
            oldStocks[stockItemName] = {};

        var stock = stocks[stockItemName] ?? [];

        if (stock.length > 0) {
            Object.keys(stock).forEach(mat => {
                if (oldStocks[stockItemName][mat] == null)
                    oldStocks[stockItemName][mat] = 0;

                var diff = stock[mat] - oldStocks[stockItemName][mat];
                if (diff != 0) {
                    StockCellChanged(stockItemName, mat, diff);
                    itemMatStockChanges.push(stockItemName + "_" + mat);
                }
                oldStocks[stockItemName][mat] = stock[mat];

                if (mat == "STONE")
                    mat = "INORGANIC"
            });
        } else {
            CreateStockCell(stockItemName, "");
        }
    });

    ApplyInventoryMaterialFilters()
}

function ProcessStockLine(item, matsQtts) {

    var newInfo = false;

    if (!stocks[item]) {
        stocks[item] = {}
        newInfo = true;
    }

    Object.keys(matsQtts).forEach(mat => {

        qtt = matsQtts[mat];

        if (!stocks[item][mat])
            stocks[item][mat] = 0;

        if (!stocks[item]["ALL"])
            stocks[item]["ALL"] = 0;

        let cmat = CraftableMaterialName(mat);
        if (mat != "" && stocksMaterials.indexOf(cmat) == -1)
            stocksMaterials.push(cmat);

        stock = stocks[item];
        stock[cmat] = qtt;
        stock["ALL"] += qtt;
    });
}

function CreateEmptyStocksCells() {
    var disp = $(".inventoryTable")[0].style.display
    $(".inventoryTable")[0].style.display = "none"

    var pool = GetStockPool(true);
    var validMaterials = stocksMaterials.filter(mat => config.selectedStocksMaterialsCols.indexOf(mat) != -1);

    pool.forEach(poolEntry => {
        validMaterials.forEach(mat => { CreateStockCell(poolEntry, mat); });
    });

    $(".inventoryTable")[0].style.display = disp
    emptyCellsCreated = true;
}

function GetStockPool(forceIncludeBuildables = false) {
    if (config.toggleHideMissingItems || forceIncludeBuildables) {
        let pool = [];
        Object.values(gm.items).forEach(item => {
            if (itemTypesRequiringSubtypes.indexOf(item.typeName) != -1 && !item.subtypeName)
                return;

            var key = (item.isTypeOnly ? item.typeName : NoS(item.typeName) + "!" + item.subtypeName).toUpperCase();
            if (itemHasJob[key] != true && (!stocks[key] || stocks[key]["ALL"] == 0)) {
                return;
            }

            var key = item.isTypeOnly ? item.typeName : NoS(item.typeName) + "!" + item.subtypeName;
            pool.push(key.toUpperCase());
        });
        return pool;
    } else {
        return Object.keys(stocks)
    }
}


function CreateStockCell(stockEntry, material) {
    if (material == "")
        return;

    var totalStockWant = (stocks[stockEntry]?.["ALL"] > 0 ? 1 : 0) + GetWantedProduction(stockEntry, "ALL");
    var buildable = itemHasJob[stockEntry] ? 1 : 0;
    //cl("Creating stock cell for " + stockEntry + " / " + material + " (totalWant: " + totalStockWant + ", buildable: " + buildable + ")");

    //side header
    if (stockEntry == null || material == null || stockEntry == undefined)
        console.log("QUOI LA BAISE!?");

    var myLabel = stockCellsLabels[stockEntry];
    if (!myLabel) {
        myLabel = document.createElement("div");
        myLabel.classList.add("cell", "itemType", "gameButton");
        myLabel.innerHTML = StockEntryLabelGroup(stockEntry);
        myLabel.setAttribute("item", stockEntry.toUpperCase());

        /*
        let button = document.createElement("button");
        let span = document.createElement("span");
        span.textContent = "/";
        button.appendChild(span);
        button.classList.add("rowTool", "graphButton");
        button.addEventListener("mouseup", (e) => {
            e.stopPropagation();
            ToggleDisplayedGraph(item);
        });
        */
        stockCellsLabels[stockEntry] = myLabel;
        sideA.appendChild(myLabel);
    }
    myLabel.setAttribute("totalStockWant", totalStockWant)
    myLabel.setAttribute("buildable", buildable)


    var tableHeader = $(".inventoryTableHeader")[0];
    var header = stockCellsHeaders[material];
    var index = config.selectedStocksMaterialsCols.indexOf(material)
    if (!header) {
        header = document.createElement("div");
        header.classList.add("cell", "header", "gameButtonL", "inventoryCol");
        header.setAttribute("material", material);

        if (materialGroups.indexOf(material) != -1)
            header.setAttribute("mainCat", 1);

        header.innerHTML = "<div title=\"" + DisplayableMaterialName(material, 2) + "\">" + DisplayableMaterialName(material, 1) + "</div>";
        inventoryStaticHeader.appendChild(header);

        tableHeader.appendChild(header);
        stockCellsHeaders[material] = header;
    }
    header.style.order = index;

    var myMatCol = stockMatCols[material];
    //mat col
    if (!myMatCol) {
        myMatCol = document.createElement("div");
        myMatCol.classList.add("inventoryCol", "inventoryCol");
        myMatCol.setAttribute("material", material);
        sideB.appendChild(myMatCol);
        stockMatCols[material] = myMatCol;
    }
    myMatCol.style.order = config.selectedStocksMaterialsCols.indexOf(material);

    var matCell = stockCells[material + "_" + stockEntry];
    if (!matCell) {
        matCell = document.createElement("div");
        matCell.classList.add("cell", "editable");
        matCell.setAttribute("item", stockEntry);
        var stockDiv = document.createElement("div");
        stockDiv.classList.add("stock");
        stockDiv.title = "Current stock quantity";

        var key = stockEntry + "/" + material;

        if (!itemJob[key]) {
            //cl("Missing job for " + key);
        }

        matCell.classList.toggle("hasJob", false);
        if (itemJob[key] && material != "ALL") {
            matCell.classList.toggle("hasJob", true);
            matCell.setAttribute("jobId", itemJob[key] != null ? itemJob[key].index : "")
            AddInventoryCellInput(matCell, stockEntry, material, ChangeWantedProduction);
        }

        matCell.appendChild(stockDiv);
        myMatCol.appendChild(matCell);
        stockCells[material + "_" + stockEntry] = matCell;
    }

    var input = matCell.querySelector("input.wanted");
    //update input value unless its being edited
    if (input && document.activeElement != input)
        input.value = GetWantedProduction(stockEntry, material);

    var stocked = 0;
    var wanted = GetWantedProduction(stockEntry, material);
    if (stocks[stockEntry] && stocks[stockEntry][material])
        stocked = stocks[stockEntry][material];

    matCell.setAttribute("stockWant", stocked + wanted);
    matCell.setAttribute("want", wanted);
    matCell.setAttribute("totalStockWant", totalStockWant);
    matCell.setAttribute("buildable", buildable);

    var stockDiv = matCell.querySelector("div.stock");
    stockDiv.textContent = GetKiloValue(stocked);
    if (stocked == 0) {
        stockDiv.classList.add("empty");
    } else {
        stockDiv.classList.remove("empty");
    }

    return matCell;
}

function AddInventoryCellInput(cell, itemName, mat, onChangeCallback) {
    input = document.createElement("input");
    input.type = "number";
    input.classList.add("inputNumber", "wanted");
    input.setAttribute("itemType", itemName);
    input.setAttribute("material", mat);
    input.title = "Desired quantity in stocks - affects productions orders";
    PrepareInput(input, onChangeCallback);
    cell.appendChild(input);
}

function StockCellChanged(itemName, matName, diff) {
    var cell = stockCells[matName + "_" + itemName];
    if (!cell) {
        return;
    }

    if (diff > 0) {
        cell.classList.add("popUp");
    } else if (diff < 0) {
        cell.classList.add("popDown");
    }

    setTimeout(() => {
        const c = cell;
        c.classList.remove("popUp");
        c.classList.remove("popDown");
    }, 500);
}



function CloseMaterialsPicker() {
    $(".inventoryMaterialsPickerHost ")[0].classList.add("hidden");
    ApplyInventoryMaterialFilters()
}

function OpenMaterialsPicker() {
    UpdateInventoryMaterialsPicker();
    $(".inventoryMaterialsPickerHost ")[0].classList.remove("hidden");
    $(".inventoryMaterialsPickerHost input")[0].value = ''
    $(".inventoryMaterialsPickerHost input")[0].focus();

}

function UpdateInventoryMaterialsPicker() {
    var pickerList = $(".inventoryMaterialsPicker .materialsList")[0];

    stocksMaterials.forEach(mat => {
        var option = pickerList.querySelector(`button.materialOption[material='${mat}']`);
        if (!option) {
            option = document.createElement("button");
            option.classList.add("materialOption", "gameButton");
            option.setAttribute("material", mat);
            option.addEventListener("mouseup", (e) => {
                e.stopPropagation();
                if (e.button == 0)
                    ToggleInventoryMaterialSelected(e.currentTarget.getAttribute("material"));
            });

            var labelPreDiv = document.createElement("div");
            var labelDiv = document.createElement("div");
            labelDiv.classList.add("label");
            labelDiv.innerHTML = DisplayableMaterialName(mat, 1);
            labelPreDiv.appendChild(labelDiv);

            option.appendChild(labelPreDiv);

            var mainCat = materialGroups.indexOf(mat);
            option.setAttribute("maincat", mainCat);

            var types = GetMaterialTypes(mat);
            var order = 10000;
            types.forEach(matGroup => {
                var matGroup = materialGroups.indexOf(matGroup);
                if (matGroup > -1 && matGroup < order)
                    order = matGroup;
            });

            option.setAttribute("groupOrder", order);

            pickerList.appendChild(option);
        }

        if (config.selectedStocksMaterialsCols.includes(mat)) {
            option.classList.add("selected");
        } else {
            option.classList.remove("selected");
        }
    });

    allOptions = Array.from(pickerList.querySelectorAll("button.materialOption"));

    allOptions.forEach(option => {
        var mat = option.getAttribute("material");
        if (stocksMaterials.indexOf(mat) == -1) {
            //remove option
            option.remove();
            return;
        }
    });

    SortInventoryMaterialPicker();
}

async function ToggleInventoryMaterialSelected(mat, noBuild) {
    var option = $(".inventoryMaterialsPicker .materialOption[material='" + mat + "']")[0];
    var change = false;
    if (config.selectedStocksMaterialsCols.indexOf(mat) == -1) {
        if (config.selectedStocksMaterialsCols.length >= MAX_MATERIALS_COLS) {
            return;
        } else {
            config.selectedStocksMaterialsCols.push(mat);
            change = true;
            if (option)
                option.classList.add("selected");
        }
    } else {
        if (mat != "ALL") {
            config.selectedStocksMaterialsCols = config.selectedStocksMaterialsCols.filter(m => m != mat);
            change = true;
            if (option)
                option.classList.remove("selected");
        }
    }

    if (change && !noBuild) {
        SaveConfig();
        SortInventoryMaterialPicker();
    }
}

function SetMaterialSelectedState(mat, selected) {
    if (mat == "ALL")
        return;

    if (selected) {
        config.selectedStocksMaterialsCols.push(mat);
    } else {
        config.selectedStocksMaterialsCols = config.selectedStocksMaterialsCols.filter(m => m != mat);
    }

    config.selectedStocksMaterialsCols = [...new Set(config.selectedStocksMaterialsCols)];
    SaveConfig();
}

function ApplyInventoryMaterialFilters() {
    $(".inventoryCol").forEach(col => {
        var mat = col.getAttribute("material");
        if (config.selectedStocksMaterialsCols.includes(mat)) {
            col.classList.remove("hidden");
        } else {
            col.classList.add("hidden");
        }
    });
    $(".inventoryTableHeader .inventoryCell.header").forEach(cell => {
        var mat = cell.getAttribute("material");
        if (config.selectedStocksMaterialsCols.includes(mat)) {
            cell.classList.remove("hidden");
        } else {
            cell.classList.add("hidden");
        }

        cell.style.order = config.selectedStocksMaterialsCols.indexOf(mat);
    });
    ResetStocksDisplay()
    SortStockCells();
    UpdateInventoryItemFilter(lastInventoryFilter ?? '');
}

function SortStockCells() {

    var ordering = {};

    var stockCells = $(".inventoryTable .cell.itemType[item]");
    var cellsTexts = Array.from(stockCells).map(cell => { return cell.innerHTML.split("</b>").last(); });
    cellsTexts.sort((a, b) => a.localeCompare(b));
    var cellsHtmls = Array.from(stockCells).map(cell => { return cell.innerHTML; });
    cellsHtmls.sort((a, b) => a.localeCompare(b));

    stockCells.forEach(cell => {
        var itemIndex = 0;
        var itemName = cell.getAttribute("item");
        var noHtml = cell.innerHTML.split("</b>").last();
        if (config.toggleStockSorting) {
            itemIndex = cellsHtmls.findIndex(obj => obj == cell.innerHTML)
        } else {
            itemIndex = cellsTexts.findIndex(obj => obj == noHtml)
        }
        cell.style.order = itemIndex;
        ordering[itemName] = itemIndex;
    });

    var stockCells = $(".inventoryTable .cell.editable[item]");
    stockCells.forEach(cell => {
        var itemName = cell.getAttribute("item");
        cell.style.order = ordering[itemName];
    });

}


function ClearMatName(mat) {
    return mat.replace(/ /g, "_");
}


function DisplayableMaterialName(mat, tagMode = 0) {

    var matString = mat;

    matString = matString.replace("CREATURE:", "");
    matString = matString.replace("INORGANIC:", "");
    matString = matString.replace(":WOOD", "");
    matString = matString.replace("PLANT:", "");
    matString = matString.replace(":BONE", " ");
    matString = matString.replace(":LEATHER", "");
    matString = matString.replace(":DRINK", " DRINK");
    matString = matString.replace(":", " ");
    matString = matString.replace(/_/g, " ");

    switch (tagMode) {
        case 0:
            var groups = GetMaterialTypes(mat);
            groups.forEach(t => {
                matString += " <span class='tag'>" + t + "</span>";
            });
            break;

        case 1:
            matString = "<div class='mat'>" + matString + "</div>";
            types = GetMaterialTypes(mat);
            if (types.length > 0) {
                matString += "<div class='tags'> "
                types.forEach(t => {
                    matString += "<span class='f_" + t + "'>" + t + "</span>";
                });
                matString += "</div>";
            };
            break;

        case 2:
            return matString.charAt(0).toUpperCase() + matString.slice(1).toLowerCase();

    }

    matString = matString.replace("ALL", "TOTAL");

    if (materialGroups.indexOf(mat) == -1) {
        var matInfo = gm.materials[mat];
        if (!matInfo) {
            cl("missing material info for " + mat);
        } else {
            matInfo.Types.forEach(type => {
                if (matString == type)
                    matString = "All <b>" + type + "</b>";
            });
        }

    }

    matString = matString.replace(/_/g, " ");
    return matString;
}

function GetKiloValue(value) {
    value = parseInt(value);
    value = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return value;
}

function InventoryMaterialsFilterEnter(filterValue) {
    if (filterValue != '') {
        if (IsShiftPressed()) {
            var visibles = $(".inventoryMaterialsPicker .materialOption:not(.hidden)");
            if (visibles.length > 0) {
                if (visibles.length > 20) {
                    alert("Too many visible materials to toggle selection at once (max 20). Please refine your filter.");
                    return;
                }

                var firstVisible = Array.from(visibles).reduce((prev, curr) => {
                    if (prev.getAttribute("material") == "ALL")
                        return curr;
                    if (curr.getAttribute("material") == "ALL")
                        return prev;
                    return (parseInt(prev.style.order) < parseInt(curr.style.order)) ? prev : curr;
                });
                var isSelected = config.selectedStocksMaterialsCols.indexOf(firstVisible.getAttribute("material")) != -1;

                visibles.forEach(option => {
                    SetMaterialSelectedState(option.getAttribute("material"), !isSelected);
                });
            }
        } else {
            var firstVisible = $(".inventoryMaterialsPicker .materialOption:not(.hidden)")[0];
            if (firstVisible)
                ToggleInventoryMaterialSelected(firstVisible.getAttribute("material"), true);
        }
        $(".inventoryMaterialsPicker input")[0].value = '';
        InventoryMaterialsFilterChanged('');
    }

    SaveConfig();
    UpdateInventoryMaterialsPicker();
    ApplyInventoryMaterialFilters()
}

function InventoryMaterialsFilterChanged(filterValue) {
    $(".inventoryMaterialsPicker .materialOption").forEach(option => {
        var mat = option.textContent.toLowerCase();
        var words = filterValue.toLowerCase().split(" ");

        if (filterValue == '') {
            option.classList.remove("hidden");
        } else {
            if (words.every(word => mat.includes(word))) {
                option.classList.remove("hidden");
            } else
                option.classList.add("hidden");
        }
    });
    SortInventoryMaterialPicker();
}

function SortInventoryMaterialPicker() {
    //sort elements by .selcted
    var picker = $(".inventoryMaterialsPicker")[0];
    var options = Array.from(picker.querySelectorAll(".materialOption"));
    options.sort((a, b) => {
        var selectedA = a.classList.contains("selected") ? 1 : 0;
        var selectedB = b.classList.contains("selected") ? 1 : 0;

        if (selectedA != selectedB) {
            return selectedB - selectedA;
        } else {
            if (selectedA == 1)
                return config.selectedStocksMaterialsCols.indexOf(a.getAttribute("material")) - config.selectedStocksMaterialsCols.indexOf(b.getAttribute("material"));
        }

        var mainA = parseInt(a.getAttribute("mainCat")) ?? 0;
        var mainB = parseInt(b.getAttribute("mainCat")) ?? 0;

        if (mainA == -1 && mainB > -1)
            return 1;

        if (mainA > -1 && mainB == -1)
            return -1;

        if (mainA > -1 && mainB > -1)
            return mainA - mainB;

        var orderA = parseInt(a.getAttribute("groupOrder"));
        var orderB = parseInt(b.getAttribute("groupOrder"));

        if (orderA != orderB)
            return orderA - orderB;

        var labelA = DisplayableMaterialName(a.getAttribute("material"), 0)
        var labelB = DisplayableMaterialName(b.getAttribute("material"), 0)

        return labelA.localeCompare(labelB);
    });


    var i = 0;
    options.forEach(option => {
        option.style.order = i;
        i++;
    });
}

function UpdateInventoryItemFilter(search) {
    if (search != '') {
        if (config.toggleHideMissingItems && !forceAllItemsVisible) {
            forceAllItemsVisible = true;
            ToggleOption('hideMissingItems');
        }
    } else {
        if (forceAllItemsVisible) {
            forceAllItemsVisible = false;
            ToggleOption('hideMissingItems');
        }
    }

    lastInventoryFilter = search;
    var itemCells = $(".inventoryBody .cell[item]");
    itemCells.forEach(cell => {
        var itemName = cell.getAttribute("item").toLowerCase();
        if (!search || search == '' || itemName.includes(search.toLowerCase())) {
            cell.classList.remove("hidden");
        } else {
            cell.classList.add("hidden");
        }
    });
}

function EditOrder(order) {
    if (!order)
        return;

    $(".orderEditor")[0].classList.remove("hidden");
    var input = $(".orderEditor input")[0];
    input.value = '';
    editedOrder = order;

    if (order.foundJob) {
        input.value = order.foundJob.name;
        OrderEdited('job')
    }
    input.focus();
    $(".interpretedConditions")[0].innerHTML = "";
    $("#conditionCode")[0].value = "";
    $(".outputConditions")[0].innerHTML = "";

    input.dispatchEvent(new Event('change'));

}

function OrderEdited(tag) {
    let job = null;
    switch (tag) {
        case "job":
            let jobName = $(".orderEditor #jobName")[0].value;
            job = jobs.find(j => j.name == jobName);
            if (job != null) {
                $(".orderEditor #jobName")[0].classList.remove("error");
                editedOrder.jobInfo = job;
                editedOrder.job = job.jobTypeName;
                var code = "10\n";
                if (job.io?.in?.length > 0) {
                    job.io.in.forEach(input => {
                        if (input.flags) {
                            input.flags.forEach(flag => {
                                code += ":" + flag + " ";
                            });
                        }
                        var item = input.item;
                        if (item.material || (item.material_category && item.material_category.length > 0))
                            code += "!" + (item.material ?? item.material_category[0]) + " ";

                        if (item.subtypeName) {
                            code += item.subtypeName + " ";
                        } else if (item.typeName) {
                            code += item.typeName + " ";
                        }

                        code += ">10\n"
                    });
                }

                if (job.material != "")
                    editedOrder.material = job.material;

                if (job.material_category && job.material_category.length > 0)
                    editedOrder.material_category = job.material_category;

                if (job.item_typeName && job.item_typeName != "")
                    editedOrder.item_subtype = job.item_typeName;

                $("#conditionCode")[0].value = code;
                OrderEdited("cond");
            } else {
                $(".orderEditor #jobName")[0].classList.add("error");
            }
            break;

        case "qtt":
            editedOrder.amount_left = parseInt($(".orderEditor #itemQtt")[0].value);
            editedOrder.amount_total = parseInt($(".orderEditor #itemQtt")[0].value);
            break;

        case "cond":
            var lines = $("#conditionCode")[0].value.split("\n");

            var inter = $(".interpretedConditions")[0];
            var out = $(".outputConditions")[0];
            inter.textContent = "";
            var basicLineDone = false;
            editedOrder.item_conditions = []
            job = editedOrder.jobInfo;

            fuseItemsTypes = new Fuse(sortedItemTypesIds);
            fuseItemsSubTypes = new Fuse(sortedItemSubTypesIds);
            fuseMats = new Fuse(Object.keys(gm.materials));
            fuseFlags = new Fuse(gm.itemFlags);

            lines.forEach((line) => {

                if (line.trim() == "")
                    return;

                var codeLine = "";
                var value = parseInt(line.trim());
                var flags = [];
                var operator = "";
                let textOperator = "";
                var itemTypeProduced = "";
                var itemSubTypeProduced = "";


                if (line.trim() == value.toString()) {

                    if (basicLineDone)
                        return;
                    codeLine = ""
                    basicLineDone = true;

                    var producedType = job.io?.out[0]?.item_typeName ?? job.io?.out[0]?.item?.typeName;
                    $(".orderEditor #itemQtt")[0].value = Math.min(GetOrderBatchSize(), value)

                    if (producedType != "" && producedType != null) {
                        textOperator = "LessThan";
                        itemTypeProduced = producedType;
                        itemSubTypeProduced = job.io?.out[0]?.item_subtypeName ?? job.io?.out[0]?.item?.subtypeName;
                        codeLine = "Stocks of <b>" + (itemSubTypeProduced ? ItemNameWithoutPrefix(itemSubTypeProduced) : producedType) + "</b> < <b>" + value + "</b>"
                    } else {
                        codeLine = "<u>[Job's produced item not found]</u>";
                    }

                } else {

                    var mat = "";
                    if (line.includes("!"))
                        mat = line.split("!")[1].split(" ")[0].trim();
                    line = line.replace("!" + mat, "");

                    var itemSubTypeProduced = "";
                    if (line.includes("."))
                        itemSubTypeProduced = line.split(".")[1].split(" ")[0].trim();
                    line = line.replace("." + itemSubTypeProduced, "");

                    while (line.includes(":")) {
                        var flag = line.split(":")[1].split(" ")[0].trim();
                        line = line.replace(":" + flag, "").trim();
                        flags.push(flag);
                    }
                    //find position of first characters among < > = !
                    var operators = ["<", ">", "==", "=", "~=", "<=", ">="];
                    var operatorPos = -1;
                    operators.forEach(op => {
                        var pos = line.indexOf(op);
                        if (pos != -1 && (operatorPos == -1 || pos < operatorPos)) {
                            operator = op;
                            operatorPos = pos;
                        }
                    });
                    line = line.replace(operator, "");

                    if (operator == "=")
                        operator = "==";

                    if (operator == "")
                        operator = ">";

                    if (operator == "~=")
                        operator = "!="

                    //position of the first digit
                    var firstDigit = line.search(/\d/);
                    if (firstDigit == -1) {

                        value = -1

                    } else {

                        value = parseInt(line.substr(firstDigit).trim());

                        line = line.replace(value, "");

                        if (value == NaN || value <= -1)
                            value = -1
                    }

                    for (var i = 0; i < flags.length; i++) {
                        var fuseFlag = fuseFlags.search(flags[i], { limit: 1 })[0];
                        flags[i] = fuseFlag ? fuseFlag.item : "?" + flags[i] + "?";
                    };

                    var itemTypeProduced = line.trim();
                    if (itemTypeProduced == "") {
                        itemTypeProduced = "items"
                    } else {
                        var fuseItem = fuseItemsTypes.search(itemTypeProduced, { limit: 1 })[0];
                        itemTypeProduced = fuseItem ? fuseItem.item : "?" + itemTypeProduced + "?";
                    }

                    if (mat != "") {
                        var fuseMat = fuseMats.search(mat, { limit: 1 })[0];
                        mat = fuseMat ? fuseMat.item : "?" + mat + "?";
                    }

                    if (itemSubTypeProduced != "") {
                        var fuseSub = fuseItemsSubTypes.search(itemSubTypeProduced, { limit: 1 })[0];
                        itemSubTypeProduced = fuseSub ? fuseSub.item : "?" + itemSubTypeProduced + "?";
                    }

                    codeLine = ""

                    if (flags.length > 0) {
                        flags.forEach(t => {
                            if (codeLine != "")
                                codeLine += ", ";

                            if (t[0] == "?") {
                                codeLine += "<u>" + t.replace("?", "") + "</u>";
                            }
                            else {
                                codeLine += "<b>" + t + "</b>";
                            }
                        });
                    }

                    if (mat != "") {
                        var tmat = mat;
                        if (tmat[0] == "?") {
                            tmat = "<u>" + tmat.replace("?", "") + "</u>";
                        } else {
                            tmat = "<b>" + tmat + "</b>";
                        }
                        if (codeLine != "") {
                            codeLine += ", (" + tmat + ")";
                        }
                        else {
                            codeLine += "(" + tmat + ")";
                        }
                    }
                    if (codeLine != "")
                        codeLine += " ";

                    if (itemTypeProduced == "" || itemTypeProduced == undefined)
                        itemTypeProduced = "items";

                    if (itemSubTypeProduced == "" || itemSubTypeProduced == undefined)
                        itemSubTypeProduced = "";

                    var tItem = itemTypeProduced;
                    if (itemTypeProduced[0] == "?") {
                        tItem = "<u>" + itemTypeProduced.replace("?", "") + "</u> ";
                    } else {
                        tItem = "<b>" + itemTypeProduced + "</b> ";
                    }

                    var tItemSub = itemSubTypeProduced;
                    if (itemSubTypeProduced[0] == "?") {
                        tItemSub = "<u>" + itemSubTypeProduced.replace("?", "") + "</u> ";
                    } else {
                        tItemSub = "<b>" + itemSubTypeProduced + "</b> ";
                    }

                    codeLine += tItem + tItemSub + operator + " " + (value >= 0 ? "<b>" + value + "</b>" : "<u>[invalid value]</u>") + "\n";

                    if (operator == "~=")
                        operator = "!="

                    textOperator = Object.values(condOperators).find(cnd => { return cnd.symbol == operator }).name ?? "??";
                }

                let condition = {
                    "condition": textOperator,
                    "value": value,
                }
                if (mat != "")
                    condition["material"] = mat;
                if (itemTypeProduced != "items")
                    condition["item_type"] = NoS(itemTypeProduced.toUpperCase());
                if (itemSubTypeProduced != "items")
                    condition["item_subtype"] = itemSubTypeProduced.toUpperCase();
                if (flags.length > 0) {
                    condition["flags"] = flags;
                }

                inter.innerHTML += codeLine + "<br/>";
                if (value >= 0 && condition.item_type != null)
                    editedOrder.item_conditions.push(condition);
            });

            out.textContent = JSON.stringify(editedOrder.item_conditions, null, 2);
            break;
    }

}

function CloseOrderEditor() {
    $(".orderEditor")[0].classList.add("hidden");
    editedOrder = null;
}

function GetWantedProduction(item, mat) {
    if (!mat)
        return 0;

    var key = item + "/" + mat;
    var job = itemJob[key];
    if (!job)
        return 0;

    let myOrders = FindActiveOrdersForJob(job);
    if (myOrders.length == 0)
        return 0;

    cl("Wanted production for " + item + " / " + mat + " is " + myOrders[0].amount_total);

    var outItem = job.io?.out?.[0];
    if (outItem) {
        var prodCondition = myOrders[0].item_conditions?.find(cond => {
            var a = (cond.item_type ?? "") + "!" + (cond.item_subtype ?? "");
            var b = (outItem.item.typeName ?? "") + "!" + (outItem.item.subtypeName ?? "");
            return a == b;
        });

        if (prodCondition)
            return prodCondition.value;
    }

    return myOrders[0].amount_total;
}


function IsShiftPressed() {
    return wasShiftPressed && keysDown.length != 0;
}

function IsCtrlPressed() {
    return wasCtrlPressed && keysDown.length != 0;
}

function OnGeneralKeyDown(e) {
    keysDown.push(e.key);

    if (e.key == "Shift")
        wasShiftPressed = true;

    if (e.key == "Control")
        wasCtrlPressed = true;

    if (e.key == "a" && wasCtrlPressed)
        e.preventDefault();

    if (IsCtrlPressed() || IsShiftPressed())
        $("body")[0].classList.add("ctrlOrShift");

    var stockMatPicker = $(".inventoryMaterialsPickerHost:not(.hidden)")[0];
    if (stockMatPicker) {
        var pickerInput = stockMatPicker.querySelector("input");
        if (document.activeElement === pickerInput)
            return;
        pickerInput.focus();
        pickerInput.select();
        return;
    }

    if ($(".conditionEditor:not(.hidden)")[0])
        return;
    if ($(".orderEditor:not(.hidden)")[0])
        return;
    if (document.activeElement && document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
        return;

    if (!IsCtrlPressed()) {
        var searchers = $("input.autofocus");
        //convert searchers to array
        searchers = Array.from(searchers);
        //filter out element with offsetParent null (not visible)
        searchers = searchers.filter(s => s.offsetParent !== null);
        if (searchers.length > 0) {
            searchers.sort(CompareDepth);
            searchers[0].focus();
            searchers[0].select();
        }
    }
}

function OnGeneralKeyUp(e) {

    if (PopInfoActive())
        return;

    var key = e.key.toLocaleLowerCase();

    if (key == "escape") {
        e.preventDefault();
        OnRightClickOrEscape();
        KeyUpEnd(e);
        return;
    }

    if ($(".inventoryMaterialsPickerHost:not(.hidden)")[0]) {
        if (e.key == "Enter")
            InventoryMaterialsFilterEnter()
        KeyUpEnd(e);
        return;
    }

    if ($(".orderEditor:not(.hidden)")[0]) {
        if (e.key == "Enter" && (IsShiftPressed() || IsCtrlPressed())) {
            e.preventDefault();
            document.activeElement.blur();
            if (IsShiftPressed()) {
                //quick order
                delete editedOrder.item_conditions;
                editedOrder.frequency = "OneTime";
                //unfocus all elements
                AddNewOrder(editedOrder);
            } else if (IsCtrlPressed()) {
                editedOrder.frequency = "Daily";
                AddNewOrder(editedOrder);
            }
            CloseOrderEditor();
        }
        KeyUpEnd(e);
        return;
    }

    if (IsCtrlPressed() || IsShiftPressed()) {

        var double = IsCtrlPressed() && IsShiftPressed();

        if (key == "a") {
            e.preventDefault();
            PauseAllTasks();
        }

        if (key == "z") {
            //cancel changes
            e.preventDefault();
            CancelOrderChanges()
        }

        if (key == "e") {
            e.preventDefault();
            ToggleOption("hideMissingItems");
        }

        if (key == "r") {
            e.preventDefault();
            if (double) {
                ToggleOption("AutoReadOrders");
            } else {
                ReadOrders();
            }
        }

        if (key == "t") {
            e.preventDefault();
            if (double) {
                ToggleOption("AutoReadStocks");
            } else {
                ReadStocksBatch();
            }
        }





        if (key == "q") {
            e.preventDefault();
            OpenMaterialsPicker();
        }

        if (key == "s") {
            e.preventDefault();
            if (double) {
                ToggleOption("AutoSaveOrders");
            } else {
                WriteOrders();
            }
        }

        if (key == "d") {
            e.preventDefault();
            OrderToolDuplicate()
        }

        if (key == "f") {
            e.preventDefault();
            CleanupDuplicateJobs()
        }


        if (key == "g") {
            e.preventDefault();
            ToggleGrouping()
        }




        if (key == "w") {
            e.preventDefault();
            ToggleOption('LessColumns')
        }

        if (key == "x") {
            //delete
            e.preventDefault();
            if ($(".inventoryMaterialsPickerHost:not(.hidden)")[0]) {
                ClearStocksMaterialsFilter();
            } else {
                DeleteTask(currentHoverOrder);
            }
        }

        if (key == "c") {
            //create
            e.preventDefault();
            EditOrder(CreateNewOrder());
        }

        if (key == "v") {
            e.preventDefault();
            OrderToolMax();
        }

        if (key == "b") {
            e.preventDefault();
            OrderToolMin();
        }


        //space
        if (key == " ") {
            if (currentHoverOrder) {
                if (double) {
                    e.preventDefault();
                    OrderToolStopAllAfter();
                } else {
                    e.preventDefault();
                    OrderToolStopMe();
                }
            }
        }

        if (key == "tab") {
            e.preventDefault();
            if (displayedTab == "inventory") {
                SetTab("orders");
            } else {
                SetTab("inventory");
            }
        }

        if (key == "1" || key == "&") {
            e.preventDefault();
            ClearStocksMaterialsFilter();
        }
        if (key == "2" || key == "é") {
            e.preventDefault();
            ToggleOption('HideLogs')
        }

    }
    KeyUpEnd(e);
}

function KeyUpEnd(e) {
    keysDown = keysDown.filter(k => k != e.key);

    if (keysDown.length == 0) {
        wasCtrlPressed = false;
        wasShiftPressed = false;
        $("body")[0].classList.remove("ctrlOrShift");
    }
}

function ClearKeys() {
    $("body")[0].classList.remove("ctrlOrShift");
    keysDown = [];
    wasCtrlPressed = false;
    wasShiftPressed = false;
}



function CompareDepth(a, b) {
    if (a === b)
        return 0;

    var position = a.compareDocumentPosition(b);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING || position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
        return -1;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING || position & Node.DOCUMENT_POSITION_CONTAINS) {
        return 1;
    } else {
        return 0;
    }
}

function PopInfo(title, message, sub, buttons = null, closeCallback = null, waitingToken = "") {

    var infoBox = document.createElement("div");
    infoBox.classList.add("infoBox");
    infoBox.innerHTML = `<div class='window'><div class='title'></div><div class='context'></div><div class='message'></div><div class='buttons'></div></div>`;
    infoBox.setAttribute("waitingToken", waitingToken);
    infoBox.querySelector(".title").textContent = title;
    infoBox.querySelector(".message").innerHTML = message;

    if (buttons) {
        buttons.forEach(btn => {
            var button = document.createElement("button");
            button.textContent = btn;

            switch (btn) {
                case "WAIT":
                    var prevBox = document.querySelector(".infoBox.wait");
                    if (prevBox)
                        prevBox.remove();
                    infoBox.classList.add("wait");
                    if (closeCallback != null) {
                        setTimeout(() => {
                            const c = closeCallback
                            c();
                        }, 500);
                    }
                    break;

                case "RESET APP PATHS":
                    Trace("Resetting paths.");
                    button.addEventListener("click", (e) => {
                        e.stopPropagation();
                        ResetAppPaths();
                        document.querySelector(".infoBox").remove();
                    });
                    break;

                default:
                    button.addEventListener("click", (e) => {
                        const callback = closeCallback;
                        e.stopPropagation();
                        if (callback != null)
                            callback();
                        document.querySelector(".infoBox").remove();
                    });
                    break;

            }
            infoBox.querySelector(".buttons").appendChild(button);
        });
    }
    infoBox.querySelector(".context").innerHTML = sub;
    $("body")[0].appendChild(infoBox);

    setTimeout(() => {
        infoBox.addEventListener("click", () => {
            const box = infoBox;
            //remove infobox
            box.remove();
            if (closeCallback)
                closeCallback();
        });
    }, 500);
}

function PopInfoActive() {
    return document.querySelector(".infoBox") != null;
}

function ClosePopInfoWaiting(token) {
    boxes = document.querySelectorAll(".infoBox[waitingtoken='" + token + "']");
    boxes.forEach(box => {
        box.remove();
    });
}



function ResetAppPaths() {
    window.api.ResetAppPaths();
};


function AddKeyInfo(button, string) {

    var keyInfo = button.querySelector("span.keyInfo")
    if (!keyInfo) {
        keyInfo = document.createElement("span");
        keyInfo.classList.add("keyInfo");
        button.appendChild(keyInfo);
    }
    keyInfo.textContent = string;
}

function GetMaterialTypes(mat) {
    if (!gm.materials[mat])
        return [];

    return gm.materials[mat].Types;
}


function Trace(msg) {
    var pop = document.createElement("div");
    pop.classList.add("traceActivity");
    pop.innerHTML = msg;

    var firstChild = $(".traces")[0].firstChild;
    $(".traces")[0].insertBefore(pop, firstChild);

    if (firstChild.textContent == msg)
        firstChild.remove();

    setTimeout(() => {
        const p = pop;
        if (p?.parentElement)
            p.parentElement.removeChild(p);
    }, 3000);
}

function Toast(msg) {
    var pop = document.createElement("div");
    pop.classList.add("toastActivity");
    pop.innerHTML = msg;

    var firstChild = $(".toasts")[0].firstChild;
    $(".toasts")[0].insertBefore(pop, firstChild);

    if (firstChild.textContent == msg)
        firstChild.remove();

    setTimeout(() => {
        const p = pop;
        if (p?.parentElement)
            p.parentElement.removeChild(p);
    }, 5000);
}


function ClearStocksMaterialsFilter() {
    config.selectedStocksMaterialsCols = ["ALL"];
    SaveConfig();
    UpdateInventoryMaterialsPicker();
    ApplyInventoryMaterialFilters();
}

async function pause(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}


function FixItemTypeName(name) {
    //get last character of prod.item_typeName
    if (name == "SIEGE_AMMO")
        return name;
    var lastChar = name.charAt(name.length - 1);
    if (lastChar != "S")
        return name + "S";
    return name;
}

function DebugJobs() {
    jobs.forEach(job => {
        if (job.reaction) {
            cl("Job #" + jobs.indexOf(job) + " " + job.name + " in/outs:");
            job.io.in.forEach(inp => {
                var mat = inp.material ? "(" + inp.material + ") " : "";
                var flags = inp.flags ? "(" + inp.flags.join(",") + ") " : "";
                var item = inp.item_subtypeName ? "ST " + inp.item_subtypeName : null;
                item ??= inp.item_typeName ? "IT " + inp.item_typeName : "";
                cl("   <- Input: " + inp.quantity + "x " + flags + mat + item);
            });
            job.io.out.forEach(outp => {
                var mat = outp.material ? "(" + outp.material + ") " : "";
                var item = outp.item_subtypeName ? "ST " + outp.item_subtypeName : null;
                item ??= outp.item_typeName ? "IT " + outp.item_typeName : "";
                cl("     -> Output: " + outp.count + "x " + mat + item);
            });
        }
    });
}

function GetMaterialNameFromIndex(index) {
    return Object.keys(gm.materials).find(matName => {
        if (gm.materials[matName].Index == index) {
            return matName;
        }
    });
}


if (!Array.prototype.last) {
    Array.prototype.last = function () {
        return this[this.length - 1];
    };
};

function FindJobWith(name) {
    var low = name.toLocaleLowerCase();
    return jobs.filter(j => j.name.toLocaleLowerCase().includes(low))
}

function FindStocksWith(name) {
    return Object.entries(stocks).filter(([key, value]) => key.includes(name));
}

function CraftableMaterialName(mat) {
    if (mat.startsWith("CREATURE:")) {
        if (mat.endsWith(":LEATHER") || mat.endsWith(":BONE") || mat.endsWith(":SHELL"))
            return mat;
        return "";
    }
    if (mat.startsWith("PLANT:")) {
        if (mat.endsWith(":WOOD"))
            return mat;
        return "";
    }
    return mat;
}


function CompleteJobInfos(job) {
    job.jobTypeName = gm.job_type[job.jobType];
    job.isCrafts = job.name.includes(" crafts");

    //determine item type and subtype
    GuessJobItem(job);

    //associate item & job
    GuessJobItemAssociation(job);
}

function GuessJobItem(job) {
    var seekNameUp = GetMaterialNameFromIndex(job.mat_index);
    job.material = seekNameUp ? seekNameUp : "";

    job.reaction = job.reactionName ? gm.reactions[job.reactionName] : null;
    job.io = { in: [], out: [] };

    if (job.reaction != null) {
        //by reactions (easy mode)

        if (job.reaction.products != null) {
            var first = true;
            job.reaction.products.forEach(p => {
                if (p.item_type > -1) {
                    let item = gm.items[p.item_type];
                    job.io.out.push({
                        "item": item,
                        "materialName": job.material,
                        "material_index": job.mat_index,
                        "count": p.count ? p.count : 1
                    });
                    if (first && item) {
                        job.item_typeName = item.subtypeName;
                        first = false;
                    }
                }
            });
        }

        if (job.reaction.reagents != null) {
            job.reaction.reagents.forEach(r => {
                r.flags = r.flags1.concat(r.flags2).concat(r.flags3);
                r.material = GetMaterialNameFromIndex(r.mat_index);
                let item = null;
                if (r.item_type > -1)
                    item = gm.items[r.item_type];

                job.io.in.push({
                    "item": item,
                    "materialName": r.material,
                    "material_index": r.mat_index,
                    "count": r.count ? r.count : 1,
                    "flags": r.flags,
                    "reaction_product": r.reaction_product
                });
            });
        }

    } else {

        //by guesswork (hard mode)

        //create job output

        var jn = job.name;
        var parts = jn.toUpperCase().split(" ");

        var newOut = {
            item: null,
            count: 1,
        }
        var newIn = {
            item: null,
            quantity: 1,
        };

        while (parts.length > 0) {
            parts.shift(1)
            var itm = parts.join(" ").toLowerCase();

            if (sortedItemsAndTypesNames.includes(itm)) {
                newOut.item = GetItemBySubtype(itm);
                break;
            }
        }

        if (jn == "Weave thread into silk") {
            newOut.item = gm.items["CLOTH"];
            newOut.material_category = ["SILK"];

            newIn.item = gm.items["THREAD"];
            newIn.flags = ["collected", "silk"];
        }

        if (newOut.item == null) {
            //get item by name

            var jnl = job.name.toLowerCase();
            if (jnl.includes(" throne ") || jnl.includes(" chair "))
                newOut.item = gm.items["CHAIR"];

            if (jnl.includes(" barrel "))
                newOut.item = gm.items["BARREL"];

            if (jnl == "make bed")
                newOut.item = gm.items["BED"];

            if (jnl.includes(" chain"))
                newOut.item = gm.items["CHAIN"];

            if (jnl.includes(" quiver"))
                newOut.item = gm.items["QUIVER"];

            if (jnl.includes(" weapon rack"))
                newOut.item = gm.items["WEAPONRACK"];

            if (jnl.includes(" armor stand"))
                newOut.item = gm.items["ARMORSTAND"];

            if (jnl.includes(" bucket"))
                newOut.item = gm.items["BUCKET"];

            if (jnl.includes(" pipe section"))
                newOut.item = gm.items["PIPE_SECTION"];

            if (jnl.includes(" anvil"))
                newOut.item = gm.items["ANVIL"];

            if (jnl.includes(" wheelbarrow"))
                newOut.item = gm.items["ITEM_TOOL_WHEELBARROW"];

            if (jnl.includes(" casket"))
                newOut.item = gm.items["COFFIN"];
            if (jnl.includes(" sarcophagus"))
                newOut.item = gm.items["COFFIN"];

            if (jnl.includes(" hatch cover"))
                newOut.item = gm.items["HATCH_COVER"];

            if (jnl.includes(" rope"))
                newOut.item = gm.items["CHAIN"];

            if (jnl.includes(" traction bench"))
                newOut.item = gm.items["TRACTION_BENCH"];

            if (jnl.includes(" animal trap"))
                newOut.item = gm.items["ANIMALTRAP"];

            if (jnl.includes(" bolts"))
                newOut.item = gm.items["ITEM_AMMO_BOLTS"];

            if (jnl.includes(" ballista arrow head"))
                newOut.item = gm.items["BALLISTAARROWHEAD"];

            if (jnl.includes(" ballista parts")) {
                newOut.item = gm.items["BALLISTAPARTS"];
                job.material_category = ["WOOD"]
            }
            if (jnl.includes(" catapult parts")) {
                newOut.item = gm.items["CATAPULTPARTS"];
                job.material_category = ["WOOD"]
            }
            if (jnl.includes(" bolt thrower parts")) {
                newOut.item = gm.items["BOLT_THROWER_PARTS"];
                job.material_category = ["WOOD"]
            }

            if (jnl.endsWith(" ash")) {
                newOut.item = gm.items["BAR"];
                job.material = "ASH";
            }
            if (jnl.endsWith(" charcoal")) {
                newOut.item = gm.items["BAR"];
                job.material = "COAL:CHARCOAL";
            }
            if (jnl.includes(" potash ")) {
                newOut.item = gm.items["BAR"];
                job.material = "POTASH";
            }
            if (jnl.endsWith(" lye")) {
                newOut.item = gm.items["BAR"];
                job.material = "LYE";
            }

            if (jnl == "make raw clear glass") {
                newOut.item = gm.items["ROUGH"];
                job.material = "GLASS_CLEAR"
            } else if (jnl == "make raw green glass") {
                newOut.item = gm.items["ROUGH"];
                job.material = "GLASS_GREEN"
            } else if (jnl == "make raw crystal glass") {
                newOut.item = gm.items["ROUGH"];
                job.material = "GLASS_CRYSTAL";
            }

            if (jnl.endsWith(" portal"))
                newOut.item = gm.items["DOOR"];

            if (jnl.endsWith(" terrarium"))
                newOut.item = gm.items["CAGE"];

            if (jnl.endsWith(" tube"))
                newOut.item = gm.items["PIPE_SECTION"];

            if (jnl.endsWith(" vial"))
                newOut.item = gm.items["FLASK"];
            if (jnl.endsWith(" waterskin"))
                newOut.item = gm.items["FLASK"];

            if (jnl.endsWith(" mug"))
                newOut.item = gm.items["GOBLET"];
            if (jnl.endsWith(" cup"))
                newOut.item = gm.items["GOBLET"];

            if (job.name.startsWith("Make wooden training")) {
                var weapon = job.name.split(" ").last();
                switch (weapon) {
                    case "sword":
                        newOut.item = gm.items["ITEM_WEAPON_SWORD_SHORT_TRAINING"];
                        break;
                    case "axe":
                        newOut.item = gm.items["ITEM_WEAPON_AXE_TRAINING"];
                        break;
                    case "mace":
                        newOut.item = gm.items["ITEM_WEAPON_MACE_TRAINING"];
                        break;
                }
            }

            if (newOut.item == null) {
                switch (job.jobTypeName) {
                    case "PrepareMeal":
                        newOut.item = gm.items["FOOD"];
                        newIn.flags = ["unrotten", "cookable", "solid"];
                        break;
                    case "ConstructChest":
                        newOut.item = gm.items["BOX"];
                        newOut.condition = { flags: ["empty"], };
                        break;
                    case "ConstructThrone":
                        newOut.item = gm.items["CHAIR"];
                        break;
                    case "ConstructMechanisms":
                        newOut.item = gm.items["TRAPPARTS"];
                        break;
                    case "MakeAsh":
                        newOut.item = gm.items["ASH"];
                        break;
                    case "MakeLye":
                        newOut.item = gm.items["LYE"];
                        break;
                    case "MakePotashFromAsh":
                        newOut.item = gm.items["POTASH"];
                        break;
                    case "MakePotashFromLye":
                        newOut.item = gm.items["POTASH"];
                        break;
                    case "MakeRawGlass":
                        newOut.item = gm.items["GLASS"];
                        break;
                    case "SmeltOre":
                        newOut.item = gm.items["BAR"];
                        break;
                    case "MakeCrafts":
                        newOut.item = -1;
                        break;
                    case "MintCoins":
                        newOut.item = gm.items["COIN"];
                        break;
                }
            }
        }



        //create job inputs
        newIn.material = job.material;
        var materialType = gm.materials[job.material]?.Types[0];
        switch (materialType) {
            case "STONE":
                newIn.item = gm.items["BOULDER"];
                break;
            case "METAL":
                newIn.item = gm.items["BAR"];
                break;
            case "GEM":
                newIn.item = gm.items["SMALLGEM"];
                break;
            case "COAL":
                newIn.item = gm.items["BAR"];
                break;
            case "WOOD":
                newIn.item = gm.items["WOOD"];
                break;
            case "LEATHER":
                newIn.item = gm.items["SKIN_TANNED"];
                break;
            case "GLASS":
                newIn.item = gm.items["ROUGH"];
                break;
            case "BONE":
                newIn = {
                    "flags":
                        [
                            "unrotten",
                            "bone",
                            "body_part"
                        ]
                };
                break;

            default:
                if (job.name.includes(" wooden ")) {
                    newIn.item = gm.items["WOOD"];

                } else if (job.name.includes(" rock ")) {
                    newIn.material = "INORGANIC";
                    newIn.item = gm.items["BOULDER"];

                } else if (job.name.includes(" leather")) {
                    newIn.item = gm.items['SKIN_TANNED'];

                } else if (job.name.includes(" silk")) {
                    newIn.flags = ['silk'];
                    newIn.item = gm.items["CLOTH"];
                    newIn.min_dimension = 10000;

                } else if (job.name.includes(" yarn")) {
                    newIn.flags = ['yarn'];
                    newIn.item = gm.items["CLOTH"];
                    newIn.min_dimension = 10000;

                } else if (job.name.includes(" cloth")) {
                    newIn.flags = ['plant'];
                    newIn.item = gm.items["CLOTH"];
                    newIn.min_dimension = 10000;

                } else if (job.name == "Make bed") {
                    newIn.item = gm.items["WOOD"];
                }
                break;
        }


        if (newOut.item == null) {
            //try auto resolve
            var cutName = job.name.toLowerCase();
            if (gm.materials[newOut.material])
                cutName = cutName.replace(gm.materials[newOut.material].name.toLocaleLowerCase(), "")
            if (newOut.material_category)
                cutName = cutName.replace(newOut.material_category[0].toLocaleLowerCase(), "")
            cutName = cutName.replace("contruct", "")
            cutName = cutName.replace("make", "")
            cutName = cutName.replace("forge", "")
            cutName = cutName.replace("cut", "")
            cutName = cutName.replace("assemble", "")

            //replace uppercase letters with _ + letter except first
            cutName = cutName[0].toLowerCase() + cutName.slice(1);
            cutName = cutName.replace(/([A-Z])/g, '_$1');
            cutName = cutName.toLocaleLowerCase().trim();
            newOut.item = GetItemBySubtype(cutName.trim());

            if (newOut.item != null) {
                //cl("Auto-resolved job #" + jobs.indexOf(job) + " '" + job.name + "' to item " + newOut.item.name + " using '" + cutName + "'");
            }
        }

        job.material ??= "";
        job.material_category ??= "";
        if (newOut.item != null && job.material == "" && job.material_category == "") {
            //search job name (without item name) for material
            var jn = job.name.replace(newOut.item.name, "");

            if (newOut.item != -1)
                jn = jn.toUpperCase().replace(newOut.item.name.toUpperCase(), "")

            let parts = jn.toUpperCase().trim().split(" ");

            while (parts.length > 0) {
                parts.shift(1)
                var seekNameUp = parts.join(" ")

                var matName = FindMaterialByName(seekNameUp);

                if (matName) {
                    job.material = matName;
                    break;
                } else {
                    if (materialGroups.indexOf(seekNameUp) >= 0) {
                        job.material_category = [seekNameUp];
                    }
                    break;
                }
            }

            if (job.material == "" && job.material_category == "") {
                if (job.name.includes(" leather "))
                    job.material_category = ["LEATHER"];

                if (job.name.includes(" rock "))
                    job.material_category = ["INORGANIC"];

                if (job.name.includes(" bone "))
                    job.material_category = ["BONE"];

                if (job.name.includes(" cloth "))
                    job.material_category = ["CLOTH"];

                if (job.name.includes("ivory/tooth"))
                    job.material_category = ["TOOTH"];

                if (job.name.includes("shell"))
                    job.material_category = ["shell"];

                if (job.name.includes("pearl"))
                    job.material_category = ["PEARL"];

                if (job.name.includes(" wooden "))
                    job.material_category = ["WOOD"];

                if (job.name.includes(" wood "))
                    job.material_category = ["WOOD"];

                if (job.name.includes(" yarn "))
                    job.material_category = ["YARN"];

                if (job.name.includes(" horn "))
                    job.material_category = ["HORN"];

                if (job.name.includes(" glass"))
                    job.material_category = ["HORN"];

                if (job.name == "Make bed")
                    job.material_category = ["WOOD"];
            }
        }

        if (newOut.item)
            job.item_typeName = newOut.item.subtypeName;

        if (newIn.item != null || newIn.flags)
            job.io.in.push(newIn);

        if (newOut.item != null) {
            job.io.out.push(newOut);
        } else {
            //cl("Could not auto-resolve output item for job #" + jobs.indexOf(job) + " '" + job.name + "'");
        }

        if (job.material_category?.length > 0)
            job.material_category[0] = job.material_category[0].toLocaleLowerCase();

    }
}

function GuessJobItemAssociation(job) {
    var key = ''
    var matKey = "";

    if (job.material != "") {
        matKey = "/" + job.material;
    } else if (job.material_category != null && job.material_category.length > 0) {
        matKey = "/" + job.material_category[0].toUpperCase();
    };

    if (matKey == '')
        return;

    if (job.isCrafts) {
        key = 'CRAFTS' + matKey;
        itemJob[key] = job;
        itemHasJob["CRAFTS"] = true;

        key = 'CRAFTS/ALL';
        itemJob[key] = job;
        return;
    }

    if (job.io.out == null || job.io.out.length == 0)
        return;

    job.io.out.forEach(outInfo => {
        if (!outInfo.item) {

            //cl("Job #" + jobs.indexOf(job) + " " + job.name + " has no output item defined.");
            return;
        }

        key = ''

        var item = outInfo.item;
        ok = false;

        if (item.typeName == undefined && item.subtypeName != undefined) {
            cl(" !!! Item has no typeName defined, but a subtypeName: " + item.subtypeName);
        }

        if (item.typeName == undefined && item.subtypeName == undefined) {
            return;
        }

        key = (item.isTypeOnly ? item.typeName : NoS(item.typeName) + "!" + item.subtypeName).toUpperCase();
        itemHasJob[key] = true;
        var fullKey = key + matKey;
        itemJob[fullKey] = job;
        var allKey = key + "/ALL";
        itemJob[allKey] = job;
    });
}

function GetItemTypeByName(itemSubTypeName) {
    return Object.entries(itemTypesMembers).find(([typeName, subTypes]) => {
        if (subTypes.includes(itemSubTypeName))
            return typeName;
    });
}



function GetOrderJobLabel(order) {
    if (order.job == "PrepareMeal") {
        var ret = "Prepare meal (";
        if (order.meal_ingredients == 2) {
            ret += "easy)";
        } else if (order.meal_ingredients == 3) {
            ret += "fine)";
        } else if (order.meal_ingredients == 4) {
            ret += "lavish)";
        } else {
            ret += order.meal_ingredients + " ingredients)";
        }
        return ret;
    }

    order.meal_ingredients + " ingredients)";



    let job = GetJobFromOrder(order);
    if (!job)
        return "Unknown job! " + order.job

    if (config.toggleStockSorting) {
        let item = job?.io?.out?.[0]?.item;

        let name = "";

        if (job.jobTypeName == "MakeCrafts") {
            name = "<b>Make Crafts</b> ";
        } else {
            var gname = item && item != -1 ? ItemGroupName(item) : '';
            if (gname != "")
                name = "<b>" + gname + "</b> ";

            if (item && item != -1 && item.name.toLocaleLowerCase() != gname.toLocaleLowerCase()) {
                name += item.name + " ";
            } else {
                name = job.name + " ";
            }
        }

        if (job.material_category)
            name += "<i>(" + DisplayableMaterialName(job.material_category[0], 2) + ")</i>";
        else if (job.material)
            name += "<i>(" + DisplayableMaterialName(job.material, 2) + ")</i>";

        return name.trim();

    } else {
        return job.name;

    }
}



function GetItemBySubtype(itemName) {
    itemName = itemName.toLowerCase().trim();
    return Object.values(gm.items).find(itm => itm.name == itemName);
}

function FindItemsBySubtype(search) {
    search = search.toLowerCase().trim();
    return Object.entries(gm.items).find(([key, itm]) => { return key.includes(search) || itm.name.includes(search) || itm.typeName.includes(search) || itm.subtypeName.includes(search) });
}

function FindMaterialByName(materialName) {
    materialName = materialName.toLowerCase().trim();
    let materialNameKey = materialName.replaceAll(" ", "_").toUpperCase();

    if (materialNameKey.includes("GLASS")) {
        let parts = materialNameKey.split("_");
        //reverse parts
        parts = parts.reverse();
        materialNameKey = parts.join("_");
    }

    return Object.entries(gm.materials).find(([key, matInfo]) => {
        if (matInfo.name && matInfo.name == materialName)
            return true;
        if (key == materialNameKey)
            return true;
    })?.[0]
}

function FindMaterialIncluding(materialName) {
    materialName = materialName.toLowerCase().trim();
    return Object.entries(gm.materials).filter(([key, matInfo]) => {
        if (matInfo.name?.toLocaleLowerCase().includes(materialName))
            return true;
        if (key.toLowerCase().includes(materialName))
            return true;
    })
}

function CheckJobsValidity() {
    jobs.forEach(job => {
        if (job.item_typeName != '') {
            if (job.io.in.length == 0)
                cl("Warning: Job #" + jobs.indexOf(job) + " " + job.name + " has no <-input defined.");
            if (job.io.out.length == 0)
                cl("Warning: Job #" + jobs.indexOf(job) + " " + job.name + " has no output-> defined.");
        }
    });
}

function NoS(str) {
    if (str.endsWith("S") || str.endsWith("s"))
        return str.substr(0, str.length - 1);
    return str;
}

function GetJobFromOrder(order) {
    var jbs = jobs.filter(j => j.jobTypeName == order.job);

    if (order.reaction)
        jbs = jbs.filter(j => j.reactionName == order.reaction);

    if (order.material_category && order.material_category.length > 0)
        jbs = jbs.filter(j => j.material_category && j.material_category[0] == order.material_category[0]);

    if (order.job == "PrepareMeal") {
        switch (order.meal_ingredients) {
            case 2:
                jbs = jbs.filter(j => j.name == "Preapre easy meal");
                break;
            case 3:
                jbs = jbs.filter(j => j.name == "Prepare fine meal");
                break;
            case 4:
                jbs = jbs.filter(j => j.name == "Prepare lavish meal");
                break;
            default:
                jbs = [];
        }
    } else if (order.job == "SmeltOre") {
        var caillou = order.material.split(":")[1].toLocaleLowerCase().replace("_", " ");
        jbs = jbs.filter(j => j.name.includes(caillou));
    } else {
        if (order.material)
            jbs = jbs.filter(j => j.material == order.material || j.material_category && j.material_category.includes(order.material.toLowerCase()));
    }

    if (order.item_subtype)
        jbs = jbs.filter(j => j.item_typeName == order.item_subtype);

    if (jbs.length == 1) {
        order.foundJob = jbs[0];
        return jbs[0];
    }

    return null;
}

function TypeIsCraft(typeName) {
    return craftTypes.includes(typeName);
}

function SetOrderTools(element) {
    var tools = $("#orderTools")[0];
    if (!tools) {
        //duplicate template dom element
        var template = $("#orderToolsTemplate")[0];
        tools = template.cloneNode(true);
        tools.id = "orderTools";
        tools.classList.remove("hidden");
        $("body")[0].appendChild(tools);
    }
    if (element != null) {
        tools.classList.remove("hidden");
        element.appendChild(tools);
    } else {
        tools.classList.add("hidden");
    }
}


function OrderToolStopMe() {
    if (!currentHoverOrder)
        return;

    if (IsTaskPaused(currentHoverOrder, PAUSECHANNEL_ONETASK)) {
        ResumeTask(currentHoverOrder, PAUSECHANNEL_ONETASK);
    } else {
        PauseTask(currentHoverOrder, PAUSECHANNEL_ONETASK);
    }
    UpdateOrdersTable();
}

function OrderToolStopAllAfter() {
    if (!currentHoverOrder)
        return;

    PauseAllTasksFrom(currentHoverOrder);
}

function OrderToolMin() {
    if (!currentHoverOrder)
        return;

    orders = orders.filter(o => o.id !== currentHoverOrder.id);
    orders.push(currentHoverOrder);
    MarkEdited(currentHoverOrder);
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
    UpdateOrdersTable();
}

function OrderToolMax() {
    if (!currentHoverOrder)
        return;

    orders = orders.filter(o => o.id !== currentHoverOrder.id);
    orders.unshift(currentHoverOrder);
    MarkEdited(currentHoverOrder);
    if (config.toggleAutoSaveOrders)
        QueueOrdersSave();
    UpdateOrdersTable();
}

function OrderToolDuplicate() {
    if (!currentHoverOrder)
        return;

    var newOrder = CreateNewOrder(currentHoverOrder)
    AddNewOrder(newOrder, currentHoverOrder);
}


function OrderToolDelete() {
    if (!currentHoverOrder)
        return;

    DeleteTask(currentHoverOrder);
}

function ToggleGrouping() {
    ToggleOption('stockSorting');
    SortStockCells();
    UpdateOrdersLabels()
}

function ConditionCoderFocused() {
    //select first line of textarea
    $("#conditionCode")[0].select();

    var area = $("#conditionCode")[0];
    var end = area.value.indexOf('\n');

    area.focus();
    area.setSelectionRange(0, end === -1 ? area.value.length : end);
}

function JobItemName(job) {
    if (job.io.out.length == 0)
        return "";
    var outItem = job.io.out[0];
    if (!outItem.item)
        return "";
    return outItem.item.typeName + (outItem.item.subtypeName ? "!" + outItem.item.subtypeName : "");
}

function JobMaterialName(job) {
    return (job.material != "" ? job.material : (job.material_category != null && job.material_category.length > 0 ? job.material_category[0] : "ALL")).toUpperCase();
}