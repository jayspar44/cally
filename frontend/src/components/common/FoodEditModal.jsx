import { useState, useEffect } from 'react';
import { toDateStr } from '../../utils/dateUtils';

export default function FoodEditModal({ isOpen, onClose, onSave, onDelete, initialData }) {
    const [formData, setFormData] = useState({
        name: '',
        quantity: '',
        unit: '',
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        meal: 'snack',
        date: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                quantity: initialData.quantity || '',
                unit: initialData.unit || '',
                calories: initialData.calories || 0,
                protein: initialData.protein || 0,
                carbs: initialData.carbs || 0,
                fat: initialData.fat || 0,
                meal: initialData.meal || 'snack',
                date: initialData.date || toDateStr()
            });
        }
    }, [initialData]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            quantity: Number(formData.quantity),
            calories: Number(formData.calories),
            protein: Number(formData.protein),
            carbs: Number(formData.carbs),
            fat: Number(formData.fat)
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-surface rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom sm:zoom-in duration-200 sm:m-4 max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-primary">Edit Food Log</h2>
                    <button onClick={onClose} className="text-primary/50 hover:text-primary/80">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-primary/80 mb-1">Food Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent"
                            required
                        />
                    </div>

                    {/* Quantity & Unit */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-primary/80 mb-1">Quantity</label>
                            <input
                                type="number"
                                step="0.1"
                                name="quantity"
                                value={formData.quantity}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary/80 mb-1">Unit</label>
                            <input
                                type="text"
                                name="unit"
                                value={formData.unit}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent"
                                required
                            />
                        </div>
                    </div>

                    {/* Macros */}
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <label className="block text-xs font-medium text-primary/50 mb-1">Cals</label>
                            <input
                                type="number"
                                name="calories"
                                value={formData.calories}
                                onChange={handleChange}
                                className="w-full px-2 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-primary mb-1">Protein</label>
                            <input
                                type="number"
                                name="protein"
                                value={formData.protein}
                                onChange={handleChange}
                                className="w-full px-2 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-carbs mb-1">Carbs</label>
                            <input
                                type="number"
                                name="carbs"
                                value={formData.carbs}
                                onChange={handleChange}
                                className="w-full px-2 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-fat mb-1">Fat</label>
                            <input
                                type="number"
                                name="fat"
                                value={formData.fat}
                                onChange={handleChange}
                                className="w-full px-2 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent text-sm"
                            />
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-primary/80 mb-1">Meal</label>
                            <select
                                name="meal"
                                value={formData.meal}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent capitalize"
                            >
                                <option value="breakfast">Breakfast</option>
                                <option value="lunch">Lunch</option>
                                <option value="dinner">Dinner</option>
                                <option value="snack">Snack</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-primary/80 mb-1">Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-primary focus:ring-2 focus:ring-accent"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onDelete}
                            className="flex-1 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl font-medium transition-colors border border-red-200 dark:border-red-500/20"
                        >
                            Delete
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-accent text-white hover:bg-accent/90 rounded-xl font-medium transition-colors shadow-lg shadow-accent/20"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
