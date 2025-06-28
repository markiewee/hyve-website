from http.server import BaseHTTPRequestHandler
import json
import urllib.parse as urlparse

# Sample properties data
SAMPLE_PROPERTIES = [
    {
        "id": 1,
        "name": "Modern Coliving Hub - Lentor",
        "description": "Experience contemporary living in this stylish coliving space located in the heart of Lentor. Features modern amenities, flexible lease terms, and a vibrant community atmosphere.",
        "address": "123 Lentor Avenue, Singapore 789012",
        "neighborhood": "Lentor",
        "propertyType": "Condo",
        "totalRooms": 8,
        "availableRooms": 3,
        "startingPrice": 1200,
        "images": ["hero_coliving_interior-Degm_TYh.jpg", "modern_coliving_space-Dh7DMDaq.jpg"],
        "amenities": ["High-Speed WiFi", "24/7 Security", "Parking Available", "Responsive Maintenance", "Weekly Housekeeping", "Community Events"],
        "nearbyMRT": ["Lentor MRT (2 min walk)", "Mayflower MRT (8 min walk)"],
        "nearbyAmenities": ["Shopping Mall (3 min)", "Supermarket (5 min)", "Restaurants (1 min)", "Gym (2 min)", "Park (8 min)"]
    },
    {
        "id": 2,
        "name": "Urban Sanctuary - Orchard",
        "description": "Live in the heart of Singapore's shopping district with premium coliving amenities. This property offers luxury living with convenient access to Orchard Road's best attractions.",
        "address": "456 Orchard Boulevard, Singapore 238123",
        "neighborhood": "Orchard",
        "propertyType": "Condo",
        "totalRooms": 12,
        "availableRooms": 5,
        "startingPrice": 1800,
        "images": ["orchard_building-D_4H-Y7J.jpg", "singapore_apartment_living-B87_t4CC.jpg"],
        "amenities": ["WiFi Included", "24/7 Security", "Parking", "Maintenance", "Housekeeping", "Community Events"],
        "nearbyMRT": ["Orchard MRT (1 min walk)", "Somerset MRT (5 min walk)"],
        "nearbyAmenities": ["Ion Orchard (2 min)", "Cold Storage (3 min)", "Food Court (1 min)", "Virgin Active (1 min)", "Botanic Gardens (10 min)"]
    },
    {
        "id": 3,
        "name": "Riverside Living - River Valley",
        "description": "Enjoy peaceful riverside living with modern conveniences. This coliving space combines tranquility with urban accessibility, perfect for professionals and students alike.",
        "address": "789 River Valley Road, Singapore 179024",
        "neighborhood": "River Valley",
        "propertyType": "Apartment",
        "totalRooms": 6,
        "availableRooms": 2,
        "startingPrice": 1500,
        "images": ["river_valley_exterior-BG3t3iQI.jpg", "shared_kitchen-CvwwBMrv.jpg"],
        "amenities": ["High-Speed WiFi", "Security", "Maintenance", "Weekly Housekeeping"],
        "nearbyMRT": ["Great World MRT (5 min walk)", "Tiong Bahru MRT (8 min walk)"],
        "nearbyAmenities": ["Great World Mall (5 min)", "FairPrice (4 min)", "Hawker Center (3 min)", "Fitness First (6 min)", "Singapore River (2 min)"]
    },
    {
        "id": 4,
        "name": "Heritage Charm - Tiong Bahru",
        "description": "Experience Singapore's heritage charm in this beautifully restored coliving space. Located in the trendy Tiong Bahru neighborhood with excellent cafes and local culture.",
        "address": "321 Tiong Bahru Road, Singapore 168732",
        "neighborhood": "Tiong Bahru",
        "propertyType": "Heritage",
        "totalRooms": 5,
        "availableRooms": 1,
        "startingPrice": 1300,
        "images": ["tiong_bahru_neighborhood-D2b2g5LC.jpg", "modern_condo_exterior-AllQKqM-.jpg"],
        "amenities": ["WiFi", "Security", "Maintenance", "Housekeeping"],
        "nearbyMRT": ["Tiong Bahru MRT (3 min walk)", "Outram Park MRT (10 min walk)"],
        "nearbyAmenities": ["Tiong Bahru Market (2 min)", "Sheng Siong (3 min)", "Local Cafes (1 min)", "Community Center (4 min)", "Tiong Bahru Park (5 min)"]
    }
]

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Extract property ID from URL
        path_parts = self.path.split('/')
        try:
            property_id = int(path_parts[-1])
        except (ValueError, IndexError):
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = json.dumps({"error": "Invalid property ID"})
            self.wfile.write(response.encode())
            return
        
        # Find property by ID
        property_data = None
        for prop in SAMPLE_PROPERTIES:
            if prop["id"] == property_id:
                property_data = prop
                break
        
        if not property_data:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = json.dumps({"error": "Property not found"})
            self.wfile.write(response.encode())
            return
        
        # Send successful response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        response = json.dumps(property_data)
        self.wfile.write(response.encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()