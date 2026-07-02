@echo off
REM ============================================================================
REM  FamilyBank v38 — E2E Smoke Test Battery  (tests/e2e_smoke.cmd)
REM ----------------------------------------------------------------------------
REM  PURPOSE : Quick curl-based smoke checks against the FamilyBank Apps Script
REM            backend. Verifies the deployment serves, dispatch is intact, and
REM            the core signup/admin/login routes respond with expected shapes.
REM
REM  TARGET  : DEV ONLY.  https://dmike1379.github.io/fb-dev/ + FamilyBank DEV
REM            Apps Script project + "Allowance database DEV" Sheet.
REM
REM  *** NEVER POINT THIS AT PRODUCTION. ***
REM      PROD serves Linnea's live app. The DESTRUCTIVE section below WRITES rows
REM            and DELETES families. Running it against PROD corrupts real data.
REM            The API_URL below is the DEV endpoint. Do not paste the PROD URL.
REM
REM  USAGE   : Open CMD, cd to this folder, run:  e2e_smoke.cmd
REM            By default ONLY the non-destructive section runs.
REM            To also run the destructive section, run:  e2e_smoke.cmd --destructive
REM
REM  NOTE    : All curl calls use -L. The Apps Script /exec endpoint answers with
REM            a 302 redirect; without -L curl stops at the redirect and you get
REM            no JSON body. (Standing project lesson.)
REM ============================================================================

setlocal
set "API_URL=https://script.google.com/macros/s/AKfycbyIqTRDvr826wFEZe2p77wevZM9MIMQwwr_O6l7OwpX3LjnxgKtMNAwcFXZXKqkNhWE/exec"
set "ADMIN_PIN=0000"

REM --- guardrail: refuse to run if API_URL still contains a PROD marker ----------
echo %API_URL% | find /I "AKfycbxvevlcClHWzRJeO4djJwlFOAfrp7AZGUN17uSBmbgjeAfcmSgg07yfV0WCfh" >nul
if not errorlevel 1 (
  echo.
  echo  *** ABORT: API_URL looks like the PRODUCTION endpoint. ***
  echo  This script is DEV-ONLY. Edit API_URL back to the DEV /exec URL.
  echo.
  goto :eof
)

echo ============================================================
echo  FamilyBank v38 Smoke Test  -  TARGET: DEV
echo  API_URL=%API_URL%
echo ============================================================
echo.

REM ============================================================================
REM  SECTION A  --  NON-DESTRUCTIVE   (safe to run anytime, reads/probes only)
REM ============================================================================
echo [A1] Version probe (version.json is served by GitHub Pages, not Apps Script)
echo      Run separately if desired:
echo      curl -sL https://raw.githubusercontent.com/dmike1379/fb-dev/main/version.json
echo.

echo [A2] adminLoad with correct PIN  --  EXPECT: {"status":"ok","adminEmail":...,"familyCount":N,"queueLength":N}
curl -sL "%API_URL%?action=adminLoad&adminPin=%ADMIN_PIN%"
echo.
echo.

echo [A3] adminLoad with WRONG PIN    --  EXPECT: {"status":"error","reason":"auth"}
curl -sL "%API_URL%?action=adminLoad&adminPin=9999"
echo.
echo.

echo [A4] loginByEmail bad creds      --  EXPECT: generic {"status":"error","reason":"loginFailed"} (no leak)
curl -sL "%API_URL%?action=loginByEmail&email=nobody@example.com&pin=0000"
echo.
echo.

echo [A5] load unknown familyId       --  EXPECT: {"status":"error","reason":"familyNotFound"}
curl -sL "%API_URL%?action=load&familyId=fam_doesnotexist"
echo.
echo.

echo [A6] signup reserved name 'admin'  --  EXPECT: {"status":"error","reason":"reservedName"}
curl -sL "%API_URL%?action=signup&displayName=admin&email=smoke_admin@example.com&pin=1111&hp="
echo.
echo.

if /I "%~1"=="--destructive" goto :destructive
echo ============================================================
echo  SECTION B (DESTRUCTIVE) SKIPPED.
echo  Re-run with:  e2e_smoke.cmd --destructive   to execute it.
echo ============================================================
goto :eof

:destructive
echo.
echo ############################################################################
echo #  SECTION B  --  DESTRUCTIVE   ***  DEV ONLY  ***
echo #  This WRITES a PendingSignups row and then DELETES the created family.
echo #  Do NOT run against PROD. Ctrl+C now if API_URL is not DEV.
echo ############################################################################
echo.
pause

echo [B1] signup valid Smoke family  --  EXPECT: {"status":"ok","signupId":"sig_...","notificationStatus":...}
curl -sL "%API_URL%?action=signup&displayName=SmokeFam&email=smoke_fam@example.com&pin=1111&hp="
echo.
echo.
echo  --> Manually approve SmokeFam in the Admin Panel to get its familyId,
echo      then delete it there, OR use the admin curls below if you captured a signupId.
echo.

echo [B2] (template) adminDeny by signupId  --  EXPECT: {"status":"ok"}
echo      curl -sL "%API_URL%?action=adminDeny&adminPin=%ADMIN_PIN%&signupId=sig_PASTE_HERE"
echo.

echo [B3] (template) adminDeleteFamily by familyId  --  EXPECT: {"status":"ok"} (idempotent)
echo      curl -sL "%API_URL%?action=adminDeleteFamily&adminPin=%ADMIN_PIN%&familyId=fam_PASTE_HERE"
echo.

echo ============================================================
echo  Destructive section complete. Verify the DEV Sheet:
echo   - PendingSignups: SmokeFam row present (or removed if denied)
echo   - Families / DeletedFamilies: as expected after manual approve/delete
echo ============================================================
goto :eof
