let allData = {
    new:        [],
    existing:   [],
    extension:  [],
    releasing:  []
};

let currentCompany = '';
let companyList = [];
let currentNewRows = [];
let currentExtRows = [];
let currentRelRows = [];
let activeFromYear = 'all';
let activeToYear   = 'all';
let activeMonth = '';

//fetch all the sheet data 
window.addEventListener('DOMContentLoaded', async() => {
    wireFilterEvents();
    try {
        await fetchAllSheetData();
        buildCompanyList(); 
    } catch (e) {
        console.log('Failed to load the sheets data', e);
    }
});

function wireFilterEvents() {
    const yearFrom = document.getElementById('year-from');
    const yearTo = document.getElementById('year-to');
    const monthSelect = document.getElementById('month-select');

    if (yearFrom) yearFrom.addEventListener('change', applyFilters);
    if (yearTo) yearTo.addEventListener('change', applyFilters);
    if (monthSelect) monthSelect.addEventListener('change', applyFilters);
}

// fetch all the sheets data - uses appScript GET endpoint
async function fetchAllSheetData() {
  const tabs = [
    { key: 'new',       name: CONFIG.TABS.new       },
    { key: 'existing',  name: CONFIG.TABS.extension  },
    { key: 'releasing', name: CONFIG.TABS.releasing  }
  ];

  for (const tab of tabs) {
        const result = await fetchSheetData(tab.name);

    if (result.data) {
            allData[tab.key] = result.data.slice(1).filter(row =>
                row.some(cell => String(cell ?? '').trim() !== '')
            );
            if (tab.key === 'existing') {
                allData.extension = allData.existing;
            }
    }
  }
}

function fetchSheetData(tabName) {
  const maxAttempts = 3;

  function load(attempt) {
    return new Promise((resolve, reject) => {
      const callbackName = `sheetData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out loading ${tabName}`));
      }, 30000);

      function cleanup() {
        clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = result => {
        cleanup();
        resolve(result);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load ${tabName}`));
      };

      script.src = `${CONFIG.APPS_SCRIPT_URL}?tab=${encodeURIComponent(tabName)}&callback=${callbackName}&attempt=${attempt}`;
      document.head.appendChild(script);
    }).catch(error => {
      if (attempt < maxAttempts) return load(attempt + 1);
      throw error;
    });
  }

  return load(1);
}

// Extract the number from a string
function parseAmount(str){
    // Remove Rs., commas, spaces — then grab the first number found
   if(!str) return 0;
   const match = str.toString().replace(/Rs\.?/gi, '').replace(/,/g, '').match(/[\d]+\.?\d*/);
   return match ? parseFloat(match[0]) : 0;
}

function fmtAmount(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2
  }).format(num);
}

// YEAR HELPERS
function extractYear(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.toString().trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return parseInt(dmy[3]);
  const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) return parseInt(iso[1]);
  const y = s.match(/\b(20\d{2})\b/);
  if (y) return parseInt(y[1]);
  return null;
}

function getYearsFromRows(rows, dateColumns = [2]) {
  const years = new Set();
  rows.forEach(row => {
    dateColumns.forEach(column => {
      const y = extractYear(row[column]);
      if (y) years.add(y);
    });
  });
  return Array.from(years).sort();
}

function filterByYearRange(rows, from, to, dateColumns = [2]) {
  if (from === 'all' && to === 'all') return rows;
  return rows.filter(r => {
    const f = from === 'all' ? -Infinity : parseInt(from);
    const t = to   === 'all' ?  Infinity : parseInt(to);
    return dateColumns.some(column => {
      const y = extractYear(r[column]);
      return y && y >= f && y <= t;
    });
  });
}

function populateYearDropdowns(newRows, extRows, relRows) {
  const allYears = new Set([
    ...getYearsFromRows(newRows, [2, 8, 11]),
    ...getYearsFromRows(extRows, [2, 5]),
    ...getYearsFromRows(relRows, [2, 5, 6])
  ]);
  const sorted = Array.from(allYears).sort();
  ['year-from', 'year-to'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="all">All years</option>';
    sorted.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      sel.appendChild(opt);
    });
  });
}

function resetYearFilter() {
  document.getElementById('year-from').value = 'all';
  document.getElementById('year-to').value   = 'all';
  activeFromYear = 'all';
  activeToYear   = 'all';
  applyFilters();
}

 /*  MONTH HELPERS */
function parseDateToMonthYear(dateStr) {
  if (!dateStr) return null;
  const s = dateStr.toString().trim();
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const month = parseInt(dmy[2]);
    const year  = parseInt(dmy[3]);
    return { key: `${year}-${String(month).padStart(2,'0')}`, month, year };
  }
  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) {
    const month = parseInt(iso[2]);
    const year  = parseInt(iso[1]);
    return { key: `${year}-${String(month).padStart(2,'0')}`, month, year };
  }
  return null;
}

function monthLabel(month, year) {
  const names = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
  return `${names[month - 1]} ${year}`;
}

// Populate month dropdown from year-filtered new BG rows
function populateMonthDropdown(rows) {
  const monthSet = new Set();
  (rows || []).forEach(row => {
    const parsed = parseDateToMonthYear(String(row[2] ?? '').trim());
    if (parsed) monthSet.add(parsed.key);
  });
  const sorted = Array.from(monthSet).sort();
  const sel = document.getElementById('month-select');
  sel.innerHTML = '<option value="">All months</option>';
  sorted.forEach(key => {
    const [y, m] = key.split('-');
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = monthLabel(parseInt(m), parseInt(y));
    sel.appendChild(opt);
  });
}

function filterByMonth(rows, monthKey) {
  if (!monthKey) return rows;
  const [y, m] = monthKey.split('-').map(Number);
  return rows.filter(r => {
    const p = parseDateToMonthYear(String(r[2] ?? '').trim());
    return p && p.month === m && p.year === y;
  });
}

function resetMonthFilter() {
  document.getElementById('month-select').value = '';
  activeMonth = '';
  document.getElementById('month-active-label').classList.add('hidden');
  applyFilters();
}

/* 
   APPLY BOTH FILTERS TOGETHER
   Year range first --> month on top
*/
function applyFilters() {
  const from  = document.getElementById('year-from').value;
  const to    = document.getElementById('year-to').value;
  const month = document.getElementById('month-select').value;

  // Validate year range
  if (from !== 'all' && to !== 'all' && parseInt(from) > parseInt(to)) {
    alert('"From year" cannot be later than "To year".');
    document.getElementById('year-from').value = activeFromYear;
    document.getElementById('year-to').value   = activeToYear;
    return;
  }

  activeFromYear = from;
  activeToYear   = to;
  activeMonth    = month;

  // Step 1 — apply year range
  let filteredNew = filterByYearRange(currentNewRows, from, to, [2, 8, 11]);
  let filteredExt = filterByYearRange(currentExtRows, from, to, [2, 5]);
  let filteredRel = filterByYearRange(currentRelRows, from, to, [2, 5, 6]);

  // Step 2 — apply month on top of year
  filteredNew = filterByMonth(filteredNew, month);
  filteredExt = filterByMonth(filteredExt, month);
  filteredRel = filterByMonth(filteredRel, month);

  // Repopulate month dropdown to only show months in selected year range
  const yearFilteredNew = filterByYearRange(currentNewRows, from, to, [2, 8, 11]);
  populateMonthDropdown(yearFilteredNew);
  document.getElementById('month-select').value = month; // restore selection

  // Render summary cards and all three tables
  renderSummaryCards(filteredNew, filteredExt, filteredRel);
  renderNewTable(filteredNew);
  renderExtTable(filteredExt);
  renderRelTable(filteredRel);

  document.getElementById('section-new').style.display = filteredNew.length ? 'block' : 'none';
  document.getElementById('section-ext').style.display = filteredExt.length ? 'block' : 'none';
  document.getElementById('section-rel').style.display = filteredRel.length ? 'block' : 'none';

  // Update year active label
  const yearLabelEl = document.getElementById('filter-active-label');
  if (from === 'all' && to === 'all') {
    yearLabelEl.classList.add('hidden');
  } else {
    yearLabelEl.textContent = `Showing: ${from === 'all' ? 'All' : from} → ${to === 'all' ? 'All' : to}`;
    yearLabelEl.classList.remove('hidden');
  }

  // Update month active label
  const monthLabelEl = document.getElementById('month-active-label');
  if (month) {
    const [y, m] = month.split('-').map(Number);
    monthLabelEl.textContent = `Month: ${monthLabel(m, y)}`;
    monthLabelEl.classList.remove('hidden');
  } else {
    monthLabelEl.classList.add('hidden');
  }
}

/*  BUILD COMPANY LIST FOR AUTOCOMPLETE  */
function normalizeCompanyName(name) {
    return String(name ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
}

function buildCompanyList() {
    const names = new Map();
    [...allData.new, ...allData.existing, ...allData.extension, ...allData.releasing].forEach(row => {
        const company = String(row[1] ?? '').trim();
        const normalized = normalizeCompanyName(company);
        if (company && normalized && !names.has(normalized)) {
            names.set(normalized, company);
        }
    });
    companyList = Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

/*  CLEAR REPORT STATE  */
function clearReportState() {
    currentCompany = '';
    activeFromYear = 'all';
    activeToYear   = 'all';
    activeMonth    = '';
    document.getElementById('year-filter-panel').classList.add('hidden');
    document.getElementById('month-filter-panel').classList.add('hidden');
    document.getElementById('month-select').value = '';
    document.getElementById('month-active-label').classList.add('hidden');
    document.getElementById('report-output').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('summary-cards').innerHTML = '';
    document.getElementById('tbody-new').innerHTML = '';
    document.getElementById('tbody-ext').innerHTML = '';
    document.getElementById('tbody-rel').innerHTML = '';
    document.getElementById('section-new').style.display = 'none';
    document.getElementById('section-ext').style.display = 'none';
    document.getElementById('section-rel').style.display = 'none';
}

/*  AUTOCOMPLETE  */
function onSearchInput() {
    const val = document.getElementById('search-input').value.trim();
    const box = document.getElementById('suggestions');

    if (!val) {
        box.classList.add('hidden');
        clearReportState();
        return;
    }

    const normalizedQuery = normalizeCompanyName(val);
    const matches = companyList.filter(c => normalizeCompanyName(c).includes(normalizedQuery));

    if (matches.length === 0) {
        box.classList.add('hidden');
        clearReportState();
        return;
    }

    box.innerHTML = matches.map(m =>
        `<div class="suggestion-item" onclick="selectCompany('${m.replace(/'/g, "\\'")}')">${m}</div>`
    ).join('');
    box.classList.remove('hidden');
}

function selectCompany(name) {
    document.getElementById('search-input').value = name;
    document.getElementById('suggestions').classList.add('hidden');
    searchCompany();
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-row')) {
        document.getElementById('suggestions').classList.add('hidden');
    }
});

/*  SEARCH COMPANY  */
function searchCompany() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) {
        alert('Please enter a company name to search.');
        return;
    }

    const normalizedQuery = normalizeCompanyName(query);
    const newRows = allData.new.filter(r => r[1] && normalizeCompanyName(r[1]) === normalizedQuery);
    const extRows = allData.existing.filter(r => r[1] && normalizeCompanyName(r[1]) === normalizedQuery);
    const relRows = allData.releasing.filter(r => r[1] && normalizeCompanyName(r[1]) === normalizedQuery);

    const total = newRows.length + extRows.length + relRows.length;

    if (total === 0) {
        document.getElementById('report-output').classList.add('hidden');
        document.getElementById('year-filter-panel').classList.add('hidden');
        document.getElementById('month-filter-panel').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }

    currentCompany = query;

    // Store full unfiltered rows
    currentNewRows = newRows;
    currentExtRows = extRows;
    currentRelRows = relRows;

    // Reset year filter
    activeFromYear = 'all';
    activeToYear   = 'all';
    populateYearDropdowns(newRows, extRows, relRows);
    document.getElementById('year-from').value = 'all';
    document.getElementById('year-to').value   = 'all';
    document.getElementById('filter-active-label').classList.add('hidden');
    document.getElementById('year-filter-panel').classList.remove('hidden');

    // Reset month filter
    activeMonth = '';
    populateMonthDropdown(newRows);
    document.getElementById('month-select').value = '';
    document.getElementById('month-active-label').classList.add('hidden');
    document.getElementById('month-filter-panel').classList.remove('hidden');

    // Show report
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('report-output').classList.remove('hidden');

    renderSummaryCards(newRows, extRows, relRows);
    renderNewTable(newRows);
    renderExtTable(extRows);
    renderRelTable(relRows);

    document.getElementById('section-new').style.display = newRows.length ? 'block' : 'none';
    document.getElementById('section-ext').style.display = extRows.length ? 'block' : 'none';
    document.getElementById('section-rel').style.display = relRows.length ? 'block' : 'none';

    document.getElementById('report-output').scrollIntoView({ behavior: 'smooth' });
}

/*  SUMMARY CARDS  */
function renderSummaryCards(newRows, extRows, relRows) {
    const totalBGs  = newRows.length;
    const totalExts = extRows.length;
    const totalRels = relRows.length;
    const activeBGs = Math.max(0, totalBGs - totalRels);
    const totalAmt  = newRows.reduce((s, r) => s + parseAmount(r[8]), 0);
    const relAmt    = relRows.reduce((s, r) => s + parseAmount(r[7]), 0);

    document.getElementById('summary-cards').innerHTML = `
        <div class="metric-card blue">
            <div class="metric-label">Total BGs obtained</div>
            <div class="metric-value">${totalBGs}</div>
            <div class="metric-sub">bank guarantees</div>
        </div>
        <div class="metric-card orange">
            <div class="metric-label">Total extensions</div>
            <div class="metric-value">${totalExts}</div>
            <div class="metric-sub">extensions</div>
        </div>
        <div class="metric-card green">
            <div class="metric-label">Total released</div>
            <div class="metric-value">${totalRels}</div>
            <div class="metric-sub">released</div>
        </div>
        <div class="metric-card red">
            <div class="metric-label">Still active</div>
            <div class="metric-value">${activeBGs}</div>
            <div class="metric-sub">not yet released</div>
        </div>
        <div class="metric-card blue" style="grid-column:span 2">
            <div class="metric-label">Total BG amount obtained</div>
            <div class="metric-value" style="font-size:20px">${fmtAmount(totalAmt)}</div>
        </div>
        <div class="metric-card green" style="grid-column:span 2">
            <div class="metric-label">Total amount released</div>
            <div class="metric-value" style="font-size:20px">${fmtAmount(relAmt)}</div>
        </div>`;
}

/*  TABLE RENDERERS  */

// BG Register: 0:No | 1:Company | 2:Date | 3:Ref | 4:CUSDEC |
// 5:Reason | 6:Taxes | 7:BG No | 8:Amount&Expiry | 9:Remarks | 10:Extended Y/N | 11:Releasing Date
function renderNewTable(rows) {
  const tbody = document.getElementById('tbody-new');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#888">No records</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r[2] || ''}</td>
      <td>${r[3] || ''}</td>
      <td><strong>${r[4] || ''}</strong></td>
      <td>${r[5] || ''}</td>
      <td>${r[6] || ''}</td>
      <td>${r[7] || ''}</td>
      <td>${r[8] || ''}</td>
      <td>${r[9] || ''}</td>
      <td>${badge(r[10], 'Yes', 'No')}</td>
      <td>${r[11] || '<span style="color:#ccc">—</span>'}</td>
    </tr>`).join('');
}

// BG Extensions: 0:No | 1:Company | 2:Date | 3:Ref | 4:CUSDEC | 5:Extension Period | 6:BG No | 7:Amount
function renderExtTable(rows) {
  const tbody = document.getElementById('tbody-ext');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888">No records</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r[2] || ''}</td>
      <td>${r[3] || ''}</td>
      <td><strong>${r[4] || ''}</strong></td>
      <td>${r[5] || ''}</td>
      <td>${r[6] || ''}</td>
      <td>${r[7] || ''}</td>
    </tr>`).join('');
}

// BG Releasing: 0:No | 1:Company | 2:Date | 3:Ref | 4:CUSDEC | 5:CUSDEC Date | 6:BG Amount & Validity | 7:Amount
function renderRelTable(rows) {
  const tbody = document.getElementById('tbody-rel');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888">No records</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r[2] || ''}</td>
      <td>${r[3] || ''}</td>
      <td><strong>${r[4] || ''}</strong></td>
      <td>${r[5] || ''}</td>
      <td>${r[6] || ''}</td>
      <td>${r[7] || ''}</td>
    </tr>`).join('');
}

function badge(val, yes, no) {
  if (!val) return `<span class="badge badge-no">${no}</span>`;
  return val.toString().toLowerCase() === 'yes'
    ? `<span class="badge badge-yes">${yes}</span>`
    : `<span class="badge badge-no">${no}</span>`;
}

/*  PDF DOWNLOAD  */
/*   Respects both active year and month filters   */
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('en-GB');

  // Apply year filter
  let newRows = filterByYearRange(currentNewRows, activeFromYear, activeToYear, [2, 8, 11]);
  let extRows = filterByYearRange(currentExtRows, activeFromYear, activeToYear, [2, 5]);
  let relRows = filterByYearRange(currentRelRows, activeFromYear, activeToYear, [2, 5, 6]);

  // Apply month filter on top
  newRows = filterByMonth(newRows, activeMonth);
  extRows = filterByMonth(extRows, activeMonth);
  relRows = filterByMonth(relRows, activeMonth);

  // Build filename suffix from active filters
  const monthSuffix = activeMonth
    ? (() => { const [y, m] = activeMonth.split('-').map(Number); return `_${monthLabel(m, y).replace(/\s/g, '_')}`; })()
    : '';

  let y = 15;

  // Header
  doc.setFillColor(0, 48, 135);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('BOARD OF INVESTMENT OF SRI LANKA', 14, 10);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Investor Services — Bank Guarantee Report', 14, 16);
  doc.text(`Generated: ${today}`, 250, 16);
  y = 30;

  // Company name
  doc.setTextColor(0, 48, 135);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(currentCompany, 14, y); y += 6;

  // Active filter labels
  const filterParts = [];
  if (activeFromYear !== 'all' || activeToYear !== 'all') {
    filterParts.push(`Year: ${activeFromYear === 'all' ? 'All' : activeFromYear} → ${activeToYear === 'all' ? 'All' : activeToYear}`);
  }
  if (activeMonth) {
    const [ym, mm] = activeMonth.split('-').map(Number);
    filterParts.push(`Month: ${monthLabel(mm, ym)}`);
  }
  if (filterParts.length) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
    doc.text(filterParts.join('   |   '), 14, y); y += 6;
  }

  // Summary boxes
  const totalAmt = newRows.reduce((s, r) => s + parseAmount(r[8]), 0);
  const relAmt   = relRows.reduce((s, r) => s + parseAmount(r[7]), 0);
  const active   = Math.max(0, newRows.length - relRows.length);
  const summaries = [
    { label: 'Total BGs obtained', value: newRows.length, color: [0, 48, 135]   },
    { label: 'Total extensions',   value: extRows.length, color: [230, 126, 34] },
    { label: 'Total released',     value: relRows.length, color: [26, 122, 74]  },
    { label: 'Still active',       value: active,         color: [192, 57, 43]  }
  ];
  summaries.forEach((s, i) => {
    const x = 14 + i * 68;
    doc.setFillColor(...s.color);
    doc.rect(x, y, 64, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(s.label, x + 3, y + 5);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(String(s.value), x + 3, y + 12);
  });
  y += 18;

  // Amount row
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
  doc.text(`Total BG amount obtained: ${fmtAmount(totalAmt)}`, 14, y);
  doc.text(`Total amount released: ${fmtAmount(relAmt)}`, 160, y);
  y += 8;

  // BG Register table
  if (newRows.length > 0) {
    doc.setTextColor(0, 48, 135); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Bank Guarantees Obtained', 14, y); y += 4;
    doc.autoTable({
      startY: y,
      head: [['No.','Date','Ref No.','CUSDEC No.','Reason','Taxes & Levies','BG No.','Amount & Expiry','Remarks','Extended','Released Date']],
      body: newRows.map((r, i) => [i+1, r[2]||'', r[3]||'', r[4]||'', r[5]||'', r[6]||'', r[7]||'', r[8]||'', r[9]||'', r[10]||'No', r[11]||'—']),
      theme: 'grid',
      headStyles: { fillColor: [0,48,135], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245,247,252] },
      margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Extensions table
  if (extRows.length > 0) {
    if (y > 170) { doc.addPage(); y = 15; }
    doc.setTextColor(0, 48, 135); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('BG Extensions', 14, y); y += 4;
    doc.autoTable({
      startY: y,
      head: [['No.','Date','Ref No.','CUSDEC No.','Extension Period','BG No.','Amount (Rs.)']],
      body: extRows.map((r, i) => [i+1, r[2]||'', r[3]||'', r[4]||'', r[5]||'', r[6]||'', r[7]||'']),
      theme: 'grid',
      headStyles: { fillColor: [230,126,34], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [255,249,242] },
      margin: { left: 14, right: 14 }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Releasing table
  if (relRows.length > 0) {
    if (y > 170) { doc.addPage(); y = 15; }
    doc.setTextColor(0, 48, 135); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('BG Releases', 14, y); y += 4;
    doc.autoTable({
      startY: y,
      head: [['No.','Date','Ref No.','CUSDEC No.','CUSDEC Date','BG Amount & Validity','Amount (Rs.)']],
      body: relRows.map((r, i) => [i+1, r[2]||'', r[3]||'', r[4]||'', r[5]||'', r[6]||'', r[7]||'']),
      theme: 'grid',
      headStyles: { fillColor: [26,122,74], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [242,255,248] },
      margin: { left: 14, right: 14 }
    });
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(170, 170, 170);
    doc.text(`Page ${i} of ${pageCount}  |  BOI Investor Services  |  Confidential`, 14, 205);
  }

  doc.save(`BG_Report_${currentCompany.replace(/\s+/g,'_')}${monthSuffix}_${today.replace(/\//g,'-')}.pdf`);
  showToast('PDF downloaded ✓');
}

/*  TOAST  */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3500);
}
