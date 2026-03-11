import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Globe } from 'lucide-react';

interface LanguageOption {
    code: string;
    label: string;
    nativeLabel: string;
}

interface LanguageDropdownProps {
    value: string;
    onChange: (value: string) => void;
    options: LanguageOption[];
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.code === value);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div ref={dropdownRef} className="relative">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between p-3.5 rounded-xl border-2 bg-gray-50 dark:bg-gray-700 text-left
                    transition-all duration-200
                    ${isOpen
                        ? 'border-emerald-500 bg-white dark:bg-gray-700 shadow-md ring-4 ring-emerald-500/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 hover:bg-white dark:hover:bg-gray-600'
                    }
                `}
            >
                <div className="flex items-center gap-3">
                    <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        ${isOpen ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}
                        transition-colors duration-200
                    `}>
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-base">
                            {selected?.nativeLabel || 'Select'}
                        </p>
                        <p className="text-xs text-gray-400">
                            {selected?.label || 'Choose language'}
                        </p>
                    </div>
                </div>
                <ChevronDown className={`
                    w-5 h-5 text-gray-400 transition-transform duration-300
                    ${isOpen ? 'rotate-180 text-emerald-500' : ''}
                `} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-fade-in-down">
                    <div className="max-h-64 overflow-y-auto py-1">
                        {options.map((lang, idx) => {
                            const isSelected = lang.code === value;
                            return (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => {
                                        onChange(lang.code);
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        w-full flex items-center justify-between px-4 py-3 text-left
                                        transition-all duration-150 animate-fade-in-up
                                        ${isSelected
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        }
                                    `}
                                    style={{ animationDelay: `${idx * 0.04}s` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                                            w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                                            ${isSelected
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                            }
                                        `}>
                                            {lang.nativeLabel.charAt(0)}
                                        </div>
                                        <div>
                                            <p className={`font-medium text-sm ${isSelected ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                                {lang.nativeLabel}
                                            </p>
                                            <p className="text-xs text-gray-400">{lang.label}</p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-pop-in">
                                            <Check className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanguageDropdown;
