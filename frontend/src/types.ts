export type Language = 'hi' | 'en' | 'mr' | 'te' | 'ta' | 'bn';

export interface User {
  id: string;
  name: string;
  role: 'farmer' | 'buyer';
  language: Language;
  phone: string;
  location?: string;
}

export interface CropListing {
  id: string;
  farmerId: string;
  farmerName: string;
  cropName: string;
  cropNameEnglish?: string; // Standardized English name for search
  quantity: number; // in kg
  price: number; // per kg
  location: string;
  description: string;
  timestamp: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string; // Target user
  listingId?: string; // Context
  text: string;
  translatedText?: string; // The text translated to the viewer's language
  audioUrl?: string; // If it was a voice message
  timestamp: number;
  isSystem?: boolean;
}

export interface MarketInsight {
  recommendedPrice: number;
  trend: 'up' | 'down' | 'stable';
  advice: string;
}

// Gemini Live API Types
export interface LiveConfig {
  model: string;
  systemInstruction?: string;
}
