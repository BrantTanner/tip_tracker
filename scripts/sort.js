// Sorting helpers keep the table order logic separate from the UI wiring.
// These labels are shared by the dropdown and the table header text.
export const SORT_FIELD_LABELS = {
    created_at: "Date",
    tips: "Tips",
    guests: "Guests",
    tour: "Tour",
    ship: "Cruise Ship"
};

export const SORT_FIELD_DEFAULT_DIRECTIONS = {
    created_at: "desc",
    tips: "desc",
    guests: "desc",
    tour: "asc",
    ship: "asc"
};

export const SORT_DIRECTION_LABELS = {
    created_at: {
        desc: "Newest to Oldest",
        asc: "Oldest to Newest"
    },
    tips: {
        desc: "Highest to Lowest",
        asc: "Lowest to Highest"
    },
    guests: {
        desc: "Highest to Lowest",
        asc: "Lowest to Highest"
    },
    tour: {
        desc: "Z to A",
        asc: "A to Z"
    },
    ship: {
        desc: "Z to A",
        asc: "A to Z"
    }
};

// Returns the default sort direction for each field.
export function getDefaultSortDirection(field) {
    return SORT_FIELD_DEFAULT_DIRECTIONS[field] || "asc";
}

// Returns the label shown in the direction dropdown for the active field.
export function getSortDirectionLabel(field, direction) {
    return SORT_DIRECTION_LABELS[field]?.[direction] ?? (direction === "desc" ? "Descending" : "Ascending");
}

// Compares two rows using the selected field and direction.
function compareSortValues(field, direction, leftRow, rightRow) {
    if (field === "created_at") {
        const leftTime = new Date(leftRow.created_at ?? 0).getTime();
        const rightTime = new Date(rightRow.created_at ?? 0).getTime();

        if (leftTime !== rightTime) {
            return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
        }

        return direction === "desc"
            ? (rightRow.id ?? 0) - (leftRow.id ?? 0)
            : (leftRow.id ?? 0) - (rightRow.id ?? 0);
    }

    const leftValue = leftRow[field];
    const rightValue = rightRow[field];
    const leftIsNumber = typeof leftValue === "number" || !Number.isNaN(Number(leftValue));
    const rightIsNumber = typeof rightValue === "number" || !Number.isNaN(Number(rightValue));

    if (leftIsNumber && rightIsNumber) {
        const leftNumber = Number(leftValue);
        const rightNumber = Number(rightValue);

        if (leftNumber !== rightNumber) {
            return direction === "desc" ? rightNumber - leftNumber : leftNumber - rightNumber;
        }
    }

    const leftText = String(leftValue ?? "").toLowerCase();
    const rightText = String(rightValue ?? "").toLowerCase();

    if (leftText !== rightText) {
        const comparison = leftText.localeCompare(rightText);
        return direction === "desc" ? -comparison : comparison;
    }

    return direction === "desc"
        ? (rightRow.id ?? 0) - (leftRow.id ?? 0)
        : (leftRow.id ?? 0) - (rightRow.id ?? 0);
}

// Produces a new array so callers can render rows without mutating the source data.
export function getSortedRows(rows, field, direction) {
    return [...rows].sort((leftRow, rightRow) => compareSortValues(field, direction, leftRow, rightRow));
}