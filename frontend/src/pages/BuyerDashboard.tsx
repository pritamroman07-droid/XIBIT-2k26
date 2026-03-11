import React, { useState, useEffect, useRef } from 'react';
import { User, CropListing, Message } from '../types';
import { api } from '../api';
import { translateText } from '../services/geminiService';
import { TRANSLATIONS, LANGUAGES } from '../constants';
import LiveAssistant from '../components/LiveAssistant';
import { MapPin, MessageCircle, ArrowLeft, LogOut, Search, X, User as UserIcon } from 'lucide-react';
import LanguageDropdown from '../components/LanguageDropdown';
import ThemeToggle from '../components/ThemeToggle';
import { FunctionDeclaration, Type } from '@google/genai';

interface Props {
    user: User;
    listings: CropListing[];
    onLogout: () => void;
    onUpdateUser: (updates: Partial<User>) => void;
}

const formatMessageTime = (timestamp?: number | string | Date) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatMessageDate = (timestamp?: number | string | Date) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
};

const BuyerDashboard: React.FC<Props> = ({ user, listings, onLogout, onUpdateUser }) => {
    const [selectedListing, setSelectedListing] = useState<CropListing | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeTab, setActiveTab] = useState<'market' | 'inbox'>('market');
    const [inboxItems, setInboxItems] = useState<{ partnerId: string, listingId?: string, listingName?: string, name: string, lastMsg: string, listingQuantity?: number, listingPrice?: number }[]>([]);
    const [newMessage, setNewMessage] = useState('');
    // State for advanced filters
    const [activeFilters, setActiveFilters] = useState({
        query: '',
        location: '',
        farmerName: '',
        minPrice: 0,
        maxPrice: Infinity,
        timeFilter: 'all' as 'all' | 'newest' | 'today' | 'week'
    });

    const [showProfile, setShowProfile] = useState(false);
    const [profileData, setProfileData] = useState({ name: '', location: '', language: 'en' as any });
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

    // Refs for Voice Assistant Context
    const listingsRef = useRef(listings);
    const selectedListingRef = useRef(selectedListing);
    const messagesRef = useRef(messages);
    const inboxItemsRef = useRef(inboxItems);

    useEffect(() => {
        listingsRef.current = listings;
    }, [listings]);

    useEffect(() => {
        selectedListingRef.current = selectedListing;
    }, [selectedListing]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        inboxItemsRef.current = inboxItems;
    }, [inboxItems]);

    const systemInstruction = `
    You are a helpful assistant for an Indian crop buyer on 'SpeakHarvest'.
    
    CRITICAL INSTRUCTION FOR NAMES:
    - The database stores Farmer Names in ENGLISH script (e.g., "Suresh", "Ramesh").
    - If the user says a name in Hindi (e.g., "सुरेश"), you MUST transliterate it to English script ("Suresh") before calling the 'search_market' tool.
    
    Your goal is to help them find crops, filter by location/price/time, and negotiate with farmers.
    You can also read their inbox and messages.
    - To check for messages or conversations or to OPEN the inbox, call open_inbox. This applies even if they use local terms like "संदेश" (messages) or "माझे संदेश" (my messages) or "इनबॉक्स".
    - To go to the main market view, call open_market. This applies for terms like "बाजार" (market) or "मंडी" (mandi) or "होम" (home).
    - To check for messages or conversations data without opening it, call check_inbox.
    - To open an active conversation explicitly, call open_chat.
    - To read messages, call read_messages.
    - To reply to any farmer, call send_message with the message content and optionally recipientName.
    Always be polite and keep answers concise.
    `;

    const t = (key: keyof typeof TRANSLATIONS['en']) => {
        return TRANSLATIONS[user.language][key] || TRANSLATIONS['en'][key];
    };

    // --- Voice Tools Configuration ---
    const tools: FunctionDeclaration[] = [
        {
            name: "search_market",
            description: "Search and filter the marketplace. Use this for ANY search query. You can filter by crop name, location, farmer, price range, and time (recency).",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    query: { type: Type.STRING, description: "Crop name in English (e.g. Onion, Wheat)" },
                    location: { type: Type.STRING, description: "Filter by location (e.g. Nashik)" },
                    farmerName: { type: Type.STRING, description: "Filter by farmer name. The user might say the name in their local language, but the database has English names. Transliterate if needed." },
                    minPrice: { type: Type.NUMBER, description: "Minimum price" },
                    maxPrice: { type: Type.NUMBER, description: "Maximum price" },
                    time: { type: Type.STRING, enum: ["newest", "today", "week", "all"], description: "Time filter: 'newest' (sorted), 'today' (last 24h), 'week' (last 7 days), 'all'." }
                },
                required: []
            }
        },
        {
            name: "clear_search",
            description: "Clear all filters and show all crops.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "contact_seller",
            description: "Start negotiating with a farmer. Use this ONLY when the user explicitly wants to MESSAGE or TALK to a specific seller.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    farmerName: { type: Type.STRING, description: "Name of the farmer (exact match from list preferred)" },
                    cropName: { type: Type.STRING, description: "Crop name to further identify the seller" },
                    location: { type: Type.STRING, description: "Location of the seller" },
                    price: { type: Type.NUMBER, description: "Price of the crop" }
                },
                required: []
            }
        },
        {
            name: "sort_market",
            description: "Sort the marketplace listings.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    sortBy: { type: Type.STRING, enum: ["price_asc", "price_desc"], description: "Sort order" }
                },
                required: ["sortBy"]
            }
        },
        {
            name: "send_message",
            description: "Send a message to a seller. You can specify who to send it to from anywhere.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    message: { type: Type.STRING, description: "The message content" },
                    recipientName: { type: Type.STRING, description: "Optional. Name of the person to send the message to" },
                    cropName: { type: Type.STRING, description: "Optional crop name if there are multiple conversations with this person" }
                },
                required: ["message"]
            }
        },
        {
            name: "read_messages",
            description: "Read the actual content of the recent messages. It reads from the active chat or globally.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: 'check_inbox',
            description: 'Check messages. Returns sender, product name, quantity, and price for each conversation.',
            parameters: {
                type: Type.OBJECT,
                properties: {},
            }
        },
        {
            name: 'open_chat',
            description: 'Open a chat UI with a specific seller from the inbox.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    farmerName: { type: Type.STRING, description: "Name of the farmer to chat with" },
                    cropName: { type: Type.STRING, description: "Crop name to further identify the seller" }
                },
                required: ['farmerName']
            }
        },
        {
            name: "go_back",
            description: "Exit the chat and go back to the marketplace feed.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "open_market",
            description: "Open the main market listings feed to see all crops. Call this if the user says 'market', 'बाजार', 'मंडी', etc.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "open_inbox",
            description: "Open the user's inbox section to see all their conversations. Call this if the user says 'inbox', 'messages', 'संदेश', 'निरोप', etc.",
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: "update_profile",
            description: "Update the user profile details like name, location, or language.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "New name of the user" },
                    location: { type: Type.STRING, description: "New location/city" },
                    language: { type: Type.STRING, enum: ["en", "hi", "mr", "te", "ta", "bn"], description: "Language code" }
                },
                required: []
            }
        }
    ];

    const handleToolCall = async (name: string, args: any) => {
        console.log("Buyer Tool:", name, args);

        if (name === "search_market") {
            setActiveFilters({
                query: args.query || '',
                location: args.location || '',
                farmerName: args.farmerName || '',
                minPrice: args.minPrice || 0,
                maxPrice: args.maxPrice || Infinity,
                timeFilter: args.time || 'all'
            });

            if (args.time === 'newest') setSortOrder(null);

            // Calculate how many items match this new filter exactly as the UI will
            const newMatches = listingsRef.current.filter(l => {
                if (args.query) {
                    const q = args.query.toLowerCase();
                    const match = l.cropName.toLowerCase().includes(q) ||
                        l.cropNameEnglish?.toLowerCase().includes(q) ||
                        l.farmerName.toLowerCase().includes(q) ||
                        l.location.toLowerCase().includes(q);
                    if (!match) return false;
                }
                if (args.location) {
                    if (!l.location.toLowerCase().includes(args.location.toLowerCase())) return false;
                }
                if (args.farmerName) {
                    if (!l.farmerName.toLowerCase().includes(args.farmerName.toLowerCase())) return false;
                }

                const minP = args.minPrice || 0;
                const maxP = args.maxPrice || Infinity;
                if (l.price < minP) return false;
                if (l.price > maxP) return false;

                if (args.time === 'today') {
                    if (Date.now() - l.timestamp > 24 * 60 * 60 * 1000) return false;
                }
                if (args.time === 'week') {
                    if (Date.now() - l.timestamp > 7 * 24 * 60 * 60 * 1000) return false;
                }
                return true;
            });

            let response = "Filtered market";
            if (args.query) response += ` for ${args.query}`;
            if (args.location) response += ` in ${args.location}`;
            if (args.time) response += ` time: ${args.time}`;

            response += `. Found ${newMatches.length} matching products.`;
            // Include top 3 results specifically in the response to ensure precision
            if (newMatches.length > 0) {
                const topResults = newMatches.slice(0, 3).map(m => `[${m.farmerName}: ${m.quantity}kg of ${m.cropName} at ₹${m.price}/kg]`);
                response += ` Here are the best matches: ${topResults.join(', ')}`;
            }

            return response;
        }

        if (name === "clear_search") {
            setActiveFilters({
                query: '',
                location: '',
                farmerName: '',
                minPrice: 0,
                maxPrice: Infinity,
                timeFilter: 'all'
            });
            return "Showing all listings.";
        }

        if (name === "contact_seller") {
            let candidates = listingsRef.current;

            // Apply Filters
            if (args.farmerName) {
                // First try strict/partial match
                const nameQuery = args.farmerName.toLowerCase();
                let matches = candidates.filter(l => l.farmerName.toLowerCase().includes(nameQuery));

                // If no name match, check if the assistant passed a "Localized Name" but our DB has English?
                // Or if the user meant a specific person from the VISIBLE list which might account for transcripts.
                if (matches.length === 0) {
                    // Fallback: If the user said a name that seems like a first name
                    // and we have it in our cache/list?
                    // For now, rely on "Partial" match.
                } else {
                    candidates = matches;
                }
            }
            if (args.cropName) {
                const q = args.cropName.toLowerCase();
                candidates = candidates.filter(l =>
                    l.cropName.toLowerCase().includes(q) ||
                    l.cropNameEnglish?.toLowerCase().includes(q)
                );
            }
            if (args.location) {
                candidates = candidates.filter(l => l.location.toLowerCase().includes(args.location.toLowerCase()));
            }
            if (args.price) {
                candidates = candidates.filter(l => l.price === Number(args.price));
            }

            // AUTO-SELECT Logic for "Message him/that seller" context where assistant passes no name
            // If the filter resulted in exactly 1 candidate (or very few), assume that's the intent.
            // But we need to be careful. If no args provided, candidates = ALL listings.
            const hasArgs = args.farmerName || args.cropName || args.location || args.price;

            // If explicit name failed, return appropriate error.
            if (args.farmerName && candidates.length === 0) {
                return `I couldn't find a farmer named '${args.farmerName}'. Please try the name from the list.`;
            }

            if (candidates.length === 0) return "No matching sellers found to contact.";

            // Sort by price (Best Price First)
            candidates.sort((a, b) => a.price - b.price);
            const best = candidates[0];

            // If a specific name provided -> Open Chat directly
            if (args.farmerName && candidates.length > 0) {
                setSelectedListing(candidates[0]);
                return `Opened chat with ${candidates[0].farmerName}.`;
            }

            // If we have a SINGLE result from a specific query (e.g. "Message the Onion seller in Nashik")
            if (hasArgs && candidates.length === 1) {
                setSelectedListing(candidates[0]);
                return `Opened chat with ${candidates[0].farmerName}.`;
            }

            // Safety Check: If Name is NOT provided, require confirmation by showing list instead of messaging.
            if (!args.farmerName) {
                // Update UI to show these results
                if (args.location) setActiveFilters(prev => ({ ...prev, location: args.location }));
                else if (args.cropName) setActiveFilters(prev => ({ ...prev, query: args.cropName }));

                setSortOrder('asc'); // Show Best Price first
                return `Found ${candidates.length} sellers. The best price is ₹${best.price} from ${best.farmerName}. Who would you like to contact?`;
            }

            // Fallback
            const target = best;
            setSelectedListing(target);
            return `Opened chat with ${target.farmerName} for ${target.cropName} at ₹${target.price}.`;
        }

        if (name === "sort_market") {
            if (args.sortBy === 'price_asc') {
                setSortOrder('asc');
                return "Sorted by best price (lowest first).";
            }
            if (args.sortBy === 'price_desc') {
                setSortOrder('desc');
                return "Sorted by price (highest first).";
            }
            setSortOrder(null);
            return "Sort cleared.";
        }

        if (name === "go_back" || name === "open_market") {
            setSelectedListing(null);
            setActiveTab('market');
            return "Returned to marketplace.";
        }

        if (name === "send_message") {
            let receiverId = selectedListingRef.current?.farmerId;
            let listingId = selectedListingRef.current?.id;
            let finalName = receiverId;

            if (args.recipientName) {
                const possible = inboxItemsRef.current.filter(i =>
                    i.name.toLowerCase().includes(args.recipientName.toLowerCase())
                );

                if (possible.length === 0) {
                    return `Could not find a conversation with ${args.recipientName}.`;
                }

                let match = possible[0];
                if (args.cropName && possible.length > 1) {
                    const exact = possible.find(i => i.listingName?.toLowerCase().includes(args.cropName.toLowerCase()));
                    if (exact) match = exact;
                }

                receiverId = match.partnerId;
                listingId = match.listingId;
                finalName = match.name;
            } else if (selectedListingRef.current) {
                const match = inboxItemsRef.current.find(i => i.partnerId === receiverId && i.listingId === listingId);
                if (match) finalName = match.name;
            } else {
                return "Please specify who you want to send the message to, or open a chat first.";
            }

            if (!receiverId) return "Invalid recipient.";

            try {
                const msg = await api.sendMessage({
                    senderId: user.id,
                    receiverId,
                    listingId,
                    text: args.message,
                    timestamp: Date.now()
                });
                // Optimistically add to messages if we are in that chat
                if (selectedListingRef.current?.id === listingId) {
                    setMessages(prev => [...prev, msg]);
                }
                return `Message sent to ${finalName || receiverId}.`;
            } catch (e) {
                console.error("Voice msg failed", e);
                return "Failed to send message.";
            }
        }

        if (name === "read_messages") {
            let contextMessages = messagesRef.current;
            if (selectedListingRef.current) {
                // If a chat is open, only read messages from that specific conversation
                contextMessages = contextMessages.filter(m =>
                    (m.senderId === selectedListingRef.current!.farmerId || m.receiverId === selectedListingRef.current!.farmerId) &&
                    m.listingId === selectedListingRef.current!.id
                );
            }

            const recentMessages = contextMessages.slice(-5); // Get last 5 messages
            if (recentMessages.length === 0) return "No messages found.";

            return JSON.stringify(recentMessages.map(m => ({
                type: m.senderId === user.id ? 'sent' : 'received',
                from: m.senderId,
                text: m.text
            })));
        }

        if (name === 'check_inbox') {
            if (inboxItemsRef.current.length === 0) return "Inbox is empty.";
            return JSON.stringify(inboxItemsRef.current.map(i => ({ from: i.name, product: i.listingName, qty: i.listingQuantity, price: i.listingPrice, lastParams: i.lastMsg })));
        }

        if (name === 'open_chat') {
            const possible = inboxItemsRef.current.filter(i =>
                i.name.toLowerCase().includes(args.farmerName.toLowerCase())
            );

            if (possible.length === 0) return `Could not find a conversation with ${args.farmerName}.`;

            let match = possible[0];
            if (args.cropName && possible.length > 1) {
                const exact = possible.find(i => i.listingName?.toLowerCase().includes(args.cropName.toLowerCase()));
                if (exact) match = exact;
            }

            const listing = listingsRef.current.find(l => l.id === match.listingId);
            setSelectedListing(listing || {
                id: match.listingId || 'general',
                farmerId: match.partnerId,
                farmerName: match.name,
                cropName: match.listingName || 'General',
                price: match.listingPrice || 0,
                quantity: match.listingQuantity || 0,
                location: '',
                description: '',
                timestamp: Date.now()
            });
            setActiveTab('inbox');
            return `Opened chat with ${match.name}.`;
        }

        if (name === 'open_inbox') {
            setSelectedListing(null);
            setActiveTab('inbox');
            return "Opened the inbox section.";
        }

        if (name === "update_profile") {
            const updates: any = {};
            if (args.name) updates.name = args.name;
            if (args.location) updates.location = args.location;
            if (args.language) updates.language = args.language;

            if (Object.keys(updates).length > 0) {
                onUpdateUser(updates);
                setProfileData(prev => ({ ...prev, ...updates }));
                return "Profile updated successfully.";
            }
            return "No changes provided for profile.";
        }

        return "Unknown tool";
    };

    // --- Logic ---
    // Poll for all messages
    useEffect(() => {
        const fetchMessages = async () => {
            if (user.id) {
                const msgs = await api.getMessages(user.id);
                setMessages(msgs);
            }
        };

        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [user.id]);

    useEffect(() => {
        const processInbox = async () => {
            const threads = new Map<string, any>();

            for (const m of messages) {
                const partnerId = m.senderId === user.id ? m.receiverId : m.senderId;
                if (!partnerId || partnerId === user.id) continue;

                const key = `${partnerId}_${m.listingId || 'general'}`;

                if (!threads.has(key)) {
                    let listingName = 'General';
                    let listingQuantity: number | undefined;
                    let listingPrice: number | undefined;
                    if (m.listingId) {
                        const l = listings.find(lst => lst.id === m.listingId);
                        if (l) {
                            listingName = l.cropName;
                            listingQuantity = l.quantity;
                            listingPrice = l.price;
                        }
                    }

                    threads.set(key, {
                        partnerId,
                        listingId: m.listingId,
                        listingName,
                        listingQuantity,
                        listingPrice,
                        name: partnerId,
                        lastMsg: m.text,
                        timestamp: m.timestamp
                    });
                } else {
                    const t = threads.get(key)!;
                    if (m.timestamp > t.timestamp) {
                        t.lastMsg = m.text;
                        t.timestamp = m.timestamp;
                    }
                }
            }

            const items = await Promise.all(Array.from(threads.values()).map(async (item) => {
                let name = item.partnerId;
                try {
                    const u = await api.getUser(item.partnerId);
                    if (u) name = u.name;
                } catch (e) { }
                return { ...item, name };
            }));

            items.sort((a, b) => b.timestamp - a.timestamp);
            setInboxItems(items);
        };
        processInbox();
    }, [messages, user.id, listings]);

    // --- Logic ---
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedListing) return;

        try {
            const msg = await api.sendMessage({
                senderId: user.id,
                receiverId: selectedListing.farmerId,
                listingId: selectedListing.id,
                text: newMessage,
                timestamp: Date.now()
            });

            setMessages(prev => [...prev, msg]);
            setNewMessage('');

            // Removed Simulated Farmer Response - now relies on real user reply
        } catch (e) {
            console.error("Msg failed", e);
        }
    };

    const filteredListings = listings.filter(l => {
        // Query Filter
        if (activeFilters.query) {
            const q = activeFilters.query.toLowerCase();
            const match = l.cropName.toLowerCase().includes(q) ||
                l.cropNameEnglish?.toLowerCase().includes(q) ||
                l.farmerName.toLowerCase().includes(q) ||
                l.location.toLowerCase().includes(q);
            if (!match) return false;
        }

        // Location Filter
        if (activeFilters.location) {
            if (!l.location.toLowerCase().includes(activeFilters.location.toLowerCase())) return false;
        }

        // Farmer Name Filter
        if (activeFilters.farmerName) {
            if (!l.farmerName.toLowerCase().includes(activeFilters.farmerName.toLowerCase())) return false;
        }

        // Price Filter
        if (l.price < activeFilters.minPrice) return false;
        if (l.price > activeFilters.maxPrice) return false;

        // Time Filter
        if (activeFilters.timeFilter === 'today') {
            const oneDay = 24 * 60 * 60 * 1000;
            if (Date.now() - l.timestamp > oneDay) return false;
        }
        if (activeFilters.timeFilter === 'week') {
            const oneWeek = 7 * 24 * 60 * 60 * 1000;
            if (Date.now() - l.timestamp > oneWeek) return false;
        }

        return true;
    }).sort((a, b) => {
        if (sortOrder === 'asc') return a.price - b.price;
        if (sortOrder === 'desc') return b.price - a.price;
        // Default sort by Recency if 'newest'
        if (activeFilters.timeFilter === 'newest') return b.timestamp - a.timestamp;

        return 0;
    });

    // View: Profile
    if (showProfile) {
        const saveProfile = () => {
            onUpdateUser({
                name: profileData.name,
                location: profileData.location,
                language: profileData.language
            });
            setShowProfile(false);
        };

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 page-enter transition-colors">
                <button onClick={() => setShowProfile(false)} className="mb-4 flex items-center text-gray-600 dark:text-gray-400 hover:text-emerald-600 press-scale transition-colors">
                    <ArrowLeft className="w-5 h-5 mr-1" /> Back
                </button>
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100 animate-fade-in-up">Profile</h2>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div>
                        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Name</label>
                        <input
                            type="text"
                            value={profileData.name}
                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                            className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 text-lg font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Location</label>
                        <input
                            type="text"
                            value={profileData.location}
                            onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                            className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-100 text-lg font-medium"
                            placeholder="e.g. Pune, Maharashtra"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Language</label>
                        <LanguageDropdown
                            value={profileData.language}
                            onChange={(val) => setProfileData({ ...profileData, language: val as any })}
                            options={LANGUAGES}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Phone (Cannot Change)</label>
                        <div className="w-full p-3 border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            {user.phone}
                        </div>
                    </div>
                    <button onClick={saveProfile} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg mt-4 hover-glow press-scale btn-ripple">
                        Save Profile
                    </button>
                </div>
            </div>
        );
    }

    // View: Negotiation Chat
    if (selectedListing) {
        const negotiationInstruction = `
        You are a translator and negotiation assistant for a buyer speaking ${user.language}.
        The topic is ${selectedListing.cropName}, quantity is ${selectedListing.quantity}kg and price is ₹${selectedListing.price}/kg.
        Use 'send_message' to send replies to the farmer.
        Use 'go_back' to return to list.
        Use 'read_messages' to read history.
    `;

        return (
            <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
                {/* Chat Header */}
                <div className="bg-white dark:bg-gray-800 p-4 shadow-sm flex items-center gap-3 z-10 animate-fade-in-down">
                    <button onClick={() => setSelectedListing(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full press-scale transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    </button>
                    <div>
                        <h2 className="font-bold text-gray-800 dark:text-gray-100">{selectedListing.farmerName}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('negotiationTitle')}: {selectedListing.cropName}</p>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-3 rounded-lg text-sm mb-4 animate-fade-in-up">
                        <p className="font-semibold text-emerald-800 dark:text-emerald-300">{selectedListing.quantity}kg @ ₹{selectedListing.price}/kg</p>
                    </div>

                    {(() => {
                        let lastDateStr = '';
                        return messages.filter(m => (m.senderId === user.id && m.receiverId === selectedListing.farmerId || m.senderId === selectedListing.farmerId && m.receiverId === user.id) && m.listingId === selectedListing.id).map((m) => {
                            const isMe = m.senderId === user.id;
                            const currentDateStr = formatMessageDate(m.timestamp);
                            const showDate = currentDateStr !== lastDateStr;
                            if (showDate) lastDateStr = currentDateStr;

                            return (
                                <React.Fragment key={m.id}>
                                    {showDate && (
                                        <div className="flex justify-center my-4">
                                            <div className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-3 py-1 rounded-full shadow-sm">
                                                {currentDateStr}
                                            </div>
                                        </div>
                                    )}
                                    <div className={`flex ${isMe ? 'justify-end msg-out' : 'justify-start msg-in'} mb-4`}>
                                        <div className={`max-w-[80%] p-3 rounded-xl flex flex-col ${isMe ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
                                            <p>{m.text}</p>
                                            {m.translatedText && (
                                                <p className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-600/50 text-sm opacity-90 italic">
                                                    {m.translatedText}
                                                </p>
                                            )}
                                            <div className={`text-[10px] mt-1 pr-1 self-end ${isMe ? 'text-emerald-100' : 'text-gray-400 dark:text-gray-500'}`}>
                                                {formatMessageTime(m.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        });
                    })()}
                </div>

                {/* Input Area */}
                <div className="bg-white dark:bg-gray-800 p-4 border-t dark:border-gray-700 flex gap-2 fixed bottom-0 w-full md:max-w-md left-0 md:left-auto">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t('typeMessage')}
                        className="flex-1 border dark:border-gray-600 rounded-full px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-gray-100"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button onClick={handleSendMessage} className="bg-emerald-600 text-white p-2 rounded-full px-6 font-semibold press-scale hover:bg-emerald-700 transition-colors">
                        {t('send')}
                    </button>
                </div>

                <LiveAssistant
                    systemInstruction={negotiationInstruction}
                    initialMessage={t('tapToSpeak')}
                    tools={tools}
                    onToolCall={handleToolCall}
                />
            </div>
        );
    }

    // View: Marketplace Feed
    const feedInstruction = `
    ${systemInstruction}
    
    Current Visible Listings (Reference Context):
    ${filteredListings.slice(0, 5).map((l, i) => `${i + 1}. [${l.farmerName}] selling ${l.quantity}kg of ${l.cropName} for ₹${l.price}/kg in ${l.location}`).join('\n    ')}

    Universal Commands:
    - Use 'search_market' to find crops. ALWAYS convert search to English.
    - Use 'contact_seller' to talk to a farmer. 
      - IMPORTANT: If the user says "Message HIM", "Message THAT seller", or refers to a person by name from the Visible Listings above, pass the EXACT farmer name from the list.
      - If multiple sellers are visible but the user specifies a name, try to match the visible name.
    - Use 'sort_market' to filter/sort for best price.
    - Use 'update_profile' to update name, location, or language.
  `;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 transition-colors">
            <header className="bg-white dark:bg-gray-800 p-6 sticky top-0 z-10 shadow-sm flex flex-col gap-4 animate-fade-in-down">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('mandiTitle')}</h1>
                        <p className="text-gray-500 dark:text-gray-400">{t('findCrops')}</p>
                    </div>
                    <div className="flex gap-2">
                        <ThemeToggle />
                        <button
                            onClick={() => { setProfileData({ name: user.name, location: user.location || '', language: user.language }); setShowProfile(true); }}
                            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors press-scale"
                            aria-label="Profile"
                        >
                            <UserIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                            onClick={onLogout}
                            className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors press-scale"
                            aria-label="Logout"
                        >
                            <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-2">
                    <button
                        onClick={() => setActiveTab('market')}
                        className={`flex-1 py-2 rounded-lg font-medium transition-all press-scale ${activeTab === 'market' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                        Market
                    </button>
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`flex-1 py-2 rounded-lg font-medium transition-all press-scale ${activeTab === 'inbox' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow' : 'text-gray-500 hover:bg-white/50'}`}
                    >
                        Inbox
                    </button>
                </div>

                {/* Search Bar */}
                {activeTab === 'market' && (
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={activeFilters.query}
                            onChange={(e) => setActiveFilters(prev => ({ ...prev, query: e.target.value }))}
                            placeholder="Search crops, farmers or location..."
                            className="w-full pl-10 pr-10 py-2.5 bg-gray-100 dark:bg-gray-700 border-none rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none dark:text-gray-100"
                        />
                        {activeFilters.query && (
                            <button onClick={() => setActiveFilters(prev => ({ ...prev, query: '' }))} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}
            </header>

            {activeTab === 'market' ? (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredListings.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No crops found matching your criteria.
                        </div>
                    ) : (
                        filteredListings.map((listing, idx) => (
                            <div key={listing.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift press-scale flex flex-col justify-between animate-fade-in-up" style={{ animationDelay: `${idx * 0.07}s` }}>
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{listing.cropName}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" /> {listing.location}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {formatMessageDate(listing.timestamp)
                                                ? `Listed: ${formatMessageDate(listing.timestamp)} at ${formatMessageTime(listing.timestamp)}`
                                                : ''}
                                        </p>
                                    </div>
                                    <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2 py-1 rounded-md">
                                        {listing.farmerName}
                                    </span>
                                </div>

                                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{listing.description}</p>
                                {(listing as any).image ? (
                                    <div className="mb-4 overflow-hidden rounded-xl">
                                        <img
                                            src={(listing as any).image.startsWith('http') ? (listing as any).image : `http://localhost:5000${(listing as any).image}`}
                                            alt="crop"
                                            className="w-full h-40 md:h-56 object-cover transition-transform duration-300 hover:scale-105"
                                        />
                                    </div>
                                ) : (
                                    <div className="mb-4 w-full h-40 md:h-56 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl flex flex-col items-center justify-center text-gray-300 dark:text-gray-500">
                                        <span className="text-5xl">🌾</span>
                                        <p className="text-sm font-medium mt-2 text-gray-500 dark:text-gray-400">No Preview</p>
                                    </div>
                                )}

                                <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('price')}</span>
                                        <p className="font-bold text-xl text-emerald-700 dark:text-emerald-400">₹{listing.price}<span className="text-sm font-normal text-gray-500 dark:text-gray-400">/kg</span></p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('quantity')}</span>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{listing.quantity} kg</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedListing(listing)}
                                    className="w-full mt-4 bg-gray-900 dark:bg-emerald-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-emerald-600 press-scale hover:shadow-lg transition-all"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    {t('negotiate')}
                                </button>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="p-4 space-y-3">
                    {inboxItems.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            No messages in your inbox.
                        </div>
                    ) : (
                        inboxItems.map((item, idx) => (
                            <div key={idx} onClick={() => {
                                const listing = listings.find(l => l.id === item.listingId);
                                setSelectedListing(listing || {
                                    id: item.listingId || 'general',
                                    farmerId: item.partnerId,
                                    farmerName: item.name,
                                    cropName: item.listingName || 'General',
                                    price: item.listingPrice || 0,
                                    quantity: item.listingQuantity || 0,
                                    location: '',
                                    description: '',
                                    timestamp: Date.now()
                                });
                            }} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 hover-lift press-scale transition-colors animate-fade-in-up" style={{ animationDelay: `${idx * 0.07}s` }}>
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                                    {item.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="font-bold text-gray-800 dark:text-gray-100">{item.name}</h4>
                                        {item.listingName && (
                                            <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full">
                                                {item.listingName}
                                                {item.listingQuantity !== undefined && item.listingPrice !== undefined ? ` • ${item.listingQuantity}kg • ₹${item.listingPrice}/kg` : ''}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.lastMsg}</p>
                                </div>
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <LiveAssistant
                systemInstruction={feedInstruction}
                initialMessage={t('tapToSpeak')}
                tools={tools}
                onToolCall={handleToolCall}
            />
        </div>
    );
};

export default BuyerDashboard;