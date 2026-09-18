/* 
   notif.js — BG Expiry Notifications
   - Checks BG Register on page load
   - Shows badge with count of BGs expiring within 30 days
   - Dropdown lists each expiring BG with company, BG no, days left
   - Emails are sent via Apps Script (not from this file)
*/

/* LOAD & CHECK ON PAGE OPEN */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkExpiringBGs();
  } catch(e) {
    console.error('Expiry check failed:', e);
  }
});

/* MAIN CHECK FUNCTION */
async function checkExpiringBGs() {
  // Fetch BG Register tab
  const url    = CONFIG.APPS_SCRIPT_URL + '?tab=' + encodeURIComponent(CONFIG.TABS.new);
  const resp   = await fetch(url);
  const result = await resp.json();

  if (!result.data || result.data.length < 2) return;

  const rows = result.data.slice(1).filter(row =>
    row.some(cell => String(cell ?? '').trim() !== '')
  );

  const today   = new Date();
  today.setHours(0,0,0,0);
  const in30    = new Date(today);
  in30.setDate(in30.getDate() + 30);

  // Find expiring BGs
  // Col 8  = "Amount & Date of expiry" e.g. "Rs.85,000.00 & 15/02/2027"
  // Col 11 = BG Releasing Date — if filled, BG is already released, skip it
  // Col 7  = BG No.
  // Col 1  = Company Name   
  // Col 12 = Company Email 
  const expiring = [];

  rows.forEach(row => {
    // Skip already released BGs
    const releasedDate = String(row[11] ?? '').trim();
    if (releasedDate && releasedDate !== '—') return;

    const amtExpiry = String(row[8] ?? '').trim();
    const expiryDate = parseExpiryDate(amtExpiry);
    if (!expiryDate) return;

    expiryDate.setHours(0,0,0,0);

    // Only include if expiry is within the next 30 days (and not already past)
    if (expiryDate >= today && expiryDate <= in30) {
      const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
      expiring.push({
        company:    String(row[1]  ?? '').trim(),
        bgNo:       String(row[7]  ?? '').trim(),
        cusdecNo:   String(row[4]  ?? '').trim(),
        expiryDate: formatDate(expiryDate),
        email:      String(row[12] ?? '').trim(),
        daysLeft:   daysLeft
      });
    }
  });

  // Sort by soonest expiry first
  expiring.sort((a, b) => a.daysLeft - b.daysLeft);

  renderNotifications(expiring);
}

/* 
   PARSE EXPIRY DATE
   Handles: "Rs.85,000.00 & 15/02/2027" → Date
   Also handles plain "15/02/2027"
*/
function parseExpiryDate(str) {
  if (!str) return null;

  // Extract date part after '&' if combined
  let datePart = str;
  if (str.includes('&')) {
    datePart = str.split('&')[1].trim();
  }

  // DD/MM/YYYY
  const dmy = datePart.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const d = parseInt(dmy[1]);
    const m = parseInt(dmy[2]) - 1; // JS months are 0-indexed
    const y = parseInt(dmy[3]);
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/*  FORMAT DATE → DD/MM/YYYY  */
function formatDate(date) {
  const d = String(date.getDate()).padStart(2,'0');
  const m = String(date.getMonth()+1).padStart(2,'0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/* 
   RENDER BADGE + DROPDOWN */
function renderNotifications(expiring) {
  const badge    = document.getElementById('notif-badge');
  const list     = document.getElementById('notif-list');

  if (expiring.length === 0) {
    // No expiring BGs — hide badge, show all clear
    badge.classList.add('hidden');
    list.innerHTML = `<div class="notif-empty"><i class="material-icons" aria-hidden="true">check_circle</i> No BGs expiring within 30 days.</div>`;
    return;
  }

  // Show badge with count
  badge.textContent = expiring.length;
  badge.classList.remove('hidden');

  // Build dropdown items
  list.innerHTML = expiring.map(item => {
    const urgencyClass = item.daysLeft <= 7 ? 'urgent' : 'warning';
    const urgencyText  = item.daysLeft === 0 ? 'Expires today!'
      : item.daysLeft === 1 ? '1 day left'
      : `${item.daysLeft} days left`;

    const emailStatus = item.email
      ? `<span class="notif-email-sent"><i class="material-icons" aria-hidden="true">email</i> Email will be sent to ${item.email}</span>`
      : `<span class="notif-email-missing"><i class="material-icons" aria-hidden="true">warning</i> No email address on record</span>`;

    return `
      <div class="notif-item">
        <div class="notif-company">${item.company}</div>
        <div class="notif-meta">
          BG No: <strong>${item.bgNo || '—'}</strong> &nbsp;|&nbsp;
          CUSDEC: <strong>${item.cusdecNo || '—'}</strong>
        </div>
        <div class="notif-meta">Expires: <strong>${item.expiryDate}</strong></div>
        <span class="notif-days ${urgencyClass}">${urgencyText}</span>
        <div class="notif-email-row">${emailStatus}</div>
      </div>`;
  }).join('');
}

/*   TOGGLE DROPDOWN  */
function toggleNotifDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  dropdown.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-dropdown').classList.add('hidden');
  }
});
