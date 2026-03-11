import React from 'react';
import { LANGUAGES } from '../constants';
import { Language } from '../types';

interface LanguageSelectorProps {
  onSelect: (lang: Language) => void;
  selectedLang?: Language;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onSelect, selectedLang }) => {
  return (
    <div className="grid grid-cols-2 gap-4 w-full max-w-md mx-auto p-4">
      {LANGUAGES.map((lang, idx) => (
        <button
          key={lang.code}
          onClick={() => onSelect(lang.code)}
          className={`
            flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all hover-lift press-scale animate-pop-in
            ${selectedLang === lang.code
              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 shadow-lg scale-105'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20'}
          `}
          style={{ animationDelay: `${idx * 0.08}s` }}
        >
          <span className="text-2xl font-bold mb-2">{lang.nativeLabel}</span>
          <span className="text-sm opacity-75">{lang.label}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
