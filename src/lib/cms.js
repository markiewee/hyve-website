// CMS adapter — replaces src/lib/sanity.js.
// Reads page/neighborhood content from Supabase `cms_content` table.
// Reads property/room data from existing Supabase tables (the source of truth).
// Surface area mirrors sanity.js so call sites swap imports with no other changes.

import { supabase } from './supabase';

// Each "query" is just an opaque tag — `client.fetch` switches on `kind`.
export const QUERIES = {
  homePage:            { kind: 'page', slug: 'home' },
  aboutPage:           { kind: 'page', slug: 'about' },
  faqPage:             { kind: 'page', slug: 'faq' },
  properties:          { kind: 'properties' },
  propertiesWithRooms: { kind: 'propertiesWithRooms' },
  featuredProperties:  { kind: 'featuredProperties' },
  propertyDetail:      { kind: 'propertyDetail' },
  roomsByProperty:     { kind: 'roomsByProperty' },
  neighborhoods:       { kind: 'neighborhoods' },
  neighborhoodsFull:   { kind: 'neighborhoodsFull' },
};

const mapProperty = (p, opts = {}) => ({
  _id: p.id,
  name: p.name,
  code: p.code,
  slug: { current: p.slug },
  description: p.description,
  address: p.address,
  location: (p.latitude || p.longitude)
    ? { latitude: p.latitude, longitude: p.longitude }
    : null,
  propertyType: opts.propertyType ?? 'private',
  startingPrice: opts.startingPrice ?? null,
  totalRooms: opts.totalRooms ?? null,
  availableRooms: opts.availableRooms ?? null,
  images: (p.images ?? []).map((src) => ({
    image: { src, alt: p.name, caption: null },
    alt: p.name,
    caption: null,
  })),
  amenities: p.amenities ?? [],
  facilities: p.facilities ?? [],
  nearbyMRT: p.nearby_mrt ?? [],
  nearbyAmenities: p.nearby_amenities ?? [],
  featured: !!p.featured,
  status: p.status,
  neighborhood: null,
});

const mapRoom = (r) => ({
  _id: r.id,
  roomNumber: r.unit_code || r.name,
  roomType: r.room_type,
  priceMonthly: r.price_monthly,
  sizeSqm: r.size_sqm,
  isAvailable: !r.available_until || new Date(r.available_until) > new Date(),
  availableFrom: r.next_available,
  images: (r.photos ?? []).map((src) => ({
    image: { src, alt: r.name, caption: null },
    alt: r.name,
    caption: null,
  })),
  amenities: r.amenities ?? [],
  description: r.description,
  hasPrivateBathroom: r.has_private_bathroom,
  hasAircon: r.has_aircon,
  furnishingLevel: r.furnishing_level,
  bedSize: r.bed_size,
  maxOccupancy: r.max_occupancy,
});

const propertyAggregate = (p) => {
  const rooms = p.rooms ?? [];
  const prices = rooms.map((r) => r.price_monthly).filter((x) => x != null);
  const available = rooms.filter(
    (r) => !r.available_until || new Date(r.available_until) > new Date(),
  );
  return {
    startingPrice: prices.length ? Math.min(...prices) : null,
    totalRooms: rooms.length,
    availableRooms: available.length,
  };
};

export const client = {
  async fetch(q, params = {}) {
    if (!q || !q.kind) {
      console.warn('cms.client.fetch: invalid query', q);
      return null;
    }

    switch (q.kind) {
      case 'page': {
        const { data, error } = await supabase
          .from('cms_content')
          .select('content')
          .eq('type', 'page')
          .eq('slug', q.slug)
          .eq('published', true)
          .maybeSingle();
        if (error) console.warn('cms page fetch failed:', error.message);
        return data?.content ?? null;
      }

      case 'neighborhoods': {
        const { data, error } = await supabase
          .from('cms_content')
          .select('content')
          .eq('type', 'neighborhood')
          .eq('published', true)
          .order('sort_order');
        if (error) console.warn('cms neighborhoods fetch failed:', error.message);
        return (data ?? []).map((r) => ({
          _id: r.content?.slug?.current,
          name: r.content?.name,
          slug: r.content?.slug,
        }));
      }

      case 'neighborhoodsFull': {
        const { data, error } = await supabase
          .from('cms_content')
          .select('content')
          .eq('type', 'neighborhood')
          .eq('published', true)
          .order('sort_order');
        if (error) console.warn('cms neighborhoodsFull fetch failed:', error.message);
        return (data ?? []).map((r) => ({
          ...r.content,
          _id: r.content?.slug?.current,
        }));
      }

      case 'properties': {
        const { data, error } = await supabase
          .from('properties')
          .select('*, rooms(price_monthly, available_until)')
          .neq('status', 'inactive');
        if (error) console.warn('cms properties fetch failed:', error.message);
        return (data ?? []).map((p) => mapProperty(p, propertyAggregate(p)));
      }

      case 'propertiesWithRooms': {
        const { data, error } = await supabase
          .from('properties')
          .select('*, rooms(*)')
          .neq('status', 'inactive');
        if (error) console.warn('cms propertiesWithRooms fetch failed:', error.message);
        return (data ?? []).map((p) => ({
          ...mapProperty(p, propertyAggregate(p)),
          rooms: (p.rooms ?? []).map(mapRoom),
        }));
      }

      case 'featuredProperties': {
        // No `featured` column in Supabase yet — return all active, capped at 6
        const { data, error } = await supabase
          .from('properties')
          .select('*, rooms(price_monthly, available_until)')
          .neq('status', 'inactive')
          .limit(6);
        if (error) console.warn('cms featuredProperties fetch failed:', error.message);
        return (data ?? []).map((p) => mapProperty(p, propertyAggregate(p)));
      }

      case 'propertyDetail': {
        const id = params.id || '';
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const filter = supabase
          .from('properties')
          .select('*, rooms(price_monthly, available_until)');
        const { data, error } = isUuid
          ? await filter.eq('id', id).maybeSingle()
          : await filter.eq('slug', id).maybeSingle();
        if (error) console.warn('cms propertyDetail fetch failed:', error.message);
        return data ? mapProperty(data, propertyAggregate(data)) : null;
      }

      case 'roomsByProperty': {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('property_id', params.propertyId);
        if (error) console.warn('cms roomsByProperty fetch failed:', error.message);
        return (data ?? []).map(mapRoom);
      }

      default:
        console.warn('cms.client.fetch: unknown query kind', q.kind);
        return null;
    }
  },
};

// Compat with Sanity's `urlFor(image).width(W).height(H).url()` fluent chain.
// All our images are already local paths — width/height are decorative
// (the static server doesn't resize). Returns the src string from .url().
export const urlFor = (image) => {
  const src =
    typeof image === 'string'
      ? image
      : image?.src ?? image?.asset?.url ?? null;
  const chain = {
    width: () => chain,
    height: () => chain,
    fit: () => chain,
    auto: () => chain,
    quality: () => chain,
    format: () => chain,
    url: () => src,
  };
  return chain;
};
