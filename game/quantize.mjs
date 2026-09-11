// Network payload trimming: round every finite number in a snapshot/event tree to
// a fixed decimal precision. Positions and angles to the millimetre are visually
// indistinguishable but stringify several bytes smaller, which matters at the
// 30 Hz snapshot rate. Non-finite numbers (Infinity ammo, NaN) and non-number
// values are left untouched. Mutates and returns the given tree, which the server
// builds fresh for every send, so no shared state is affected.
export function quantizeNumbers(value, precision = 3) {
 const factor = 10 ** precision;
 const round = n => Math.round(n * factor) / factor;
 const walk = node => {
  if (Array.isArray(node)) {
   for (let i = 0; i < node.length; i++) {
    const v = node[i];
    if (typeof v === 'number') { if (Number.isFinite(v)) node[i] = round(v); }
    else if (v && typeof v === 'object') walk(v);
   }
  } else if (node && typeof node === 'object') {
   for (const key of Object.keys(node)) {
    const v = node[key];
    if (typeof v === 'number') { if (Number.isFinite(v)) node[key] = round(v); }
    else if (v && typeof v === 'object') walk(v);
   }
  }
  return node;
 };
 return walk(value);
}
