import english from './en.json';
import type { Asset } from './world';
export type Locale = 'zh-CN' | 'en';
export const LANGUAGE_KEY = 'dwellcraft-language';
export type Params = Record<string, string | number>;
const messages: Record<string, string> = english;
export function resolveLocale(
  saved: string | null,
  languages: readonly string[],
): Locale {
  if (saved === 'zh-CN' || saved === 'en') return saved;
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) return 'zh-CN';
    if (/^en(?:-|$)/i.test(language)) return 'en';
  }
  return 'zh-CN';
}
/** Source Chinese strings remain stable identifiers; never translate persisted design data. */
export function translate(
  locale: Locale,
  key: string,
  params: Params = {},
): string {
  const value = locale === 'en' ? (messages[key.trim()] ?? key) : key;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
export function assetLabel(locale: Locale, asset: Asset): string {
  if (asset.custom || locale === 'zh-CN') return asset.name;
  const parts = asset.name.split('·');
  return parts.map((part) => translate(locale, part)).join(' ');
}
export function matchesAsset(asset: Asset, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  return [asset.name, assetLabel('en', asset)].some((name) =>
    name.toLocaleLowerCase().includes(q),
  );
}
