const $ = (selector) => document.querySelectorAll(selector);

var json;
var clonedOrders;
var fileHandle;
var orders = [];
var conditionJustCopied = false;
var currentHoverOrder = null;
var copiedCondition = null;
var autoSave = false;
var autoRead = false;
var ordersTable = $(".ordersTable")[0];
var isShiftPressed = false;
var mustRead = false;
var mustWrite = false;
var headerReady = false;
var allPaused = false;
var waitForOperation = false;
const PAUSECHANNEL_ALLSTASKS = -2;
const PAUSECHANNEL_FROMTASK = -1;
const PAUSECHANNEL_ONETASK = 0;
const PAUSECHANNEL_ANY = -99;
const pauseAll = GetPauseCondition(PAUSECHANNEL_ALLSTASKS);
const pauseFrom = GetPauseCondition(PAUSECHANNEL_FROMTASK);
const pauseOne = GetPauseCondition(PAUSECHANNEL_ONETASK);
var fuses = [];
var currendFuseInput;
var compactMode = false;
const DELAY_BETWEEN_FILE_OPS_MS = 2500;
var multiFill = false;
var editedConditionsOrder;
var editedConditionsIndex;
var lastFileAccess;

setInterval(ReloadCss, 1000);
setInterval(ReadWriteWatcher, 333);

function cl(msg) { console.log(msg); }

document.addEventListener("keydown", (e) => {
    if (e.shiftKey)
        isShiftPressed = true;
});

document.addEventListener("keyup", (e) => {
    if (!e.shiftKey)
        isShiftPressed = false;

    if (e.ctrlKey) {
        if (e.key.toLowerCase() == "s") {
            e.preventDefault();
            if (e.shiftKey) {
                ToggleAutoSave();
            } else {
                WriteOrders();
            }
        }
        if (e.key.toLowerCase() == "r") {
            e.preventDefault();
            if (e.shiftKey) {
                ToggleAutoRead();
            } else {
                ReadOrders();
            }
        }
        if (e.key == " ") {
            e.preventDefault();
            if (currentHoverOrder)
                PauseAllTasksFrom(currentHoverOrder);
        }
        if (e.key == "x") {
            e.preventDefault();
            DeleteTask(currentHoverOrder);
        }
        if (e.key == "c") {
            e.preventDefault();
            ToggleCompact();
        }
        if (e.key == "v") {
            CreateNewOrder();
        }
    } else {
        if (e.key == " ") {
            e.preventDefault();
            if (currentHoverOrder) {
                if (IsTaskPaused(currentHoverOrder, PAUSECHANNEL_ONETASK)) {
                    ResumeTask(currentHoverOrder, PAUSECHANNEL_ONETASK);
                } else {
                    PauseTask(currentHoverOrder, PAUSECHANNEL_ONETASK);
                }
                UpdateTable();
            }
        }

    }
});

document.addEventListener("DOMContentLoaded", async (event) => {
    $("html")[0].addEventListener("click", () => { ClosePopups(); });
    fileHandle = await window.api.GetFileHandle();
    data["items"] = await window.api.GetGameDefs("data/vanilla/vanilla_items/objects/");
    data["materials"] = await window.api.GetGameDefs("data/vanilla/vanilla_materials/objects/");
    data["materials"].push("INORGANIC");
    data["reactions"] = await window.api.GetGameDefs("data/vanilla/vanilla_reactions/objects/");

    var itemTypes = data["items"].concat(data["types"]);
    fuses["itemTypes"] = new Fuse(itemTypes);
    fuses["materials"] = new Fuse(data["materials"]);
    fuses["reactions"] = new Fuse(data["reactions"]);
    fuses["flags"] = new Fuse(data["flags"]);
    fuses["types"] = new Fuse(data["types"]);

    ToggleCompact(true);
    ClosePopups();
    PrepareInput($("input#conditionValue")[0]);
    ReadOrders();
});

var propertiesInfos = [
    {
        name: "id",
        displayName: "ID",
        visible: false,
    },
    {
        name: "is_active",
        displayName: "⚙", //gear icon
        visible: true,
        compactable: true,
    },
    {
        name: "is_validated",
        displayName: "✔",
        visible: true,
        compactable: true,
    },
    {
        name: "job",
        displayName: "Job",
        visible: true,
        search: true,
    },
    {
        name: "reaction",
        displayName: "Job",
        visible: false,
    },
    {
        name: "item_subtype",
        displayName: "Item",
        visible: false,
    },
    {
        name: "material",
        displayName: "Material",
        visible: true,
    },
    {
        name: "material_category",
        displayName: "Material Category",
        visible: false,
    },

    {
        name: "amount_left",
        displayName: "Left",
        isInput: true,
        visible: true,
    },
    {
        name: "amount_total",
        displayName: "Goal",
        isInput: true,
        visible: true,
    },
    {
        name: "frequency",
        displayName: "Check freq.",
        visible: true,
        compactable: true,
    },
    {
        name: "item_conditions",
        displayName: "Conds.",
        visible: true,
    },
    {
        name: "max_workshops",
        displayName: "Wrk",
        visible: true,
        isInput: true,
    },

]

function DragStart(e) {
    e.dataTransfer.setData("text/plain", null);
    var from = Array.from(e.target.parentElement.children);
    e.dataTransfer.setData("orderIndex", from.indexOf(e.target));
}

function DragOver(e) {
    e.preventDefault();
    e.target.parentElement.classList.add("dragOver");
}

function DragLeave(e) {
    e.preventDefault();
    $(".dragOver").forEach(el => el.classList.remove("dragOver"));
}

function DragDrop(e) {
    e.preventDefault();
    $(".dragOver").forEach(el => el.classList.remove("dragOver"));
    const fromIndex = e.dataTransfer.getData("orderIndex") - 1;
    const toIndex = Array.from(ordersTable.children).indexOf(e.target.parentElement) - 1;
    if (fromIndex === toIndex)
        return;
    const movedOrder = orders.splice(fromIndex, 1)[0];

    orders.splice(toIndex, 0, movedOrder);

    if (toIndex > fromIndex) {
        ordersTable.insertBefore(ordersTable.children[fromIndex + 1], ordersTable.children[toIndex + 2]);
    } else {
        ordersTable.insertBefore(ordersTable.children[fromIndex + 1], ordersTable.children[toIndex + 1]);
    }
    if (autoSave)
        MarkForSave(true);
}


function UpdateTable(forceRedrawConditions = false) {
    var orderlines = $(".ordersTable .orderRow")
    orderlines.forEach(line => {
        //dont delete the header line
        if (line.classList.contains("header"))
            return;
        if (orders.find(o => o.id == line.getAttribute("orderId")) == null)
            line.remove()
    });
    ordersTable = $(".ordersTable")[0];


    if (!headerReady) {
        newLine = document.createElement("div");
        newLine.classList.add("orderRow", "header");
        propertiesInfos.forEach(prop => {
            if (prop.visible === false)
                return;
            var cell = document.createElement("div");
            cell.classList.add("property", "head", prop.name);
            if (prop.compactable)
                cell.classList.add("comp");
            cell.textContent = prop.displayName;

            if (prop.search) {
                var input = document.createElement("input");
                input.type = "text";
                input.classList.add("searchInput", prop.name);
                input.placeholder = "Search...";
                input.addEventListener("keyup", (e) => {
                    var searchTerm = e.target.value.toLowerCase();
                    FilterJobs(searchTerm);
                });
                cell.appendChild(input);
            }

            newLine.appendChild(cell);
        });

        var toolZone = document.createElement("div");
        toolZone.classList.add("toolZone");
        newLine.appendChild(toolZone);

        headerReady = true;
        ordersTable.appendChild(newLine);
    }

    orders.forEach(order => {

        if (order.conditionsHovered)
            return;

        var editedLine = ordersTable.querySelector(`div[orderId='${order.id}']`);
        var orderIndex = orders.indexOf(order);

        if (editedLine == null) {
            editedLine = document.createElement("div");
            editedLine.classList.add("orderRow");
            editedLine.draggable = true;
            editedLine.setAttribute("orderId", order.id);

            editedLine.addEventListener("dragstart", (e) => { DragStart(e); });
            editedLine.addEventListener("dragover", (e) => { DragOver(e); });
            editedLine.addEventListener("dragleave", (e) => { DragLeave(e); });
            editedLine.addEventListener("drop", (e) => { DragDrop(e); });
            editedLine.addEventListener("mouseenter", (e) => { currentHoverOrder = GetOrderFromElement(e.currentTarget); });
            editedLine.addEventListener("mousemove", (e) => { currentHoverOrder = GetOrderFromElement(e.currentTarget); });
            editedLine.addEventListener("mouseleave", (e) => { currentHoverOrder = null; });

            var toolZone = document.createElement("div");
            toolZone.classList.add("toolZone");
            editedLine.appendChild(toolZone);

            var button = document.createElement("button");
            button.classList.add("rowTool", "btnDelete");
            button.textContent = "✖";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                DeleteTask(myOrder);
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnToggleMe");
            button.textContent = "⏹";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                if (IsTaskPaused(myOrder, PAUSECHANNEL_ONETASK)) {
                    ResumeTask(myOrder, PAUSECHANNEL_ONETASK);
                    UpdateTable();
                } else {
                    PauseTask(myOrder, PAUSECHANNEL_ONETASK);
                    UpdateTable();
                }
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnStopAllAfter");
            button.textContent = "⏹⇓";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                PauseAllTasksFrom(myOrder);
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnDuplicate");
            button.textContent = "⧉";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                var newOrder = JSON.parse(JSON.stringify(myOrder));
                newOrder.isNew = true;
                newOrder.id = orders.reduce((maxId, o) => Math.max(maxId, o.id), 0) + 1;
                var index = orders.indexOf(myOrder) + 1;
                orders.splice(index, 0, newOrder);
                if (autoSave)
                    MarkForSave();
                UpdateTable();
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnMax", "comp");
            button.textContent = "⇈";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                orders = orders.filter(o => o.id !== myOrder.id);
                orders.unshift(myOrder);
                MarkEdited(myOrder);
                if (autoSave)
                    MarkForSave();
                UpdateTable();
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnMin", "comp");
            button.textContent = "⇊";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                orders = orders.filter(o => o.id !== myOrder.id);
                orders.push(myOrder);
                MarkEdited(myOrder);
                if (autoSave)
                    MarkForSave();
                UpdateTable();
            });
            toolZone.appendChild(button);

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

        if (order.max_workshops === undefined)
            order.max_workshops = 0;

        if (order.item_conditions === undefined)
            order.item_conditions = [];

        if (order.material === undefined)
            order.material = "";

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
                editedLine.appendChild(cell);
            }

            if (propInfo.compactable)
                cell.classList.add("comp");

            if (propInfo.isToggle) {
                cell.classList.add("toggleable");
                cell.addEventListener("click", () => {
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
            if (property === "material") {
                if (order["material_category"] != null) {
                    cellText = order["material_category"].toString();
                } else {
                    /*
                    if (cellText == "INORGANIC")
                        cellText = "ROCK";
                    cellText = cellText.replace("INORGANIC:", "");
                    */
                }
                cellText = cellText.toLowerCase();
                if (cellText.length > 0)
                    cellText = cellText[0].toUpperCase() + cellText.slice(1);
            }

            if (property == "job") {
                cellText = order["reaction"] ? order["reaction"] : order["job"];
                if (cellText.startsWith("Make") && order["item_subtype"] != undefined)
                    cellText = order["item_subtype"];

                if (cellText == "PrepareMeal")
                    cellText += " (" + order.meal_ingredients + " ingredients)";

                var progressBar = editedLine.querySelector(`.property.${property} .progressBar`);
                if (!progressBar) {
                    progressBar = document.createElement("div");
                    progressBar.classList.add("progressBar");
                    progressBar.text = "."
                    cell.appendChild(progressBar);
                }
                progressBar.style.width = ((order.amount_total - order.amount_left) / order.amount_total * 100) + "%";
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
                    input = CreateInput(InputChangeCallback_PropertyValue, order, property, -1);
                    cell.appendChild(input);
                }
                input.value = order[property];

            } else if (property == "item_conditions") {

                var i = 0;

                var numDiv = editedLine.querySelector(`.property.${property} .conditionsNum`);
                if (!numDiv) {
                    numDiv = document.createElement("div");
                    numDiv.classList.add("conditionsNum");
                    numDiv.addEventListener("mouseenter", (e) => { ConditionEditHover(e); });
                    numDiv.addEventListener("mouseleave", (e) => { ConditionEditLeave(e); });
                    cell.appendChild(numDiv);
                }

                var conditions = order[property];

                //remove all conditions that correspond to a PauseCondition object
                conditions = conditions.filter(cond => !(cond.condition === pauseAll.condition && cond.value === pauseAll.value));
                conditions = conditions.filter(cond => !(cond.condition === pauseFrom.condition && cond.value === pauseFrom.value));
                conditions = conditions.filter(cond => !(cond.condition === pauseOne.condition && cond.value === pauseOne.value));

                numDiv.textContent = conditions.length > 0 ? conditions.length + " cond." : "-";

                //remove container if exists
                container = editedLine.querySelector(`.property.${property} .conditionsContainer`);
                if (!container || forceRedrawConditions) {
                    if (container)
                        container.remove();

                    container = document.createElement("div");
                    container.classList.add("conditionsContainer");
                    cell.appendChild(container);
                }

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
                        delButton.addEventListener("click", (e) => {
                            CopyCondition(order, conditions.indexOf(condition));
                        });
                        partsHost.appendChild(delButton);

                        var delButton = document.createElement("button");
                        delButton.classList.add("btnDelete");
                        delButton.textContent = "✖";
                        delButton.addEventListener("click", (e) => {
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
                                input = CreateInput(InputChangeCallback_ConditionValue, order, property, i);
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
                                (function (order, index) { condPartElement.addEventListener("click", (e) => { ShowConditionEditor(order, index); e.stopPropagation(); }); })(order, conditions.indexOf(condition));

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
                    button.addEventListener("click", (e) => { PasteCondition(order); });
                    buts.appendChild(button);
                } else {
                    buts.appendChild(pasteCondButton[0]);
                }
                var addCondButton = container.querySelectorAll(".btnAddCondition");
                if (addCondButton.length == 0) {
                    var button = document.createElement("button");
                    button.textContent = "+";
                    button.classList.add("btnAddCondition");
                    button.addEventListener("click", (e) => { AddCondition(order); });
                    buts.appendChild(button);
                } else {
                    buts.appendChild(addCondButton[0]);
                }

                container.appendChild(buts);
                container.querySelectorAll(".btnPaste")[0].classList.toggle("disabled", copiedCondition == null);

            } else {

                cell.textContent = cellText;

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
    if (autoSave)
        MarkForSave(true);

    UpdateTable();
    ShowConditionEditor(order, order.item_conditions.length - 1);
}

function DeleteCondition(order, conditionIndex) {
    order.item_conditions.splice(conditionIndex, 1);
    MarkEdited(order);
    UpdateTable(true);

    if (autoSave)
        MarkForSave();
}

function CopyCondition(order, conditionIndex) {
    copiedCondition = order.item_conditions[conditionIndex];
    conditionJustCopied = true;
    ClosePopups();
}

function PasteCondition(order) {
    if (copiedCondition == null)
        return;

    order.item_conditions.push(copiedCondition);
    MarkEdited(order);
    UpdateTable(true);
    if (autoSave)
        MarkForSave(true);
}

function ShowConditionEditor(order, conditionIndex) {
    cl("moncul1");
    if (conditionJustCopied) {
        conditionJustCopied = false;
        ClosePopups();
        cl("moncul2");
        return;
    }
    cl("moncul3");

    condition = order.item_conditions[conditionIndex];
    if (!condition)
        return;
    editedConditionsOrder = order;
    editedConditionsIndex = conditionIndex;
    var editor = $(".conditionEditor")[0];
    //    editor.querySelector("#itemName").value = condition.item_type ? condition.item_type : "";
    editor.querySelector("#itemType").value = condition.item_subtype ? condition.item_subtype : condition.item_type;
    editor.querySelector("#itemFlag").value = condition.flags ? condition.flags.join(",") : "";
    editor.querySelector("#itemMaterial").value = condition.material ? condition.material : "";
    editor.querySelector("#itemReactable").value = condition.reaction_product ? condition.reaction_product : "";
    editor.querySelector("#operator").value = condition.condition;
    editor.querySelector("#conditionValue").value = condition.value;
    Show($(".conditionEditor"));
}


function MarkForSave(immediate = false) {
    mustWrite = true;
    if (immediate)
        WriteOrders();
}

async function ReadWriteWatcher() {
    var currentFileAccess = Date.now();
    if (lastFileAccess == undefined)
        lastFileAccess = currentFileAccess;

    var timePassed = currentFileAccess - lastFileAccess;
    if (timePassed < DELAY_BETWEEN_FILE_OPS_MS) {
        return;
    }

    //check if any condition editor is opened
    var hovered = editedConditionsOrder != null || document.querySelector(".conditionEditor:hover") || document.querySelector(".item_conditions:hover");
    if (hovered != null || waitForOperation)
        return;

    if (mustWrite) {
        mustWrite = false;
        cl("Sending update...");
        lastFileAccess = Date.now();
        await WriteOrders();
        lastFileAccess = Date.now();
    } else if (mustRead || autoRead) {
        mustRead = false;
        cl("Requesting update...");
        lastFileAccess = Date.now();
        await ReadOrders();
        lastFileAccess = Date.now();
    }
}

async function ReadOrders() {
    waitForOperation = true;

    $("#openFile")[0].innerHTML = fileHandle ? "READING: <u>" + fileHandle.split("\\").pop().toUpperCase() + "</u>" : "Select orders file";

    json = await window.api.ReadFile();
    if (json == undefined) {
        waitForOperation = false;
        $("body")[0].classList.add("noFileSelected");
        return;
    }

    $("body")[0].classList.remove("noFileSelected");
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
                        if (prop.name === "item_conditions" && editedConditionsOrder != null && editedConditionsOrder.id == oldLine.id)
                            ClosePopups();
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

    UpdateTable();
    waitForOperation = false;
}

async function WriteOrders() {
    //check if any new, edited or deleted orders exist
    var hasChanges = orders.some(o => o.edited === true || o.deleted === true || o.isNew === true);
    if (!hasChanges)
        return;

    fileHandle ??= await window.api.GetFileHandle();
    if (!fileHandle) {
        $("body")[0].classList.add("noFileSelected");
        return;
    }
    $("body")[0].classList.remove("noFileSelected");

    waitForOperation = true;

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
    cl(clonedOrders);

    await window.api.WriteFile(JSON.stringify(clonedOrders, null, 2));
    waitForOperation = false;
    UpdateTable();
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

function ToggleAutoSave() {
    autoSave = !autoSave;
    const autoSaveBtn = document.getElementById("autoSave");
    autoSaveBtn.textContent = `AUTOSAVE: ${autoSave ? "ON" : "OFF"}`;
    autoSaveBtn.classList.toggle("active", autoSave);

    if (autoSave)
        MarkForSave();
}

function ToggleAutoRead() {
    autoRead = !autoRead;
    const autoReadBtn = document.getElementById("autoRead");
    autoReadBtn.textContent = `AUTOREAD: ${autoRead ? "ON" : "OFF"}`;
    autoReadBtn.classList.toggle("active", autoRead);


}

function CreateInput(onChangeCallback, orderObject, affectedProperty, conditionIndex = -1) {
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
    input
        .addEventListener("wheel", (e) => {
            e.preventDefault();
            var delta = Math.sign(e.deltaY);
            if (isShiftPressed)
                delta *= 5;
            var curVal = e.target.value;
            curVal = curVal === "" ? 0 : curVal;
            var newValue = Math.max(0, parseInt(curVal) - delta);
            e.target.value = newValue;
            var event = new Event("change");
            e.target.dispatchEvent(event);
        });

    if (onChangeCallback != null) {
        input.addEventListener("change", (e) => { onChangeCallback(e); });
    }
}

function InputChangeCallback_PropertyValue(e) {
    var id = e.target.getAttribute("orderId");
    var order = orders.find(o => o.id == id);

    MarkEdited(order);
    var prop = e.target.getAttribute("affectedProp");
    order[prop] = parseInt(e.target.value);
    order[prop + "_cell"].childNodes[0].nodeValue = order[prop];
    if (autoSave)
        MarkForSave();
}

function InputChangeCallback_ConditionValue(e) {
    var id = e.target.getAttribute("orderId");
    var order = orders.find(o => o.id == id);
    var condIndex = e.target.getAttribute("conditionIndex");

    MarkEdited(order);
    var condition = order["item_conditions"][condIndex];
    condition.value = parseInt(e.target.value);
    condition.value_element.value = condition.value;
    if (autoSave)
        MarkForSave();
}

function MarkEdited(order) {
    order.edited = true;
    var line = ordersTable.querySelector(`div[orderId='${order.id}']`);
    line.classList.add("edited");
}


function GetOrderFromElement(element) {
    var id = element.closest(".orderRow")?.getAttribute("orderId");;
    return orders.find(o => o.id == id);
}


function PauseAllTasks() {
    allPaused = !allPaused;
    const pauseAllBtn = document.getElementById("pauseAll");
    pauseAllBtn.textContent = `PAUSE ALL: ${allPaused ? "ON" : "OFF"}`;
    pauseAllBtn.classList.toggle("active", allPaused);

    orders.forEach(order => {
        if (allPaused) {
            PauseTask(order, PAUSECHANNEL_ALLSTASKS);
        } else {
            ResumeTask(order, PAUSECHANNEL_ALLSTASKS);
        }
    });
    UpdateTable();
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
    UpdateTable();
}

function PauseTask(order, stopChannel = 0) {
    var pauseCondition = GetPauseCondition(stopChannel);

    if (!order.item_conditions)
        order.item_conditions = [];

    if (order.item_conditions.findIndex(cond => cond.condition === pauseCondition.condition && cond.value === pauseCondition.value) === -1) {
        order.item_conditions.push(pauseCondition);
    }

    MarkEdited(order);
    if (autoSave)
        MarkForSave();
}

function ResumeTask(order, stopChannel = 0) {
    var pauseCondition = GetPauseCondition(stopChannel);

    if (!order.item_conditions)
        order.item_conditions = [];
    order.item_conditions = order.item_conditions.filter(cond => !(cond.condition === pauseCondition.condition && cond.value === pauseCondition.value));

    MarkEdited(order);
    if (autoSave)
        MarkForSave();
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



async function OpenFile() {
    fileHandle = await window.api.PickFile();
    if (!fileHandle) {
        $("body")[0].classList.add("noFileSelected");
        return;
    }
    $("body")[0].classList.remove("noFileSelected");
    ReadOrders();
}

function ClosePopups() {
    var rems = $(".popup")
    rems.forEach(el => el.remove());

    CloseConditionEditor();
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

function FilterJobs(searchTerm) {
    var orderLines = $(".ordersTable .orderRow");
    orderLines.forEach(line => {
        if (line.classList.contains("header"))
            return;
        var jobCell = line.querySelector(".property.job");
        var jobName = jobCell ? jobCell.textContent.toLowerCase() : "";
        if (jobName.includes(searchTerm)) {
            line.classList.remove("hidden");
        } else {
            line.classList.add("hidden");
        }
    });
}


function SetAutoFill(input, category, allowMultiples) {
    $(".autocompleteList").forEach(el => el.innerHTML = "");

    multiFill = allowMultiples;
    input.setAttribute("category", category);
    currendFuseInput = input;
    if (currendFuseInput != null)
        currendFuseInput.removeEventListener("input", AutoFillFieldChanged);
    currendFuseInput.addEventListener("input", AutoFillFieldChanged);
}

function AutoFillFieldChanged(event) {
    var input = event.target;
    var cat = input.getAttribute("category");
    var tags = input.value.split(",");
    var results = fuses[cat].search(tags[tags.length - 1].trim());
    var list = input.nextElementSibling;
    list.innerHTML = "";
    results.slice(0, 10).forEach(result => {
        var line = document.createElement("div");
        line.classList.add("autocompleteItem");
        line.textContent = result.item;
        list.appendChild(line);
        line.addEventListener("click", () => {
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
    var category = input.getAttribute("category");

    var tags = input.value.split(",");
    tags = tags.map(t => t.trim());
    tags = tags.filter(t => t !== "");
    tags = [...new Set(tags)];

    var validTags = [];
    if (tags) {
        tags.forEach(tag => {
            if (data[category].findIndex(v => v == tag) != -1) {
                validTags.push(tag);
                if (!multiFill)
                    return;
            }
        });
    }

    input.value = validTags.join(",");
    var event = new Event("change");
    input.dispatchEvent(event);
    ConditionEdited(input, category);
}


function ConditionEdited(elem) {
    var order = editedConditionsOrder;
    var condition = order.item_conditions[editedConditionsIndex];
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

    if (autoSave)
        MarkForSave();
}

function ConditionEditHover(e) {
    var order = GetOrderFromElement(e.currentTarget);
    order.conditionsHovered = true;
}

function ConditionEditLeave(e) {
    var order = GetOrderFromElement(e.currentTarget);
    order.conditionsHovered = false;
}

function CloseConditionEditor() {
    $(".conditionEditor")[0].classList.add("hidden");

    if (editedConditionsOrder != null)
        UpdateTable();

    editedConditionsOrder = null;
}


function CreateNewOrder() {
    if (currentHoverOrder) {
        //clone current hover order
        myOrder = JSON.parse(JSON.stringify(currentHoverOrder));
        myOrder.isNew = true;
        myOrder.edited = true;
        myOrder.amount_left = myOrder.amount_total;
    } else {
        myOrder = {
            job: "MakeBucket",
            amount_left: 10,
            amount_total: 10,
            material_category: ["Wood"],
            material: "",
            frequency: "Daily",
            max_workshops: 0,
            is_active: false,
            is_validated: false,
            isNew: true,
            edited: true,
        }
    }
    myOrder.id = orders.reduce((maxId, o) => Math.max(maxId, o.id), 0) + 1;

    if (currentHoverOrder) {
        //insert after hovered order
        var index = orders.findIndex(o => o.id === currentHoverOrder.id);
        orders.splice(index + 1, 0, myOrder);
    } else {
        orders.push(myOrder);
    }
    if (autoSave)
        MarkForSave();
    UpdateTable();
    MarkEdited(myOrder);
}

async function ToggleCompact(noSwitch = false) {
    compactMode = await window.api.ToggleCompactMode(noSwitch);
    $("#extraCols")[0].textContent = compactMode ? "EXTRA COLS: OFF" : "EXTRA COLS: ON";
    $("#extraCols")[0].classList.toggle("active", compactMode);

    if (compactMode) {
        $("body")[0].classList.add("compactMode");
    } else {
        $("body")[0].classList.remove("compactMode");
    }
}


function DeleteTask(order) {
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
    if (autoSave)
        MarkForSave();
    UpdateTable();
}