import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { HiHome, HiSquares2X2, HiChatBubbleOvalLeftEllipsis } from 'react-icons/hi2';
import { useState } from 'react';

export default function FloatingCapsuleNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMicActive, setIsMicActive] = useState(false); // Placeholder for future voice interaction

    const navItems = [
        { icon: HiHome, label: 'Home', path: '/' },
        // Middle is FAB
        { icon: HiSquares2X2, label: 'Insights', path: '/insights' },
    ];

    return (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[80%] max-w-[500px] z-50">
            <div className="bg-white/90 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] px-6 py-3 flex items-center justify-between relative">

                {/* Left Items */}
                <div className="flex gap-6">
                    {navItems.slice(0, 1).map((item) => (
                        <NavItem
                            key={item.label}
                            item={item}
                            isActive={location.pathname === item.path}
                            onClick={() => navigate(item.path)}
                        />
                    ))}
                </div>

                {/* Center FAB - Floats above slightly */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6">
                    <button
                        onClick={() => navigate('/chat')}
                        className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(200,90,60,0.4)] transition-all duration-300 active:scale-95 group",
                            "bg-accent text-accent-foreground border-4 border-background"
                        )}
                    >
                        <HiChatBubbleOvalLeftEllipsis className="w-8 h-8" />
                    </button>
                    {/* Ripple/Pulse effect for AI state could go here */}
                </div>

                {/* Right Items */}
                <div className="flex gap-6">
                    {navItems.slice(1, 2).map((item) => (
                        <NavItem
                            key={item.label}
                            item={item}
                            isActive={location.pathname === item.path}
                            onClick={() => navigate(item.path)}
                        />
                    ))}
                </div>

            </div>
        </nav>
    );
}

function NavItem({ item, isActive, onClick }) {
    const Icon = item.icon;
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-2xl transition-all duration-200",
                isActive ? "text-primary bg-primary/5" : "text-primary/40 hover:text-primary/60 hover:bg-primary/5"
            )}
        >
            {/* Standard Lucide Icons with subtle fill to match Top Bar "premium" look */}
            <Icon
                className={cn(
                    "w-6 h-6 transition-all duration-200",
                    isActive ? "text-primary fill-primary/10" : "text-primary/40 fill-transparent"
                )}
                strokeWidth={isActive ? 2.5 : 2}
            />
        </button>
    );
}
