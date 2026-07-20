# Research: Does the Obsidian community plugin directory accept custom / source-available licenses?

**Question:** Can a plugin using a CUSTOM, source-available, non-OSI license (e.g. "KSAL-2.3" — free for personal/non-commercial use, commercial use restricted) be listed in the official Obsidian community plugin directory (`obsidianmd/obsidian-releases` → `community-plugins.json`)?

**VERDICT: YES. A custom source-available / commercial-restricted license IS acceptable. Confidence: HIGH.**

Obsidian imposes **no license-*type* requirement**. The only rule is that a plugin MUST have a LICENSE file and MUST clearly indicate its license. Open-source / OSI approval is explicitly NOT required; closed-source, paid, and proprietary licenses are all permitted (case-by-case review for closed-source, with clear README disclosure).

---

## 1. Official Obsidian policy — no license-type mandate

### Developer policies
Source: <https://docs.obsidian.md/Developer+policies>

The policies require only:
1. **A LICENSE file must exist and be clearly indicated** — "Include a LICENSE file and clearly indicate the license of your plugin or theme."
2. **Respect upstream licenses** — "Comply with the original licenses of any code your plugin or theme makes use of, including attribution in the README if required."
3. Trademark compliance (don't misrepresent Obsidian affiliation).

There is **no requirement that the license be open-source or OSI-approved**, and no prohibition on proprietary/commercial terms. Closed-source projects are allowed but subject to case-by-case review and must be clearly disclosed in the README.

### Submission requirements for plugins
Source: <https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins>

This page lists the mechanical submission requirements (fundingUrl, minAppVersion, description rules, Node/Electron API restrictions, command IDs, removing sample code, etc.). It contains **no licensing provisions at all** — no license-type restriction, no OSI requirement.

### Submit your plugin
Source: <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>

Submission = opening a PR that adds an entry to `community-plugins.json`. Repo must contain README.md, LICENSE, and manifest.json at root. No constraint on *which* license.

---

## 2. Official moderator statement (forum)

Source: "Plugins and problematic licensing" — <https://forum.obsidian.md/t/plugins-and-problematic-licensing/48631>

An Obsidian moderator states directly:
- "Plugins published in Obsidian must have a license (whatever they pick)."
- "I think you are operating under the assumption that ... plugins are/must be free and/or open-source. That is not the case. There are (a few) plugins which are closed source and/or need a payment."

Takeaway: the ONLY licensing rule enforced is *have a license and specify it*. Type is the developer's choice. Open-source is not mandatory; paid and closed-source plugins exist in the directory.

---

## 3. Precedent: Smart Connections (custom source-available, commercial-restricted)

- Plugin: **Smart Connections** by Brian Petro (`brianpetro/obsidian-smart-connections`).
- **CONFIRMED listed** in the official directory: `community-plugins.json` in `obsidianmd/obsidian-releases` contains the entry `"id": "smart-connections"`, `"name": "Smart Connections"`, `"repo": "brianpetro/obsidian-smart-connections"` (verified against the raw master file; ~5,882 plugins total, Smart Connections present).
  - Source: <https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json>
- **License = custom source-available, NOT open source.** The repo's LICENSE is the **"Smart Plugins License Agreement"** — a proprietary/source-available license with a non-compete clause.
  - Source: <https://github.com/brianpetro/obsidian-smart-connections/blob/main/LICENSE>
  - Key restriction: bars using the software as "a substantial component of any product or service that ... is marketed for use with ... Obsidian ... and (b) is offered as a general-purpose solution to multiple unrelated customers." Carve-outs for "private use, internal use within a single organization, or bespoke or client-specific implementations."
  - History: switched from **GPLv3 → a modified-MIT-with-noncompete** in commit `f411b3e` (Dec 9, 2025). Also marketed as the "Smart Plugins License": <https://smartconnections.app/legal/license/>
- The license change drew community criticism (issue #1293, discussion #1294) — but critically, **the plugin remained in the community directory throughout**. This is direct precedent that a custom, commercially-restrictive, non-OSI license does not get a plugin removed or rejected.

This is a near-exact match for the proposed **KSAL-2.3** shape (free for personal/non-commercial use; commercial use restricted).

---

## 4. What the review bot / reviewers actually enforce re: licensing

Sources:
- Submission guide (DeepWiki mirror of `obsidian-releases`): <https://deepwiki.com/obsidianmd/obsidian-releases/6.1-plugin-submission-guide>
- Releasing guide (DeepWiki mirror of developer-docs): <https://deepwiki.com/obsidianmd/obsidian-developer-docs/2.8-releasing-your-plugin>

The automated validation bot on the `community-plugins.json` PR checks structural/manifest correctness: manifest fields, unique plugin ID, repo existence, release assets (`main.js`, `manifest.json`, optional `styles.css`), version tag matching, description formatting, etc. Human reviewers additionally check the code-quality/API guidelines and the developer policies. The **only licensing check is presence + clear indication of a LICENSE** — there is no automated or manual check that the license is OSI-approved or "open" in any FSF/OSI sense. A source-available license satisfies "has a LICENSE and clearly indicates it."

---

## 5. Caveats / recommendations (to stay clean)

1. **Include a LICENSE file at repo root** and reference the license clearly in README + `manifest.json` context. This is the one hard requirement.
2. If any bundled/derived code carries its own license (e.g. dependencies, submodules like `obsidian-id-lib`), **comply with and attribute** those licenses — this is explicitly required. A restrictive plugin license cannot override incompatible upstream terms (e.g. GPL dependencies).
3. If the plugin is effectively source-available but not "open," a brief **README disclosure** of the licensing/commercial terms is advisable (aligns with the closed-source case-by-case guidance and avoids reviewer friction).
4. Custom licenses get more scrutiny for *clarity* than permissive ones — write KSAL-2.3 unambiguously so a reviewer can tell what's permitted.

---

## Sources
- Developer policies: <https://docs.obsidian.md/Developer+policies>
- Submission requirements: <https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins>
- Submit your plugin: <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>
- Forum — plugins & problematic licensing (moderator statement): <https://forum.obsidian.md/t/plugins-and-problematic-licensing/48631>
- community-plugins.json (Smart Connections listed): <https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json>
- Smart Connections LICENSE (custom source-available): <https://github.com/brianpetro/obsidian-smart-connections/blob/main/LICENSE>
- Smart Connections repo: <https://github.com/brianpetro/obsidian-smart-connections>
- Smart Plugins License page: <https://smartconnections.app/legal/license/>
- Submission guide (bot rules): <https://deepwiki.com/obsidianmd/obsidian-releases/6.1-plugin-submission-guide>
