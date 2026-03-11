import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Save, User as UserIcon } from 'lucide-react';
import { Language, User } from '../types';
import { transliterateToEnglish } from '../services/geminiService';
import { TRANSLATIONS } from '../constants';

interface NameCollectionModalProps {
    user: User;
    selectedLanguage: Language;
    onSave: (newName: string) => Promise<void>;
}

const NameCollectionModal: React.FC<NameCollectionModalProps> = ({ user, selectedLanguage, onSave }) => {
    const [name, setName] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Use a ref to track if we've already welcomed the user to avoid double speech
    const hasWelcomed = useRef(false);

    // Use the explicitly selected language, fallback to user preference or english
    const currentLang = selectedLanguage || user.language || 'en';
    const t = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];

    const getLangCode = (lang: string) => {
        switch (lang) {
            case 'hi': return 'hi-IN';
            case 'mr': return 'mr-IN';
            case 'te': return 'te-IN';
            case 'ta': return 'ta-IN';
            case 'bn': return 'bn-IN';
            default: return 'en-US';
        }
    };

    useEffect(() => {
        const speakWelcome = () => {
            if (hasWelcomed.current) return;

            const text = t.voiceModalWelcome;
            const langCode = getLangCode(currentLang);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = langCode;

            // Attempt to find a native voice for better pronunciation
            const voices = window.speechSynthesis.getVoices();
            const nativeVoice = voices.find(v => v.lang === langCode) ||
                voices.find(v => v.lang.startsWith(langCode.split('-')[0]));

            if (nativeVoice) {
                utterance.voice = nativeVoice;
            }

            utterance.onend = () => {
                // slight delay to ensure audio is completely clear
                setTimeout(() => {
                    startListening();
                }, 500);
            };

            window.speechSynthesis.speak(utterance);
            hasWelcomed.current = true;
        };

        // Voices might load asynchronously
        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = speakWelcome;
        } else {
            speakWelcome();
        }

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, [currentLang]);

    const startListening = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Voice recognition is not supported in this browser.");
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        // Always use English for name capture so names are in Latin script
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            // Capitalize first letter of each word for proper name formatting
            const formattedName = transcript.replace(/\b\w/g, (c: string) => c.toUpperCase());
            setName(formattedName);
        };

        recognition.start();
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            // Transliterate to English for uniformity (for buyers)
            const englishName = await transliterateToEnglish(name);
            await onSave(englishName);
        } catch (error) {
            console.error("Failed to save name", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-modal">
                <div className="bg-emerald-600 p-6 text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md animate-float">
                        <UserIcon className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {t.voiceModalTitle}
                    </h2>
                    <p className="text-emerald-100">
                        {t.voiceModalSubtitle}
                    </p>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t.voiceModalLabel}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t.voiceModalPlaceholder}
                                    className="w-full pl-4 pr-12 py-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-emerald-500 focus:ring-0 text-lg transition-all bg-white dark:bg-gray-700 dark:text-gray-100"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={startListening}
                                    className={`absolute right-3 top-3 p-2 rounded-lg transition-all ${isListening
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 animate-pulse'
                                        : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600'
                                        }`}
                                >
                                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                <Mic className="w-3 h-3" />
                                {t.voiceModalMicHint}
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={!name.trim() || isSaving}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl translate-y-0 hover:-translate-y-1 hover-glow press-scale"
                        >
                            {isSaving ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    {t.voiceModalSave}
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default NameCollectionModal;
