import { CropListing, User, Message } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

export const api = {
    // User Endpoints
    loginUser: async (phone: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });
            if (!response.ok) {
                if (response.status === 404) return null; // User not found
                throw new Error('Login failed');
            }
            return await response.json();
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    registerUser: async (userData: Omit<User, 'id'>): Promise<User> => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/login`, { // Using the same route logic as backend
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            if (!response.ok) throw new Error('Registration failed');
            return await response.json();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    },

    updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error('Update user failed');
            return await response.json();
        } catch (error) {
            console.error('Update user error:', error);
            throw error;
        }
    },

    getUser: async (id: string): Promise<User | null> => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            return null;
        }
    },

    // Listing Endpoints
    getListings: async (): Promise<CropListing[]> => {
        try {
            const response = await fetch(`${API_BASE_URL}/listings`);
            if (!response.ok) throw new Error('Failed to fetch listings');
            // Map MongoDB _id to id for frontend compatibility
            const data = await response.json();
            return data.map((item: any) => ({ ...item, id: item._id, timestamp: new Date(item.createdAt).getTime() || Date.now() }));
        } catch (error) {
            console.error('Get listings error:', error);
            return [];
        }
    },

    createListing: async (listing: FormData): Promise<CropListing> => {
        try {
            const response = await fetch(`${API_BASE_URL}/listings`, {
                method: 'POST',
                // Content-Type is set automatically for FormData
                body: listing,
            });
            if (!response.ok) throw new Error('Failed to create listing');
            const data = await response.json();
            return { ...data, id: data._id, timestamp: new Date(data.createdAt).getTime() || Date.now() };
        } catch (error) {
            console.error('Create listing error:', error);
            throw error;
        }
    },

    // Message Endpoints
    getMessages: async (userId: string, otherUserId?: string, listingId?: string): Promise<Message[]> => {
        try {
            const params = new URLSearchParams();
            if (userId) params.append('userId', userId);
            if (otherUserId) params.append('otherUserId', otherUserId);
            if (listingId) params.append('listingId', listingId);

            const response = await fetch(`${API_BASE_URL}/messages?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            const data = await response.json();
            // Map _id to id
            return data.map((m: any) => ({ ...m, id: m._id }));
        } catch (error) {
            console.error('Get messages error:', error);
            return [];
        }
    },

    sendMessage: async (message: Omit<Message, 'id'>): Promise<Message> => {
        try {
            const response = await fetch(`${API_BASE_URL}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message),
            });
            if (!response.ok) throw new Error('Failed to send message');
            const data = await response.json();
            return { ...data, id: data._id };
        } catch (error) {
            console.error('Send message error:', error);
            throw error;
        }
    },

    updateListing: async (id: string, updates: Partial<CropListing>): Promise<CropListing> => {
        try {
            const response = await fetch(`${API_BASE_URL}/listings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!response.ok) throw new Error('Failed to update listing');
            const data = await response.json();
            return { ...data, id: data._id, timestamp: new Date(data.createdAt).getTime() || Date.now() };
        } catch (error) {
            console.error('Update listing error:', error);
            throw error;
        }
    },

    deleteListing: async (id: string): Promise<void> => {
        try {
            const response = await fetch(`${API_BASE_URL}/listings/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete listing');
        } catch (error) {
            console.error('Delete listing error:', error);
            throw error;
        }
    }
};
