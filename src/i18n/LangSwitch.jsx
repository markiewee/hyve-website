import { useLanguage } from './LanguageContext';

/**
 * The EN / 中文 control, sitting in the header slot the light-dark button used
 * to hold until 10 Aug 2026.
 *
 * Labelled with the language you *get* by pressing it, which is how the
 * bilingual sites here do it. Labelling it with the current language instead
 * makes half the visitors press it twice to find out which way it goes.
 *
 * The label is the writing system itself rather than a globe icon, because 中文
 * is legible to exactly the person who needs it and needs no tooltip. The portal
 * uses a two-button EN | 中文 pair; the marketing header has one slot, so this is
 * a single toggle.
 */
export default function LangSwitch() {
  const { lang, setLanguage } = useLanguage();
  const goingChinese = lang !== 'zh';

  return (
    <button
      className="langbtn"
      type="button"
      lang={goingChinese ? 'zh-Hans' : 'en'}
      onClick={() => setLanguage(goingChinese ? 'zh' : 'en')}
      aria-label={goingChinese ? '切换到中文 / Switch to Chinese' : 'Switch to English / 切换到英文'}
    >
      {goingChinese ? '中文' : 'EN'}
    </button>
  );
}
