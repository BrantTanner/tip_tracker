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

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
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

    let html = '<table border="1"><tr>';
    displayColumns.forEach((key) => {
        html += `<th>${headerLabels[key]}</th>`;
    });
    html += "</tr>";

    rows.forEach((row) => {
        html += "<tr>";
        displayColumns.forEach((key) => {
            let value = row[key];

            if (key === "created_at") {
                value = formatDateOnly(value);
            }

            if (key === "tips" && value !== null && value !== undefined && value !== "") {
                value = `$${Number(value).toFixed(2)}`;
            }

            html += `<td>${value ?? ""}</td>`;
        });
        html += "</tr>";
    });

    html += "</table>";
    dataDisplayEl.innerHTML = html;
}

async function loadTips() {
    if (!currentUser) {
        clearDataViews();
        return;
    }

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("tips, guests, tour, ship, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        dataDisplayEl.innerText = `Error loading data: ${error.message}`;
        return;
    }

    renderTable(data);
}

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
