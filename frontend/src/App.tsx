import React, { useState, useEffect } from 'react';
import { User, Language, CropListing } from './types';
import { api } from './api';
import LanguageSelector from './components/LanguageSelector';
import FarmerDashboard from './pages/FarmerDashboard';
import BuyerDashboard from './pages/BuyerDashboard';
import { MOCK_LISTINGS, TRANSLATIONS } from './constants';
import { ShieldCheck, Phone } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import NameCollectionModal from './components/NameCollectionModal';

const App: React.FC = () => {
  // Restore session from localStorage
  const savedSession = (() => {
    try {
      const data = localStorage.getItem('speakharvest_session');
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  })();

  // State — initialize from saved session if available
  const [step, setStep] = useState<'lang' | 'role' | 'auth' | 'app'>(savedSession ? 'app' : 'lang');
  const [language, setLanguage] = useState<Language>(savedSession?.language || 'en');
  const [role, setRole] = useState<'farmer' | 'buyer' | null>(savedSession?.role || null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [user, setUser] = useState<User | null>(savedSession?.user || null);
  const [listings, setListings] = useState<CropListing[]>(MOCK_LISTINGS);

  // Handlers
  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
    setStep('role');
  };

  useEffect(() => {
    if (step === 'app') {
      loadListings();
    }
  }, [step]);

  const handleRoleSelect = (r: 'farmer' | 'buyer') => {
    setRole(r);
    setStep('auth');
  };

  const loadListings = async () => {
    try {
      const data = await api.getListings();
      setListings(data);
    } catch (e) {
      console.error("Failed to load listings", e);
    }
  };

  const handleLogin = async () => {
    if (phoneNumber.length > 9) {
      try {
        // Attempt login first
        let loggedInUser = await api.loginUser(phoneNumber);

        // If user not found (null), registers them
        if (!loggedInUser && role) {
          loggedInUser = await api.registerUser({
            name: role === 'farmer' ? 'Kisan Bhai' : 'Vyapari Ji', // In a real app, you'd ask for this
            role,
            language,
            phone: phoneNumber,
            location: ''
          });
        }

        if (loggedInUser) {
          // Map _id to id if necessary (api usually handles this but safety check)
          const userWithId = { ...loggedInUser, id: (loggedInUser as any)._id || loggedInUser.id };
          setUser(userWithId);

          // Save session to localStorage
          localStorage.setItem('speakharvest_session', JSON.stringify({
            user: userWithId,
            language,
            role
          }));

          // Load listings from server
          await loadListings();

          setStep('app');
        }
      } catch (error) {
        alert("Login/Registration failed. Please check console.");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('speakharvest_session');
    setUser(null);
    setRole(null);
    setPhoneNumber('');
    setOtp('');
    setStep('lang');
    setListings([]);
  };

  const handleAddListing = async (listing: any) => {
    try {
      // Create on backend
      const newListing = await api.createListing(listing);
      setListings(prev => [newListing, ...prev]);
    } catch (e) {
      console.error(e);
      alert("Failed to create listing");
    }
  };

  const handleUpdateListing = async (updatedListing: CropListing) => {
    try {
      const result = await api.updateListing(updatedListing.id, updatedListing);
      setListings(prev => prev.map(l => l.id === result.id ? result : l));
    } catch (e) {
      alert("Failed to update listing");
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    try {
      await api.deleteListing(listingId);
      setListings(prev => prev.filter(l => l.id !== listingId));
    } catch (e) {
      alert("Failed to delete listing");
    }
  };

  const handleUpdateUser = async (updates: Partial<User>) => {
    if (!user) return;
    try {
      const updatedUser = await api.updateUser(user.id, updates);
      if (updatedUser) {
        const userWithId = { ...updatedUser, id: (updatedUser as any)._id || updatedUser.id };
        setUser(userWithId);
        // Update saved session
        localStorage.setItem('speakharvest_session', JSON.stringify({
          user: userWithId,
          language: userWithId.language || language,
          role: userWithId.role || role
        }));
        // Reload listings to reflect potential name change in listings
        await loadListings();
      }
    } catch (e) {
      alert("Failed to update profile");
    }
  };

  const t = (key: keyof typeof TRANSLATIONS['en']) => {
    return TRANSLATIONS[language][key] || TRANSLATIONS['en'][key];
  };

  // Render Logic
  if (step === 'lang') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100 animate-fade-in-up">Select Language / भाषा चुनें</h1>
        <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <LanguageSelector onSelect={handleLangSelect} />
        </div>
      </div>
    );
  }

  if (step === 'role') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 transition-colors">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <h1 className="text-2xl font-bold mb-8 text-center animate-fade-in-up dark:text-gray-100">{t('whoAreYou')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg">
          <button onClick={() => handleRoleSelect('farmer')} className="bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-500 p-8 rounded-2xl flex flex-col items-center hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors hover-lift press-scale animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <span className="text-4xl mb-2">🧑‍🌾</span>
            <span className="text-xl font-bold text-emerald-900 dark:text-emerald-300">{t('roleFarmer')}</span>
            <span className="text-sm text-emerald-700 dark:text-emerald-400">{t('sellCropsDesc')}</span>
          </button>
          <button onClick={() => handleRoleSelect('buyer')} className="bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 p-8 rounded-2xl flex flex-col items-center hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors hover-lift press-scale animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <span className="text-4xl mb-2">🏢</span>
            <span className="text-xl font-bold text-blue-900 dark:text-blue-300">{t('roleBuyer')}</span>
            <span className="text-sm text-blue-700 dark:text-blue-400">{t('buyCropsDesc')}</span>
          </button>
        </div>
      </div>
    )
  }

  if (step === 'auth') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 transition-colors">
        <div className="absolute top-4 right-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm space-y-6 animate-fade-in-up">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('loginTitle')}</h2>
            <p className="text-gray-500 dark:text-gray-400">{t('loginSubtitle')}</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                placeholder={t('enterPhonePlaceholder')}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            {phoneNumber.length > 9 && (
              <div className="animate-fade-in">
                <input
                  type="text"
                  placeholder={t('otpPlaceholder')}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center tracking-widest text-lg bg-white dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            )}

            <button
              disabled={phoneNumber.length < 10}
              onClick={handleLogin}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all hover-glow press-scale"
            >
              {t('verifyLogin')}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-8">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('secureText')}</span>
          </div>
        </div>
      </div>
    )
  }

  if (user && step === 'app') {
    const isDefaultName = user.name === 'Kisan Bhai' || user.name === 'Vyapari Ji';

    return (
      <>
        {isDefaultName && (
          <NameCollectionModal
            user={user}
            selectedLanguage={language}
            onSave={async (newName) => {
              await handleUpdateUser({ name: newName });
            }}
          />
        )}
        {user.role === 'farmer'
          ? <FarmerDashboard
            user={user}
            listings={listings}
            onAddListing={handleAddListing}
            onUpdateListing={handleUpdateListing}
            onDeleteListing={handleDeleteListing}
            onUpdateUser={handleUpdateUser}
            onLogout={handleLogout}
          />
          : <BuyerDashboard
            user={user}
            listings={listings}
            onUpdateUser={handleUpdateUser}
            onLogout={handleLogout}
          />
        }
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 animate-fade-in transition-colors">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg animate-pulse">Loading...</p>
      </div>
    </div>
  );
};

export default App;