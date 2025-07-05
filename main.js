import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB5sdq67xFYUvxrdWx3nNpjg2BH_-QOqx8",
  authDomain: "tip-tracker-b08ca.firebaseapp.com",
  projectId: "tip-tracker-b08ca",
  storageBucket: "tip-tracker-b08ca.firebasestorage.app",
  messagingSenderId: "1008683412353",
  appId: "1:1008683412353:web:7eab17177929449bf8d680",
  measurementId: "G-Q4VE849YYV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Submit a new tip
export async function submitTip() {
  const tips = document.getElementById("tips").value;
  const guests = document.getElementById("guests").value;
  const tour = document.getElementById("tour").value;
  const ship = document.getElementById("ship").value;

  await addDoc(collection(db, "tips"), {
    tips: parseFloat(tips),
    guests: parseInt(guests),
    tour: tour,
    ship: ship,
    date: new Date().toISOString()
  });

  alert("Tip submitted!");
  displayTips();
}

// Display all tips
export async function displayTips() {
    // Inject table into container
    const container = document.getElementById("dataDisplay");
    container.innerHTML = "<table id='tipTable' border='1'><tr><th>Date</th><th>Tour</th><th>Cruise Ship</th><th>Guests</th><th>Tips</th></tr></table>";
    const table = document.getElementById(tipTable)

    // Get data from Firestore
    const snapshot = await getDocs(collection(db, "tips"));

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