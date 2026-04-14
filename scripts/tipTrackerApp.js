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
    const openTipModalBtn = document.getElementById("openTipModal");
    const closeTipModalBtn = document.getElementById("closeTipModal");
    const tipModalEl = document.getElementById("tipModal");
    const removeTipsBtn = document.getElementById("removeTipsBtn");
    const graphSectionEl = document.getElementById("graphSection");
    const tableControlsEl = document.getElementById("tableControls");
    const loggedOutPromptEl = document.getElementById("loggedOutPrompt");
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
    let isRemoveMode = false;
    let selectedRowIds = new Set();

    const EDITABLE_FIELDS = new Set(["tips", "guests", "tour", "ship", "created_at"]);

    function setAuthStatus(message) {
        if (authStatusEl) {
            authStatusEl.innerText = message;
        }
    }

    // Clears the display when no data should be shown yet.
    function clearDataViews() {
        currentRows = [];
        dataDisplayEl.innerText = "";
    }

    // Opens the auth dialog so the user can log in or create an account.
    function openAuthModal() {
        authModalEl.style.display = "flex";
    }

    // Closes the auth dialog without changing any auth state.
    function closeAuthModal() {
        authModalEl.style.display = "none";
    }

    // Opens the tip input dialog for adding a new row.
    function openTipModal() {
        tipModalEl.style.display = "flex";
    }

    // Closes the tip input dialog.
    function closeTipModal() {
        tipModalEl.style.display = "none";
    }

    // Tries to infer a friendly first name from the email local-part.
    function getDisplayFirstNameFromEmail(email) {
        if (!email || typeof email !== "string") {
            return "there";
        }

        const localPart = email.split("@")[0] ?? "";
        const firstToken = localPart.split(/[._-]+/)[0]?.trim();

        if (!firstToken) {
            return "there";
        }

        return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
    }

    // Uses Google profile metadata when available, then falls back to email parsing.
    function getDisplayFirstName(user) {
        const metadata = user?.user_metadata ?? {};
        const givenName = metadata.given_name;

        if (typeof givenName === "string" && givenName.trim()) {
            return givenName.trim();
        }

        const fullName = metadata.full_name ?? metadata.name;
        if (typeof fullName === "string" && fullName.trim()) {
            return fullName.trim().split(/\s+/)[0];
        }

        return getDisplayFirstNameFromEmail(user?.email);
    }

    // Updates the visible auth controls so the page matches the current session.
    function setAuthUi(user) {
        if (user) {
            const firstName = getDisplayFirstName(user);
            currentUserEl.innerText = `Hi, ${firstName}`;
            loggedOutActionsEl.style.display = "none";
            loggedInActionsEl.style.display = "flex";
            if (loggedOutPromptEl) loggedOutPromptEl.hidden = true;
            if (graphSectionEl) graphSectionEl.hidden = false;
            if (tableControlsEl) tableControlsEl.hidden = false;
            if (statusEl) statusEl.hidden = false;
            if (dataDisplayEl) dataDisplayEl.hidden = false;
            closeAuthModal();
            setAuthStatus("");
            form.querySelectorAll("input, button").forEach((el) => {
                el.disabled = false;
            });
            logoutBtn.disabled = false;
        } else {
            currentUserEl.innerText = "";
            loggedOutActionsEl.style.display = "block";
            loggedInActionsEl.style.display = "none";
            if (loggedOutPromptEl) loggedOutPromptEl.hidden = false;
            if (graphSectionEl) graphSectionEl.hidden = true;
            if (tableControlsEl) tableControlsEl.hidden = true;
            if (statusEl) statusEl.hidden = true;
            if (dataDisplayEl) dataDisplayEl.hidden = true;
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
            setAuthStatus("Enter email and password first.");
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

    // Deletes many tip rows for the signed-in user.
    async function deleteTipRows(ids) {
        if (!currentUser) {
            setAuthStatus("Log in before deleting tips.");
            return false;
        }

        if (!ids || ids.length === 0) {
            statusEl.innerText = "Select at least one row to remove.";
            return false;
        }

        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .in("id", ids)
            .eq("user_id", currentUser.id);

        if (error) {
            statusEl.innerText = `Error deleting rows: ${error.message}`;
            return false;
        }

        statusEl.innerText = `${ids.length} row(s) deleted.`;
        return true;
    }

    // Updates button text and table alignment for remove mode.
    function updateRemoveModeUi() {
        if (removeTipsBtn) {
            removeTipsBtn.innerText = isRemoveMode ? "Delete Selected" : "Remove";
            removeTipsBtn.classList.toggle("active", isRemoveMode);
        }

        const isMobile = window.matchMedia("(max-width: 699px)").matches;
        dataDisplayEl.classList.toggle("mobileCentered", isMobile && !isRemoveMode);
    }

    // Enables or disables remove mode and refreshes the current table view.
    function setRemoveMode(active) {
        isRemoveMode = active;

        if (!active) {
            selectedRowIds = new Set();
        }

        updateRemoveModeUi();
        renderTable(getSortedRows(currentRows, currentSortField, currentSortDirection));
    }

    // Sends a single inline edit to Supabase after the user changes a cell.
    async function updateTipField(id, field, value) {
        if (!currentUser) {
            setAuthStatus("Log in before editing tips.");
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

    // Renders the current rows into HTML and reattaches the table-specific behaviors.
    function renderTable(rows) {
        if (!rows || rows.length === 0) {
            dataDisplayEl.innerText = "No data yet.";
            updateRemoveModeUi();
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
            editableFields: isRemoveMode ? new Set() : EDITABLE_FIELDS,
            headerLabels,
            removeMode: isRemoveMode,
            selectedRowIds
        });
        updateRemoveModeUi();
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
        if (isRemoveMode) {
            return;
        }

        const cell = event.target.closest(".editableCell");
        if (!cell) {
            return;
        }

        cell.dataset.previousValue = cell.innerText.trim();
    });

    // Handles keyboard shortcuts for inline editing, including submit and cancel.
    dataDisplayEl.addEventListener("keydown", (event) => {
        if (isRemoveMode) {
            return;
        }

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
        if (isRemoveMode) {
            return;
        }

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

    // Tracks selected rows while remove mode is active.
    dataDisplayEl.addEventListener("change", (event) => {
        const checkbox = event.target.closest(".rowDeleteCheckbox");
        if (!checkbox) {
            return;
        }

        const rowId = Number(checkbox.dataset.rowId);
        if (!Number.isFinite(rowId)) {
            return;
        }

        if (checkbox.checked) {
            selectedRowIds.add(rowId);
        } else {
            selectedRowIds.delete(rowId);
        }
    });

    // Submits a new tip row for the signed-in user.
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        if (!currentUser) {
            setAuthStatus("Log in before submitting tips.");
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

        // Close and clear immediately so the next add starts fresh.
        form.reset();
        closeTipModal();

        const { error } = await supabase.from(TABLE_NAME).insert([data]);

        if (error) {
            statusEl.innerText = `Error: ${error.message}`;
            return;
        }

        statusEl.innerText = "Submitted!";
        await loadTips();
    });

    // Opens the tip modal from the add-tour button near table controls.
    openTipModalBtn?.addEventListener("click", () => {
        if (!currentUser) {
            setAuthStatus("Log in before adding tips.");
            return;
        }

        openTipModal();
    });

    // Closes the tip modal without submitting.
    closeTipModalBtn?.addEventListener("click", () => {
        closeTipModal();
    });

    // First tap enters remove mode, second tap deletes checked rows.
    removeTipsBtn?.addEventListener("click", async () => {
        if (!currentUser) {
            setAuthStatus("Log in before deleting tips.");
            return;
        }

        if (!isRemoveMode) {
            setRemoveMode(true);
            statusEl.innerText = "Select rows to remove, then tap Delete Selected.";
            return;
        }

        const idsToDelete = Array.from(selectedRowIds);
        const didDelete = await deleteTipRows(idsToDelete);
        if (!didDelete) {
            return;
        }

        setRemoveMode(false);
        await loadTips();
    });

    // Opens the auth modal from the login button in the header.
    loginBtn.addEventListener("click", () => {
        setAuthStatus("");
        openAuthModal();
    });

    // Opens the auth modal from the sign-up button in the header.
    signupBtn.addEventListener("click", () => {
        setAuthStatus("");
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

        setAuthStatus("Logging in...");
        const { error } = await supabase.auth.signInWithPassword(values);

        if (error) {
            setAuthStatus(`Login failed: ${error.message}`);
            return;
        }

        setAuthStatus("Logged in.");
    });

    // Creates a new account from the auth dialog.
    modalSignupBtn.addEventListener("click", async () => {
        const values = getAuthInputValues();
        if (!values) {
            return;
        }

        setAuthStatus("Creating account...");
        const { error } = await supabase.auth.signUp(values);

        if (error) {
            setAuthStatus(`Sign up failed: ${error.message}`);
            return;
        }

        setAuthStatus("Account created. If email confirmation is enabled, confirm your email before login.");
    });

    // Starts the OAuth flow for Google sign-in.
    googleLoginBtn.addEventListener("click", async () => {
        setAuthStatus("Redirecting to Google...");

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            setAuthStatus(`Google login failed: ${error.message}`);
        }
    });

    // Signs the current user out locally and resets the visible state.
    logoutBtn.addEventListener("click", async () => {
        setAuthStatus("Logging out...");

        currentUser = null;
        setAuthUi(null);
        statusEl.innerText = "";
        emailInput.value = "";
        passwordInput.value = "";
        setAuthStatus("Logged out.");

        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) {
            setAuthStatus(`Logged out locally. Session cleanup warning: ${error.message}`);
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

        if (!currentUser) {
            setRemoveMode(false);
        }

        if (currentUser) {
            await loadTips();
        }
    });

    // Handles the filter button toggle for mobile view.
    const filterBtn = document.getElementById("filterBtn");
    const filterOptions = document.getElementById("filterOptions");
    const orderBtn = document.getElementById("orderBtn");
    const orderOptions = document.getElementById("orderOptions");

    if (filterBtn && filterOptions) {
        filterBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            filterOptions.classList.toggle("open");
            orderOptions.classList.remove("open");
        });
    }

    if (orderBtn && orderOptions) {
        orderBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            orderOptions.classList.toggle("open");
            filterOptions.classList.remove("open");
        });
    }

    // Close any open dropdown when clicking outside.
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".controlGroup")) {
            if (filterOptions) filterOptions.classList.remove("open");
            if (orderOptions) orderOptions.classList.remove("open");
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

        updateRemoveModeUi();
    }

    window.addEventListener("resize", updateRemoveModeUi);

    initializeAuth();
}
