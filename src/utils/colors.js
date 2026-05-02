function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function hexToRGB(hex) {
  const h = parseInt(hex.replace('#', ''), 16);
  return [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
}

function lerpColor(hexA, hexB, t) {
  const [ar, ag, ab] = hexToRGB(hexA);
  const [br, bg, bb] = hexToRGB(hexB);
  return `rgb(${lerp(ar, br, t)},${lerp(ag, bg, t)},${lerp(ab, bb, t)})`;
}

// ratio 0→red, 0.5→khaki, 1→olive
export function completionColor(ratio) {
  if (ratio == null) return '#3A3A3C';
  if (ratio <= 0) return '#FF453A';
  if (ratio >= 1) return '#6B7C3F';
  if (ratio <= 0.5) return lerpColor('#FF453A', '#C8B87A', ratio * 2);
  return lerpColor('#C8B87A', '#6B7C3F', (ratio - 0.5) * 2);
}
