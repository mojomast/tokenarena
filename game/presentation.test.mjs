import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRenderState, resetNetworkPresentation} from './presentation.mjs';

const local = {id: 'local', mapId: 'a'};
const netState = {id: 'net', mapId: 'b'};
const demoState = {id: 'demo', mapId: 'c'};

test('selection and menu modes never render a stale local match', () => {
  for (const mode of ['selection', 'browse', 'lobby', 'theater']) {
    const chosen = selectRenderState(mode, {match: local, demoState, netState, netStarted: true});
    assert.notEqual(chosen, local, `${mode} must not render the leftover local match`);
  }
  assert.equal(selectRenderState('selection', {match: local}), null);
  assert.equal(selectRenderState('lobby', {match: local, netStarted: true}), null);
});

test('theater renders demo playback even when a local match is loaded', () => {
  assert.equal(selectRenderState('theater', {match: local, demoState}), demoState);
  assert.equal(selectRenderState('theater', {match: local}), null);
});

test('playing renders the network snapshot when online, else the local match', () => {
  assert.equal(selectRenderState('playing', {match: local, netState, netStarted: true}), netState);
  assert.equal(selectRenderState('playing', {match: local, netState, netStarted: false}), local);
  assert.equal(selectRenderState('playing', {match: local, netStarted: true}), null);
});

test('paused and results keep rendering the local match', () => {
  assert.equal(selectRenderState('paused', {match: local, demoState}), local);
  assert.equal(selectRenderState('results', {match: local, demoState}), local);
});

test('returning from the lobby rebuilds the network view and clears showcase state', () => {
  const runtime = {netViewReady: true, showcaseMatchedId: 'catacombs'};
  const calls = [];
  const view = {
    setShowcase: v => calls.push(['showcase', v]),
    setCinema: v => calls.push(['cinema', v]),
    setDirector: v => calls.push(['director', v]),
  };
  resetNetworkPresentation(runtime, view);
  assert.equal(runtime.netViewReady, false);
  assert.equal(runtime.showcaseMatchedId, null);
  assert.deepEqual(calls, [['showcase', null], ['cinema', false], ['director', null]]);
});

test('resetNetworkPresentation tolerates a missing runtime or view', () => {
  assert.doesNotThrow(() => resetNetworkPresentation(null, {}));
  assert.doesNotThrow(() => resetNetworkPresentation({netViewReady: true}, null));
});
