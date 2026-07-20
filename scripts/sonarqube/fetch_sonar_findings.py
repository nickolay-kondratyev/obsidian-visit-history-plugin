#!/usr/bin/env python3
"""Download SonarCloud findings for this repo as JSONL into .out/sonarqube/.

Emits, one finding per line:
  .out/sonarqube/issues.jsonl     — code smells / bugs / vulnerabilities (api/issues/search)
  .out/sonarqube/hotspots.jsonl   — security hotspots (api/hotspots/search)
  .out/sonarqube/findings.jsonl   — both, normalized to a common shape for automation

Each finding row is enriched with the source-file path and a ready-to-open
"file:line" locator so a fixer loop can act on it without re-querying Sonar.

Auth: needs a SonarCloud **User token** (My Account -> Security -> type "User Token").
      The project analysis/scanner token used by CI is NOT valid for the Web API.

Usage:
  export SONAR_USER_TOKEN=<user-token>            # NOT the scanner SONAR_TOKEN
  python3 scripts/sonarqube/fetch_sonar_findings.py

  # overrides (defaults derive from the project key):
  python3 scripts/sonarqube/fetch_sonar_findings.py \
      --project nickolay-kondratyev_obsidian-visit-history-plugin \
      --organization nickolay-kondratyev
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://sonarcloud.io"
DEFAULT_PROJECT = "nickolay-kondratyev_obsidian-visit-history-plugin"
OUT_DIR = os.path.join(".out", "sonarqube")
PAGE_SIZE = 500  # Sonar max
# Sonar caps deep pagination at p*ps <= 10000; this repo is far below that.
MAX_RESULTS = 10000


class SonarClient:
    """Thin authenticated GET client for the SonarCloud Web API."""

    def __init__(self, token: str) -> None:
        # SonarCloud accepts the token as HTTP Basic username with empty password.
        creds = base64.b64encode(f"{token}:".encode()).decode()
        self._auth = f"Basic {creds}"

    def get(self, path: str, params: dict[str, object]) -> dict:
        query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        req = urllib.request.Request(f"{BASE_URL}{path}?{query}")
        req.add_header("Authorization", self._auth)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as err:
            body = err.read().decode(errors="replace")
            raise SystemExit(f"HTTP {err.code} for {path}: {body}") from err

    def validate(self) -> bool:
        return bool(self.get("/api/authentication/validate", {}).get("valid"))


def paginate(client: SonarClient, path: str, params: dict[str, object],
             items_key: str, side_keys: tuple[str, ...] = ()) -> tuple[list[dict], dict[str, list[dict]]]:
    """Collect every page of a Sonar list endpoint, respecting the 10k deep-page cap.

    Returns (items, side) where `side` accumulates the requested side-list keys
    (e.g. "components") across all pages — so callers resolve paths in one pass.
    """
    results: list[dict] = []
    side: dict[str, list[dict]] = {key: [] for key in side_keys}
    page = 1
    while True:
        payload = client.get(path, {**params, "p": page, "ps": PAGE_SIZE})
        batch = payload.get(items_key, [])
        results.extend(batch)
        for key in side_keys:
            side[key].extend(payload.get(key, []))
        total = (payload.get("paging") or {}).get("total", payload.get("total", len(results)))
        if not batch or len(results) >= total or page * PAGE_SIZE >= MAX_RESULTS:
            if len(results) < total and page * PAGE_SIZE >= MAX_RESULTS:
                print(f"WARNING: {items_key} truncated at {len(results)}/{total} (Sonar 10k page cap).",
                      file=sys.stderr)
            return results, side
        page += 1


def component_paths(components: list[dict]) -> dict[str, str]:
    """Map componentKey -> repo-relative path from the components[] side lists."""
    paths: dict[str, str] = {}
    for comp in components:
        key = comp.get("key")
        if key:
            paths[key] = comp.get("path") or comp.get("longName") or key
    return paths


def normalize_issue(issue: dict, paths: dict[str, str]) -> dict:
    path = paths.get(issue.get("component", ""), issue.get("component", ""))
    line = issue.get("line")
    return {
        "kind": "issue",
        "key": issue.get("key"),
        "rule": issue.get("rule"),
        "type": issue.get("type"),
        "severity": issue.get("severity"),
        "status": issue.get("status"),
        "message": issue.get("message"),
        "path": path,
        "line": line,
        "locator": f"{path}:{line}" if line else path,
        "effort": issue.get("effort"),
        "tags": issue.get("tags", []),
        "raw": issue,
    }


def normalize_hotspot(hs: dict, paths: dict[str, str]) -> dict:
    path = paths.get(hs.get("component", ""), hs.get("component", ""))
    line = hs.get("line")
    return {
        "kind": "hotspot",
        "key": hs.get("key"),
        "rule": hs.get("ruleKey"),
        "type": "SECURITY_HOTSPOT",
        "severity": hs.get("vulnerabilityProbability"),
        "status": f'{hs.get("status")}/{hs.get("resolution", "")}'.rstrip("/"),
        "message": hs.get("message"),
        "path": path,
        "line": line,
        "locator": f"{path}:{line}" if line else path,
        "effort": None,
        "tags": [hs.get("securityCategory")] if hs.get("securityCategory") else [],
        "raw": hs,
    }


def write_jsonl(path: str, rows: list[dict]) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--project", default=os.environ.get("SONAR_PROJECT_KEY", DEFAULT_PROJECT))
    parser.add_argument("--organization", default=os.environ.get("SONAR_ORGANIZATION"))
    parser.add_argument("--token", default=os.environ.get("SONAR_USER_TOKEN"))
    parser.add_argument("--include-resolved", action="store_true",
                        help="Also fetch resolved/closed issues (default: open only).")
    args = parser.parse_args()

    if not args.token:
        print("ERROR: set SONAR_USER_TOKEN (a User token, not the scanner SONAR_TOKEN) "
              "or pass --token.", file=sys.stderr)
        return 2

    org = args.organization or args.project.split("_", 1)[0]
    client = SonarClient(args.token)
    if not client.validate():
        print("ERROR: token rejected by api/authentication/validate. "
              "Generate a *User token* at SonarCloud -> My Account -> Security.", file=sys.stderr)
        return 2

    os.makedirs(OUT_DIR, exist_ok=True)

    issue_params: dict[str, object] = {
        "componentKeys": args.project,
        "organization": org,
        "additionalFields": "rules",
    }
    if not args.include_resolved:
        issue_params["resolved"] = "false"

    # issues/search and hotspots/search both return a components[] side list for path resolution.
    raw_issues, issue_side = paginate(client, "/api/issues/search", issue_params,
                                      "issues", side_keys=("components",))
    hotspots, hs_side = paginate(client, "/api/hotspots/search",
                                 {"projectKey": args.project, "organization": org},
                                 "hotspots", side_keys=("components",))

    comp_map = component_paths(issue_side["components"] + hs_side["components"])

    issue_rows = [normalize_issue(i, comp_map) for i in raw_issues]
    hotspot_rows = [normalize_hotspot(h, comp_map) for h in hotspots]

    write_jsonl(os.path.join(OUT_DIR, "issues.jsonl"), issue_rows)
    write_jsonl(os.path.join(OUT_DIR, "hotspots.jsonl"), hotspot_rows)
    write_jsonl(os.path.join(OUT_DIR, "findings.jsonl"), issue_rows + hotspot_rows)

    by_sev: dict[str, int] = {}
    for row in issue_rows:
        by_sev[row["severity"]] = by_sev.get(row["severity"], 0) + 1
    print(f"Wrote {len(issue_rows)} issues + {len(hotspot_rows)} hotspots to {OUT_DIR}/")
    if by_sev:
        print("Issue severities:", ", ".join(f"{k}={v}" for k, v in sorted(by_sev.items())))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
