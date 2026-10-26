import { interpolateRgb } from 'd3-interpolate';
import type { VaultNode } from '../core/data/VaultNode';
import { GRADIENTS, TYPE_C, type ColorMode, type GradientKey, type HeatField, type TypeColors } from '../view/constants';

const MS_PER_DAY = 86400000;

/** The heatmap color settings a leaf's base color depends on (day thresholds as plain numbers). */
export interface LeafColorSettings {
  readonly colorMode: ColorMode;
  readonly gradKey: GradientKey;
  readonly field: HeatField;
  readonly hotDays: number;
  readonly coldDays: number;
}

/** A leaf's un-hovered color. */
export interface LeafBaseColor {
  readonly fill: string;
  /** false → `fill` is the gradient's "no data" (nil) color; the heatmap dims these tiles. */
  readonly hasData: boolean;
}

/** The fill + hover pair a file type is drawn with in type color mode. */
export type TypeFillColors = Pick<TypeColors, 'fill' | 'hover'>;

/**
 * The ONE owner of how a file is colored: the heatmap's tiles (view/utils
 * leafFill/leafOpacity — hover brightening stays in the view) and the public
 * cross-plugin API both ask this rule, so they can never disagree.
 *
 * Pure (obsidian-free, no DOM); time is passed in as `nowMs`.
 */
export class LeafColorRule {
  /** Type-mode colors for a file type with no TYPE_C entry. */
  static readonly UNKNOWN_TYPE_COLORS: TypeFillColors = { fill: '#555', hover: '#777' };

  /** The leaf's un-hovered fill and whether it has data under `settings`. */
  static baseColor(leaf: VaultNode, settings: LeafColorSettings, nowMs: number): LeafBaseColor {
    const hasData = LeafColorRule.hasData(leaf, settings.colorMode, settings.field);
    if (settings.colorMode === 'heatmap') {
      const ts = leaf[settings.field];
      return { fill: LeafColorRule.heatColor(ts, settings.gradKey, settings.hotDays, settings.coldDays, nowMs), hasData };
    }
    return { fill: LeafColorRule.typeColors(leaf.type).fill, hasData };
  }

  /** Whether the leaf has data to color by: always in type mode; heatmap mode needs the field's timestamp. */
  static hasData(leaf: VaultNode, colorMode: ColorMode, field: HeatField): boolean {
    return colorMode === 'type' || leaf[field] != null;
  }

  /**
   * Gradient color for a timestamp: hot within `hotDays`, cold from
   * `coldDays`, interpolated in between; the nil color when there is no timestamp.
   */
  static heatColor(
    ts: number | null | undefined,
    gradKey: GradientKey,
    hotDays: number,
    coldDays: number,
    nowMs: number,
  ): string {
    const g = GRADIENTS[gradKey];
    if (ts == null) return g.nil;

    const daysOld = (nowMs - ts) / MS_PER_DAY;
    if (daysOld <= hotDays) return g.hot;
    if (daysOld >= coldDays) return g.cold;

    return interpolateRgb(g.hot, g.cold)((daysOld - hotDays) / (coldDays - hotDays));
  }

  /** Type-mode colors for a file type (UNKNOWN_TYPE_COLORS when the type has no entry). */
  static typeColors(type: VaultNode['type']): TypeFillColors {
    return TYPE_C[type ?? ''] ?? LeafColorRule.UNKNOWN_TYPE_COLORS;
  }
}
