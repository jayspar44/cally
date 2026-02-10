import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { logger } from '../utils/logger';
import { getVersionString } from '../utils/appConfig';
import { MobileContainer } from '../components/layout/MobileContainer';
import { cn } from '../utils/cn';

const Login = () => {
    const { loginEmail, signup, user } = useAuth();
    const navigate = useNavigate();

    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignup) {
                await signup(email, password);
            } else {
                await loginEmail(email, password);
            }
        } catch (err) {
            logger.error('Auth error:', err);
            if (err.code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Email is already in use.');
            } else if (err.code === 'auth/weak-password') {
                setError('Password should be at least 6 characters.');
            } else {
                setError('Failed to ' + (isSignup ? 'create account' : 'log in'));
            }
        }

        setLoading(false);
    };

    return (
        <MobileContainer className="overflow-y-auto">
            <div className="min-h-[100dvh] flex flex-col items-center p-6 bg-background relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-[-10%] right-[-10%] w-[50vh] h-[50vh] bg-accent/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50vh] h-[50vh] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

                {/* Version string */}
                <div className="z-10 pt-2">
                    <p className="text-primary/30 font-mono text-[10px] tracking-widest uppercase">{getVersionString()}</p>
                </div>

                {/* Spacer — centers content vertically, collapses when keyboard shrinks viewport */}
                <div className="flex-1" />

                <div className="w-full max-w-sm z-10">
                    {/* Header */}
                    <div className="text-center mb-12 space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-primary to-primary/80 text-white shadow-xl shadow-primary/20 rotate-[-6deg] mb-4">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-serif font-black text-primary tracking-tight mb-2">
                                Kalli
                            </h1>
                            <p className="text-primary/60 font-sans text-lg text-balance">
                                Your gourmet AI nutrition companion.
                            </p>
                        </div>
                    </div>

                    {/* Card */}
                    <div className="bg-white/80 dark:bg-surface/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-card border border-white/50 dark:border-border/50">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50/80 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div className="space-y-1.5">
                                <label className="pl-4 text-xs font-bold text-primary/40 uppercase tracking-widest">Email</label>
                                <input
                                    type="email"
                                    placeholder="hello@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full h-14 px-6 rounded-2xl bg-background/50 border border-primary/10 text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all font-sans text-lg"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="pl-4 text-xs font-bold text-primary/40 uppercase tracking-widest">Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full h-14 px-6 rounded-2xl bg-background/50 border border-primary/10 text-primary placeholder:text-primary/30 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all font-sans text-lg"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    "w-full h-14 mt-4 rounded-2xl font-serif font-bold text-lg tracking-wide transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2",
                                    loading
                                        ? "bg-primary/5 text-primary/40 cursor-not-allowed"
                                        : "bg-primary text-white hover:translate-y-[-2px] active:translate-y-[0px] hover:shadow-xl active:shadow-sm"
                                )}
                            >
                                {loading ? 'Processing...' : (isSignup ? 'Create Account' : 'Sign In')}
                                {!loading && <ArrowRight className="w-5 h-5 opacity-80" />}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-primary/5 text-center">
                            <p className="text-primary/40 text-sm mb-3 font-medium">
                                {isSignup ? 'Already have an account?' : "New to Kalli?"}
                            </p>
                            <button
                                onClick={() => setIsSignup(!isSignup)}
                                className="text-accent hover:text-accent/80 font-bold text-sm tracking-wide active:scale-95 transition-transform"
                            >
                                {isSignup ? 'Sign In to your account' : 'Create a new account'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom spacer */}
                <div className="flex-1" />
            </div>
        </MobileContainer>
    );
};

export default Login;
