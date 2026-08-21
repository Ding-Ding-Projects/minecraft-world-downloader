import { describe, expect, it, beforeEach } from 'vitest';
import { shell } from '../../src/renderer/shell';

/**
 * The shell's navigation and subtitle channels must stay separate.
 *
 * This is the invariant whose absence left the application on a blank window.
 * `setSubtitle` used to re-emit the NAVIGATION channel so the header could pick
 * a subtitle change up without a subscription of its own. The shell's own
 * `renderActiveScreen` is on that channel and mounts the active screen, so a
 * screen that set its own subtitle while mounting mounted itself again, and
 * again, forever. It was a synchronous loop with no exception to surface it:
 * the renderer pegged a core, never reached first paint, and the window stayed
 * blank with nothing in the console. The downloader screen -- the default
 * destination -- did exactly this, so no launch ever painted anything.
 *
 * A test that only checked "the header updates" would have passed throughout,
 * because the header did update. What has to be asserted is the thing that must
 * NOT happen.
 */

let disposers: Array<() => void> = [];

function track(dispose: () => void): void {
  disposers.push(dispose);
}

beforeEach(() => {
  for (const dispose of disposers) dispose();
  disposers = [];
});

function registerScreen(id: string): void {
  if (shell.screen(id)) return;
  shell.register({ id, title: `${id}.title`, mount: () => undefined });
}

describe('the shell keeps navigation and subtitle changes on separate channels', () => {
  it('does NOT fire the navigation channel when a subtitle changes', () => {
    registerScreen('alpha');
    shell.go('alpha');

    let navigations = 0;
    track(shell.onChange(() => { navigations += 1; }));

    shell.setSubtitle('alpha', 'Capturing something');

    // The whole defect in one assertion: a subtitle change reaching the
    // navigation channel is what remounts the screen.
    expect(navigations).toBe(0);
  });

  it('does fire the subtitle channel, so the header still updates', () => {
    registerScreen('beta');
    shell.go('beta');

    let subtitleChanges = 0;
    track(shell.onSubtitleChange(() => { subtitleChanges += 1; }));

    shell.setSubtitle('beta', 'Stopped');

    expect(subtitleChanges).toBe(1);
    expect(shell.subtitleOverride('beta')).toBe('Stopped');
  });

  it('a screen setting its own subtitle repeatedly cannot drive unbounded navigation', () => {
    registerScreen('gamma');
    shell.go('gamma');

    let navigations = 0;
    track(shell.onChange(() => { navigations += 1; }));

    // Stands in for a screen's mount pushing a live status on every tick.
    for (let i = 0; i < 50; i += 1) shell.setSubtitle('gamma', `Captured ${i} chunks`);

    expect(navigations).toBe(0);
  });

  it('ignores a repeated identical subtitle rather than notifying for nothing', () => {
    registerScreen('delta');
    shell.go('delta');

    let subtitleChanges = 0;
    track(shell.onSubtitleChange(() => { subtitleChanges += 1; }));

    shell.setSubtitle('delta', 'Stopped');
    shell.setSubtitle('delta', 'Stopped');
    shell.setSubtitle('delta', 'Stopped');

    expect(subtitleChanges).toBe(1);
  });

  it('still fires the navigation channel for a real navigation', () => {
    registerScreen('epsilon');
    registerScreen('zeta');
    shell.go('epsilon');

    let navigations = 0;
    track(shell.onChange(() => { navigations += 1; }));

    shell.go('zeta');

    // Guards the guard: a `setSubtitle` fix that broke navigation entirely
    // would satisfy every assertion above and fail this one.
    expect(navigations).toBe(1);
    expect(shell.current()).toBe('zeta');
  });
});
