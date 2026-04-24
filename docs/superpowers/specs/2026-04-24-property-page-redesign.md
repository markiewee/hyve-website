# Property Detail Page Redesign — Conversion Optimization

**Goal:** Increase viewing bookings from the property detail page by addressing the top 5 prospect concerns (price, availability, housemates, inclusions, trust) with proven conversion patterns.

**Approach:** Moderate conversion tactics — urgency cues, clear CTAs, social proof, tasteful. No countdown timers or fake scarcity.

---

## Section 1: Hero Gallery

**Current:** Small single image with overlay text.
**New:** Full-width gallery — large main image + 4-thumbnail grid. "+X Photos" overlay on last thumb. Property name, neighborhood, MRT distance, starting price in an overlay bar at bottom. "X rooms available" badge top-left (teal). Mobile: swipeable carousel.

## Section 2: Sticky CTA

**Current:** Sidebar "Book a Viewing" disappears on scroll/mobile.
**New:** Desktop — sticky sidebar (price + Schedule Viewing + WhatsApp, always visible). Mobile — sticky bottom bar with "From $X/mo" + green "Schedule Viewing" button. Never scrolls away.

## Section 3: What's Included (icon grid)

**Current:** Tiny tags "Gym, Pool, Parking".
**New:** 3-row icon grid using Material Symbols. Each icon + label.

Row 1 (basics): Utilities included, High-speed WiFi, Weekly cleaning, Fully furnished, Aircon, Shared kitchen
Row 2 (facilities): Pool, Gym, Parking, Playground, 24hr security, Parcel lockers
Row 3 (lifestyle): Pets welcome, Couples allowed, Laundry on-site, Near MRT, No agent fees, Flexible lease

Only show relevant icons per property. Basics row is universal. Facilities from Sanity amenities. Lifestyle hardcoded per property config.

Material Symbols icon names: bolt, wifi, cleaning_services, chair, ac_unit, kitchen, pool, fitness_center, local_parking, toys, lock, inventory_2, pets, group, local_laundry_service, train, money_off, event_available

## Section 4: Meet Your Housemates

**Current:** Doesn't exist.
**New:** Horizontal row of circles showing current tenants: country flag + age + gender. E.g. "🇮🇳 25M · 🇸🇬 28F · 🇮🇩 24M". Heading: "Who you'll be living with". Data pulled from Supabase tenant_profiles + tenant_details (nationality, date_of_birth) for active tenants in the property. No names, no photos.

## Section 5: Room Listings (improved cards)

**Current:** Small thumbnails, basic list.
**New:** Larger card-style room photos. Price prominent with "per month, all-inclusive" label. Availability badge: green "Available Now" or amber "Available Jun 20". Single CTA: "Book Viewing" (available) or "Enquire" (coming soon). Friendly room type labels (already implemented).

## Section 6: Location & Transport

**Current:** Text mention of neighborhood.
**New:** Small embedded Leaflet map + walking time badges. MRT station + walk time. Nearby amenities (shopping, schools). Reuse existing Leaflet setup.

## Section 7: Social Proof

**Current:** Nothing.
**New:** 1-2 short resident quotes with first name + property. "Trusted by X+ residents" counter. Subtle, below room listings.

---

## Data Sources

- Property info: Sanity CMS (images, description, amenities, MRT)
- Room availability/pricing: Sanity CMS (rooms subcollection)
- Housemate data: Supabase (tenant_profiles + tenant_details for active tenants)
- Social proof: Hardcoded initially, move to Sanity later

## Technical Notes

- File to modify: `src/components/PropertyDetailPageWithSanity.jsx`
- New component: `src/components/HousematePreview.jsx` (fetches from Supabase)
- Sticky CTA: CSS `position: sticky` for desktop, `position: fixed` for mobile bottom bar
- Icons: Material Symbols (already loaded via Google Fonts)
- Map: Reuse `LocationsMapComponent` with single-property mode
- Mobile-first: design mobile layout first, enhance for desktop
