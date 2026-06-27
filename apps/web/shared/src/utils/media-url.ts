/** Resolve Composer / package media refs to Edge static upload URLs. */
export function resolveUploadMediaUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/api/uploads/')) return trimmed.replace('/api/uploads/', '/uploads/');
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  if (trimmed.startsWith('media/')) return `/uploads/${trimmed.slice('media/'.length)}`;
  return `/uploads/${trimmed.replace(/^uploads\//, '')}`;
}
