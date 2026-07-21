import { DevOverridesFileSource } from './DevOverridesFileSource';

/**
 * DEV-only config overrides, parsed from the overrides JSON file. A typed
 * PARTIAL map: only keys present in the file are set. Extensible — add fields
 * here (e.g. `unfocusGraceMs`) as more constants need e2e overriding — but no
 * unused keys are declared until a consumer exists.
 */
export interface DevConfigOverrides {
  readonly idleTimeoutSeconds?: number;
}

/**
 * Reads and parses the dev overrides file ONCE at construction. The parsed
 * result is exposed via `overrides`; a missing/mobile/malformed file yields an
 * empty overrides object (never throws), so downstream code always behaves.
 */
export class DevConfigOverridesReader {
  readonly overrides: DevConfigOverrides;

  constructor(source: DevOverridesFileSource) {
    this.overrides = DevConfigOverridesReader.parse(source.readRawJson());
  }

  private static parse(rawJson: string | null): DevConfigOverrides {
    if (rawJson === null) {
      return {};
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      // The file WAS provided but is not valid JSON — a genuine dev/e2e misconfig.
      console.error('[VHP][DevConfigOverridesReader] overrides file is not valid JSON', err);
      return {};
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    // Boundary: JSON.parse yields `unknown`; narrow each consumed key by type.
    const record: Record<string, unknown> = parsed as Record<string, unknown>;
    const idleTimeoutSeconds = record.idleTimeoutSeconds;
    return {
      idleTimeoutSeconds: typeof idleTimeoutSeconds === 'number' ? idleTimeoutSeconds : undefined,
    };
  }
}
