import { MediaAsset } from '../../database/entities/media-asset.entity';

const MEDIA_TOKEN_RE = /\[(?:Ảnh|Audio):\s*([^\]]+)\]/g;

function basenameRef(ref: string): string {
  return ref.replace(/^media\//, '').split('/').pop() ?? ref;
}

function findAssetForRef(ref: string, assets: MediaAsset[]): MediaAsset | undefined {
  const trimmed = ref.trim();
  if (trimmed.startsWith('/uploads/')) {
    const name = trimmed.slice('/uploads/'.length);
    return assets.find((a) => a.filename === name || a.path === trimmed);
  }
  const base = basenameRef(trimmed);
  return assets.find(
    (a) =>
      a.filename === base ||
      a.filename.endsWith(`-${base}`) ||
      a.path === `/uploads/${base}` ||
      a.path.endsWith(`/${base}`),
  );
}

export function resolveMediaRef(ref: string, assets: MediaAsset[]): string {
  const trimmed = ref.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  const asset = findAssetForRef(trimmed, assets);
  return asset?.path ?? `/uploads/${basenameRef(trimmed)}`;
}

export function resolveMediaTokensInText(text: string, assets: MediaAsset[]): string {
  if (!text || assets.length === 0) return text;
  return text.replace(MEDIA_TOKEN_RE, (full, ref: string) => {
    const resolved = resolveMediaRef(ref, assets);
    return full.replace(ref, resolved);
  });
}

export function resolveMediaInValue<T>(value: T, assets: MediaAsset[]): T {
  if (!value || assets.length === 0) return value;
  if (typeof value === 'string') return resolveMediaTokensInText(value, assets) as T;
  if (Array.isArray(value)) return value.map((item) => resolveMediaInValue(item, assets)) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveMediaInValue(v, assets);
    }
    return out as T;
  }
  return value;
}
