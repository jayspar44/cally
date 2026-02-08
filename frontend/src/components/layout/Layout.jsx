import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import FloatingCapsuleNav from './FloatingCapsuleNav';

export const Layout = () => {
    const location = useLocation();
    const isChatPage = location.pathname === '/chat';

    // Samy-style robust alignment
    // Top Bar Height: ~88px (adjusted for safe area)
    // Nav Height: ~80px (capsule + bottom margin)
    // Chat Input Height: ~80px (input + margin)

    return (
        <div className="fixed inset-0 bg-background text-foreground font-sans selection:bg-accent/20 overflow-hidden">
            {/* Note: Texture overlay is applied to body in index.css */}

            {/* Content Area - Scrolls independently */}
            <div
                id="layout-container"
                className="absolute inset-0 overflow-y-auto no-scrollbar"
                style={{
                    // Top: Safe Area + TopBar height (Reduced to 6rem per user request)
                    paddingTop: 'calc(env(safe-area-inset-top) + 6rem)',
                    // Bottom: Safe Area only.
                    // Content spacing is now handled by explicit Spacer divs for robustness.
                    paddingBottom: 'env(safe-area-inset-bottom)'
                }}
            >
                <div className="px-4 sm:px-6 max-w-xl mx-auto w-full animate-in fade-in duration-500 h-full flex flex-col">
                    <div className="flex-1">
                        <Outlet />
                    </div>
                    {/* SPACER for Floating Nav (Non-Chat pages) */}
                    {/* Chat page handles its own spacer. Home/Insights use this. */}
                    {!isChatPage && <div className="h-32 w-full flex-shrink-0" aria-hidden="true" />}
                </div>
            </div>

            {/* Fixed Elements (Outside scroll container) */}
            <TopBar />
            <FloatingCapsuleNav />
        </div>
    );
};
