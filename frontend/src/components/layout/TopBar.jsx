import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { HiUser, HiCalendarDays, HiCircleStack } from 'react-icons/hi2';
import { useAuth } from '../../contexts/AuthContext';

import { useUserPreferences } from '../../contexts/UserPreferencesContext';

const PAGE_TITLES = {
    '/': 'Cally',
    '/database': 'Food Log',
    '/insights': 'Insights',
    '/settings': 'Settings',
};

export default function TopBar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { developerMode } = useUserPreferences();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const container = document.getElementById('layout-container');
        if (!container) return;

        const handleScroll = () => {
            setScrolled(container.scrollTop > 20);
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    const title = PAGE_TITLES[location.pathname] || 'Cally';

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                scrolled
                    ? "bg-white/80 dark:bg-surface/80 backdrop-blur-xl border-b border-border pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 px-6 shadow-sm"
                    : "bg-white/80 dark:bg-surface/80 backdrop-blur-md pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 px-6",
                developerMode && "border-t-[3px] border-t-red-500"
            )}
        >
            <div className="max-w-md mx-auto flex items-center justify-between">

                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h1
                            className={cn(
                                "font-serif font-black text-primary transition-all duration-300 origin-left",
                                scrolled ? "text-lg" : "text-3xl"
                            )}
                        >
                            {title}
                        </h1>
                        {developerMode && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                                DEV
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center px-3 py-1 rounded-full bg-white/50 dark:bg-surface/50 border border-border backdrop-blur-md">
                        <HiCalendarDays className="w-4 h-4 text-primary/60 mr-2" />
                        <span className="font-mono text-xs text-primary/80">
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                    </div>

                    <button
                        onClick={() => navigate('/database')}
                        className="relative w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm overflow-hidden active:scale-95 transition-transform group"
                        title="Food Log"
                    >
                        <HiCircleStack className="w-5 h-5 text-primary group-hover:text-accent transition-colors" />
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="relative w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center shadow-sm overflow-hidden active:scale-95 transition-transform"
                    >
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <HiUser className="w-5 h-5 text-primary" />
                        )}
                    </button>
                </div>

            </div>
        </header>
    );
}
