from http.server import BaseHTTPRequestHandler
import json

# Sample rooms data
SAMPLE_ROOMS = [
    # Lentor Property (ID: 1)
    {
        "id": 1,
        "propertyId": 1,
        "roomNumber": "A1",
        "roomType": "Master Bedroom",
        "priceMonthly": 1400,
        "sizeSqm": 25,
        "isAvailable": True,
        "availableFrom": "2024-07-01",
        "images": ["hero_coliving_interior-Degm_TYh.jpg", "singapore_apartment_living-B87_t4CC.jpg"],
        "amenities": ["Private Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning", "Window View"]
    },
    {
        "id": 2,
        "propertyId": 1,
        "roomNumber": "A2",
        "roomType": "Standard Room",
        "priceMonthly": 1200,
        "sizeSqm": 18,
        "isAvailable": False,
        "availableFrom": None,
        "images": ["modern_coliving_space-Dh7DMDaq.jpg"],
        "amenities": ["Shared Bathroom", "Single Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
    },
    {
        "id": 3,
        "propertyId": 1,
        "roomNumber": "A3",
        "roomType": "Standard Room",
        "priceMonthly": 1250,
        "sizeSqm": 20,
        "isAvailable": True,
        "availableFrom": "2024-08-15",
        "images": ["singapore_apartment_living-B87_t4CC.jpg"],
        "amenities": ["Shared Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
    },
    {
        "id": 4,
        "propertyId": 1,
        "roomNumber": "A4",
        "roomType": "Standard Room",
        "priceMonthly": 1180,
        "sizeSqm": 17,
        "isAvailable": True,
        "availableFrom": "2024-09-01",
        "images": ["hero_coliving_interior-Degm_TYh.jpg"],
        "amenities": ["Shared Bathroom", "Single Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
    },
    # Orchard Property (ID: 2)
    {
        "id": 5,
        "propertyId": 2,
        "roomNumber": "B1",
        "roomType": "Master Bedroom",
        "priceMonthly": 2000,
        "sizeSqm": 30,
        "isAvailable": True,
        "availableFrom": "2024-07-01",
        "images": ["orchard_building-D_4H-Y7J.jpg", "hero_coliving_interior-Degm_TYh.jpg"],
        "amenities": ["Private Bathroom", "King Bed", "Study Desk", "Walk-in Wardrobe", "Air Conditioning", "City View", "Balcony"]
    },
    {
        "id": 6,
        "propertyId": 2,
        "roomNumber": "B2",
        "roomType": "Deluxe Room",
        "priceMonthly": 1800,
        "sizeSqm": 22,
        "isAvailable": True,
        "availableFrom": "2024-07-15",
        "images": ["singapore_apartment_living-B87_t4CC.jpg"],
        "amenities": ["Private Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning", "City View"]
    },
    {
        "id": 7,
        "propertyId": 2,
        "roomNumber": "B3",
        "roomType": "Standard Room",
        "priceMonthly": 1600,
        "sizeSqm": 19,
        "isAvailable": False,
        "availableFrom": None,
        "images": ["modern_coliving_space-Dh7DMDaq.jpg"],
        "amenities": ["Shared Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
    },
    # River Valley Property (ID: 3)
    {
        "id": 8,
        "propertyId": 3,
        "roomNumber": "C1",
        "roomType": "Master Bedroom",
        "priceMonthly": 1650,
        "sizeSqm": 24,
        "isAvailable": True,
        "availableFrom": "2024-08-01",
        "images": ["river_valley_exterior-BG3t3iQI.jpg", "shared_kitchen-CvwwBMrv.jpg"],
        "amenities": ["Private Bathroom", "Queen Bed", "Study Desk", "Wardrobe", "Air Conditioning", "River View"]
    },
    {
        "id": 9,
        "propertyId": 3,
        "roomNumber": "C2",
        "roomType": "Standard Room",
        "priceMonthly": 1500,
        "sizeSqm": 18,
        "isAvailable": True,
        "availableFrom": "2024-07-20",
        "images": ["singapore_apartment_living-B87_t4CC.jpg"],
        "amenities": ["Shared Bathroom", "Single Bed", "Study Desk", "Wardrobe", "Air Conditioning"]
    },
    # Tiong Bahru Property (ID: 4)
    {
        "id": 10,
        "propertyId": 4,
        "roomNumber": "D1",
        "roomType": "Heritage Room",
        "priceMonthly": 1300,
        "sizeSqm": 20,
        "isAvailable": True,
        "availableFrom": "2024-08-15",
        "images": ["tiong_bahru_neighborhood-D2b2g5LC.jpg", "modern_condo_exterior-AllQKqM-.jpg"],
        "amenities": ["Private Bathroom", "Queen Bed", "Study Desk", "Vintage Wardrobe", "Air Conditioning", "Heritage Features"]
    }
]

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Extract property ID from URL path
        path_parts = self.path.split('/')
        try:
            # Find the property ID in the path (should be before 'rooms')
            property_id_index = None
            for i, part in enumerate(path_parts):
                if part == 'property' and i + 1 < len(path_parts):
                    property_id = int(path_parts[i + 1])
                    break
            else:
                # Fallback: try to extract from path
                property_id = int(path_parts[-2])  # Should be before 'rooms'
        except (ValueError, IndexError):
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = json.dumps({"error": "Invalid property ID"})
            self.wfile.write(response.encode())
            return
        
        # Filter rooms by property ID
        property_rooms = [room for room in SAMPLE_ROOMS if room["propertyId"] == property_id]
        
        # Send successful response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        response = json.dumps(property_rooms)
        self.wfile.write(response.encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()