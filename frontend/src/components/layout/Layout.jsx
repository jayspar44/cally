import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import FloatingCapsuleNav from './FloatingCapsuleNav';

export const Layout = () => {
    return (
        <div className="h-screen overflow-y-auto bg-background text-foreground font-sans selection:bg-accent/20 relative no-scrollbar">
            {/* Note: Texture overlay is applied to body in index.css */}

            <TopBar />

            <main className="pt-24 pb-36 px-4 sm:px-6 max-w-xl mx-auto w-full animate-in fade-in duration-500">
                <Outlet />
            </main>

            <FloatingCapsuleNav />
        </div>
    );
};
