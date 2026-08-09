// src/components/marketing/BrowseRoomsButton.jsx
import { BOOKING_URL } from '../../lib/booking';
import { track, EVENTS } from '../../lib/analytics';
export default function BrowseRoomsButton({ source, label = 'Browse rooms →', className = '', href = BOOKING_URL }) {
  return (
    <a href={href} onClick={() => track(EVENTS.BROWSE_ROOMS_CLICK, { source })}
      className={`inline-flex items-center justify-center bg-accent text-accent-foreground font-display font-bold px-7 py-3 rounded-full hover:opacity-90 active:scale-95 transition-all ${className}`}>
      {label}
    </a>
  );
}
