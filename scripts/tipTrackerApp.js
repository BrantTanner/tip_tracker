import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { editableValuesEqual, parseEditableValue } from "./editable-fields.js";
import {
    getDefaultSortDirection,
    getSortDirectionLabel,
    getSortedRows,
    SORT_FIELD_LABELS
} from "./sort.js";
import { buildTipTableHtml } from "./table.js";

// Keep credentials and table access in one place so the app wiring stays thin.
const supabaseUrl = "https://gcvhadnymhofdymnxbps.supabase.co";
const supabaseAnonKey = "sb_publishable_7fXlNoZ8zuRcBbLvENgq0Q_rwe9kXh6";
const TABLE_NAME = "tips";

// Bootstraps the full tip tracker experience after the page loads.
export function initializeTipTrackerApp() {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Cache the DOM once so the rest of the app works with direct references.
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
    const sortBySelect = document.getElementById("sortBy");
    const sortDirectionSelect = document.getElementById("sortDirectionSelect");
    const loggedOutActionsEl = document.getElementById("loggedOutActions");
    const loggedInActionsEl = document.getElementById("loggedInActions");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const currentUserEl = document.getElementById("currentUser");

    let currentUser = null;
    let currentRows = [];
    let currentSortField = sortBySelect?.value || "created_at";
    let currentSortDirection = getDefaultSortDirection(currentSortField);

    const EDITABLE_FIELDS = new Set(["tips", "guests", "tour", "ship", "created_at"]);

    // Clears the display when no data should be shown yet.
    function clearDataViews() {
        currentRows = [];
        dataDisplayEl.innerText = "Log in to view your tips.";
    }

    // Opens the auth dialog so the user can log in or create an account.
    function openAuthModal() {
        authModalEl.style.display = "flex";
    }

    // Closes the auth dialog without changing any auth state.
    function closeAuthModal() {
        authModalEl.style.display = "none";
    }

    // Updates the visible auth controls so the page matches the current session.
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

    // Reads and validates the email/password form before auth calls are made.
    function getAuthInputValues() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            authStatusEl.innerText = "Enter email and password first.";
            return null;
        }

        return { email, password };
    }

    // Keeps the direction dropdown text in sync with the selected sort field.
    function updateSortDirectionSelect() {
        if (!sortDirectionSelect) {
            return;
        }

        const ascendingOption = sortDirectionSelect.querySelector('option[value="asc"]');
        const descendingOption = sortDirectionSelect.querySelector('option[value="desc"]');

        if (descendingOption) {
            descendingOption.textContent = getSortDirectionLabel(currentSortField, "desc");
        }

        if (ascendingOption) {
            ascendingOption.textContent = getSortDirectionLabel(currentSortField, "asc");
        }

        sortDirectionSelect.value = currentSortDirection;
    }

    // Applies a new sort field and resets the direction to that field's default order.
    function setSortField(field, direction = getDefaultSortDirection(field)) {
        currentSortField = field;
        currentSortDirection = direction;

        if (sortBySelect && sortBySelect.value !== field) {
            sortBySelect.value = field;
        }

        updateSortDirectionSelect();
    }

    // Deletes a tip row for the signed-in user and reloads the table afterwards.
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

    // Sends a single inline edit to Supabase after the user changes a cell.
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

    // Watches the rendered table so the hover delete button tracks the row under the pointer.
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

    // Renders the current rows into HTML and reattaches the table-specific behaviors.
    function renderTable(rows) {
        if (!rows || rows.length === 0) {
            dataDisplayEl.innerText = "No data yet.";
            return;
        }

        const headerLabels = {
            tips: SORT_FIELD_LABELS.tips,
            guests: SORT_FIELD_LABELS.guests,
            tour: SORT_FIELD_LABELS.tour,
            ship: SORT_FIELD_LABELS.ship,
            created_at: "Date Submitted"
        };

        dataDisplayEl.innerHTML = buildTipTableHtml(rows, {
            editableFields: EDITABLE_FIELDS,
            headerLabels
        });

        setupHoverDeleteControl();
    }

    // Loads the current user's rows from Supabase and renders them in the active sort order.
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

        currentRows = data ?? [];
        renderTable(getSortedRows(currentRows, currentSortField, currentSortDirection));
    }

    // Stores the original text when a cell gains focus so edits can be compared later.
    dataDisplayEl.addEventListener("focusin", (event) => {
        const cell = event.target.closest(".editableCell");
        if (!cell) {
            return;
        }

        cell.dataset.previousValue = cell.innerText.trim();
    });

    // Handles keyboard shortcuts for inline editing, including submit and cancel.
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

    // Validates the final cell value and pushes the update to the database if needed.
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

    // Submits a new tip row for the signed-in user.
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

    // Opens the auth modal from the login button in the header.
    loginBtn.addEventListener("click", () => {
        authStatusEl.innerText = "";
        openAuthModal();
    });

    // Opens the auth modal from the sign-up button in the header.
    signupBtn.addEventListener("click", () => {
        authStatusEl.innerText = "";
        openAuthModal();
    });

    // Closes the auth dialog without logging the user out.
    closeAuthModalBtn.addEventListener("click", () => {
        closeAuthModal();
    });

    // Handles password login from the auth dialog.
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

    // Creates a new account from the auth dialog.
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

    // Starts the OAuth flow for Google sign-in.
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

    // Signs the current user out locally and resets the visible state.
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

    // Changes the active sort field and reapplies the current table order.
    sortBySelect?.addEventListener("change", () => {
        if (!currentUser) {
            return;
        }

        setSortField(sortBySelect.value);
        renderTable(getSortedRows(currentRows, currentSortField, currentSortDirection));
    });

    // Flips the direction dropdown for the current field and rerenders the table.
    sortDirectionSelect?.addEventListener("change", () => {
        if (!currentUser) {
            return;
        }

        currentSortDirection = sortDirectionSelect.value;
        renderTable(getSortedRows(currentRows, currentSortField, currentSortDirection));
    });

    // Keeps the UI in sync with Supabase auth state changes from other tabs or refreshes.
    supabase.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user ?? null;
        setAuthUi(currentUser);

        if (currentUser) {
            await loadTips();
        }
    });

    // Pulls the current session on page load so the UI starts in the right state.
    async function initializeAuth() {
        const {
            data: { session }
        } = await supabase.auth.getSession();

        currentUser = session?.user ?? null;
        setAuthUi(currentUser);
        setSortField(sortBySelect?.value || "created_at");

        if (currentUser) {
            await loadTips();
        }
    }

    initializeAuth();
}