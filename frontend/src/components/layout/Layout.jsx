import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import FloatingCapsuleNav from './FloatingCapsuleNav';
import SearchOverlay from '../database/SearchOverlay';

export function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const isChatPage = location.pathname === '/chat';
    const isDatabase = location.pathname === '/database';
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        const handler = () => setShowSearch(true);
        window.addEventListener('open-database-search', handler);
        return () => window.removeEventListener('open-database-search', handler);
    }, []);

    const handleCloseSearch = useCallback(() => {
        setShowSearch(false);
        window.dispatchEvent(new CustomEvent('close-database-search'));
    }, []);

    const handleNavigateToDate = useCallback((date) => {
        if (isDatabase) {
            window.dispatchEvent(new CustomEvent('database-set-date', { detail: date }));
        } else {
            navigate(`/database?date=${date}`);
        }
        setShowSearch(false);
        window.dispatchEvent(new CustomEvent('close-database-search'));
    }, [isDatabase, navigate]);

    return (
        <div className="fixed inset-0 bg-background text-foreground font-sans selection:bg-accent/20 overflow-hidden">
            <div
                id="layout-container"
                className="absolute inset-0 overflow-y-auto no-scrollbar"
                style={{
                    paddingTop: 'calc(env(safe-area-inset-top) + 4.5rem)',
                    paddingBottom: 'env(safe-area-inset-bottom)'
                }}
            >
                <div className="px-4 sm:px-6 max-w-xl mx-auto w-full animate-in fade-in duration-500 h-full flex flex-col">
                    <div className="flex-1">
                        <Outlet />
                    </div>
                    {!isChatPage && <div className="h-24 w-full flex-shrink-0" aria-hidden="true" />}
                </div>
            </div>

            <TopBar />
            <FloatingCapsuleNav />
            {showSearch && (
                <SearchOverlay onClose={handleCloseSearch} onNavigateToDate={handleNavigateToDate} />
            )}
        </div>
    );
}
