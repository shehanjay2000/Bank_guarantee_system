let currentType = null;

/* STEP 1 — Select letter type */
function selectType(type) {
  currentType = type;

  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-type="${type}"]`).classList.add('active');

  const titles = {
    new:       'New BG — fill in details',
    extension: 'BG Extension — fill in details',
    releasing: 'BG Releasing — fill in details'
  };
  document.getElementById('form-title').textContent = titles[type];

  // Hide all sub-forms, show the right one
  ['new', 'extension', 'releasing'].forEach(t => {
    document.getElementById(`form-${t}`).classList.add('hidden');
  });
  document.getElementById(`form-${type}`).classList.remove('hidden');

  // Seed one empty row for table letters
  if (type === 'extension' && document.getElementById('ext-rows').children.length === 0) addExtRow();
  if (type === 'releasing' && document.getElementById('rel-rows').children.length === 0) addRelRow();

  document.getElementById('step-form').classList.remove('hidden');
  document.getElementById('step-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/*
   DYNAMIC ROWS — Extension
   Columns: CUSDEC No. | BG No. | Prior Expiry Date | Amount (Rs.)
   (matches BG Extensions Register columns)
 */
function addExtRow() {
  const wrap = document.getElementById('ext-rows');

  // Build table header once
  if (!wrap.querySelector('table')) {
    const tbl = document.createElement('table');
    tbl.className = 'row-table';
    tbl.innerHTML = `
      <thead><tr>
        <th>#</th>
        <th>CUSDEC No.</th>
        <th>BG No.</th>
        <th>Prior expiry date</th>
        <th>Amount (Rs.)</th>
        <th></th>
      </tr></thead>
      <tbody></tbody>`;
    wrap.appendChild(tbl);
  }

  const tbody = wrap.querySelector('tbody');
  const n = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${n}</td>
    <td><input type="text"  placeholder="S-52284" /></td>
    <td><input type="text"  placeholder="25123BG00331" /></td>
    <td><input type="date" /></td>
    <td><input type="text"  placeholder="2,258,618.00" /></td>
    <td><button class="btn-del" onclick="removeRow(this)" title="Remove row">×</button></td>`;
  tbody.appendChild(tr);
}

/* 
   DYNAMIC ROWS — Releasing
   Columns: CUSDEC No. | CUSDEC Date | BG Amount (Rs.) & Validity Date | Amount (Rs.)
   (matches BG Releasing Register columns)
 */
function addRelRow() {
  const wrap = document.getElementById('rel-rows');

  if (!wrap.querySelector('table')) {
    const tbl = document.createElement('table');
    tbl.className = 'row-table';
    tbl.innerHTML = `
      <thead><tr>
        <th>#</th>
        <th>CUSDEC No.</th>
        <th>CUSDEC Date</th>
        <th>BG Amount & Validity Date</th>
        <th>Amount (Rs.)</th>
        <th></th>
      </tr></thead>
      <tbody></tbody>`;
    wrap.appendChild(tbl);
  }

  const tbody = wrap.querySelector('tbody');
  const n = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="row-num">${n}</td>
    <td><input type="text"  placeholder="S-61436" /></td>
    <td><input type="date" /></td>
    <td><input type="text"  placeholder="711020541166-GO & 15/02/2026" /></td>
    <td><input type="text"  placeholder="353,516.00" /></td>
    <td><button class="btn-del" onclick="removeRow(this)" title="Remove row">×</button></td>`;
  tbody.appendChild(tr);
}

function removeRow(btn) {
  const tr  = btn.closest('tr');
  const tbd = tr.closest('tbody');
  tbd.removeChild(tr);
  Array.from(tbd.children).forEach((r, i) => { r.querySelector('.row-num').textContent = i + 1; });
}

/* RESET CURRENT FORM ONLY */
function resetForm() {
  if (!currentType) return;

  const form = document.getElementById(`form-${currentType}`);
  if (!form) return;

  form.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    } else {
      el.value = '';
    }
  });

  document.getElementById('ext-rows').innerHTML = '';
  document.getElementById('rel-rows').innerHTML = '';

  if (currentType === 'extension') addExtRow();
  if (currentType === 'releasing') addRelRow();
}

function goToStart() {
  currentType = null;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('step-form').classList.add('hidden');
  document.getElementById('ext-rows').innerHTML = '';
  document.getElementById('rel-rows').innerHTML = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/*  DATE HELPERS */
// YYYY-MM-DD  -->  DD/MM/YYYY
function fmtDate(v) {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

// YYYY-MM-DD  -->  "15th May 2026"  (for letter body text)
function fmtDateLong(v) {
  if (!v) return '';
  const dt  = new Date(v);
  const d   = dt.getDate();
  const sfx = [,'st','nd','rd'][d % 10 > 3 || ~~(d % 100 / 10) === 1 ? 0 : d % 10] || 'th';
  return `${d}${sfx} ${dt.toLocaleString('default',{month:'long'})} ${dt.getFullYear()}`;
}

/*  STEP 2 — Generate letter */
async function generateLetter() {
  const btn = document.getElementById('btn-label');
  btn.textContent = 'Generating…';

  try {
    if      (currentType === 'new')       await handleNew();
    else if (currentType === 'extension') await handleExtension();
    else if (currentType === 'releasing') await handleReleasing();
  } catch(e) {
    console.error(e);
    alert('Error: ' + e.message);
  }

  btn.textContent = 'Generate letter (.docx)';
}

/* ── NEW BG ── */
async function handleNew() {
  const date      = document.getElementById('n-date').value;
  const refno     = document.getElementById('n-refno').value.trim();
  const company   = document.getElementById('n-company').value.trim();
  const cusdec    = document.getElementById('n-cusdec').value.trim();
  const reason    = document.getElementById('n-reason').value.trim();
  const taxes     = document.getElementById('n-taxes').value.trim();
  const bgno      = document.getElementById('n-bgno').value.trim();
  const bgamount  = document.getElementById('n-bgamount').value.trim();
  const bgexpiry  = document.getElementById('n-bgexpiry').value;
  const remarks   = document.getElementById('n-remarks').value.trim();
  const category  = document.getElementById('n-category').value.trim();
  const purpose   = document.getElementById('n-purpose').value.trim();
  const items     = document.getElementById('n-items').value.trim();

  if (!date || !refno || !company || !cusdec) {
    alert('Please fill in Date, Reference number, Company name, and CUSDEC number.');
    return;
  }

  // Data for the Word template placeholders
  const templateData = {
    date:           fmtDate(date),
    ref_no:         refno,
    company_name:   company,
    cusdec_no:      cusdec,
    cusdec_date:    fmtDate(date),   // same date as letter for New BG
    category_type:  category,
    purpose:        purpose,
    items_imported: items,
    taxes_levies:   taxes,
    bg_no:          bgno,
    bg_amount:      bgamount,
    bg_expiry_date: fmtDate(bgexpiry),
    remarks:        remarks
  };

  // No. | Company Name | Date | Ref No. | CUSDEC No. | Reason |
  // Taxes & Levies under BG | BG No. | Amount & Date of expiry | Remarks |
  // BG Extension Yes/No | BG Releasing Date
  const sheetRow = [
    '',                                         // No. — auto-filled by sheet
    company,
    fmtDate(date),
    refno,
    cusdec,
    reason,
    taxes,
    bgno,
    `Rs.${bgamount} & ${fmtDate(bgexpiry)}`,
    remarks,
    'No',                                       // BG Extension Yes/No — default No
    ''                                          // BG Releasing Date — blank for now
  ];

  await fillAndDownload(
    'templates/bg_new_template.docx',
    templateData,
    `BG_New_${company.replace(/\s+/g,'_')}_${fmtDate(date).replace(/\//g,'-')}.docx`
  );

  await logToSheet(CONFIG.TABS.new, sheetRow);
  showToast('Letter generated & logged to BG Register ✓');
  resetForm();
}

/* ── BG EXTENSION ── */
async function handleExtension() {
  const date      = document.getElementById('e-date').value;
  const refno     = document.getElementById('e-refno').value.trim();
  const company   = document.getElementById('e-company').value.trim();
  const extperiod = document.getElementById('e-extperiod').value.trim();

  if (!date || !refno || !company || !extperiod) {
    alert('Please fill in Date, Reference number, Company name, and BG Extension Period.');
    return;
  }

  // Collect CUSDEC rows
  const rows = [];
  const tbody = document.querySelector('#ext-rows tbody');
  if (tbody) {
    Array.from(tbody.children).forEach((tr, i) => {
      const inputs = tr.querySelectorAll('input');
      rows.push({
        no:           String(i + 1).padStart(2, '0'),
        cusdec_no:    inputs[0].value.trim(),
        bg_no:        inputs[1].value.trim(),
        prior_expiry: fmtDate(inputs[2].value),
        amount:       inputs[3].value.trim()
      });
    });
  }

  if (rows.length === 0) { alert('Add at least one CUSDEC row.'); return; }

  const templateData = {
    date:           fmtDate(date),
    ref_no:         refno,
    company_name:   company,
    extension_date: extperiod,
    rows:           rows
  };

  await fillAndDownload(
    'templates/bg_extension_template.docx',
    templateData,
    `BG_Extension_${company.replace(/\s+/g,'_')}_${fmtDate(date).replace(/\//g,'-')}.docx`
  );

  // Log each CUSDEC as a separate row in Google Sheets
  for (const row of rows) {
    const sheetRow = [
      '',           // No.
      company,
      fmtDate(date),
      refno,
      row.cusdec_no,
      extperiod,
      row.bg_no,
      row.amount
    ];
    await logToSheet(CONFIG.TABS.extension, sheetRow);
  }

  showToast(`Letter generated & ${rows.length} row(s) logged to BG Extensions Register ✓`);
  resetForm();
}

/* ── BG RELEASING ── */
async function handleReleasing() {
  const date    = document.getElementById('r-date').value;
  const refno   = document.getElementById('r-refno').value.trim();
  const company = document.getElementById('r-company').value.trim();
  const reason  = document.getElementById('r-reason').value;
  const bgref   = document.getElementById('r-bgref').value.trim();
  const material = document.getElementById('r-material').value.trim();

  if (!date || !refno || !company || !reason) {
    alert('Please fill in Date, Reference number, Company name, and Release reason.');
    return;
  }

  const rows = [];
  const tbody = document.querySelector('#rel-rows tbody');
  if (tbody) {
    Array.from(tbody.children).forEach((tr, i) => {
      const inputs = tr.querySelectorAll('input');
      rows.push({
        no:           String(i + 1).padStart(2, '0'),
        cusdec_no:    inputs[0].value.trim(),
        cusdec_date:  fmtDate(inputs[1].value),
        bg_validity:  inputs[2].value.trim(),   // user types combined "711020541166-GO & 15/02/2026"
        amount:       inputs[3].value.trim()
      });
    });
  }

  if (rows.length === 0) { alert('Add at least one CUSDEC row.'); return; }

  const templateData = {
    date:           fmtDate(date),
    ref_no:         refno,
    company_name:   company,
    release_reason: reason,
    bg_ref:         bgref,
    material_desc:  material,
    rows:           rows
  };

  await fillAndDownload(
    'templates/bg_releasing_template.docx',
    templateData,
    `BG_Releasing_${company.replace(/\s+/g,'_')}_${fmtDate(date).replace(/\//g,'-')}.docx`
  );

  // BG Releasing Register columns in the actual sheet:
  // No. | Company Name | Date | Ref No. | CUSDEC No. |
  // Bank Guarantee Amount (Rs.) & Validity Date | Amount (Rs.)
  for (const row of rows) {
    const sheetRow = [
      '',           // No.
      company,
      fmtDate(date),
      refno,
      row.cusdec_no,
      row.bg_validity,
      row.amount
    ];
    await logToSheet(CONFIG.TABS.releasing, sheetRow);
  }

  showToast(`Letter generated & ${rows.length} row(s) logged to BG Releasing Register ✓`);
  resetForm();
}

/*FILL WORD TEMPLATE & DOWNLOAD */

async function fillAndDownload(templatePath, data, filename) {
  const resp = await fetch(templatePath);
  if (!resp.ok) throw new Error(`Template not found: ${templatePath}`);

  const buf = await resp.arrayBuffer();
  const zip = new PizZip(buf); 

  const doc = new window.docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true
  });

  doc.setData(data);
  doc.render();

  const out = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  saveAs(out, filename);
}

/* LOG ROW TO GOOGLE SHEETS */

async function logToSheet(tabName, rowData) {
  const url = (CONFIG.APPS_SCRIPT_URL || '').trim();

  if (!url || url.includes('YOUR_SCRIPT_ID') || url.includes('PASTE_YOUR_SCRIPT_ID')) {
    console.warn('Apps Script URL not configured.');
    alert('Letter generated, but Google Sheet logging is disabled because the Apps Script URL is not configured yet. Update it in config.js with your published Web App URL.');
    return;
  }


  try {
    const payload = JSON.stringify({
      tab: tabName,
      row: rowData
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload
    });

    let result = null;
    const text = await resp.text();
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = { raw: text };
      }
    }

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${result && result.error ? result.error : text || 'Unknown Apps Script error'}`);
    }

    if (result && result.error) {
      console.error('Sheet error:', result.error);
      alert('Letter generated but sheet logging failed: ' + result.error);
    } else {
      console.log('Row logged successfully to:', tabName);
    }

  } catch(err) {
    console.error('Failed to log to sheet:', err);
    alert('Letter generated but could not reach Google Sheet. Check your Apps Script URL and make sure the Web App is published with “Anyone” access.');
  }
}

/*TOAST*/

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 4000);
}
