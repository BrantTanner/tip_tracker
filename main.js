import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyB5sdq67xFYUvxrdWx3nNpjg2BH_-QOqx8",
    authDomain: "tip-tracker-b08ca.firebaseapp.com",
    projectId: "tip-tracker-b08ca",
    storageBucket: "tip-tracker-b08ca.appspot.com",
    messagingSenderId: "1008683412353",
    appId: "1:1008683412353:web:7eab17177929449bf8d680",
    measurementId: "G-Q4VE849YYV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app)

// Sign up
document.getElementById('signup-btn').addEventListener('click', async () => {
    const form = document.getElementById('signup-form');
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        alert("Sign-up successful!")
        form.reset();
    }   catch (error) {
        alert(error.message)
        form.reset();
    }
});

// Log in
document.getElementById('login-btn').addEventListener('click', async () => {
    const form = document.getElementById('login-form');
    const passwordInput = document.getElementById('login-password');
    const email = document.getElementById('login-email').value;
    const password = passwordInput.value;

    try{
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        alert("Login successful!");
        document.getElementById('login-form').reset();
    }   catch (error) {
        alert(error.message)
        passwordInput.value = "";
    }
});

// Track logged in user
onAuthStateChanged(auth, user => {
    if (user) {
        console.log("User logged in:", user.uid);
        displayTips(); // <- load inputted tips
    }   else {
        console.log("User logged out");
        displayTips(); // <- clear or show "log in" message
    }
});

// Log out
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => alert("Logged out"));
});

// Submit a new tip
export async function submitTip() {
    console.log("submitTip function triggered")
    
    const user = auth.currentUser;

    if (!user) {
        alert("You must be logged in to submit a tip")
        return;
    }

    const tips = document.getElementById("tips").value;
    const guests = document.getElementById("guests").value;
    const tour = document.getElementById("tour").value;
    const ship = document.getElementById("ship").value;


    // save to user's subcollection
    await addDoc(collection(db, "users", user.uid, "tips"), {
        tips: parseFloat(tips),
        guests: parseInt(guests),
        tour: tour,
        ship: ship,
        date: new Date().toISOString()
    });

    alert("Tip submitted!");
    displayTips();
    document.getElementById("tipForm").reset();
}

// Display all tips
export async function displayTips() {
    // Inject table into container
    const container = document.getElementById("dataDisplay");
    container.innerHTML = "<table id='tipTable' border='1'><tr><th>Date</th><th>Tour</th><th>Cruise Ship</th><th>Guests</th><th>Tips</th></tr></table>";
    const table = document.getElementById("tipTable")

    const user = auth.currentUser;

    if (!user) {
        table.innerHTML += `<tr><td colspan="5">Please log in to view your tips.</td></tr>`;
        return;
    }

    // Get data from Firestore
    const snapshot = await getDocs(collection(db, "users", user.uid, "tips"));

    // Add each row to table
    snapshot.forEach((doc) => {
        const data = doc.data();
        table.innerHTML += `
            <tr>
            <td>${new Date(data.date).toLocaleDateString()}</td>
            <td>${data.tour}</td>
            <td>${data.ship}</td>
            <td>${data.guests}</td>
            <td>$${data.tips.toFixed(2)}</td>
            </tr>`;
    });
}

// Make functions accessible to HTML
window.submitTip = submitTip;
window.displayTips = displayTips;

// Load tips on page load
window.onload = displayTips;

// Attach submit event listener to the form
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("tipForm");
        form.addEventListener("submit", (event) => {
        event.preventDefault(); // prevent page refresh
    submitTip(); // call your Firestore logic
    });
});