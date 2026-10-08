export const DEFAULT_CATEGORIES = [
  { name: 'lead', color: '#dc2626' },
  { name: 'member', color: '#2563eb' },
  { name: 'intern', color: '#16a34a' },
  { name: 'community service', color: '#ea580c' },
];

export function parseCategories(value) {
  if (!value) return DEFAULT_CATEGORIES;
  try {
    const arr = JSON.parse(value);
    if (Array.isArray(arr)) {
      const clean = arr.filter((c) => c && typeof c.name === 'string' && c.name.trim());
      if (clean.length > 0) {
        return clean.map((c) => ({ name: c.name, color: c.color || '#6b7280' }));
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_CATEGORIES;
}

export function getCategoryColor(categories, category) {
  const cat = categories.find((c) => c.name === category);
  return cat ? cat.color : null;
}

// Grey when unparseable.
export function hexToRgba(hex, alpha) {
  const h = (hex || '').replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.substring(i, i + 2), 16));
  const [r, g, b] = rgb.some(Number.isNaN) ? [107, 114, 128] : rgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
