import { Home, MessageCircle, BarChart3, Database } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

// eslint-disable-next-line no-unused-vars -- Icon is used in JSX below
const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className="group flex flex-col items-center justify-center"
    >
        {({ isActive }) => (
            <>
                <div className={clsx(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300",
                    isActive
                        ? "bg-green-500 text-white shadow-md ring-4 ring-green-500/20 dark:bg-green-600 dark:ring-green-900/50"
                        : "text-slate-400 group-hover:bg-slate-50 dark:text-slate-500 dark:group-hover:bg-slate-700"
                )}>
                    <Icon
                        className="w-6 h-6 transition-all"
                        strokeWidth={2}
                    />
                </div>
                <span className={clsx(
                    "text-xs mt-1 transition-colors",
                    isActive ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
                )}>
                    {label}
                </span>
            </>
        )}
    </NavLink>
);

export const Navbar = () => {
    return (
        <nav
            className="absolute left-4 right-4 bg-white/80 backdrop-blur-lg border border-slate-100 px-6 rounded-2xl shadow-lg z-30 dark:bg-slate-800/90 dark:border-slate-700"
            style={{ bottom: 'calc(1.5rem + var(--safe-area-bottom, 0))' }}
        >
            <div className="flex items-center justify-around h-20 max-w-sm mx-auto">
                <NavItem to="/" icon={Home} label="Home" />
                <NavLink
                    to="/chat"
                    className={({ isActive }) => clsx(
                        "flex flex-col items-center justify-center w-16 h-16 rounded-full shadow-lg transition-transform active:scale-95 -mt-4",
                        isActive
                            ? "bg-green-500 text-white ring-4 ring-green-500/20 dark:bg-green-600 dark:ring-green-900/50"
                            : "bg-white text-green-500 border border-slate-100 dark:bg-slate-700 dark:text-green-400 dark:border-slate-600"
                    )}
                >
                    <MessageCircle className="w-7 h-7" />
                    <span className="text-[10px] mt-0.5">Chat</span>
                </NavLink>
                <NavItem to="/database" icon={Database} label="Logs" />
                <NavItem to="/insights" icon={BarChart3} label="Insights" />
            </div>
        </nav>
    );
};
