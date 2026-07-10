export const TRACKED_VIEW_TYPES = new Set(['markdown', 'canvas', 'excalidraw']);
export const TRACKED_EXTENSIONS = new Set(["md", "canvas", "excalidraw"]);

export const VISIT_HISTORY_TOP_DIR = "_visit_history";

/**
 * Folders with this exact name are hidden in the heatmap below the current
 * view root — view an archive by right-clicking it in the file explorer and
 * choosing "Open heatmap for folder". See viewModel/pruneArchiveFolders.ts.
 */
export const ARCHIVE_DIR_NAME = "_archive";

