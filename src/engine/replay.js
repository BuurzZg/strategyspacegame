// Replaying a map: a fresh World built from the same settings, given the same orders on the
// same frames, ends up in exactly the same state (the simulation is deterministic). Saves made
// in the middle of a map store the settings' source (the voyage) and the order log, and come
// back to life this way.
//   frames: [[frame, client, orders], ...] as the OrderManager records them

export function replayInto(world, frames, toFrame) {
  const byFrame = new Map();
  for (const [f, c, orders] of frames) { if (!byFrame.has(f)) byFrame.set(f, []); byFrame.get(f).push([c, orders]); }
  const playerFor = (c) => world.players.find((p) => p.clientIndex === c) || null;
  while (world.frame < toFrame) {
    const list = byFrame.get(world.frame);
    if (list) for (const [c, orders] of list) { const p = playerFor(c); for (const o of orders) if (p || o.w) world.resolveOrder(o, p); }
    world.tick();
    world.fxEvents.length = 0;
  }
}
