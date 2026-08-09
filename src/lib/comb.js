// src/lib/comb.js
//
// The comb: Singapore drawn as a honeycomb, with every Lazybee room sitting on a
// cell at the home's real coordinates. Ported from the SVG builder in
// design-preview/owners.html, with one change of approach: the prototype created
// SVG nodes imperatively and repainted their fill attributes on every theme flip,
// this returns a plain description of the geometry and lets React render it and
// CSS colour it. Same picture, no DOM writing outside React, and the theme toggle
// costs nothing because the fills are custom properties.
//
// Pure, no DOM, no React, so the geometry can be tested with node --test.

const PAD = 8, SQ3 = Math.sqrt(3), VW = 960, R = 13.4;      /* fatter cells, as asked */

/** The six neighbours of a cell, then the six after that. A home claims its centre
    and then as many surrounding cells as it has rooms. */
const RING = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const RING2 = [[1, 1], [2, -1], [-1, 2], [-2, 1], [1, -2], [-1, -1]];

const hexPts = (cx, cy, rr) => {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = (90 + 60 * i) * Math.PI / 180;
    p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy - rr * Math.sin(a)).toFixed(2));
  }
  return p.join(' ');
};

const px = (q, r) => [SQ3 * R * (q + r / 2), 1.5 * R * r];

/** Pixel position back to the nearest hex, by cube rounding. */
const toAxial = (x, y) => {
  const q = (x * SQ3 / 3 - y / 3) / R, r = (y * 2 / 3) / R;
  let cx = q, cz = r, cy = -cx - cz;
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return [rx, rz];
};

/**
 * Build the whole comb.
 *
 * @param {number[][]} island   coastline as [lng, lat] pairs
 * @param {object[]} homes      HOMES, each with { code, ll: [lng, lat] }
 * @param {function} roomsFor   (homeCode) to that home's rooms, in display order
 * @param {function} isLet      (room) to true when the room is let today
 */
export function buildComb(island, homes, roomsFor, isLet) {
  const bb = island.reduce(
    (a, p) => ({
      x0: Math.min(a.x0, p[0]), x1: Math.max(a.x1, p[0]),
      y0: Math.min(a.y0, p[1]), y1: Math.max(a.y1, p[1]),
    }),
    { x0: 9e9, x1: -9e9, y0: 9e9, y1: -9e9 },
  );
  const K = (VW - PAD * 2) / (bb.x1 - bb.x0), VH = (bb.y1 - bb.y0) * K + PAD * 2;
  const proj = (lng, lat) => [PAD + (lng - bb.x0) * K, PAD + (bb.y1 - lat) * K];
  const POLY = island.map((p) => proj(p[0], p[1]));

  /* ray casting, so the lattice stops at the coastline */
  const inside = (x, y) => {
    let h = false;
    for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
      const [xi, yi] = POLY[i], [xj, yj] = POLY[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) h = !h;
    }
    return h;
  };

  const axial = {}, claimed = new Set();
  homes.forEach((h) => { const p = proj(h.ll[0], h.ll[1]); axial[h.code] = toAxial(p[0], p[1]); });
  homes.forEach((h) => {
    const a = axial[h.code];
    claimed.add(a.join(','));
    [...RING, ...RING2].slice(0, roomsFor(h.code).length)
      .forEach((d) => claimed.add((a[0] + d[0]) + ',' + (a[1] + d[1])));
  });

  /* the rest of Singapore, which is the part of the comb we have not built yet */
  const land = [];
  for (let r = -8; r <= Math.ceil(VH / (1.5 * R)) + 4; r++) {
    for (let q = -40; q <= 90; q++) {
      const [x, y] = px(q, r);
      if (x < -4 || x > VW + 4 || y < -4 || y > VH + 4) continue;
      if (!inside(x, y) || claimed.has(q + ',' + r)) continue;
      land.push({ key: q + ',' + r, points: hexPts(x, y, R * 0.94) });
    }
  }

  const combHomes = homes.map((h) => {
    const a = axial[h.code], rooms = roomsFor(h.code);
    const cells = [...RING, ...RING2].slice(0, rooms.length).map((d, i) => {
      const [x, y] = px(a[0] + d[0], a[1] + d[1]), rm = rooms[i];
      return {
        code: rm.code,
        points: hexPts(x, y, R * 0.94),
        state: isLet(rm) ? 'let' : 'open',
        title: rm.code + ', ' + rm.type + ', ' + (isLet(rm) ? 'let' : 'open now'),
      };
    });
    const [cx, cy] = px(a[0], a[1]);
    return {
      code: h.code,
      cells,
      core: hexPts(cx, cy, R * 0.94),
      label: { x: cx, y: cy + R * 0.3, size: +(R * 0.72).toFixed(1) },
    };
  });

  return { width: VW, height: Math.round(VH), land, homes: combHomes };
}
