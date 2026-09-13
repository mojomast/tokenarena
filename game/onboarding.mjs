// First-run coach content. Pure and engine-free so the steps and the
// show/dismiss decision are unit-testable and shared by the UI.
export const ONBOARDING_STORAGE_KEY = 'token-arena-onboarded';

export const ONBOARDING_STEPS = Object.freeze([
  Object.freeze({id: 'move', title: 'MOVE', detail: 'WASD to move, Space to jump, Shift to sprint, Ctrl or C to crouch and slide.'}),
  Object.freeze({id: 'fight', title: 'FIGHT', detail: 'Left mouse fires, right mouse aims, R reloads, F melees and G throws a frag. Scroll or use 1-0 to switch weapons.'}),
  Object.freeze({id: 'objective', title: 'PLAY THE OBJECTIVE', detail: 'Hold the hill, carry the flag, or push the payload cart. The current goal and score run along the top of the screen.'}),
  Object.freeze({id: 'adapt', title: 'MAKE IT YOURS', detail: 'Set invert look, sensitivity, captions, HUD clarity and colourblind team colours in Settings at any time.'}),
]);

export function onboardingStepCount() {
  return ONBOARDING_STEPS.length;
}

export function clampOnboardingStep(index, total = ONBOARDING_STEPS.length) {
  const value = Math.floor(Number(index));
  if (!Number.isFinite(value) || value < 0) return 0;
  const max = Math.max(0, Number(total) - 1);
  return Math.min(max, value);
}

export function shouldShowOnboarding(stored, entered) {
  return stored !== true && stored !== '1' && entered !== true;
}
