// Heatmap tile labels with many long (Chinese + Latin) note names. The journey assertion is
// only "the heatmap renders the seeded notes"; the real output is a pair of screenshots in
// the git-ignored .out/ (fitted + zoomed in) for HUMAN review of label wrapping/ellipsis —
// pixel/CSS details are deliberately not asserted (they are unit-tested in TileLabelFitter).
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ID, VIEW_TYPE_HEATMAP } from './constants';
import { HIGH_IDLE_SECONDS } from './harnessFixture';
import { ObsidianHarness, type SeedFile } from './obsidianHarness';

const ROOT_FOLDER = 'label-readability';
// run-e2e.sh cd's to the repo root before invoking Playwright, so cwd IS the repo root.
const SCREENSHOT_DIR = join(process.cwd(), '.out');
const SCREENSHOT_FITTED = join(SCREENSHOT_DIR, 'heatmap-labels.png');
const SCREENSHOT_ZOOMED = join(SCREENSHOT_DIR, 'heatmap-labels-zoomed.png');
const VIEWPORT = { width: 1280, height: 800 } as const;

const CHINESE_PHRASES = [
  '关于分布式系统中一致性协议的深入研究笔记',
  '二零二六年第三季度产品路线图与团队目标回顾',
  '如何在大型代码库中进行安全的重构与迁移',
  '读书笔记：思考快与慢中的认知偏差总结',
  '家庭旅行计划：云南大理丽江香格里拉十日游',
  '机器学习模型部署到生产环境的最佳实践清单',
  '会议纪要：后端平台架构评审与性能优化讨论',
  '个人财务规划与长期投资组合再平衡策略',
  '中文长文件名在热力图中的显示与截断测试',
  '数据库索引设计原则以及常见反模式分析',
  '每周回顾：工作进展、阻碍事项与下周计划',
  '学习日语的方法总结与常用语法点整理',
];
const LATIN_NAMES = [
  'quarterly-business-review-engineering-platform-2026-q3',
  'Meeting notes with the backend platform team about caching',
  'how_to_safely_refactor_and_migrate_large_codebases',
  'Reading list for distributed systems and consensus protocols',
  'trip.planning.yunnan.dali.lijiang.shangri-la.ten-days',
  'Supercalifragilisticexpialidociousnotenamewithoutanybreakpoints',
  'Weekly review - progress, blockers and next week plan',
  'Personal finance plan and long term portfolio rebalancing',
  'Database index design principles and common antipatterns',
  'Short',
];
/** A short-named, large note whose tile always has room for its full name — the journey anchor. */
const ANCHOR_NOTE_NAME = '总览';
const ANCHOR_NOTE_BYTES = 40_000;
/** Enough tiny notes in one sub-folder that it collapses into a single dense-folder tile. */
const DENSE_FOLDER = `${ROOT_FOLDER}/一个包含大量小笔记的非常长的文件夹名称用于折叠测试`;
const DENSE_NOTE_COUNT = 300;
const NESTED_FOLDER = `${ROOT_FOLDER}/项目文档与设计评审记录（长文件夹名）`;
const BYTES_STEP = 700;
const ZOOM_WHEEL_DELTA_PX = -400;
// @visx/zoom scales ×1.1 per wheel-up event → 1.1^15 ≈ 4× zoom.
const ZOOM_WHEEL_STEPS = 15;

/** Each base name is seeded once per variant, so the folder holds MANY tiles (small ones too). */
const NAME_VARIANTS = ['', ' (draft 2)', '-archive-copy-2026'] as const;
/** Sizes cycle through this many steps, so tiles range from roomy to cramped. */
const SIZE_STEPS = 13;

function sizedContent(seed: number): string {
  return 'x'.repeat(BYTES_STEP * ((seed % SIZE_STEPS) + 1));
}

function seedFiles(): SeedFile[] {
  const files: SeedFile[] = [{ path: `${ROOT_FOLDER}/${ANCHOR_NOTE_NAME}.md`, content: 'x'.repeat(ANCHOR_NOTE_BYTES) }];
  NAME_VARIANTS.forEach((variant, v) => {
    CHINESE_PHRASES.forEach((name, i) => {
      files.push({ path: `${ROOT_FOLDER}/${name}${variant}.md`, content: sizedContent(i * 7 + v * 3) });
    });
    LATIN_NAMES.forEach((name, i) => {
      files.push({ path: `${ROOT_FOLDER}/${name}${variant}.md`, content: sizedContent(i * 5 + v * 4) });
    });
  });
  CHINESE_PHRASES.forEach((name, i) => {
    files.push({ path: `${NESTED_FOLDER}/${name}（副本）.md`, content: sizedContent(i) });
  });
  for (let i = 0; i < DENSE_NOTE_COUNT; i++) {
    files.push({ path: `${DENSE_FOLDER}/小笔记-${i}.md`, content: 'x' });
  }
  return files;
}

/** Zooms the treemap in around the centre of its canvas with real wheel events. */
async function zoomIn(page: Page): Promise<void> {
  const canvas = page.locator('.vault-heatmap-view #viz > svg');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('heatmap canvas has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < ZOOM_WHEEL_STEPS; i++) await page.mouse.wheel(0, ZOOM_WHEEL_DELTA_PX);
  // The zoom transform lands on the canvas's top <g>; wait until it is no longer the identity.
  await expect(canvas.locator(':scope > g')).not.toHaveAttribute('transform', /matrix\(1, 0, 0, 1, 0, 0\)/);
}

test.describe('heatmap labels with long names', () => {
  let h: ObsidianHarness | undefined;

  // GIVEN the heatmap opened on a folder of many long Chinese + Latin note names,
  // in a desktop-sized pane with both sidebars collapsed.
  test.beforeEach(async () => {
    h = await ObsidianHarness.launch({
      idleTimeoutSeconds: HIGH_IDLE_SECONDS,
      minFocusSecondsToRecord: 0,
      seedFiles: seedFiles(),
    });
    await h.trustVaultAuthor(); // its modal would cover the screenshot
    await h.page.evaluate(() => {
      window.app.workspace.leftSplit.collapse();
      window.app.workspace.rightSplit.collapse();
    });
    await h.page.setViewportSize(VIEWPORT);
    await h.page.evaluate(
      async ([viewType, folderPath, pluginId]) => {
        if (!window.app.plugins.plugins[pluginId]) throw new Error('plugin not loaded');
        await window.app.workspace.getLeaf(true).setViewState({ type: viewType, active: true, state: { folderPath } });
      },
      [VIEW_TYPE_HEATMAP, ROOT_FOLDER, PLUGIN_ID] as const,
    );
    await h.waitForActiveViewType(VIEW_TYPE_HEATMAP);
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test.afterEach(async () => {
    if (h) await h.close();
    h = undefined;
  });

  function page(): Page {
    if (!h) throw new Error('harness accessed outside a test (beforeEach did not run)');
    return h.page;
  }

  test('should render the seeded notes as labelled tiles (screenshots in .out/)', async () => {
    const anchorLabel = page().locator('.vault-heatmap-view .leaf-node__label', { hasText: ANCHOR_NOTE_NAME });

    await expect(anchorLabel.first()).toBeVisible();

    await page().screenshot({ path: SCREENSHOT_FITTED });
    await zoomIn(page());
    await page().screenshot({ path: SCREENSHOT_ZOOMED });
  });
});
