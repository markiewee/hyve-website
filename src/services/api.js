const API_BASE_URL = process.env.NODE_ENV === 'production' ? '/api' : '/api';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Properties
  async getProperties(filters = {}) {
    const params = new URLSearchParams();
    
    // Transform frontend filter names to backend parameter names
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'location') {
          // Map location to neighborhood for backend
          params.append('neighborhood', value);
        } else if (key === 'priceRange' && Array.isArray(value)) {
          // Transform priceRange array to min_price and max_price
          if (value[0] > 0) params.append('min_price', value[0]);
          if (value[1] < 2000) params.append('max_price', value[1]);
        } else if (key === 'roomType') {
          // Map roomType to property_type for backend
          params.append('property_type', value);
        } else if (key === 'neighborhood') {
          // Direct neighborhood mapping
          params.append('neighborhood', value);
        } else if (key === 'availableFrom') {
          // Map availableFrom for API
          params.append('available_from', value);
        } else {
          // Keep other parameters as-is
          params.append(key, value);
        }
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/properties${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  async getProperty(id) {
    return this.request(`/property/${id}`);
  }

  async createProperty(propertyData) {
    return this.request('/api/properties', {
      method: 'POST',
      body: JSON.stringify(propertyData),
    });
  }

  async updateProperty(id, propertyData) {
    return this.request(`/api/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(propertyData),
    });
  }

  async deleteProperty(id) {
    return this.request(`/api/properties/${id}`, {
      method: 'DELETE',
    });
  }

  // Rooms
  async getRooms(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/rooms${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  async getPropertyRooms(propertyId) {
    return this.request(`/property/${propertyId}/rooms`);
  }

  async getRoom(id) {
    return this.request(`/api/rooms/${id}`);
  }

  async createRoom(roomData) {
    return this.request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  }

  async updateRoom(id, roomData) {
    return this.request(`/api/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roomData),
    });
  }

  async deleteRoom(id) {
    return this.request(`/api/rooms/${id}`, {
      method: 'DELETE',
    });
  }

  // Occupants
  async getOccupants(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    
    const queryString = params.toString();
    const endpoint = `/api/occupants${queryString ? `?${queryString}` : ''}`;
    return this.request(endpoint);
  }

  async getRoomOccupants(roomId) {
    return this.request(`/api/rooms/${roomId}/occupants`);
  }

  async getOccupant(id) {
    return this.request(`/api/occupants/${id}`);
  }

  async createOccupant(occupantData) {
    return this.request('/api/occupants', {
      method: 'POST',
      body: JSON.stringify(occupantData),
    });
  }

  async updateOccupant(id, occupantData) {
    return this.request(`/api/occupants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(occupantData),
    });
  }

  async deleteOccupant(id) {
    return this.request(`/api/occupants/${id}`, {
      method: 'DELETE',
    });
  }

  // Bulk operations
  async updatePropertyAvailability(propertyId, roomUpdates) {
    return this.request(`/api/properties/${propertyId}/availability`, {
      method: 'PUT',
      body: JSON.stringify({ rooms: roomUpdates }),
    });
  }

  // Admin operations
  async seedSampleData() {
    return this.request('/admin/api/seed-data', {
      method: 'POST',
    });
  }

  async getAdminStats() {
    return this.request('/admin/api/stats');
  }
}

export default new ApiService();

