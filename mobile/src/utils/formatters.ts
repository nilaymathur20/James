/**
 * Formatting helpers for dates, file sizes, durations, etc.
 */

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** "Sep 30, 7:45 PM" */
export function formatDate(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleString(undefined, DATE_OPTIONS);
}

/** "Today at 7:45 PM" / "Yesterday" / "Sep 28" */
export function formatDateRelative(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  }
  if (diffDays < 7) {
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    return `${dayName} at ${timeStr}`;
  }
  return formatDate(d);
}

/** "1.2 KB" / "3.4 MB" / "500 B" */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** "2:34" / "1:02:34" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** "12.3K" / "1.2M" */
export function formatNumber(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${(value / 1_000_000_000).toFixed(1)}B`;
}

/** Truncate path to show just filename for display. */
export function shortenPath(path: string, maxLen = 60): string {
  if (path.length <= maxLen) return path;
  const parts = path.split('/');
  if (parts.length > 2) {
    const head = parts[0];
    const tail = parts[parts.length - 1];
    return `${head}/…${tail}`;
  }
  return `…${path.slice(-(maxLen - 1))}`;
}
