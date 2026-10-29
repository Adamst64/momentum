// Investing's own look (like Robinhood): pure black, bright green and red-orange.
// The rest of the app keeps the base theme.
import { T as BASE } from '../../theme';

export const T = {
  ...BASE,
  bg:         '#000000',
  card:       '#0C0C0C',
  cardBorder: '#1E1E1E',
  subtle:     '#2A2A2A',
  green:      '#00C805',
  red:        '#FF5000',
};

export const gainColor = n => (n === null || n === undefined || Math.abs(n) < 1e-9 ? T.muted : n > 0 ? T.green : T.red);
