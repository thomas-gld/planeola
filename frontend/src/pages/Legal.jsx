import { Link, useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import { useTranslation } from 'react-i18next';
import Signature from '../components/Signature';
import legalEn from '../legal/legal.en.md?raw';
import legalFr from '../legal/legal.fr.md?raw';
import privacyEn from '../legal/privacy.en.md?raw';
import privacyFr from '../legal/privacy.fr.md?raw';

const PAGES = {
  legal: { en: marked.parse(legalEn), fr: marked.parse(legalFr) },
  privacy: { en: marked.parse(privacyEn), fr: marked.parse(privacyFr) },
};

// The app's language. `?lang=` wins, for the links between the two versions in the texts.
function pickLanguage(param, appLanguage) {
  if (param === 'en' || param === 'fr') return param;
  return appLanguage === 'fr' ? 'fr' : 'en';
}

export default function Legal({ page }) {
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const lang = pickLanguage(searchParams.get('lang'), i18n.resolvedLanguage);

  return (
    <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <Link to="/" className="block w-fit mb-6">
          <img src="/planeola_rect.png" alt="Planeola" className="h-10 w-auto" />
        </Link>
        <div className="card-brutal p-6 sm:p-9">
          {/* Our own files from src/legal, not user input. */}
          <div
            lang={lang}
            className="legal-prose"
            dangerouslySetInnerHTML={{ __html: PAGES[page][lang] }}
          />
        </div>
        <div className="mt-6 font-mono text-xs text-ink/40">
          <Signature />
        </div>
      </div>
    </div>
  );
}
