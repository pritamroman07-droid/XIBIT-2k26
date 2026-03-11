import React, { useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle: React.FC = () => {
    const { isDark, toggleTheme } = useTheme();
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        // Get the center of the button for the animation origin
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            toggleTheme(x, y);
        } else {
            toggleTheme(e.clientX, e.clientY);
        }
    };

    return (
        <button
            ref={buttonRef}
            onClick={handleClick}
            className="relative p-2.5 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all press-scale z-[60]"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <div className="relative w-5 h-5">
                {/* Sun: shown in dark mode → click to go light */}
                <Sun
                    className={`w-5 h-5 text-amber-500 absolute inset-0 transition-all duration-500 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
                        }`}
                />
                {/* Moon: shown in light mode → click to go dark */}
                <Moon
                    className={`w-5 h-5 text-blue-400 absolute inset-0 transition-all duration-500 ${isDark ? 'opacity-0 -rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
                        }`}
                />
            </div>
        </button>
    );
};

export default ThemeToggle;
