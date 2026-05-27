// src/components/marketing/CtaBand.jsx
import BrowseRoomsButton from './BrowseRoomsButton';
export default function CtaBand({ source = 'cta_band', heading = 'Find your room', sub = 'All-inclusive co-living from S$950/month. Browse live availability and reserve in minutes.' }) {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto text-center bg-surface-container rounded-3xl border border-border p-10 md:p-14">
        <h2 className="font-display tracking-display text-3xl md:text-4xl font-bold mb-4">{heading}</h2>
        <p className="text-foreground-variant mb-8">{sub}</p>
        <BrowseRoomsButton source={source} />
      </div>
    </section>
  );
}
