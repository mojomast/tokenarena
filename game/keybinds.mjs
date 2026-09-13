// Remappable keyboard bindings. Pure and engine-free so validation, duplicate
// handling and code-to-action resolution are unit-testable.
export const KEYBIND_STORAGE_KEY = 'token-arena-keybinds';

export const DEFAULT_BINDINGS = Object.freeze({
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', crouch: 'ControlLeft',
  reload: 'KeyR', melee: 'KeyF', grenade: 'KeyG', power: 'KeyQ', interact: 'KeyE', voice: 'KeyV',
});

export const KEYBIND_ACTIONS = Object.freeze(Object.keys(DEFAULT_BINDINGS));

const CODE = /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|Tab|Enter|BracketLeft|BracketRight|Semicolon|Quote|Comma|Period|Slash|Backslash|Backquote|Minus|Equal)$/;
const isCode = value => typeof value === 'string' && CODE.test(value);

export function normalizeBindings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = {}, used = new Set();
  for (const action of KEYBIND_ACTIONS) {
    let candidate = isCode(source[action]) ? source[action] : DEFAULT_BINDINGS[action];
    if (used.has(candidate)) candidate = DEFAULT_BINDINGS[action];
    if (used.has(candidate)) candidate = Object.keys(out).length ? null : candidate;
    if (candidate) { out[action] = candidate; used.add(candidate); }
  }
  // Guarantee every action has a key even in pathological inputs.
  for (const action of KEYBIND_ACTIONS) if (!out[action]) out[action] = DEFAULT_BINDINGS[action];
  return out;
}

export function actionForCode(bindings, code) {
  if (typeof code !== 'string') return null;
  for (const action of KEYBIND_ACTIONS) if (bindings?.[action] === code) return action;
  return null;
}

export function bindingConflicts(bindings) {
  const seen = new Set(), conflicts = new Set();
  for (const action of KEYBIND_ACTIONS) {
    const key = bindings?.[action];
    if (!key) continue;
    if (seen.has(key)) conflicts.add(key); else seen.add(key);
  }
  return [...conflicts];
}
