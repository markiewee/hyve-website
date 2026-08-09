/* Generated from hyve-iot (diiilqpfmlxjwiaeophb) on 2026-08-10.
   19 lettable rooms across 3 homes. Rows without a price are
   kitchens, toilets, yards and common areas, and are excluded.
   Regenerate rather than hand-edit. Supabase is the source of truth (CLAUDE.md rule 9). */
window.HOMES=[
 {
  "code": "CP",
  "name": "Chiltern Park 135",
  "slug": "chiltern-park",
  "address": "#04-03, 135 Serangoon Avenue 3, Singapore 556114",
  "mrt": [
   {
    "line": "NEL / CCL",
    "station": "Serangoon",
    "walking_minutes": 10
   },
   {
    "line": "CCL",
    "station": "Lorong Chuan",
    "walking_minutes": 8
   }
  ],
  "lat": 1.3535,
  "lng": 103.8718,
  "bathrooms": 2,
  "common": "All other areas not defined as private dwellings",
  "amenities": [
   "Fully furnished rooms",
   "High-speed WiFi",
   "Weekly common area cleaning",
   "Washing machine",
   "Dryer",
   "Shared kitchen",
   "Shared living room"
  ],
  "nearby": [
   {
    "name": "NEX Mall",
    "type": "mall",
    "walking_minutes": 10
   },
   {
    "name": "Serangoon Garden Market & Food Centre",
    "type": "restaurant",
    "walking_minutes": 12
   },
   {
    "name": "FairPrice Finest (NEX)",
    "type": "grocery",
    "walking_minutes": 10
   }
  ],
  "rooms": 6
 },
 {
  "code": "IH",
  "name": "Ivory Heights 122",
  "slug": "ivory-heights",
  "address": "#08-33, Blk 122 Jurong East St 13, Singapore 600122",
  "mrt": [
   {
    "line": "NSL / EWL",
    "station": "Jurong East",
    "walking_minutes": 12
   }
  ],
  "lat": 1.344,
  "lng": 103.729,
  "bathrooms": 2,
  "common": "All other areas not defined as private dwellings",
  "amenities": [
   "Fully furnished rooms",
   "High-speed WiFi",
   "Weekly common area cleaning",
   "Washing machine",
   "Shared kitchen",
   "Shared living room"
  ],
  "nearby": [
   {
    "name": "JEM",
    "type": "mall",
    "walking_minutes": 12
   },
   {
    "name": "Westgate",
    "type": "mall",
    "walking_minutes": 13
   },
   {
    "name": "Jurong East Hawker Centre",
    "type": "restaurant",
    "walking_minutes": 5
   },
   {
    "name": "FairPrice (Blk 130)",
    "type": "grocery",
    "walking_minutes": 3
   }
  ],
  "rooms": 7
 },
 {
  "code": "TG",
  "name": "Thomson Grove 588",
  "slug": "thomson-grove",
  "address": "#04-03, 588 Yio Chu Kang Road, Singapore 787072",
  "mrt": [
   {
    "line": "TEL",
    "station": "Upper Thomson",
    "walking_minutes": 10
   }
  ],
  "lat": 1.378,
  "lng": 103.835,
  "bathrooms": 3,
  "common": "All other areas not defined as private dwellings",
  "amenities": [
   "Fully furnished rooms",
   "High-speed WiFi",
   "Weekly common area cleaning",
   "Washing machine",
   "Dryer",
   "Shared kitchen",
   "Shared living room",
   "Garden"
  ],
  "nearby": [
   {
    "name": "Thomson Plaza",
    "type": "mall",
    "walking_minutes": 8
   },
   {
    "name": "MacRitchie Reservoir",
    "type": "other",
    "walking_minutes": 15
   },
   {
    "name": "Shunfu Mart",
    "type": "grocery",
    "walking_minutes": 10
   }
  ],
  "rooms": 6
 }
];
window.ROOMS=[
 {
  "code": "CP-MR",
  "home": "CP",
  "homeName": "Chiltern Park 135",
  "name": "CP Master Room",
  "type": "master",
  "price": 2200,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-08-09",
  "until": null,
  "sqm": 45,
  "bed": "queen",
  "occ": 2,
  "ensuite": true,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Spacious master room with queen bed and ensuite private bathroom.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table",
   "Ensuite bathroom",
   "Wardrobe"
  ],
  "facilities": [
   "Attached bathroom",
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/cp/MBR.jpg",
   "/photos/cp/MBR-2.jpg",
   "/photos/cp/MBR-3.jpg",
   "/photos/cp/MBR-4.jpg"
  ],
  "tour": null
 },
 {
  "code": "CP-PR1",
  "home": "CP",
  "homeName": "Chiltern Park 135",
  "name": "CP Premium Room 1",
  "type": "premium",
  "price": 1500,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-08-12",
  "until": null,
  "sqm": 9,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Premium room with super single bed and wardrobe.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table",
   "Wardrobe"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/cp/PR1.jpg",
   "/photos/cp/PR1-2.jpg"
  ],
  "tour": null
 },
 {
  "code": "CP-PR2",
  "home": "CP",
  "homeName": "Chiltern Park 135",
  "name": "CP Premium Room 2",
  "type": "premium",
  "price": 1380,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-12-01",
  "until": null,
  "sqm": 9,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Comfortable premium room with super single bed and wardrobe.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table",
   "Wardrobe"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/cp/PR2.jpg",
   "/photos/cp/PR2-2.jpg"
  ],
  "tour": "https://scaniverse.com/scan/ippfv6dt673odp6s?embed=1"
 },
 {
  "code": "CP-PR3",
  "home": "CP",
  "homeName": "Chiltern Park 135",
  "name": "CP Premium Room 3",
  "type": "premium",
  "price": 1600,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-12-20",
  "until": null,
  "sqm": 20,
  "bed": "super_single",
  "occ": 2,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Well-sized premium room with super single bed and wardrobe.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table",
   "Wardrobe"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/cp/PR3.jpg",
   "/photos/cp/PR3-2.jpg"
  ],
  "tour": null
 },
 {
  "code": "CP-PR4",
  "home": "CP",
  "homeName": "Chiltern Park 135",
  "name": "CP Premium Room 4",
  "type": "premium",
  "price": 1290,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-01-01",
  "until": null,
  "sqm": 17,
  "bed": "queen",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Bright premium room with good ventilation.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/cp/PR4.jpg"
  ],
  "tour": null
 },
 {
  "code": "CP-STD1",
  "home": "CP",
  "homeName": "Chiltern Park 135",
  "name": "CP Standard Room 1",
  "type": "standard",
  "price": 600,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-04-30",
  "until": null,
  "sqm": 4,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Compact standard room with super single bed. Great value.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table",
   "Wardrobe"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/cp/STD1.jpg",
   "/photos/cp/STD1-2.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-PR1",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Premium Room 1",
  "type": "premium",
  "price": 1500,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-09-19",
  "until": null,
  "sqm": 20,
  "bed": "queen",
  "occ": 2,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Premium room in Jurong East, close to amenities.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/PR1.jpg",
   "/photos/ih/PR1-2.jpg",
   "/photos/ih/PR1-3.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-PR2",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Premium Room 2",
  "type": "premium",
  "price": 1200,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-03-01",
  "until": null,
  "sqm": 20,
  "bed": "queen",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Well-lit premium room with desk workspace.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/PR2.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-PR3",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Premium Room 3",
  "type": "premium",
  "price": 1500,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-04-30",
  "until": null,
  "sqm": 20,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Comfortable premium room near shared spaces.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/PR3.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-STD1",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Standard Room 1",
  "type": "standard",
  "price": 1000,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-10-01",
  "until": null,
  "sqm": 30,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Standard room in Jurong East with super single bed.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/STD1.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-STD2",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Standard Room 2",
  "type": "standard",
  "price": 1000,
  "deposit": 1,
  "minStay": 3,
  "next": "2026-12-07",
  "until": null,
  "sqm": 30,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Standard room with super single bed, good natural light.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/STD2.jpg",
   "/photos/ih/STD2-2.jpg",
   "/photos/ih/STD2-3.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-STD3",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Standard Room 3",
  "type": "standard",
  "price": 1000,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-07-01",
  "until": null,
  "sqm": 30,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Standard room in Jurong East, great value.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/STD3.jpg"
  ],
  "tour": null
 },
 {
  "code": "IH-STD4",
  "home": "IH",
  "homeName": "Ivory Heights 122",
  "name": "IH Standard Room 4",
  "type": "standard",
  "price": 800,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-05-16",
  "until": null,
  "sqm": 30,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Spacious standard room with super single bed.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/ih/STD4.jpg"
  ],
  "tour": null
 },
 {
  "code": "TG-MR",
  "home": "TG",
  "homeName": "Thomson Grove 588",
  "name": "TG Master Room",
  "type": "master",
  "price": 2200,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-04-01",
  "until": null,
  "sqm": 35,
  "bed": "queen",
  "occ": 2,
  "ensuite": true,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Large master room with queen bed and ensuite bathroom in quiet landed house.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table",
   "Ensuite bathroom"
  ],
  "facilities": [
   "Attached bathroom",
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/tg/MBR.jpg",
   "/photos/tg/MBR-2.jpg",
   "/photos/tg/MBR-3.jpg"
  ],
  "tour": null
 },
 {
  "code": "TG-PR1",
  "home": "TG",
  "homeName": "Thomson Grove 588",
  "name": "TG Premium Room 1",
  "type": "premium",
  "price": 1400,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-10-01",
  "until": null,
  "sqm": 20,
  "bed": "queen",
  "occ": 2,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Premium room in landed property with garden access.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/tg/PR1.jpg",
   "/photos/tg/PR1-2.jpg"
  ],
  "tour": null
 },
 {
  "code": "TG-PR2",
  "home": "TG",
  "homeName": "Thomson Grove 588",
  "name": "TG Premium Room 2",
  "type": "premium",
  "price": 1300,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-05-01",
  "until": null,
  "sqm": 20,
  "bed": "queen",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Premium room with good natural light.",
  "amenities": [
   "Queen bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/tg/PR1.jpg",
   "/photos/tg/PR1-2.jpg"
  ],
  "tour": null
 },
 {
  "code": "TG-PR3",
  "home": "TG",
  "homeName": "Thomson Grove 588",
  "name": "TG Premium Room 3",
  "type": "premium",
  "price": 1200,
  "deposit": 1,
  "minStay": 3,
  "next": "2028-05-01",
  "until": null,
  "sqm": 17,
  "bed": "super_single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Cosy premium room in Thomson neighbourhood.",
  "amenities": [
   "Super single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/tg/PR3.jpg",
   "/photos/tg/PR3-2.jpg",
   "/photos/tg/PR3-3.jpg"
  ],
  "tour": null
 },
 {
  "code": "TG-STD1",
  "home": "TG",
  "homeName": "Thomson Grove 588",
  "name": "TG Standard Room 1",
  "type": "standard",
  "price": 700,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-09-14",
  "until": null,
  "sqm": 5,
  "bed": "single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Compact standard room in quiet Thomson neighbourhood.",
  "amenities": [
   "Single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/tg/STD1.jpg"
  ],
  "tour": null
 },
 {
  "code": "TG-STD2",
  "home": "TG",
  "homeName": "Thomson Grove 588",
  "name": "TG Standard Room 2",
  "type": "standard",
  "price": 800,
  "deposit": 1,
  "minStay": 3,
  "next": "2027-09-14",
  "until": null,
  "sqm": 6,
  "bed": "single",
  "occ": 1,
  "ensuite": false,
  "ac": true,
  "furnishing": "fully_furnished",
  "floor": 1,
  "desc": "Cosy standard room with single bed.",
  "amenities": [
   "Single bed",
   "WiFi",
   "Study table"
  ],
  "facilities": [
   "Window",
   "Door lock"
  ],
  "photos": [
   "/photos/tg/STD2.jpg"
  ],
  "tour": null
 }
];
