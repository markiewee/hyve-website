#!/usr/bin/env python3
"""Regenerate staff-data.js from hyve-iot. Supabase is the source of truth
(CLAUDE.md rule 9), so regenerate rather than hand-editing the output.

  python3 design-preview/gen-staff-data.py

Deliberately omits: default_access_code, default_security_instructions,
owner_emails, and every tenant identity. Door codes do not belong in a
static file, and tenant_profiles is RLS-blocked to the anon key anyway.
"""
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'design-preview', 'staff-data.js')
ORDER = ['CP', 'IH', 'TG']

env = {}
with open(os.path.join(ROOT, '.env.local')) as fh:
    for line in fh:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v
URL = env['VITE_IOT_SUPABASE_URL']
KEY = env['VITE_IOT_SUPABASE_ANON_KEY']


def q(path):
    req = urllib.request.Request(
        URL + '/rest/v1/' + path,
        headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY},
    )
    return json.load(urllib.request.urlopen(req))


PROP_KEEP = [
    'code', 'name', 'slug', 'address', 'description', 'latitude', 'longitude',
    'num_bathrooms', 'common_areas', 'amenities', 'facilities', 'nearby_mrt',
    'nearby_amenities', 'house_rules', 'images',
]
ROOM_KEEP = [
    'unit_code', 'name', 'room_type', 'price_monthly', 'size_sqm', 'bed_size',
    'max_occupancy', 'has_private_bathroom', 'has_aircon', 'furnishing_level',
    'floor', 'deposit_months', 'min_stay_months', 'next_available',
    'available_until', 'description', 'amenities', 'facilities', 'photos',
    'video_tour_url',
]

props = {p['id']: p for p in q('properties?select=*')}
rooms = q('rooms?select=*')

homes = []
for code in ORDER:
    p = next(v for v in props.values() if v['code'] == code)
    home = {k: p.get(k) for k in PROP_KEEP}
    mine = [r for r in rooms if r['property_id'] == p['id']]
    # A lettable bedroom has a room_type and a price. Kitchens, yards and
    # shared toilets have neither, and are not inventory.
    home['rooms'] = sorted(
        [{k: r.get(k) for k in ROOM_KEEP} for r in mine
         if r.get('room_type') and r.get('price_monthly')],
        key=lambda r: r['unit_code'],
    )
    homes.append(home)

total = sum(len(h['rooms']) for h in homes)
banner = (
    '/* Generated from hyve-iot (diiilqpfmlxjwiaeophb) by gen-staff-data.py.\n'
    '   %d lettable rooms across %d homes. Regenerate rather than hand-edit.\n'
    '   No door codes and no tenant identities live in this file. */\n'
    % (total, len(homes))
)
with open(OUT, 'w') as fh:
    fh.write(banner + 'window.HOMES=' + json.dumps(homes, indent=1) + ';\n')
print('wrote %s, %d rooms' % (OUT, total))
