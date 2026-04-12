import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace these with your Supabase project values from Settings > API.
const supabaseUrl = "https://gcvhadnymhofdymnxbps.supabase.co";
const supabaseAnonKey = "sb_publishable_7fXlNoZ8zuRcBbLvENgq0Q_rwe9kXh6";
const TABLE_NAME = "tips";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const form = document.getElementById("tipForm");
const statusEl = document.getElementById("status");
const authStatusEl = document.getElementById("authStatus");
const dataDisplayEl = document.getElementById("dataDisplay");
const loginBtn = document.getElementById("login");
const signupBtn = document.getElementById("signup");
const modalLoginBtn = document.getElementById("modalLogin");
const modalSignupBtn = document.getElementById("modalSignup");
const googleLoginBtn = document.getElementById("googleLogin");
const logoutBtn = document.getElementById("logout");
const closeAuthModalBtn = document.getElementById("closeAuthModal");
const authModalEl = document.getElementById("authModal");
const appContentEl = document.getElementById("appContent");
const loggedOutActionsEl = document.getElementById("loggedOutActions");
const loggedInActionsEl = document.getElementById("loggedInActions");
const emailInput = document.getElementById("authEmail");
const passwordInput = document.getElementById("authPassword");
const currentUserEl = document.getElementById("currentUser");

let currentUser = null;
const EDITABLE_FIELDS = new Set(["tips", "guests", "tour", "ship", "created_at"]);

function clearDataViews() {
    dataDisplayEl.innerText = "Log in to view your tips.";
}

function openAuthModal() {
    authModalEl.style.display = "flex";
}

function closeAuthModal() {
    authModalEl.style.display = "none";
}

function setAuthUi(user) {
    if (user) {
        const displayEmail = user.email ?? "your account";
        currentUserEl.innerText = `Logged in as: ${displayEmail}`;
        loggedOutActionsEl.style.display = "none";
        loggedInActionsEl.style.display = "block";
        closeAuthModal();
        authStatusEl.innerText = "";
        form.querySelectorAll("input, button").forEach((el) => {
            el.disabled = false;
        });
        logoutBtn.disabled = false;
    } else {
        currentUserEl.innerText = "";
        loggedOutActionsEl.style.display = "block";
        loggedInActionsEl.style.display = "none";
        closeAuthModal();
        form.querySelectorAll("input, button").forEach((el) => {
            el.disabled = true;
        });
        logoutBtn.disabled = true;
        clearDataViews();
    }
}

function getAuthInputValues() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        authStatusEl.innerText = "Enter email and password first.";
        return null;
    }

    return { email, password };
}

function formatDateOnly(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
            return match[1];
        }
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function deleteTipRow(id) {
    if (!currentUser) {
        authStatusEl.innerText = "Log in before deleting tips.";
        return;
    }

    const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

    if (error) {
        statusEl.innerText = `Error deleting row: ${error.message}`;
        return;
    }

    statusEl.innerText = "Row deleted.";
    await loadTips();
}

function parseEditableValue(field, rawValue) {
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

function editableValuesEqual(a, b) {
    if (typeof a === "number" && typeof b === "number") {
        return a === b;
    }

    return String(a) === String(b);
}

async function updateTipField(id, field, value) {
    if (!currentUser) {
        authStatusEl.innerText = "Log in before editing tips.";
        return { ok: false };
    }

    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ [field]: value })
        .eq("id", id)
        .eq("user_id", currentUser.id);

    if (error) {
        statusEl.innerText = `Error updating row: ${error.message}`;
        return { ok: false };
    }

    statusEl.innerText = "Row updated.";
    await loadTips();
    return { ok: true };
}

function setupHoverDeleteControl() {
    const wrapper = dataDisplayEl.querySelector(".tipsTableWrap");
    const table = wrapper?.querySelector(".tipsTable");
    const deleteBtn = wrapper?.querySelector(".hoverDeleteBtn");

    if (!wrapper || !table || !deleteBtn) {
        return;
    }

    function hideDeleteButton() {
        deleteBtn.hidden = true;
        deleteBtn.removeAttribute("data-row-id");
    }

    function positionDeleteButtonForRow(row) {
        const id = Number(row.dataset.rowId);
        if (!Number.isFinite(id)) {
            hideDeleteButton();
            return;
        }

        const wrapperRect = wrapper.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const top = rowRect.top - wrapperRect.top + rowRect.height / 2;

        deleteBtn.style.top = `${top}px`;
        deleteBtn.dataset.rowId = String(id);
        deleteBtn.hidden = false;
    }

    wrapper.addEventListener("mousemove", (event) => {
        if (event.target.closest(".hoverDeleteBtn")) {
            return;
        }

        const row = event.target.closest("tr[data-row-id]");
        if (row) {
            positionDeleteButtonForRow(row);
        }
    });

    wrapper.addEventListener("mouseleave", () => {
        hideDeleteButton();
    });

    deleteBtn.addEventListener("click", async () => {
        const id = Number(deleteBtn.dataset.rowId);
        if (!Number.isFinite(id)) {
            statusEl.innerText = "Unable to delete this row.";
            return;
        }

        await deleteTipRow(id);
        hideDeleteButton();
    });
}

function renderTable(rows) {
    if (!rows || rows.length === 0) {
        dataDisplayEl.innerText = "No data yet.";
        return;
    }

    const displayColumns = ["tips", "guests", "tour", "ship", "created_at"];
    const headerLabels = {
        tips: "Tips",
        guests: "Guests",
        tour: "Tour",
        ship: "Cruise Ship",
        created_at: "Date Submitted"
    };

    let html = '<div class="tipsTableWrap"><table class="tipsTable" border="1"><tr>';
    displayColumns.forEach((key) => {
        html += `<th>${headerLabels[key]}</th>`;
    });
    html += "</tr>";

    rows.forEach((row) => {
        html += `<tr data-row-id="${row.id}">`;
        displayColumns.forEach((key) => {
            let value = row[key];

            if (key === "created_at") {
                value = formatDateOnly(value);
            }

            if (key === "tips" && value !== null && value !== undefined && value !== "") {
                value = `$${Number(value).toFixed(2)}`;
            }

            if (EDITABLE_FIELDS.has(key)) {
                html += `<td class="editableCell" data-field="${key}" contenteditable="true" spellcheck="false">${value ?? ""}</td>`;
            } else {
                html += `<td>${value ?? ""}</td>`;
            }
        });
        html += "</tr>";
    });

    html += '</table><button type="button" class="hoverDeleteBtn" aria-label="Delete row" hidden>&times;</button></div>';
    dataDisplayEl.innerHTML = html;
    setupHoverDeleteControl();
}

async function loadTips() {
    if (!currentUser) {
        clearDataViews();
        return;
    }

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("id, tips, guests, tour, ship, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

    if (error) {
        dataDisplayEl.innerText = `Error loading data: ${error.message}`;
        return;
    }

    renderTable(data);
}

dataDisplayEl.addEventListener("focusin", (event) => {
    const cell = event.target.closest(".editableCell");
    if (!cell) {
        return;
    }

    cell.dataset.previousValue = cell.innerText.trim();
});

dataDisplayEl.addEventListener("keydown", (event) => {
    const cell = event.target.closest(".editableCell");
    if (!cell) {
        return;
    }

    if (event.key === "Enter") {
        event.preventDefault();
        cell.blur();
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        cell.innerText = cell.dataset.previousValue ?? "";
        cell.blur();
    }
});

dataDisplayEl.addEventListener("focusout", async (event) => {
    const cell = event.target.closest(".editableCell");
    if (!cell) {
        return;
    }

    const rowEl = cell.closest("tr[data-row-id]");
    const rowId = Number(rowEl?.dataset?.rowId);
    const field = cell.dataset.field;
    const beforeRaw = cell.dataset.previousValue ?? "";
    const afterRaw = cell.innerText.trim();

    if (!field || !Number.isFinite(rowId)) {
        statusEl.innerText = "Unable to update this cell.";
        return;
    }

    const parsedBefore = parseEditableValue(field, beforeRaw);
    const parsedAfter = parseEditableValue(field, afterRaw);

    if (!parsedAfter.valid) {
        statusEl.innerText = parsedAfter.message;
        cell.innerText = beforeRaw;
        return;
    }

    if (parsedBefore.valid && editableValuesEqual(parsedBefore.value, parsedAfter.value)) {
        cell.innerText = parsedAfter.display;
        return;
    }

    const result = await updateTipField(rowId, field, parsedAfter.value);
    if (!result.ok) {
        cell.innerText = beforeRaw;
        return;
    }
});

form.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentUser) {
        authStatusEl.innerText = "Log in before submitting tips.";
        return;
    }

    statusEl.innerText = "Submitting...";

    const formData = new FormData(this);
    const data = {
        tips: Number(formData.get("tips")),
        guests: Number(formData.get("guests")),
        tour: formData.get("tour"),
        ship: formData.get("ship"),
        user_id: currentUser.id
    };

    const { error } = await supabase.from(TABLE_NAME).insert([data]);

    if (error) {
        statusEl.innerText = `Error: ${error.message}`;
        return;
    }

    statusEl.innerText = "Submitted!";
    form.reset();
    await loadTips();
});

loginBtn.addEventListener("click", () => {
    authStatusEl.innerText = "";
    openAuthModal();
});

signupBtn.addEventListener("click", () => {
    authStatusEl.innerText = "";
    openAuthModal();
});

closeAuthModalBtn.addEventListener("click", () => {
    closeAuthModal();
});

modalLoginBtn.addEventListener("click", async () => {
    const values = getAuthInputValues();
    if (!values) {
        return;
    }

    authStatusEl.innerText = "Logging in...";
    const { error } = await supabase.auth.signInWithPassword(values);

    if (error) {
        authStatusEl.innerText = `Login failed: ${error.message}`;
        return;
    }

    authStatusEl.innerText = "Logged in.";
});

modalSignupBtn.addEventListener("click", async () => {
    const values = getAuthInputValues();
    if (!values) {
        return;
    }

    authStatusEl.innerText = "Creating account...";
    const { error } = await supabase.auth.signUp(values);

    if (error) {
        authStatusEl.innerText = `Sign up failed: ${error.message}`;
        return;
    }

    authStatusEl.innerText = "Account created. If email confirmation is enabled, confirm your email before login.";
});

googleLoginBtn.addEventListener("click", async () => {
    authStatusEl.innerText = "Redirecting to Google...";

    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) {
        authStatusEl.innerText = `Google login failed: ${error.message}`;
    }
});

logoutBtn.addEventListener("click", async () => {
    authStatusEl.innerText = "Logging out...";

    currentUser = null;
    setAuthUi(null);
    statusEl.innerText = "";
    emailInput.value = "";
    passwordInput.value = "";
    authStatusEl.innerText = "Logged out.";

    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
        authStatusEl.innerText = `Logged out locally. Session cleanup warning: ${error.message}`;
    }
});

supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    setAuthUi(currentUser);

    if (currentUser) {
        await loadTips();
    }
});

async function initializeAuth() {
    const {
        data: { session }
    } = await supabase.auth.getSession();

    currentUser = session?.user ?? null;
    setAuthUi(currentUser);

    if (currentUser) {
        await loadTips();
    }
}

initializeAuth();
