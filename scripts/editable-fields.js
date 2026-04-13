// Cell edits are parsed and validated here so the main app stays readable.
// The function returns both a machine-friendly value and a display-friendly version.
export function parseEditableValue(field, rawValue) {
    const trimmed = rawValue.trim();

    if (field === "tips") {
        const normalized = trimmed.replace(/[$,\s]/g, "");
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) {
            return { valid: false, message: "Tips must be a number." };
        }

        const fixed = Number(parsed.toFixed(2));
        return { valid: true, value: fixed, display: `$${fixed.toFixed(2)}` };
    }

    if (field === "guests") {
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed)) {
            return { valid: false, message: "Guests must be a number." };
        }

        return { valid: true, value: parsed, display: String(parsed) };
    }

    if (field === "tour" || field === "ship") {
        if (!trimmed) {
            return { valid: false, message: "This field cannot be empty." };
        }

        return { valid: true, value: trimmed, display: trimmed };
    }

    if (field === "created_at") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return { valid: false, message: "Date must be in YYYY-MM-DD format." };
        }

        const date = new Date(`${trimmed}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) {
            return { valid: false, message: "Enter a valid date." };
        }

        return { valid: true, value: `${trimmed}T00:00:00Z`, display: trimmed };
    }

    return { valid: false, message: "This field is not editable." };
}

// Compares two normalized values so the edit flow can detect real changes.
export function editableValuesEqual(a, b) {
    if (typeof a === "number" && typeof b === "number") {
        return a === b;
    }

    return String(a) === String(b);
}