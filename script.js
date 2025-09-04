/* ======================
   Global Variables & Local Storage Keys
   ====================== */
const LS_COMPLETED_KEY  = 'weekly_report_completed_v9'; // Version bump for new data structure
const LS_ONGOING_KEY    = 'weekly_report_ongoing_v9';
const LS_NOTES_KEY      = 'weekly_report_notes_v9';
const LS_DATE_RANGE_KEY = 'weekly_report_dateRange_v9';
const HOURLY_RATE = 25; // The rate for calculating actual price
let confirmCallback = null;

/* ======================
   Date & Calculation Helper Functions
   ====================== */
function parseLocalDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
function formatDate(dateObj) {
  if (!dateObj || isNaN(dateObj)) return '';
  const year = dateObj.getUTCFullYear();
  const month = ('0' + (dateObj.getUTCMonth() + 1)).slice(-2);
  const day = ('0' + dateObj.getUTCDate()).slice(-2);
  return `${month}/${day}/${year}`;
}
function formatDateStringForInput(dateString) {
    if (!dateString) return '';
    const d = parseLocalDate(dateString);
    if (!d) return '';
    const year = d.getUTCFullYear();
    const month = ('0' + (d.getUTCMonth() + 1)).slice(-2);
    const day = ('0' + d.getUTCDate()).slice(-2);
    return `${year}-${month}-${day}`;
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
function calculateOverUnder(bid, actual) {
  const b = parseFloat(bid);
  const a = parseFloat(actual);
  if (isNaN(b) || isNaN(a) || b === 0) return { text: 'N/A', className: '' };
  
  const diff = ((a - b) / b) * 100;
  const txt = diff.toFixed(1) + '%';
  
  if (diff > 0) return { text: `+${txt}`, className: 'text-loss' }; // Renamed class
  if (diff < 0) return { text: txt, className: 'text-gain' }; // Renamed class
  return { text: '0.0%', className: '' };
}
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/* ======================
   Primary Data Rendering
   ====================== */
function renderAllTables() {
    renderCompletedTable();
    renderOngoingTable();
    updateStats();
}

function renderCompletedTable() {
    const data = JSON.parse(localStorage.getItem(LS_COMPLETED_KEY) || '[]');
    const tbody = document.querySelector('#completedTable tbody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="3">No completed inspections have been added.</td></tr>`;
        return;
    }
    data.forEach(item => {
        let mainRow = tbody.insertRow();
        mainRow.dataset.id = item.id;

        let infoCell = mainRow.insertCell();
        infoCell.classList.add('completed-info-cell');
        
        const deficienciesClass = parseInt(item.deficiencies) > 0 ? 'has-deficiencies' : '';
        infoCell.innerHTML = `
            <p><strong>Project #:</strong> ${escapeHTML(item.projectNumber)}</p>
            <p><strong>Site Name:</strong> ${escapeHTML(item.siteName)}</p>
            <p><strong>Date Completed:</strong> ${formatDate(parseLocalDate(item.dateCompleted))}</p>
            <p><strong>Deficiencies:</strong> <span class="${deficienciesClass}">${escapeHTML(item.deficiencies)}</span></p>
            <p><strong>Report Sent:</strong> ${escapeHTML(item.reportSent || 'No')}</p>
        `;

        let historyCell = mainRow.insertCell();
        historyCell.classList.add('completed-history-cell');
        historyCell.innerHTML = generateHistoryTableHTML(item.hoursHistory);

        let actionsCell = mainRow.insertCell();
        actionsCell.classList.add("no-pdf");
        actionsCell.innerHTML = `
            <button class="btn-secondary" onclick="openEditCompleted('${item.id}')" style="margin-bottom: 5px; width: 100%;">Edit</button>
            <button class="btn-danger" onclick="deleteItem(LS_COMPLETED_KEY, '${item.id}')" style="width: 100%;">Delete</button>
        `;

        if (item.discrepancies) {
            let discrepanciesRow = tbody.insertRow();
            discrepanciesRow.classList.add("notes-row");
            let cell = discrepanciesRow.insertCell();
            cell.colSpan = 3;
            cell.innerHTML = `<strong>Discrepancies:</strong><br>${escapeHTML(item.discrepancies)}`;
        }

        if (item.notes) {
            let notesRow = tbody.insertRow();
            notesRow.classList.add("notes-row");
            let cell = notesRow.insertCell();
            cell.colSpan = 3;
            cell.innerHTML = `<strong>Notes:</strong><br>${escapeHTML(item.notes)}`;
        }
    });
}

function generateHistoryTableHTML(history) {
    if (!history || history.length === 0) return `<p style="text-align:center; color:${'var(--text-color-light)'};">No hour history recorded.</p>`;
    
    let table = '<table class="history-table"><thead><tr><th>Year</th><th>Bid Hrs</th><th>Actual Hrs</th><th>+/- %</th><th>Bid Price</th><th>Actual Price</th><th>Gain/Loss</th></tr></thead><tbody>';
    
    [...history].sort((a,b) => b.year - a.year).forEach(h => {
        const ou = calculateOverUnder(h.bid, h.actual);
        const bidPrice = parseFloat(h.bidPrice) || 0;
        const actualPrice = (parseFloat(h.actual) || 0) * HOURLY_RATE;
        const profitLoss = bidPrice - actualPrice;
        const profitLossClass = profitLoss >= 0 ? 'text-gain' : 'text-loss';
        
        table += `<tr>
                    <td>${escapeHTML(h.year)}</td>
                    <td>${escapeHTML(h.bid)}</td>
                    <td>${escapeHTML(h.actual)}</td>
                    <td class="${ou.className}">${ou.text}</td>
                    <td>${formatCurrency(bidPrice)}</td>
                    <td>${formatCurrency(actualPrice)}</td>
                    <td class="${profitLossClass}">${formatCurrency(profitLoss)}</td>
                  </tr>`;
    });
    table += '</tbody></table>';
    return table;
}

function renderOngoingTable() {
    const data = JSON.parse(localStorage.getItem(LS_ONGOING_KEY) || '[]');
    const tbody = document.querySelector('#ongoingTable tbody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No ongoing inspections have been added.</td></tr>`;
        return;
    }
    data.forEach(item => {
        const overUnder = calculateOverUnder(item.bidHours, item.hoursWorked);

        let mainRow = tbody.insertRow();
        mainRow.dataset.id = item.id;

        mainRow.insertCell().textContent = item.projectNumber;
        mainRow.insertCell().textContent = item.siteName;
        mainRow.insertCell().textContent = formatDate(parseLocalDate(item.startDate));
        mainRow.insertCell().textContent = item.bidHours;
        mainRow.insertCell().textContent = item.hoursWorked;
        let ouCell = mainRow.insertCell();
        ouCell.textContent = overUnder.text;
        ouCell.className = overUnder.className;
        mainRow.insertCell().textContent = formatDate(parseLocalDate(item.estCompletion));

        let actionsCell = mainRow.insertCell();
        actionsCell.classList.add("no-pdf");
        actionsCell.innerHTML = `
            <button class="btn-secondary" onclick="openEditOngoing('${item.id}')" style="margin-bottom: 5px; width:100%">Edit</button>
            <button class="btn-danger" onclick="deleteItem(LS_ONGOING_KEY, '${item.id}')" style="width:100%">Delete</button>
        `;
         if (item.notes) {
            let notesRow = tbody.insertRow();
            notesRow.classList.add("notes-row");
            let notesCell = notesRow.insertCell();
            notesCell.colSpan = mainRow.cells.length;
            notesCell.innerHTML = `<strong>Notes:</strong><br>${escapeHTML(item.notes)}`;
        }
    });
}

/* ======================
   Statistics & UI Updates
   ====================== */
function updateStats() {
  const completedData = JSON.parse(localStorage.getItem(LS_COMPLETED_KEY) || '[]');
  document.getElementById('totalCompletedCount').textContent = completedData.length;

  let totalBidHours = 0, totalActualHours = 0, totalBidPrice = 0, totalActualPrice = 0;

  completedData.forEach(item => {
    if(item.hoursHistory && item.hoursHistory.length > 0){
        // FIX #1: Only use the most recent year's data for the summary totals.
        // Find the entry with the highest (most recent) year.
        const latestEntry = item.hoursHistory.reduce((latest, current) => {
            return parseInt(current.year) > parseInt(latest.year) ? current : latest;
        });
        
        totalBidHours += parseFloat(latestEntry.bid) || 0;
        totalActualHours += parseFloat(latestEntry.actual) || 0;
        totalBidPrice += parseFloat(latestEntry.bidPrice) || 0;
        totalActualPrice += (parseFloat(latestEntry.actual) || 0) * HOURLY_RATE;
    }
  });

  document.getElementById('totalBidHours').textContent = totalBidHours.toFixed(1);
  document.getElementById('totalHoursWorked').textContent = totalActualHours.toFixed(1);
  document.getElementById('totalBidPrice').textContent = formatCurrency(totalBidPrice);
  document.getElementById('totalActualPrice').textContent = formatCurrency(totalActualPrice);

  const profitLoss = totalBidPrice - totalActualPrice;
  const profitLossSpan = document.getElementById('totalProfitLoss');
  profitLossSpan.textContent = formatCurrency(profitLoss);
  profitLossSpan.className = profitLoss >= 0 ? 'text-gain' : 'text-loss';
}

function updateDateRangeDisplay() {
    const range = JSON.parse(localStorage.getItem(LS_DATE_RANGE_KEY) || '{}');
    const displayEl = document.getElementById('dateRangeDisplay');
    if (range.start && range.end) {
        displayEl.textContent = `${formatDate(parseLocalDate(range.start))} - ${formatDate(parseLocalDate(range.end))}`;
    } else {
        displayEl.textContent = '[Not Set]';
    }
}

/* ======================
   Modal & Form Handling
   ====================== */
function openModal(modalId, focusElementId = null) {
    document.getElementById(modalId).classList.add('show');
    if (focusElementId) setTimeout(() => document.getElementById(focusElementId)?.focus(), 100);
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    document.querySelectorAll(`#${modalId} input, #${modalId} textarea`).forEach(field => field.value = '');
    document.getElementById('editCompletedId').value = '';
    document.getElementById('editOngoingId').value = '';
    document.getElementById('hourHistoryBody').innerHTML = '';
}

function openEditCompleted(id) {
    const data = JSON.parse(localStorage.getItem(LS_COMPLETED_KEY) || '[]');
    const item = data.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editCompletedId').value = item.id;
    document.getElementById('completedProjectNumber').value = item.projectNumber;
    document.getElementById('completedSiteName').value = item.siteName;
    document.getElementById('completedDate').value = formatDateStringForInput(item.dateCompleted);
    document.getElementById('completedDeficienciesFound').value = item.deficiencies;
    document.getElementById('completedReportSent').value = item.reportSent || 'No';
    document.getElementById('completedDiscrepancies').value = item.discrepancies || '';
    document.getElementById('completedNotes').value = item.notes || '';

    const historyBody = document.getElementById('hourHistoryBody');
    historyBody.innerHTML = '';
    if (item.hoursHistory && item.hoursHistory.length > 0) {
        item.hoursHistory.forEach(h => addHourHistoryRow(h));
    } else {
        addHourHistoryRow(); // Add at least one row
    }

    document.getElementById('completedModalTitle').textContent = 'Edit Completed Inspection';
    openModal('completedModal', 'completedProjectNumber');
}

function openEditOngoing(id) {
    const data = JSON.parse(localStorage.getItem(LS_ONGOING_KEY) || '[]');
    const item = data.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editOngoingId').value = item.id;
    document.getElementById('ongoingProjectNumber').value = item.projectNumber;
    document.getElementById('ongoingSiteName').value = item.siteName;
    document.getElementById('ongoingStartDate').value = formatDateStringForInput(item.startDate);
    document.getElementById('ongoingBidHours').value = item.bidHours;
    document.getElementById('ongoingHoursWorked').value = item.hoursWorked;
    document.getElementById('ongoingEstCompletion').value = formatDateStringForInput(item.estCompletion);
    document.getElementById('ongoingNotes').value = item.notes || '';

    document.getElementById('ongoingModalTitle').textContent = 'Edit Ongoing Inspection';
    openModal('ongoingModal', 'ongoingProjectNumber');
}

function addHourHistoryRow(data = {}) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="number" class="history-year" placeholder="Year" value="${data.year || ''}" min="2000" max="2100" required></td>
        <td><input type="number" step="0.1" class="history-bid" placeholder="Bid Hrs" value="${data.bid || ''}" min="0" required></td>
        <td><input type="number" step="0.1" class="history-actual" placeholder="Actual Hrs" value="${data.actual || ''}" min="0" required></td>
        <td><input type="number" step="0.01" class="history-bid-price" placeholder="Bid Price $" value="${data.bidPrice || ''}" min="0" required></td>
        <td class="no-pdf"><button type="button" class="btn-danger" onclick="this.closest('tr').remove()">X</button></td>
    `;
    document.getElementById('hourHistoryBody').appendChild(row);
}

function saveCompleted(event) {
    event.preventDefault();
    const id = document.getElementById('editCompletedId').value || generateId();
    const historyRows = document.querySelectorAll('#hourHistoryBody tr');
    const hourHistory = [];
    let hasError = false;

    historyRows.forEach(row => {
        const year = row.querySelector('.history-year').value;
        const bid = row.querySelector('.history-bid').value;
        const actual = row.querySelector('.history-actual').value;
        const bidPrice = row.querySelector('.history-bid-price').value;

        if (!year || !bid || !actual || !bidPrice) {
            alert('Please fill in all fields for every year in the hour history.');
            hasError = true;
            return;
        }
        hourHistory.push({ year, bid, actual, bidPrice });
    });

    if (hasError) return;

    const newItem = {
        id,
        projectNumber: document.getElementById('completedProjectNumber').value,
        siteName: document.getElementById('completedSiteName').value,
        dateCompleted: document.getElementById('completedDate').value,
        deficiencies: document.getElementById('completedDeficienciesFound').value,
        reportSent: document.getElementById('completedReportSent').value,
        discrepancies: document.getElementById('completedDiscrepancies').value,
        notes: document.getElementById('completedNotes').value,
        hoursHistory: hourHistory
    };

    let data = JSON.parse(localStorage.getItem(LS_COMPLETED_KEY) || '[]');
    const index = data.findIndex(i => i.id === id);
    if (index !== -1) data[index] = newItem;
    else data.push(newItem);
    
    localStorage.setItem(LS_COMPLETED_KEY, JSON.stringify(data));
    closeModal('completedModal');
    renderAllTables();
}

function saveOngoing(event) {
    event.preventDefault();
    const id = document.getElementById('editOngoingId').value || generateId();
    const newItem = {
        id,
        projectNumber: document.getElementById('ongoingProjectNumber').value,
        siteName: document.getElementById('ongoingSiteName').value,
        startDate: document.getElementById('ongoingStartDate').value,
        bidHours: document.getElementById('ongoingBidHours').value,
        hoursWorked: document.getElementById('ongoingHoursWorked').value,
        estCompletion: document.getElementById('ongoingEstCompletion').value,
        notes: document.getElementById('ongoingNotes').value
    };

    let data = JSON.parse(localStorage.getItem(LS_ONGOING_KEY) || '[]');
    const index = data.findIndex(i => i.id === id);
    if (index !== -1) data[index] = newItem;
    else data.push(newItem);
    
    localStorage.setItem(LS_ONGOING_KEY, JSON.stringify(data));
    closeModal('ongoingModal');
    renderAllTables();
}

function updateDateRange(event) {
    event.preventDefault();
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (!startDate || !endDate) {
        alert('Please select both start and end dates.');
        return;
    }
    localStorage.setItem(LS_DATE_RANGE_KEY, JSON.stringify({ start: startDate, end: endDate }));
    updateDateRangeDisplay();
}

/* ======================
   Data Management
   ====================== */
function deleteItem(storageKey, id) {
    showConfirmModal(
        'Confirm Deletion',
        'Are you sure you want to delete this item? This action cannot be undone.',
        () => {
            let data = JSON.parse(localStorage.getItem(storageKey) || '[]');
            data = data.filter(i => i.id !== id);
            localStorage.setItem(storageKey, JSON.stringify(data));
            renderAllTables();
        }
    );
}

function clearAllData() {
    showConfirmModal(
        'Clear All Data',
        'WARNING: This will permanently delete ALL saved data (inspections, notes, and date range). This cannot be undone. Are you sure?',
        () => {
            localStorage.removeItem(LS_COMPLETED_KEY);
            localStorage.removeItem(LS_ONGOING_KEY);
            localStorage.removeItem(LS_NOTES_KEY);
            localStorage.removeItem(LS_DATE_RANGE_KEY);
            document.getElementById('trendsNoticed').value = '';
            document.getElementById('resourceChallenges').value = '';
            document.getElementById('suggestedImprovements').value = '';
            renderAllTables();
            updateDateRangeDisplay();
        }
    );
}

function showConfirmModal(title, text, callback) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalText').textContent = text;
    confirmCallback = callback;
    openModal('confirmModal');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/* ======================
   PDF Generation
   ====================== */
function downloadPDF() {
    // Prepare the notes for PDF display
    document.getElementById('trendsNoticedPdf').textContent = document.getElementById('trendsNoticed').value;
    document.getElementById('resourceChallengesPdf').textContent = document.getElementById('resourceChallenges').value;
    document.getElementById('suggestedImprovementsPdf').textContent = document.getElementById('suggestedImprovements').value;

    // Save notes to localStorage
    localStorage.setItem(LS_NOTES_KEY, JSON.stringify({
        trendsNoticed: document.getElementById('trendsNoticed').value,
        resourceChallenges: document.getElementById('resourceChallenges').value,
        suggestedImprovements: document.getElementById('suggestedImprovements').value
    }));

    // Add PDF-specific class to body for styling
    document.body.classList.add('pdf-render-mode');

    // Use html2pdf library to generate the PDF
    const element = document.getElementById('pdfContainer');
    const opt = {
        margin: [10, 5, 10, 5],
        filename: 'Omni_Weekly_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        // Remove PDF-specific class after generation is complete
        document.body.classList.remove('pdf-render-mode');
    });
}

/* ======================
   Event Listeners & Initialization
   ====================== */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize date inputs with today's date
    const today = new Date();
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const lastDayOfWeek = new Date(today);
    lastDayOfWeek.setDate(today.getDate() + (6 - today.getDay())); // Saturday

    const formatForInput = d => d.toISOString().split('T')[0];
    document.getElementById('startDate').value = formatForInput(firstDayOfWeek);
    document.getElementById('endDate').value = formatForInput(lastDayOfWeek);

    // Load saved date range if it exists
    const savedRange = JSON.parse(localStorage.getItem(LS_DATE_RANGE_KEY) || '{}');
    if (savedRange.start) document.getElementById('startDate').value = savedRange.start;
    if (savedRange.end) document.getElementById('endDate').value = savedRange.end;
    updateDateRangeDisplay();

    // Load saved notes if they exist
    const savedNotes = JSON.parse(localStorage.getItem(LS_NOTES_KEY) || '{}');
    if (savedNotes.trendsNoticed) document.getElementById('trendsNoticed').value = savedNotes.trendsNoticed;
    if (savedNotes.resourceChallenges) document.getElementById('resourceChallenges').value = savedNotes.resourceChallenges;
    if (savedNotes.suggestedImprovements) document.getElementById('suggestedImprovements').value = savedNotes.suggestedImprovements;

    // Set up confirmation modal buttons
    document.getElementById('confirmCancelBtn').addEventListener('click', () => closeModal('confirmModal'));
    document.getElementById('confirmOkBtn').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        closeModal('confirmModal');
    });

    // Render initial data
    renderAllTables();
});
