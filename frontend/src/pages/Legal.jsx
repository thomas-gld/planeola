import { Link, useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import Signature from '../components/Signature';
import legalEn from '../legal/legal.en.md?raw';
import legalFr from '../legal/legal.fr.md?raw';
import privacyEn from '../legal/privacy.en.md?raw';
import privacyFr from '../legal/privacy.fr.md?raw';

const PAGES = {
  legal: { en: marked.parse(legalEn), fr: marked.parse(legalFr) },
  privacy: { en: marked.parse(privacyEn), fr: marked.parse(privacyFr) },
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

// `?lang=` wins so a link can point at one version, else the browser's language.
function pickLanguage(param) {
  if (param === 'en' || param === 'fr') return param;
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export default function Legal({ page }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = pickLanguage(searchParams.get('lang'));

  return (
    <div className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link to="/" className="inline-block">
            <img src="/planeola_rect.png" alt="Planeola" className="h-10 w-auto" />
          </Link>
          <div className="flex gap-1.5">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                lang={code}
                onClick={() => setSearchParams({ lang: code }, { replace: true })}
                className={`border-2 border-ink rounded-brutal px-3 py-1 font-mono text-xs font-bold uppercase tracking-wide transition ${
                  lang === code ? 'bg-ink text-surface' : 'bg-surface text-ink hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
