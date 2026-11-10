// The crew. For now a head count in four roles; everything goes through these functions and
// nothing reads the numbers directly, so named crew members with traits (Milestone 13) can
// replace the counts without changing the callers.
//
// A roster is plain data:  { roles: { engineers, pilots, miners, hands }, assigned: { ... } }
//   roles     everyone, by role
//   assigned  those flying ships in the fleet (the rest are free for work and new ships)

export const ROLES = ['engineers', 'pilots', 'miners', 'hands'];

export function makeRoster(counts) {
  const roles = {}, assigned = {};
  for (const r of ROLES) { roles[r] = Math.max(0, counts[r] | 0); assigned[r] = 0; }
  return { roles, assigned };
}

export const count = (c, role) => (role ? c.roles[role] | 0 : ROLES.reduce((s, r) => s + (c.roles[r] | 0), 0));
export const free = (c, role) => Math.max(0, (c.roles[role] | 0) - (c.assigned[role] | 0));
export const freeAll = (c) => Object.fromEntries(ROLES.map((r) => [r, free(c, r)]));

// Put n of a role to work on a ship (false if there are not enough free).
export function assign(c, role, n) {
  if (free(c, role) < n) return false;
  c.assigned[role] = (c.assigned[role] | 0) + n;
  return true;
}
export function release(c, role, n) { c.assigned[role] = Math.max(0, (c.assigned[role] | 0) - n); }

// n of a role die (or leave). Free crew go first; if a role runs short, ships lose theirs too.
export function lose(c, role, n) {
  const k = Math.min(n | 0, c.roles[role] | 0);
  c.roles[role] -= k;
  if (c.assigned[role] > c.roles[role]) c.assigned[role] = c.roles[role];
  return k;
}

// n people from the whole crew, spread over the roles in proportion to their size (largest
// remainder first, in role order on ties). Returns { role: lost }.
export function loseAny(c, n) {
  const total = count(c), out = Object.fromEntries(ROLES.map((r) => [r, 0]));
  n = Math.min(n | 0, total);
  if (n <= 0) return out;
  let left = n;
  const rem = [];
  for (const r of ROLES) {
    const share = Math.trunc((n * c.roles[r]) / total);
    out[r] = share; left -= share;
    rem.push([((n * c.roles[r]) % total), r]);
  }
  rem.sort((a, b) => b[0] - a[0] || ROLES.indexOf(a[1]) - ROLES.indexOf(b[1]));
  for (let i = 0; left > 0; i = (i + 1) % rem.length) { const r = rem[i][1]; if (c.roles[r] - out[r] > 0) { out[r]++; left--; } }
  for (const r of ROLES) lose(c, r, out[r]);
  return out;
}

// Re-count who is flying: the crew of every ship in the fleet (types), from the rules.
export function assignFleet(c, rules, fleet) {
  for (const r of ROLES) c.assigned[r] = 0;
  for (const e of fleet) {
    const k = rules.actor(e.type).traitInfo('Crew');
    if (k && k.Count) c.assigned[k.Role] = Math.min(c.roles[k.Role] | 0, (c.assigned[k.Role] | 0) + k.Count);
  }
}
