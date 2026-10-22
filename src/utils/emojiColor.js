// The color an emoji "reads as": draw it on a small canvas with the device's own
// emoji font and average its pixels, weighting colorful ones over grey outlines
// and white highlights. Then nudge it into a range that shows up on the dark
// background. Null where there's no canvas (or the emoji draws as nothing).
const cache = new Map();

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h, s, l) {
  const f = n => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function emojiColor(emoji) {
  if (!emoji || typeof document === 'undefined') return null;
  if (cache.has(emoji)) return cache.get(emoji);
  let out = null;
  try {
    const size = 36;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.font = `${size - 6}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 2);
    const px = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3] / 255;
      if (a < 0.5) continue;
      const [, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      // Colorful mid-tones count most; outlines, shadows and shine barely count
      const weight = a * (0.05 + s * (1 - Math.abs(l - 0.5) * 1.4));
      r += px[i] * weight; g += px[i + 1] * weight; b += px[i + 2] * weight; w += weight;
    }
    if (w > 0) {
      let [h, s, l] = rgbToHsl(r / w, g / w, b / w);
      // Readable on the dark cards: not too dark or washed out, greys stay grey
      if (s > 0.12) s = Math.max(s, 0.45);
      l = Math.min(0.7, Math.max(0.52, l));
      out = hslToHex(h, s, l);
    }
  } catch { out = null; }
  cache.set(emoji, out);
  return out;
}
