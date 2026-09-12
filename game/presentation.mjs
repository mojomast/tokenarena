// Presentation-state selection kept outside the React component so the
// local/online/demo/showcase precedence is testable without a renderer.

// Pick the snapshot handed to ArenaView.render for the current mode. Local
// matches are only rendered while they own the screen (playing/paused/results);
// demo playback and the menu showcase must not be shadowed by a stale local
// match left over from a previous round.
export function selectRenderState(mode, {match = null, demoState = null, netState = null, netStarted = false} = {}) {
  if (mode === 'theater') return demoState ?? null;
  if (mode === 'playing') return netStarted ? (netState ?? null) : (match ?? null);
  if (mode === 'paused' || mode === 'results') return match ?? null;
  return null;
}

// Returning from the online lobby to the live round must rebuild the network
// view. The showcase director may have replaced the scene/map/camera while the
// lobby was open, so invalidate the cached view and clear presentation-only
// state before the network branch repopulates it from the authoritative peer.
export function resetNetworkPresentation(runtime, view) {
  if (!runtime) return;
  runtime.netViewReady = false;
  runtime.showcaseMatchedId = null;
  view?.setShowcase?.(null);
  view?.setCinema?.(false);
  view?.setDirector?.(null);
}
