import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { api } from '../api/services';
import { LogOut, Sun, User, Info, ChevronRight, Trash2, Cpu, Database, Target, Scale, Calculator, MessageSquare, RotateCcw } from 'lucide-react';
import { getVersionString, getEnvironment, getBackendInfo, getBuildVersionCode } from '../utils/appConfig';
import { cn } from '../utils/cn';

export default function Settings() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    // Theme context kept for compatibility, though we enforce specific theme now
    const { isDark, toggleTheme } = useTheme();
    const { firstName, saveFirstName, developerMode, setDeveloperMode, settings, biometrics, updateProfileConfig } = useUserPreferences();

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

    const [editingBiometrics, setEditingBiometrics] = useState(false);
    const [biometricsForm, setBiometricsForm] = useState({
        weight: '',
        weightUnit: 'lbs',
        heightFeet: '',
        heightInches: '',
        heightCm: '',
        heightUnit: 'ft',
        age: '',
        gender: '',
        goalType: '',
        activityLevel: '',
    });
    const [savingBiometrics, setSavingBiometrics] = useState(false);

    const [recommendedTargets, setRecommendedTargets] = useState(null);
    const [loadingRecommended, setLoadingRecommended] = useState(false);

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

    useEffect(() => {
        if (biometrics) {
            const totalInches = biometrics.height ?? 0;
            const storedUnit = biometrics.heightUnit ?? 'in';
            const isFtIn = storedUnit === 'in' || storedUnit === 'ft';
            setBiometricsForm(prev => ({
                ...prev,
                weight: biometrics.weight ?? '',
                weightUnit: biometrics.weightUnit ?? 'lbs',
                heightFeet: isFtIn && totalInches ? Math.floor(totalInches / 12).toString() : '',
                heightInches: isFtIn && totalInches ? (totalInches % 12).toString() : '',
                heightCm: !isFtIn && totalInches ? totalInches.toString() : '',
                heightUnit: isFtIn ? 'ft' : 'cm',
                age: biometrics.age ?? '',
                gender: biometrics.gender ?? '',
                goalType: biometrics.goalType ?? '',
                activityLevel: biometrics.activityLevel ?? '',
            }));
        }
    }, [biometrics]);

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

    const handleSaveBiometrics = async () => {
        setSavingBiometrics(true);
        try {
            let height = null;
            let heightUnit = biometricsForm.heightUnit === 'ft' ? 'in' : 'cm';
            if (biometricsForm.heightUnit === 'ft') {
                const ft = parseInt(biometricsForm.heightFeet) || 0;
                const inches = parseInt(biometricsForm.heightInches) || 0;
                if (ft || inches) height = ft * 12 + inches;
            } else {
                height = biometricsForm.heightCm ? parseFloat(biometricsForm.heightCm) : null;
            }
            const payload = {
                weight: biometricsForm.weight ? parseFloat(biometricsForm.weight) : null,
                weightUnit: biometricsForm.weightUnit,
                height,
                heightUnit,
                age: biometricsForm.age ? parseInt(biometricsForm.age) : null,
                gender: biometricsForm.gender || null,
                goalType: biometricsForm.goalType || null,
                activityLevel: biometricsForm.activityLevel || null,
            };
            await updateProfileConfig({ biometrics: payload });
            setEditingBiometrics(false);
        } catch (error) {
            console.error(error);
            alert('Failed to save body stats');
        }
        setSavingBiometrics(false);
    };

    const handleCalculateRecommended = async () => {
        setLoadingRecommended(true);
        try {
            const result = await api.getRecommendedTargets();
            setRecommendedTargets(result);
        } catch (error) {
            const msg = error.response?.data?.error || 'Failed to calculate. Make sure your body stats are saved.';
            alert(msg);
        }
        setLoadingRecommended(false);
    };

    const handleAcceptRecommended = () => {
        if (!recommendedTargets) return;
        setNutritionForm({
            targetCalories: recommendedTargets.targetCalories,
            targetProtein: recommendedTargets.targetProtein,
            targetCarbs: recommendedTargets.targetCarbs,
            targetFat: recommendedTargets.targetFat,
        });
        setEditingNutrition(true);
        setRecommendedTargets(null);
    };

    const handleClearBiometrics = async () => {
        if (!confirm('Clear all body stats? This will remove your biometrics and reset to the onboarding state.')) return;
        try {
            await updateProfileConfig({ biometrics: { weight: null, weightUnit: 'lbs', height: null, heightUnit: 'in', age: null, gender: null, goalType: null, activityLevel: null } });
        } catch {
            alert('Failed to clear biometrics');
        }
    };

    const handleResetTargets = async () => {
        if (!confirm('Reset nutrition targets to defaults (2000 cal, 50g protein, 250g carbs, 65g fat)?')) return;
        try {
            await updateProfileConfig({ settings: { targetCalories: 2000, targetProtein: 50, targetCarbs: 250, targetFat: 65 } });
        } catch {
            alert('Failed to reset targets');
        }
    };

    const GENDER_LABELS = {
        male: 'Male',
        female: 'Female',
        other: 'Other',
    };

    const GOAL_TYPE_LABELS = {
        lose_weight: 'Lose Weight',
        maintain: 'Maintain',
        gain_muscle: 'Gain Muscle',
    };

    const ACTIVITY_LABELS = {
        sedentary: 'Sedentary',
        lightly_active: 'Lightly Active',
        moderately_active: 'Moderately Active',
        very_active: 'Very Active',
    };

    const backendInfo = getBackendInfo();
    const environment = getEnvironment();

    return (
        <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

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
                        <input
                            type="text"
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            className="w-32 px-3 py-1.5 text-sm bg-primary/5 border border-transparent rounded-lg focus:border-primary/20 outline-none font-sans text-primary"
                            autoFocus
                        />
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

                {editingName && (
                    <button
                        onClick={handleSaveName}
                        disabled={savingName}
                        className="w-full mt-3 py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {savingName ? 'Saving...' : 'Save'}
                    </button>
                )}

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

            {/* Body & Goals */}
            <Section title="Body & Goals">
                <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <Scale className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-sans text-sm font-medium text-primary">Body Stats</span>
                            <span className="font-mono text-xs text-primary/40">For personalized coaching</span>
                        </div>
                    </div>
                    {editingBiometrics ? (
                        <span className="px-3 py-1.5 font-serif font-bold text-primary/40 text-sm">Editing...</span>
                    ) : (
                        <button
                            onClick={() => setEditingBiometrics(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors group"
                        >
                            <span className="font-serif font-bold text-primary group-hover:text-accent transition-colors">Edit</span>
                        </button>
                    )}
                </div>

                {editingBiometrics ? (
                    <div className="space-y-4 pt-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Weight</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={biometricsForm.weight}
                                        onChange={e => setBiometricsForm({...biometricsForm, weight: e.target.value})}
                                        placeholder="168"
                                        className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                    />
                                    <select
                                        value={biometricsForm.weightUnit}
                                        onChange={e => setBiometricsForm({...biometricsForm, weightUnit: e.target.value})}
                                        className="px-2 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                    >
                                        <option value="lbs">lbs</option>
                                        <option value="kg">kg</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Height</label>
                                <div className="flex gap-2">
                                    {biometricsForm.heightUnit === 'ft' ? (
                                        <>
                                            <div className="flex items-center gap-1 flex-1">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={biometricsForm.heightFeet}
                                                    onChange={e => setBiometricsForm({...biometricsForm, heightFeet: e.target.value})}
                                                    placeholder="5"
                                                    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                                />
                                                <span className="text-xs text-primary/40 font-mono">ft</span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-1">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={biometricsForm.heightInches}
                                                    onChange={e => setBiometricsForm({...biometricsForm, heightInches: e.target.value})}
                                                    placeholder="11"
                                                    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                                />
                                                <span className="text-xs text-primary/40 font-mono">in</span>
                                            </div>
                                        </>
                                    ) : (
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={biometricsForm.heightCm}
                                            onChange={e => setBiometricsForm({...biometricsForm, heightCm: e.target.value})}
                                            placeholder="180"
                                            className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                        />
                                    )}
                                    <select
                                        value={biometricsForm.heightUnit}
                                        onChange={e => setBiometricsForm({...biometricsForm, heightUnit: e.target.value})}
                                        className="px-2 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                    >
                                        <option value="ft">ft</option>
                                        <option value="cm">cm</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Age</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={biometricsForm.age}
                                    onChange={e => setBiometricsForm({...biometricsForm, age: e.target.value})}
                                    placeholder="30"
                                    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Gender</label>
                                <select
                                    value={biometricsForm.gender}
                                    onChange={e => setBiometricsForm({...biometricsForm, gender: e.target.value})}
                                    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                >
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Goal</label>
                                <select
                                    value={biometricsForm.goalType}
                                    onChange={e => setBiometricsForm({...biometricsForm, goalType: e.target.value})}
                                    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                >
                                    <option value="">Select...</option>
                                    <option value="lose_weight">Lose Weight</option>
                                    <option value="maintain">Maintain</option>
                                    <option value="gain_muscle">Gain Muscle</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Activity</label>
                                <select
                                    value={biometricsForm.activityLevel}
                                    onChange={e => setBiometricsForm({...biometricsForm, activityLevel: e.target.value})}
                                    className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                                >
                                    <option value="">Select...</option>
                                    <option value="sedentary">Sedentary</option>
                                    <option value="lightly_active">Lightly Active</option>
                                    <option value="moderately_active">Moderately Active</option>
                                    <option value="very_active">Very Active</option>
                                </select>
                            </div>
                        </div>
                        <button
                            onClick={handleSaveBiometrics}
                            disabled={savingBiometrics}
                            className="w-full mt-4 py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {savingBiometrics ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 pt-4">
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">{biometricsForm.weight || '—'}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">{biometricsForm.weightUnit}</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">
                                {biometricsForm.heightUnit === 'ft' && (biometricsForm.heightFeet || biometricsForm.heightInches)
                                    ? `${biometricsForm.heightFeet || 0}'${biometricsForm.heightInches || 0}"`
                                    : biometricsForm.heightCm
                                        ? biometricsForm.heightCm
                                        : '—'}
                            </div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">{biometricsForm.heightUnit === 'ft' ? 'Height' : 'cm'}</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-lg font-bold text-primary">{biometricsForm.age || '—'}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Age</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-sm font-bold text-primary leading-tight pt-1">{GENDER_LABELS[biometricsForm.gender] || '—'}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Gender</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-sm font-bold text-primary leading-tight pt-1">{GOAL_TYPE_LABELS[biometricsForm.goalType] || '—'}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Goal</div>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-primary/5">
                            <div className="font-mono text-sm font-bold text-primary leading-tight pt-1">{ACTIVITY_LABELS[biometricsForm.activityLevel] || '—'}</div>
                            <div className="text-[9px] uppercase font-bold text-primary/40 tracking-wider">Active</div>
                        </div>
                    </div>
                )}

                <div className="h-px bg-border/50 my-4" />

                <button
                    onClick={() => navigate('/chat', { state: { triggerOnboarding: true } })}
                    className="w-full flex items-center justify-between py-2 group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="font-sans text-sm font-medium text-primary">Update via Chat</span>
                            <span className="font-mono text-xs text-primary/40">Let Kalli walk you through it</span>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-primary/30 group-hover:text-accent transition-colors" />
                </button>
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
                        <span className="px-3 py-1.5 font-serif font-bold text-primary/40 text-sm">Editing...</span>
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
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={nutritionForm.targetCalories}
                                onChange={e => setNutritionForm({...nutritionForm, targetCalories: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Protein (g)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={nutritionForm.targetProtein}
                                onChange={e => setNutritionForm({...nutritionForm, targetProtein: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Carbs (g)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={nutritionForm.targetCarbs}
                                onChange={e => setNutritionForm({...nutritionForm, targetCarbs: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-primary/40 tracking-wider">Fat (g)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={nutritionForm.targetFat}
                                onChange={e => setNutritionForm({...nutritionForm, targetFat: e.target.value})}
                                className="w-full px-3 py-2 text-sm bg-primary/5 rounded-lg outline-none font-mono text-primary focus:ring-1 focus:ring-primary/20"
                            />
                        </div>
                        <button
                            onClick={handleSaveNutrition}
                            disabled={savingNutrition}
                            className="col-span-2 w-full mt-2 py-2.5 text-sm font-sans font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {savingNutrition ? 'Saving...' : 'Save'}
                        </button>
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

                <div className="h-px bg-border/50 my-4" />

                {recommendedTargets ? (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-accent" />
                            <span className="font-sans text-sm font-medium text-primary">Recommended Targets</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="text-center p-2 rounded-lg bg-accent/10">
                                <div className="font-mono text-lg font-bold text-accent">{recommendedTargets.targetCalories}</div>
                                <div className="text-[9px] uppercase font-bold text-accent/60 tracking-wider">Kcal</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-accent/10">
                                <div className="font-mono text-lg font-bold text-accent">{recommendedTargets.targetProtein}</div>
                                <div className="text-[9px] uppercase font-bold text-accent/60 tracking-wider">Prot</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-accent/10">
                                <div className="font-mono text-lg font-bold text-accent">{recommendedTargets.targetCarbs}</div>
                                <div className="text-[9px] uppercase font-bold text-accent/60 tracking-wider">Carb</div>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-accent/10">
                                <div className="font-mono text-lg font-bold text-accent">{recommendedTargets.targetFat}</div>
                                <div className="text-[9px] uppercase font-bold text-accent/60 tracking-wider">Fat</div>
                            </div>
                        </div>
                        <div className="text-xs text-primary/50 font-mono">
                            BMR: {recommendedTargets.calculationDetails.bmr} cal | TDEE: {recommendedTargets.calculationDetails.tdee} cal | {recommendedTargets.calculationDetails.calorieAdjustment} | Protein: {recommendedTargets.calculationDetails.proteinRange}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAcceptRecommended}
                                className="flex-1 py-2 text-sm font-sans font-medium bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors"
                            >
                                Apply These Targets
                            </button>
                            <button
                                onClick={() => setRecommendedTargets(null)}
                                className="px-4 py-2 text-sm font-sans font-medium text-primary/60 rounded-xl hover:bg-primary/5 transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={handleCalculateRecommended}
                        disabled={loadingRecommended}
                        className="w-full flex items-center justify-between py-2 group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="font-sans text-sm font-medium text-primary">Calculate Recommended</span>
                                <span className="font-mono text-xs text-primary/40">Based on your body stats</span>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-primary/30 group-hover:text-accent transition-colors" />
                    </button>
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

                {developerMode && (
                    <>
                        <div className="h-px bg-border/50 my-2" />

                        <button
                            onClick={handleClearBiometrics}
                            className="w-full flex items-center justify-between py-2 group text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                                    <RotateCcw className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-sans text-sm font-medium">Clear Biometrics</span>
                                    <span className="font-sans text-xs opacity-60">Reset body stats to trigger onboarding</span>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <div className="h-px bg-border/50 my-2" />

                        <button
                            onClick={handleResetTargets}
                            className="w-full flex items-center justify-between py-2 group text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                                    <RotateCcw className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-sans text-sm font-medium">Reset Nutrition Targets</span>
                                    <span className="font-sans text-xs opacity-60">Revert to default 2000 cal / 50p / 250c / 65f</span>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 transition-opacity" />
                        </button>
                    </>
                )}
            </Section>

            {/* System Info */}
            <div className="text-center space-y-2 py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface shadow-sm border border-border mb-2">
                    <Database className="w-5 h-5 text-primary/40" />
                </div>
                <div className="font-serif font-bold text-primary text-lg">Kalli System</div>
                <div className="font-mono text-[10px] text-primary/40 tracking-wider">
                    CLIENT: {getVersionString()} | ENV: {environment}{getBuildVersionCode() ? ` | BUILD: ${getBuildVersionCode()}` : ''}
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
        <div className="space-y-2">
            <h3 className="px-4 font-sans text-[10px] uppercase tracking-[0.2em] font-bold text-primary/40">
                {title}
            </h3>
            <div className="bg-surface rounded-[2rem] p-5 shadow-card border border-border/40">
                {children}
            </div>
        </div>
    );
}
