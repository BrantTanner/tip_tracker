// Table rendering is isolated so the markup and date formatting are easy to scan.
// This helper normalizes date strings so the table shows a consistent day format.
export function formatDateOnly(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
            const [year, month, day] = match[1].split("-");
            return `${month}-${day}-${year}`;
        }
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${month}-${day}-${year}`;
}

// Builds the table HTML for the current rows, including optional remove-mode checkboxes.
export function buildTipTableHtml(rows, { editableFields, headerLabels, removeMode = false, selectedRowIds = new Set() }) {
    const displayColumns = ["tips", "guests", "tour", "ship", "created_at"];
    let html = '<div class="tipsTableWrap"><table class="tipsTable"><tr>';

    if (removeMode) {
        html += '<th class="selectCol">Select</th>';
    }

    displayColumns.forEach((key) => {
        html += `<th>${headerLabels[key]}</th>`;
    });

    html += "</tr>";

    rows.forEach((row) => {
        html += `<tr data-row-id="${row.id}">`;

        if (removeMode) {
            const isChecked = selectedRowIds.has(row.id) ? "checked" : "";
            html += `<td class="selectCell"><input type="checkbox" class="rowDeleteCheckbox" data-row-id="${row.id}" ${isChecked} /></td>`;
        }

        displayColumns.forEach((key) => {
            let value = row[key];

            if (key === "created_at") {
                value = formatDateOnly(value);
            }

            if (key === "tips" && value !== null && value !== undefined && value !== "") {
                value = `$${Number(value).toFixed(2)}`;
            }

            if (editableFields.has(key)) {
                if (key === "created_at") {
                    let isoDate = "";
                    if (typeof row.created_at === "string" && row.created_at.length >= 10) {
                        isoDate = row.created_at.slice(0, 10);
                    } else {
                        const d = new Date(row.created_at);
                        if (!Number.isNaN(d.getTime())) {
                            isoDate = d.toISOString().slice(0, 10);
                        }
                    }

                    html += `<td class="editableCell editableDateCell" data-field="created_at" data-date-value="${isoDate}" tabindex="0">${value ?? ""}</td>`;
                } else {
                    html += `<td class="editableCell" data-field="${key}" contenteditable="true" spellcheck="false">${value ?? ""}</td>`;
                }
            } else {
                html += `<td>${value ?? ""}</td>`;
            }
        });

        html += "</tr>";
    });

    html += "</table></div>";
    return html;
}