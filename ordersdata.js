


var condFlags = ["empty", "ammo"];
var condItemTypes = ["ARMOR", "INSTRUMENT", "TOOL"];
var condItemSubTypes = ["PART_ENORMOUS_GONG_FRAME_BI"];
var conditionParts = [
    "condition",
    "item_type",
    "item_subtype",
    "material",
    "flags",
    "value"
]
var condOperators = [
    {
        name: "Not",
        symbol: "!=",
    },
    {
        name: "AtLeast",
        symbol: ">=",
    },
    {
        name: "AtMost",
        symbol: "<=",
    },
    {
        name: "GreaterThan",
        symbol: ">",
    },
    {
        name: "LessThan",
        symbol: "<",
    },
    {
        name: "Exactly",
        symbol: "==",
    }
]