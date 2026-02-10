import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { api } from '../api/services';
import { LogOut, Sun, User, Info, ChevronRight, Check, Trash2, Cpu, Database, Target } from 'lucide-react';
import { getVersionString, getEnvironment, getBackendInfo } from '../utils/appConfig';
import { cn } from '../utils/cn';

export default function Settings() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    // Theme context kept for compatibility, though we enforce specific theme now
    const { isDark, toggleTheme } = useTheme();
    const { firstName, saveFirstName, developerMode, setDeveloperMode, settings, updateProfileConfig } = useUserPreferences();

    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(firstName);
    const [savingName, setSavingName] = useState(false);

    const [editingNutrition, setEditingNutrition] = useState(false);
    const [nutritionForm, setNutritionForm] = useState({
        targetCalories: 2000,
        targetProtein: 50,
        targetCarbs: 250,
        targetFat: 65
    });
    const [savingNutrition, setSavingNutrition] = useState(false);

    useEffect(() => {
        if (settings) {
            setNutritionForm(prev => ({
                ...prev,
                targetCalories: settings.targetCalories ?? 2000,
                targetProtein: settings.targetProtein ?? 50,
                targetCarbs: settings.targetCarbs ?? 250,
                targetFat: settings.targetFat ?? 65
            }));
        }
    }, [settings]);

    const handleLogout = async () => {
        if (confirm('Are you sure you want to sign out?')) {
            await logout();
            navigate('/login');
        }
    };

    const handleClearChat = async () => {
        if (confirm('Are you sure you want to clear your entire chat history? This cannot be undone.')) {
            try {
                await api.clearChatHistory();
                alert('Chat history cleared successfully.');
            } catch (error) {
                console.error(error);
                alert('Failed to clear chat history. Please try again.');
            }
        }
    };

    const handleSaveName = async () => {
        if (!nameInput.trim()) return;
        setSavingName(true);
        try {
            await saveFirstName(nameInput.trim());
            setEditingName(false);
        } catch {
            alert('Failed to save name');
        }
        setSavingName(false);
    };

    const handleSaveNutrition = async () => {
        setSavingNutrition(true);
        try {
            await updateProfileConfig({
                settings: {
                    targetCalories: parseInt(nutritionForm.targetCalories),
                    targetProtein: parseInt(nutritionForm.targetProtein),
                    targetCarbs: parseInt(nutritionForm.targetCarbs),
                    targetFat: parseInt(nutritionForm.targetFat),
                }
            });
            setEditingNutrition(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save nutrition targets');
        }
        setSavingNutrition(false);
    };

    const backendInfo = getBackendInfo();
    const environment = getEnvironment();

    return (
        <div className="space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* User Profile Section */}
            <Section title="Profile Identity">
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-sans text-sm font-medium text-primary">Display Name</span>
                            <span className="font-mono text-xs text-primary/40">Visible in greetings</span>
                        </div>
                    </div>
                    {editingName ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                className="w-32 px-3 py-1.5 text-sm bg-primary/5 border border-transparent rounded-lg focus:border-primary/20 outline-none font-sans text-primary"
                                autoFocus
                            />
                            <button
                                onClick={handleSaveName}
                                disabled={savingName}
                                className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setNameInput(firstName);
                                setEditingName(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors group"
                        >
                            <span className="font-serif font-bold text-primary group-hover:text-accent transition-colors">
                                {firstName || 'Guest'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-primary/30" />
                        </button>
                    )}
                </div>

                <div className="h-px bg-border/50 my-2" />

                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <Info className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-sans text-sm font-medium text-primary">Email Account</span>
                            <span className="font-mono text-xs text-primary/40">Authentication ID</span>
                        </div>
                    </div>
                    <span className="font-mono text-xs text-primary/60">{user?.email}</span>
                </div>
            </Section>

            {/* Nutrition Targets */}
            <Section title="Nutrition Targets">
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <Target className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-sans text-sm font-medium text-primary">Daily Goals</span>
                            <span className="font-mono text-xs text-primary/40">Calorie & Macro Targets</span>
                        </div>
                    </div>
                    {editingNutrition ? (
                        <button
                            onClick={handleSaveNutrition}
                            disabled={savingNutrition}
                            className="p-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={() => setEditingNutrition(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors group"
                        >
                            <span className="font-serif font-bold text-primary group-hover:text-accent transition-colors">Edit</span>
                        </button>
                    )}
                </div>

                {editingNutrition ? (
                    <div className="grid grid-cols-2 gap-4 pt-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Calories</label>
                            <input
                                type="number"
                                value={nutritionForm.targetCalories}
                                onChange={e => setNutritionForm({...nutritionForm, targetCalories: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Protein (g)</label>
                            <input
                                type="number"
                                value={nutritionForm.targetProtein}
                                onChange={e => setNutritionForm({...nutritionForm, targetProtein: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Carbs (g)</label>
                            <input
                                type="number"
                                value={nutritionForm.targetCarbs}
                                onChange={e => setNutritionForm({...nutritionForm, targetCarbs: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Fat (g)</label>
                            <input
                                type="number"
                                value={nutritionForm.targetFat}
                                onChange={e => setNutritionForm({...nutritionForm, targetFat: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2 pt-4">
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">{nutritionForm.targetCalories}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Kcal</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">{nutritionForm.targetProtein}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Prot</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">{nutritionForm.targetCarbs}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Carb</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">{nutritionForm.targetFat}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Fat</div>
                        </div>
                    </div>
                )}
            </Section>

            {/* System Preferences */}
            <Section title="System Config">
                {/* Dark Mode Toggle (Visual Only as we enforce system) */}
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between py-2 group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <Sun className="w-5 h-5" />
                        </div>
                        <span className="font-sans text-sm font-medium text-primary">Interface Theme</span>
                    </div>
                    <div className={cn(
                        "w-12 h-7 rounded-full p-1 transition-colors duration-300",
                        isDark ? "bg-primary" : "bg-border"
                    )}>
                        <div className={cn(
                            "w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300",
                            isDark ? "translate-x-5" : ""
                        )} />
                    </div>
                </button>

                <div className="h-px bg-border/50 my-2" />

                <button
                    onClick={() => setDeveloperMode(!developerMode)}
                    className="w-full flex items-center justify-between py-2 group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <span className="font-sans text-sm font-medium text-primary">Developer Mode</span>
                    </div>
                    <div className={cn(
                        "w-12 h-7 rounded-full p-1 transition-colors duration-300",
                        developerMode ? "bg-accent" : "bg-border"
                    )}>
                        <div className={cn(
                            "w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300",
                            developerMode ? "translate-x-5" : ""
                        )} />
                    </div>
                </button>
            </Section>

            {/* Data Operations */}
            <Section title="Data Operations">
                <button
                    onClick={handleClearChat}
                    className="w-full flex items-center justify-between py-2 group text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="font-sans text-sm font-medium">Clear Chat History</span>
                            <span className="font-sans text-xs opacity-60">Permanently delete all messages</span>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                </button>
            </Section>

            {/* System Info */}
            <div className="text-center space-y-2 py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface shadow-sm border border-border mb-2">
                    <Database className="w-5 h-5 text-primary/40" />
                </div>
                <div className="font-serif font-bold text-primary text-lg">Kalli System</div>
                <div className="font-mono text-[10px] text-primary/40 tracking-wider">
                    CLIENT: {getVersionString()} | ENV: {environment}
                </div>
                {backendInfo && (
                    <div className="font-mono text-[10px] text-primary/40 tracking-wider">
                        SERVER: v{backendInfo.version}
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    className="mt-6 px-6 py-2 rounded-full border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 font-sans text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                    <span className="flex items-center gap-2">
                        <LogOut className="w-3 h-3" />
                        Sign Out
                    </span>
                </button>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className="space-y-3">
            <h3 className="px-4 font-sans text-[10px] uppercase tracking-[0.2em] font-bold text-primary/40">
                {title}
            </h3>
            <div className="bg-surface rounded-[2.5rem] p-6 shadow-card border border-border/40">
                {children}
            </div>
        </div>
    );
}
