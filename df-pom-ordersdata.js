

var propertiesInfos = [
    {
        name: "id",
        displayName: "ID",
        visible: false,
        numeric: true,
    },
    {
        name: "is_active",
        displayName: "Active?", //gear icon
        visible: false,
        compactable: true,
        yesno: true,
    },
    {
        name: "is_validated",
        displayName: "Validated?",
        visible: false,
        compactable: true,
        yesno: true,
    },
    {
        name: "job",
        displayName: "Job name",
        visible: true,
        search: true,
    },
    {
        name: "reaction",
        displayName: "Reaction name",
        visible: false,
    },
    {
        name: "item_subtype",
        displayName: "Item built",
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
        displayName: "Left to do",
        isInput: true,
        visible: true,
        numeric: true,
    },
    {
        name: "amount_total",
        displayName: "Total to do",
        isInput: true,
        visible: true,
        numeric: true,
    },
    {
        name: "frequency",
        displayName: "Check frequency",
        visible: true,
        compactable: true,
    },
    {
        name: "item_conditions",
        displayName: "Conditions",
        visible: true,
    },
    {
        name: "max_workshops",
        displayName: "Max workshops assigned",
        visible: true,
        isInput: true,
        numeric: true,
        compactable: true,
    },

]

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

var craftTypes = [
    "CRAFT",
    "SCEPTER",
    "CROWN",
    "FIGURINE",
    "AMULET",
    "TOTEM"
]