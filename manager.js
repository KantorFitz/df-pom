const $ = (selector) => document.querySelectorAll(selector);

var json;
var readable;
var writable;
var orders = [];
var autoSave = false;
var autoRead = false;
var dragStartIndex = 0;
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


setInterval(ReloadCss, 1000);
setInterval(ReadWriteWatcher, 1000);

document.addEventListener("keydown", (e) => {
    if (e.shiftKey)
        isShiftPressed = true;
});
document.addEventListener("keyup", (e) => {
    if (!e.shiftKey)
        isShiftPressed = false;
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
    },
    {
        name: "is_validated",
        displayName: "✔",
        visible: true,
    },
    {
        name: "job",
        displayName: "Job",
        visible: true,
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
    },
    {
        name: "item_conditions",
        displayName: "Conditions",
        visible: true,
    },
    {
        name: "max_workshops",
        displayName: "Wrksp",
        visible: true,
        isInput: true,
    },

]

function cl(msg) {
    console.log(msg);
}

function DragStart(e) {
    e.dataTransfer.setData("text/plain", null);
    cl("target");
    cl(e.target);
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
    const fromIndex = e.dataTransfer.getData("orderIndex") - 1;
    const toIndex = Array.from(ordersTable.children).indexOf(e.target.parentElement) - 1;
    if (fromIndex === toIndex)
        return;
    const movedOrder = orders.splice(fromIndex, 1)[0];
    orders.splice(toIndex, 0, movedOrder);
    UpdateTable();
    if (autoSave) {
        ReadOrders();
        mustWrite = true;
    }
}


function UpdateTable() {
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
            cell.textContent = prop.displayName;
            newLine.appendChild(cell);
        });

        var toolZone = document.createElement("div");
        toolZone.classList.add("toolZone");
        newLine.appendChild(toolZone);

        headerReady = true;
        ordersTable.appendChild(newLine);
    }

    orders.forEach(order => {

        var editedLine = ordersTable.querySelector(`div[orderId='${order.id}']`);

        if (editedLine == null) {
            editedLine = document.createElement("div");
            editedLine.classList.add("orderRow");
            editedLine.draggable = true;
            editedLine.setAttribute("orderId", order.id);

            editedLine.addEventListener("dragstart", (e) => { DragStart(e); });
            editedLine.addEventListener("dragover", (e) => { DragOver(e); });
            editedLine.addEventListener("dragleave", (e) => { DragLeave(e); });
            editedLine.addEventListener("drop", (e) => { DragDrop(e); });

            var toolZone = document.createElement("div");
            toolZone.classList.add("toolZone");
            editedLine.appendChild(toolZone);

            var button = document.createElement("button");
            button.classList.add("rowTool", "btnDelete");
            button.textContent = "✖";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                orders = orders.filter(o => o.id !== myOrder.id);
                UpdateTable();
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
            //give me symbols for arrow down
            //arrowDownSymbol1 = "↓";
            //arrowDownSymbol2 = "⇓";
            //arrowDownSymbol3 = "⇩"; 
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
                newOrder.id = orders.reduce((maxId, o) => Math.max(maxId, o.id), 0) + 1;
                orders.push(newOrder);
                UpdateTable();
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnMax");
            button.textContent = "⇈";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                orders = orders.filter(o => o.id !== myOrder.id);
                orders.unshift(myOrder);
                UpdateTable();
            });
            toolZone.appendChild(button);

            button = document.createElement("button");
            button.classList.add("rowTool", "btnMin");
            button.textContent = "⇊";
            button.addEventListener("click", (e) => {
                myOrder = GetOrderFromElement(e.currentTarget);
                orders = orders.filter(o => o.id !== myOrder.id);
                orders.push(myOrder);
                UpdateTable();
            });
            toolZone.appendChild(button);

            ordersTable.appendChild(editedLine);
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
                    if (cellText == "INORGANIC")
                        cellText = "ROCK";
                    cellText = cellText.replace("INORGANIC:", "");
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
                    cell.appendChild(numDiv);
                }

                var conditions = order[property];

                //remove all conditions that correspond to a PauseCondition object
                conditions = conditions.filter(cond => !(cond.condition === pauseAll.condition && cond.value === pauseAll.value));
                conditions = conditions.filter(cond => !(cond.condition === pauseFrom.condition && cond.value === pauseFrom.value));
                conditions = conditions.filter(cond => !(cond.condition === pauseOne.condition && cond.value === pauseOne.value));

                numDiv.textContent = conditions.length > 0 ? conditions.length + " condition(s)" : "-";

                container = editedLine.querySelector(`.property.${property} .conditionsContainer`);
                if (!container) {
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
                        conditionElement.appendChild(partsHost);
                    }

                    for (const key of conditionParts) {
                        if (key.endsWith("_element"))
                            continue;

                        condPartElement = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}'] .conditionPartsHost .conditionPart.cond_${key}`);
                        if (!condPartElement) {
                            condPartElement = document.createElement("div");
                            condPartElement.classList.add("conditionPart", "cond_" + key);
                            partsHost.appendChild(condPartElement);
                        }

                        var value = condition[key] ?? "";

                        if (key == "condition") {
                            condPartElement.textContent = condOperators.find(op => op.name === condition[key]).symbol;
                        } else if (key == "value") {
                            var input = editedLine.querySelector(`.property.${property} .conditionsContainer .condition[conditionIndex='${i}'] .conditionPartsHost .conditionPart.cond_value input`);
                            if (!input) {
                                input = CreateInput(InputChangeCallback_ConditionValue, order, property, i);
                                condPartElement.appendChild(input);
                            }
                            condition.value_element = input;
                        } else {
                            condPartElement.textContent = value;
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

            } else {

                cell.textContent = cellText;

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

function MarkForSave(immediate = false) {
    mustWrite = true;
    if (immediate)
        WriteOrders();
}

function MarkForRead(immediate = false) {
    mustRead = true;
    if (immediate)
        ReadOrders();
}

function ReadWriteWatcher() {
    if (mustWrite && !waitForOperation) {
        mustWrite = false;
        WriteOrders();
    }

    if ((mustRead || autoRead) && !waitForOperation) {
        mustRead = false;
        ReadOrders();
    }
}

async function ReadOrders() {
    // Open file picker and destructure the result the first handle
    waitForOperation = true;
    orders = [];
    if (!readable) {
        [readable] = await window.showOpenFilePicker();
    }
    json = await readable.getFile();

    await json.text().then((text) => {
        orders = JSON.parse(text);
        UpdateTable();
        waitForOperation = false;
    });
}

async function WriteOrders() {
    waitForOperation = true;
    if (!writable) {
        writeHandle = await window.showSaveFilePicker();
        writable = await writeHandle.createWritable();
    }
    var clonedOrders = CloneOrdersNoDom(orders);
    cl(clonedOrders);

    writable.write(JSON.stringify(clonedOrders, null, 2));
    await writable.close();
    writable = await writeHandle.createWritable();
    waitForOperation = false;

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

    cl("create input " + conditionIndex);
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
            var newValue = Math.max(0, parseInt(e.target.value) - delta);
            e.target.value = newValue;
            var event = new Event("change");
            e.target.dispatchEvent(event);
        });

    input.addEventListener("change", (e) => { onChangeCallback(e); });
    return input;
}

function InputChangeCallback_PropertyValue(e) {
    var id = e.target.getAttribute("orderId");
    var order = orders.find(o => o.id == id);
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
    var condition = order["item_conditions"][condIndex];
    condition.value = parseInt(e.target.value);
    condition.value_element.value = condition.value;
    if (autoSave)
        MarkForSave();
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

    if (autoSave)
        MarkForSave();
}

function ResumeTask(order, stopChannel = 0) {
    var pauseCondition = GetPauseCondition(stopChannel);

    if (!order.item_conditions)
        order.item_conditions = [];
    order.item_conditions = order.item_conditions.filter(cond => !(cond.condition === pauseCondition.condition && cond.value === pauseCondition.value));

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