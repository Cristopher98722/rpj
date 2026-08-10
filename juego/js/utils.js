const Utils = {
  clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  },
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  rand(a, b) {
    return a + Math.random() * (b - a);
  },
  randInt(a, b) {
    return Math.floor(Utils.rand(a, b + 1));
  },
  dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  },
  angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },
  resolveCircleRect(cx, cy, r, rect) {
    const nx = Utils.clamp(cx, rect.x, rect.x + rect.w);
    const ny = Utils.clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nx;
    const dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return null;
    if (d2 > 0) {
      const d = Math.sqrt(d2);
      const push = r - d;
      return { x: cx + (dx / d) * push, y: cy + (dy / d) * push };
    }
    const left = cx - rect.x;
    const right = rect.x + rect.w - cx;
    const top = cy - rect.y;
    const bottom = rect.y + rect.h - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: rect.x - r, y: cy };
    if (m === right) return { x: rect.x + rect.w + r, y: cy };
    if (m === top) return { x: cx, y: rect.y - r };
    return { x: cx, y: rect.y + rect.h + r };
  },
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Utils.clamp(r + amt, 0, 255);
    g = Utils.clamp(g + amt, 0, 255);
    b = Utils.clamp(b + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }
};
