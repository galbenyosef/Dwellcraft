'use client';
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LANGUAGE_KEY,
  resolveLocale,
  translate,
  type Locale,
  type Params,
} from '@/lib/i18n';
type LanguageContext = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Params) => string;
};
const Context = createContext<LanguageContext | null>(null);
const CHANGE_EVENT = 'dwellcraft-language-change';
let memoryLocale: Locale | undefined;
function readLocale(): Locale {
  if (memoryLocale) return memoryLocale;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    /* Private browsing may disable storage. */
  }
  return resolveLocale(saved, navigator.languages);
}
function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === LANGUAGE_KEY || event.key === null) {
      memoryLocale = undefined;
      notify();
    }
  };
  window.addEventListener('storage', sync);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}
function setLocale(next: Locale) {
  memoryLocale = next;
  try {
    localStorage.setItem(LANGUAGE_KEY, next);
  } catch {
    /* The in-memory preference still works. */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    readLocale,
    () => 'zh-CN' as Locale,
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = 'Dwellcraft · ' + translate(locale, '住进想象');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        translate(
          locale,
          '选择一个家，自由布置，让理想生活成为可以走进去的空间。',
        ),
      );
  }, [locale]);
  const t = useCallback(
    (key: string, params?: Params) => translate(locale, key, params),
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLanguage() {
  const context = useContext(Context);
  if (!context) throw new Error('LanguageProvider is missing');
  return context;
}
export function LanguageSwitch() {
  const { locale, setLocale, t } = useLanguage();
  return (
    <fieldset className="language-switch" aria-label={t('语言')}>
      <Languages size={15} aria-hidden="true" />
      <Button
        variant="ghost"
        size="sm"
        lang="zh-CN"
        aria-label="切换到中文"
        aria-pressed={locale === 'zh-CN'}
        onClick={() => setLocale('zh-CN')}
      >
        中文
      </Button>
      <Button
        variant="ghost"
        size="sm"
        lang="en"
        aria-label="Switch to English"
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        EN
      </Button>
    </fieldset>
  );
}
