import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: (x?: number, y?: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => { } });

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('speakharvest_theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const [isTransitioning, setIsTransitioning] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('speakharvest_theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggleTheme = useCallback((x?: number, y?: number) => {
        // If no coordinates provided or already transitioning, do a simple toggle
        if (isTransitioning) return;

        const clickX = x ?? window.innerWidth / 2;
        const clickY = y ?? window.innerHeight / 2;

        // Calculate the maximum radius needed to cover the entire screen from click point
        const maxRadius = Math.hypot(
            Math.max(clickX, window.innerWidth - clickX),
            Math.max(clickY, window.innerHeight - clickY)
        );

        setIsTransitioning(true);

        // Set CSS custom properties on the overlay for the animation
        requestAnimationFrame(() => {
            const overlay = overlayRef.current;
            if (overlay) {
                overlay.style.setProperty('--cx', `${clickX}px`);
                overlay.style.setProperty('--cy', `${clickY}px`);
                overlay.style.setProperty('--max-r', `${maxRadius}px`);

                // Force reflow to restart animation
                overlay.offsetHeight;
                overlay.classList.add('theme-transition-active');

                // Switch the actual theme halfway through the animation
                const switchTimer = setTimeout(() => {
                    setIsDark(prev => !prev);
                }, 400);

                // Clean up after animation completes
                const cleanupTimer = setTimeout(() => {
                    overlay.classList.remove('theme-transition-active');
                    setIsTransitioning(false);
                }, 800);

                return () => {
                    clearTimeout(switchTimer);
                    clearTimeout(cleanupTimer);
                };
            }
        });
    }, [isTransitioning]);

    // The overlay color: the TARGET theme's background
    // If currently light (isDark=false), clicking will go to dark → show dark overlay
    // If currently dark (isDark=true), clicking will go to light → show light overlay
    const overlayColor = isDark ? '#f9fafb' : '#111827';

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
            {/* Theme transition overlay */}
            <div
                ref={overlayRef}
                className="theme-transition-overlay"
                style={{
                    '--overlay-color': overlayColor,
                } as React.CSSProperties}
            />
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
