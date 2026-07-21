import { describe, expect, it } from 'vitest';
import type {
  App,
  SettingDefinitionControl,
  SettingDefinitionGroup,
  SettingNumberControl,
} from 'obsidian';
import { VisitHistorySettingTab } from './VisitHistorySettingTab';
import { DEFAULT_IDLE_TIMEOUT_SECONDS, MIN_IDLE_TIMEOUT_SECONDS } from '../settings';
import type VisitHistoryPlugin from '../main';
import type { DocIdBackfillService } from '../core/service/docId/DocIdBackfillService';
import type { UserNotifier } from '../core/util/userComm/UserNotifier';

/**
 * getSettingDefinitions() returns plain data and never renders imperative UI,
 * so the tab can be built with hollow boundary fakes and the definitions
 * inspected directly.
 */
function buildTab(): VisitHistorySettingTab {
  return new VisitHistorySettingTab(
    {} as unknown as App,
    {} as unknown as VisitHistoryPlugin,
    {} as unknown as DocIdBackfillService,
    {} as unknown as UserNotifier,
  );
}

function idleTimeoutControl(): SettingNumberControl {
  const definition = buildTab().getSettingDefinitions()[0] as SettingDefinitionControl;
  return definition.control as SettingNumberControl;
}

function backfillGroup(): SettingDefinitionGroup {
  return buildTab().getSettingDefinitions()[1] as SettingDefinitionGroup;
}

describe('VisitHistorySettingTab', () => {
  describe('isValidIdleTimeoutSeconds', () => {
    it('should reject a value below the minimum', () => {
      // GIVEN a value one below the minimum
      // WHEN validating
      // THEN it is rejected
      expect(VisitHistorySettingTab.isValidIdleTimeoutSeconds(MIN_IDLE_TIMEOUT_SECONDS - 1)).toBe(false);
    });

    it('should reject a non-integer value', () => {
      // GIVEN a fractional value above the minimum
      // WHEN validating
      // THEN it is rejected (only whole seconds are accepted)
      expect(VisitHistorySettingTab.isValidIdleTimeoutSeconds(MIN_IDLE_TIMEOUT_SECONDS + 0.5)).toBe(false);
    });

    it('should accept the minimum integer', () => {
      // GIVEN exactly the minimum
      // WHEN validating
      // THEN it is accepted
      expect(VisitHistorySettingTab.isValidIdleTimeoutSeconds(MIN_IDLE_TIMEOUT_SECONDS)).toBe(true);
    });
  });

  describe('getSettingDefinitions', () => {
    it('should name the idle-timeout setting for search and rendering', () => {
      // GIVEN the declarative definitions
      // WHEN reading the first definition
      // THEN it carries the idle-timeout name
      const definition = buildTab().getSettingDefinitions()[0] as SettingDefinitionControl;
      expect(definition.name).toBe('Idle timeout (seconds)');
    });

    it('should expose the idle-timeout control as a number input', () => {
      // GIVEN the idle-timeout control
      // WHEN reading its type
      // THEN it is a number control
      expect(idleTimeoutControl().type).toBe('number');
    });

    it('should bind the idle-timeout control to the persisted settings key', () => {
      // GIVEN the idle-timeout control
      // WHEN reading its key
      // THEN it targets settings.idleTimeoutSeconds
      expect(idleTimeoutControl().key).toBe('idleTimeoutSeconds');
    });

    it('should constrain the idle-timeout control to the minimum', () => {
      // GIVEN the idle-timeout control
      // WHEN reading its min
      // THEN it is the shared minimum
      expect(idleTimeoutControl().min).toBe(MIN_IDLE_TIMEOUT_SECONDS);
    });

    it('should default the idle-timeout control to the shared default', () => {
      // GIVEN the idle-timeout control
      // WHEN reading its defaultValue
      // THEN it is the shared default
      expect(idleTimeoutControl().defaultValue).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    });

    it('should reject an out-of-range value via validate', () => {
      // GIVEN the control validate
      // WHEN validating a below-minimum value
      // THEN an inline error string is returned
      expect(idleTimeoutControl().validate?.(MIN_IDLE_TIMEOUT_SECONDS - 1)).toBeTypeOf('string');
    });

    it('should reject a non-integer value via validate', () => {
      // GIVEN the control validate
      // WHEN validating a fractional value
      // THEN an inline error string is returned
      expect(idleTimeoutControl().validate?.(MIN_IDLE_TIMEOUT_SECONDS + 0.5)).toBeTypeOf('string');
    });

    it('should accept a valid value via validate', () => {
      // GIVEN the control validate
      // WHEN validating a whole value at the minimum
      // THEN no error is returned
      expect(idleTimeoutControl().validate?.(MIN_IDLE_TIMEOUT_SECONDS)).toBeUndefined();
    });

    it('should group the backfill action under its heading', () => {
      // GIVEN the declarative definitions
      // WHEN reading the group heading
      // THEN it is the file-modifying-actions heading
      expect(backfillGroup().heading).toBe('File modifying actions');
    });

    it('should provide the backfill button via a render escape hatch', () => {
      // GIVEN the backfill group's single item
      // WHEN checking how it is expressed
      // THEN it uses render (no declarative button control exists)
      const item = backfillGroup().items?.[0];
      expect(item !== undefined && 'render' in item).toBe(true);
    });
  });
});
