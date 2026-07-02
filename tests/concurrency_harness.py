#!/usr/bin/env python3
# =============================================================================
#  FamilyBank v38 - Concurrency Harness  (tests/concurrency_harness.py)
# -----------------------------------------------------------------------------
#  PURPOSE : Fire admin write-routes in TRUE parallel (threading.Barrier) to
#            force real Apps Script LockService contention, then report each
#            response. Mirrors the Step 3 DW-18 concurrency suite at the
#            integrated-system level (this is DW-6 of the Step 7 walk).
#
#            Three scenarios:
#              S1  two parallel adminApprove on the SAME signupId
#                  -> EXPECT: exactly one {"status":"ok",...}, one
#                     {"status":"error","reason":"signupNotFound"};
#                     Sheet: ONE EmailIndex row, ONE family.
#              S2  adminApprove  ||  rebuildEmailIndex
#                  -> EXPECT: both ok; Sheet: ONE EmailIndex row for the
#                     approved email (lock serialized, no torn write).
#              S3  two setChildEmail, SAME target email, DIFFERENT users
#                  -> EXPECT: one ok, one duplicateEmail; Sheet: ONE
#                     EmailIndex row for the shared email.
#
#  TARGET  : DEV ONLY. The harness WRITES (signups, approvals, index rows).
#
#  *** NEVER POINT THIS AT PRODUCTION. ***
#      PROD serves Linnea's live app. Pass the DEV /exec URL only. A PROD-marker
#      guard below aborts if the production endpoint is detected.
#
#  USAGE   : python concurrency_harness.py --api-url "<DEV_EXEC_URL>" --admin-pin 0000
#            Optional: --scenario {1,2,3,all}  (default all)
#
#  NOTE    : Python's urllib follows the Apps Script 302 automatically (the
#            equivalent of curl -L). No extra flag needed here.
#
#  IMPORTANT: This harness SETS UP each scenario by creating its own signups,
#             but the POST-CONDITION ASSERTIONS are on the SHEET, not on
#             response timing. After running, inspect the DEV Sheet rows
#             (EmailIndex / Families / DeletedFamilies) and confirm the
#             EXPECT lines above. "Responses looked right" is not a PASS.
# =============================================================================

import argparse
import json
import sys
import threading
import urllib.parse
import urllib.request

PROD_MARKER = "AKfycbxvevlcClHWzRJeO4djJwlFOAfrp7AZGUN17uSBmbgjeAfcmSgg07yfV0WCfh"


def call(api_url, action, **params):
    """GET the Apps Script endpoint (urllib follows 302, like curl -L). Returns parsed JSON or raw text."""
    q = {"action": action}
    q.update(params)
    url = api_url + "?" + urllib.parse.urlencode(q)
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return {"_transport_error": str(e), "_action": action}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"_raw": body, "_action": action}


def fire_parallel(fns):
    """Run callables simultaneously using a Barrier so they hit the lock at once."""
    n = len(fns)
    barrier = threading.Barrier(n)
    results = [None] * n
    threads = []

    def runner(idx, fn):
        barrier.wait()          # all threads release together
        results[idx] = fn()

    for i, fn in enumerate(fns):
        t = threading.Thread(target=runner, args=(i, fn))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()
    return results


def scenario_1(api, pin):
    print("\n=== S1: two parallel adminApprove, SAME signupId ===")
    seed = call(api, "signup", displayName="ConcA",
                email="conca@example.com", pin="1111", hp="")
    print("  seed signup:", seed)
    sig = seed.get("signupId")
    if not sig:
        print("  !! could not seed signupId; check that the queue is not full and email is unused.")
        return
    fns = [lambda: call(api, "adminApprove", adminPin=pin, signupId=sig),
           lambda: call(api, "adminApprove", adminPin=pin, signupId=sig)]
    res = fire_parallel(fns)
    for i, r in enumerate(res):
        print(f"  approve[{i}]:", r)
    print("  EXPECT: one ok(+familyId), one error/signupNotFound.")
    print("  THEN CHECK SHEET: EmailIndex has exactly ONE row for conca@example.com; ONE family created.")


def scenario_2(api, pin):
    print("\n=== S2: adminApprove || rebuildEmailIndex ===")
    seed = call(api, "signup", displayName="ConcB",
                email="concb@example.com", pin="1111", hp="")
    print("  seed signup:", seed)
    sig = seed.get("signupId")
    if not sig:
        print("  !! could not seed signupId.")
        return
    fns = [lambda: call(api, "adminApprove", adminPin=pin, signupId=sig),
           lambda: call(api, "rebuildEmailIndex", adminPin=pin)]
    res = fire_parallel(fns)
    print("  approve:", res[0])
    print("  rebuild:", res[1])
    print("  EXPECT: both ok.")
    print("  THEN CHECK SHEET: EmailIndex has exactly ONE row for concb@example.com (no torn write).")
    print("  Optional verify: loginByEmail concb@example.com / 1111 -> ok+familyId.")


def scenario_3(api, pin):
    print("\n=== S3: two setChildEmail, SAME email, DIFFERENT users ===")
    seed = call(api, "signup", displayName="ConcC",
                email="concc@example.com", pin="1111", hp="")
    print("  seed signup:", seed)
    sig = seed.get("signupId")
    if not sig:
        print("  !! could not seed signupId.")
        return
    appr = call(api, "adminApprove", adminPin=pin, signupId=sig)
    print("  approve:", appr)
    fam = appr.get("familyId")
    if not fam:
        print("  !! approve did not yield familyId; aborting S3.")
        return
    # Seed a second user on the family so two distinct users contend for one email.
    # (setChildEmail does not validate user membership in v38 - Step3 NTH item -
    #  so this also serves to register the second user key.)
    seed_sib = call(api, "setChildEmail", adminPin=pin, familyId=fam,
                    childName="Sib", newEmail="sib_seed@example.com")
    print("  seed Sib:", seed_sib)
    fns = [lambda: call(api, "setChildEmail", adminPin=pin, familyId=fam,
                        childName="ConcC", newEmail="shared@example.com"),
           lambda: call(api, "setChildEmail", adminPin=pin, familyId=fam,
                        childName="Sib", newEmail="shared@example.com")]
    res = fire_parallel(fns)
    for i, r in enumerate(res):
        print(f"  setChildEmail[{i}]:", r)
    print("  EXPECT: one ok, one error/duplicateEmail.")
    print("  THEN CHECK SHEET: EmailIndex has exactly ONE row for shared@example.com; one user holds it.")


def main():
    ap = argparse.ArgumentParser(description="FamilyBank v38 concurrency harness (DEV ONLY).")
    ap.add_argument("--api-url", required=True, help="DEV Apps Script /exec URL")
    ap.add_argument("--admin-pin", required=True, help="DEV admin PIN")
    ap.add_argument("--scenario", choices=["1", "2", "3", "all"], default="all")
    args = ap.parse_args()

    if PROD_MARKER in args.api_url:
        print("*** ABORT: --api-url looks like the PRODUCTION endpoint. This harness is DEV-ONLY. ***")
        sys.exit(2)

    print("=" * 60)
    print(" FamilyBank v38 Concurrency Harness  -  TARGET: DEV")
    print(" api-url:", args.api_url)
    print(" Post-conditions are asserted on the SHEET, not on timing.")
    print("=" * 60)

    if args.scenario in ("1", "all"):
        scenario_1(args.api_url, args.admin_pin)
    if args.scenario in ("2", "all"):
        scenario_2(args.api_url, args.admin_pin)
    if args.scenario in ("3", "all"):
        scenario_3(args.api_url, args.admin_pin)

    print("\nDone. Inspect the DEV Sheet rows now and score each scenario against its EXPECT lines.")


if __name__ == "__main__":
    main()
