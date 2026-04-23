FAMILY BANK — VENDOR ASSETS

phosphor-sprite.svg       ← icons (included in this v31.2 drop)
chart.umd.min.js          ← Chart.js (from v30, already in your repo)
jspdf.umd.min.js          ← jsPDF v3.0.3 (YOU MUST DOWNLOAD THIS ONCE)

To install jsPDF:
  1. Go to https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js
  2. Save as jspdf.umd.min.js (right-click → Save As, or View Source → Save)
  3. Drop it in the vendor/ folder of your GitHub repo
  4. Done — the app will pick it up and cache it via the service worker

If you skip this step, the "Generate PDF Statement" button will show an error toast
explaining the file is missing. Everything else in v31.2 works without it.
