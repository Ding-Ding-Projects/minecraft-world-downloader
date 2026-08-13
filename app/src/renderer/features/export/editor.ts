import type { EditorCandidate, StudioApi } from '../../../shared/api';

/**
 * The Visual Studio Code handoff.
 *
 * Every export lands in Visual Studio Code from one action, either from the run
 * that produced it or from the row the data came from. A folder is opened as a
 * WORKSPACE ROOT rather than as a single file, because a file tree is the whole
 * reason to open a folder in an editor at all.
 *
 * When it is not installed the surface says so and offers the download. It never
 * fails silently, and it never quietly opens some other editor the user did not
 * ask for — a Notepad window appearing instead of Visual Studio Code is a worse
 * outcome than nothing happening, because nothing about it explains itself.
 */

/** The editors this handoff will use, best first. */
const PREFERRED_IDS = ['vscode', 'vscode-insiders', 'vscodium'];

export const VS_CODE_DOWNLOAD_URL = 'https://code.visualstudio.com/download';

export interface EditorAvailability {
  /** Every candidate the machine was probed for, in the order they were tried. */
  candidates: EditorCandidate[];
  /** The Visual Studio Code family members that were actually found. */
  usable: EditorCandidate[];
  /** The one that will be used unless the user chose another. */
  preferred: EditorCandidate | null;
  /** Present when the probe itself failed rather than finding nothing. */
  probeError: string | null;
}

export async function detectEditors(studio: StudioApi): Promise<EditorAvailability> {
  const result = await studio.editor.detect();
  if (!result.ok) {
    return { candidates: [], usable: [], preferred: null, probeError: result.error };
  }
  const candidates = result.value;
  const usable = PREFERRED_IDS.map((id) => candidates.find((candidate) => candidate.id === id)).filter(
    (candidate): candidate is EditorCandidate => candidate !== undefined && candidate.available
  );
  return { candidates, usable, preferred: usable[0] ?? null, probeError: null };
}

export function chooseEditor(availability: EditorAvailability, preferredId: string): EditorCandidate | null {
  if (preferredId) {
    const chosen = availability.usable.find((candidate) => candidate.id === preferredId);
    if (chosen) return chosen;
  }
  return availability.preferred;
}

export interface OpenOutcome {
  ok: boolean;
  /** The editor that was asked, when one was. */
  editor: EditorCandidate | null;
  error: string | null;
}

/**
 * Hands a path to Visual Studio Code.
 *
 * `asFolder` is what makes the difference between a usable workspace and one
 * lonely file: it opens the directory as the workspace root so the tree is
 * there. It is refused rather than downgraded when the chosen editor cannot do
 * it, because silently opening the file instead is exactly the kind of quiet
 * substitution this module exists to avoid.
 */
export async function openInEditor(
  studio: StudioApi,
  target: string,
  options: { availability: EditorAvailability; preferredId: string; asFolder: boolean }
): Promise<OpenOutcome> {
  const editor = chooseEditor(options.availability, options.preferredId);
  if (!editor) {
    return {
      ok: false,
      editor: null,
      error: 'Visual Studio Code was not found on this computer, so nothing was opened.'
    };
  }
  if (options.asFolder && !editor.supportsFolder) {
    return {
      ok: false,
      editor,
      error: `${editor.name} cannot open a folder as a workspace root.`
    };
  }
  const result = await studio.editor.open(target, { editorId: editor.id, asFolder: options.asFolder });
  if (!result.ok) return { ok: false, editor, error: result.error };
  return { ok: true, editor, error: null };
}
