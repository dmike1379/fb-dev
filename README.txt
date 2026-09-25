FAMILY BANK — VENDOR ASSETS

phosphor-sprite.svg       ← icons (included in this v31.2 drop)
chart.umd.min.js          ← Chart.js (from v30, already in your repo)

jsPDF (jspdf.umd.min.js) is no longer loaded: the PDF statement button was removed
and v38.2 dropped the script tag and the service-worker precache entry with it.
The file can be deleted from vendor/ if it is still there.
