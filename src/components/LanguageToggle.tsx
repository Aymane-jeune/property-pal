import { useI18n } from '@/contexts/I18nContext';
import { Globe } from 'lucide-react';

const LanguageToggle = () => {
  const { lang, setLang } = useI18n();

  return (
    <button
      onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Globe className="w-4 h-4" />
      {lang === 'fr' ? 'EN' : 'FR'}
    </button>
  );
};

export default LanguageToggle;
