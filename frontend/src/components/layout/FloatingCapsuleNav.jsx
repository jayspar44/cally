import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { HiHome, HiSquares2X2, HiChatBubbleOvalLeftEllipsis } from 'react-icons/hi2';

export default function FloatingCapsuleNav() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[80%] max-w-[500px] z-50">
            <div className="bg-white/90 dark:bg-surface/90 backdrop-blur-2xl border border-white/20 dark:border-border/30 rounded-[2.5rem] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.5)] px-6 py-3 flex items-center justify-between relative">
                <NavItem
                    icon={HiHome}
                    isActive={location.pathname === '/'}
                    onClick={() => navigate('/')}
                />

                <div className="absolute left-1/2 -translate-x-1/2 -top-6">
                    <button
                        onClick={() => navigate('/chat')}
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(200,90,60,0.4)] dark:shadow-[0_10px_30px_rgba(224,122,95,0.5)] transition-all duration-300 active:scale-95 bg-accent text-accent-foreground border-4 border-background"
                    >
                        <HiChatBubbleOvalLeftEllipsis className="w-8 h-8" />
                    </button>
                </div>

                <NavItem
                    icon={HiSquares2X2}
                    isActive={location.pathname === '/insights'}
                    onClick={() => navigate('/insights')}
                />
            </div>
        </nav>
    );
}

function NavItem({ icon, isActive, onClick }) {
    const Icon = icon;
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-2xl transition-all duration-200",
                isActive ? "text-primary bg-primary/5" : "text-primary/40 hover:text-primary/60 hover:bg-primary/5"
            )}
        >
            <Icon
                className={cn(
                    "w-6 h-6 transition-all duration-200",
                    isActive ? "text-primary" : "text-primary/40"
                )}
            />
        </button>
    );
}
