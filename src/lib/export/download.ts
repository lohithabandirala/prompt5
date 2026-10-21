/**
 * Replace characters that are illegal in filenames on common platforms.
 */
export function sanitizeFilename(name: string, fallback = 'event-plan'): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

/**
 * Trigger a real browser download. No-op on the server.
 */
export function downloadFile(content: string, filename: string, mimeType: string): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = sanitizeFilename(filename);
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    return true;
  } finally {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}
