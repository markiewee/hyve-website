import { useCallback, useMemo, useRef, useState } from 'react';
import posthog from 'posthog-js';

import SEO from './SEO';
import { orgSchema, faqPageSchema } from '../lib/seo';
import { track, EVENTS, analyticsReady } from '../lib/analytics';
import { assignHeroVariant } from '../lib/experiment';
import { model, DEFAULT_STATE, DI, PSF, districtForPostal } from '../lib/ownerModel';
import { useReveal } from '../hooks/useReveal';
import { FAQ } from '../data/ownerPage';

import { OwnerHeader, OwnerFooter } from './owners/OwnerChrome';
import HeroSection from './owners/HeroSection';
import SplitSection from './owners/SplitSection';
import CombSection from './owners/CombSection';
import PortalSection from './owners/PortalSection';
import ReachSection from './owners/ReachSection';
import FaqSection from './owners/FaqSection';
import AskSection from './owners/AskSection';
import {
  GreenBand, AlignmentSection, CompareSection, TrialSection,
  ComplianceSection, HomesStrip, HiveSection,
} from './owners/StaticSections';

import '../styles/lazybee.css';

/* Assign the hero once per page load, at module level rather than in a hook.
   StrictMode renders components twice in development and we do not want two
   exposure events for one visitor, which would quietly halve the measured
   conversion rate of whichever variant they saw. */
let heroAssignment = null;
function heroOnce() {
  if (!heroAssignment) heroAssignment = assignHeroVariant(analyticsReady() ? posthog : null);
  return heroAssignment;
}

export default function HomePage() {
  const { variant, copy } = heroOnce();

  const [theme, setTheme] = useState('alabaster');
  const [estimator, setEstimator] = useState({ ...DEFAULT_STATE, postal: '' });

  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const started = useRef(false);
  const changeTimer = useRef(null);

  useReveal(rootRef);

  const m = useMemo(() => model(estimator), [estimator]);
  const districtLabel = estimator.district ? `${estimator.district} ${DI[estimator.district]}` : 'Type a code';

  /* One handler for the three hero controls. A postal code moves the district and
     the psf with it, which is the only field that changes more than itself. */
  const onEstimatorChange = useCallback((patch, field) => {
    setEstimator((prev) => {
      const next = { ...prev, ...patch };
      if (patch.postal !== undefined) {
        const d = districtForPostal(patch.postal);
        if (d) { next.district = d; next.psf = PSF[d]; }
      }
      return next;
    });

    if (!started.current) {
      started.current = true;
      track(EVENTS.ESTIMATOR_STARTED, { field });
      return;
    }
    /* Sliders fire on every pixel. Debounced so the funnel reads as "they moved
       the floor area", not as four hundred identical events. */
    clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      track(EVENTS.ESTIMATOR_CHANGED, { field, ...patch });
    }, 400);
  }, []);

  return (
    <div className="lzb" data-theme={theme} ref={rootRef}>
      <SEO
        title="Be a lazy landlord"
        description="Be a lazy landlord. We do the viewings, the contracts and the cleaning on your Singapore unit. You are paid a floor whether it is full or empty, and you still keep half the upside. Ninety days to decide, nothing to pay if you walk."
        canonical="/"
        schema={[orgSchema(), faqPageSchema(FAQ.map(([q, a]) => ({ q, a })))]}
      />

      <OwnerHeader
        heroRef={heroRef}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'tobacco' ? 'alabaster' : 'tobacco'))}
      />

      <main id="top">
        <HeroSection
          heroRef={heroRef}
          variant={variant}
          copy={copy}
          estimator={estimator}
          districtLabel={districtLabel}
          onEstimatorChange={onEstimatorChange}
        />
        <SplitSection m={m} estimator={estimator} districtLabel={districtLabel} />
        <CombSection />
        <GreenBand />
        <AlignmentSection />
        <CompareSection />
        <TrialSection />
        <PortalSection />
        <ReachSection />
        <ComplianceSection />
        <HomesStrip />
        <HiveSection />
        <FaqSection />
        <AskSection m={m} estimator={estimator} variant={variant} copy={copy} />
      </main>

      <OwnerFooter />
    </div>
  );
}
