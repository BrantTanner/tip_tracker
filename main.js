
const scriptURL = 'https://script.google.com/macros/s/AKfycbzXVb0LzBnNA-JUnBELG3AAKZdM3oelXbTbInH_Ls1f5XLemC_w8z7S29xp7PzYo7wD/exec';

document.getElementById('tipForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    fetch(scriptURL, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    .then(response => document.getElementById('status').innerText = "Submitted!")
    .catch(error => document.getElementById('status').innerText = "Error: " + error);
});




//Code to create display of spreadsheet on website
const dataURL = 'https://script.google.com/macros/s/AKfycbzXVb0LzBnNA-JUnBELG3AAKZdM3oelXbTbInH_Ls1f5XLemC_w8z7S29xp7PzYo7wD/exec'

fetch(dataURL)
.then(res => res.json())
.then(data => {
    const container = document.getElementById('dataDisplay');
    if (data.length === 0) {
        container.innerText = "No data yet.";
        return;
    }

    // Create a table
    let html = '<table border="1"><tr>';
    // Table headers
    Object.keys(data[0]).forEach(key => {
        html += `<th>${key}</th>`;
    });
    html += '</tr>';

    // Table rows
    data.forEach(row => {
        html += '<tr>';
        Object.values(row).forEach(value => {
            html += `<td>${value}</td>`;
        });
        html += '</tr>'
    });
    html += '</tr>';

    container.innerHTML = html;
})
.catch(err => {
    document.getElementById('dataDisplay').innerText = "Error loading data: " + err;

});
