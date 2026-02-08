import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import FloatingCapsuleNav from './FloatingCapsuleNav';

export function Layout() {
    const location = useLocation();
    const isChatPage = location.pathname === '/chat';

    return (
        <div className="fixed inset-0 bg-background text-foreground font-sans selection:bg-accent/20 overflow-hidden">
            <div
                id="layout-container"
                className="absolute inset-0 overflow-y-auto no-scrollbar"
                style={{
                    paddingTop: 'calc(env(safe-area-inset-top) + 6rem)',
                    paddingBottom: 'env(safe-area-inset-bottom)'
                }}
            >
                <div className="px-4 sm:px-6 max-w-xl mx-auto w-full animate-in fade-in duration-500 h-full flex flex-col">
                    <div className="flex-1">
                        <Outlet />
                    </div>
                    {!isChatPage && <div className="h-32 w-full flex-shrink-0" aria-hidden="true" />}
                </div>
            </div>

            <TopBar />
            <FloatingCapsuleNav />
        </div>
    );
}
