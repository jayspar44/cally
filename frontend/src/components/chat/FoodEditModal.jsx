import { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

export default function FoodEditModal({ isOpen, onClose, foodLog, onUpdate, onDelete }) {
    const [items, setItems] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Initialize items from prop
    useEffect(() => {
        if (foodLog?.items) {
            setItems(foodLog.items);
        }
    }, [foodLog]);

    if (!isOpen || !foodLog) return null;

    const handleEditClick = (item) => {
        setEditingId(item.id);
        setEditForm({ ...item });
    };

    const handleSave = async () => {
        if (!editingId) return;

        // Optimistic update
        setItems(prev => prev.map(i => i.id === editingId ? { ...editForm } : i));

        // Notify parent
        await onUpdate(editingId, editForm);
        setEditingId(null);
    };

    const handleDelete = async (itemId) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        // Optimistic update
        setItems(prev => prev.filter(i => i.id !== itemId));

        // Notify parent
        await onDelete(itemId);

        // If no items left, close
        if (items.length <= 1) {
            onClose();
        }
    };

    const handleChange = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            [field]: field === 'name' || field === 'unit' ? value : Number(value)
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Edit Food Log
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        {items.map(item => (
                            <div key={item.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                                {editingId === item.id ? (
                                    <div className="space-y-3">
                                        {/* Edit Mode */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.name || ''}
                                                    onChange={e => handleChange('name', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                                                <input
                                                    type="number"
                                                    value={editForm.quantity || 0}
                                                    onChange={e => handleChange('quantity', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Unit</label>
                                                <input
                                                    type="text"
                                                    value={editForm.unit || ''}
                                                    onChange={e => handleChange('unit', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>

                                            {/* Macros */}
                                            <div>
                                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Calories</label>
                                                <input
                                                    type="number"
                                                    value={editForm.calories || 0}
                                                    onChange={e => handleChange('calories', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-blue-500 mb-1">Protein (g)</label>
                                                <input
                                                    type="number"
                                                    value={editForm.protein || 0}
                                                    onChange={e => handleChange('protein', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-amber-500 mb-1">Carbs (g)</label>
                                                <input
                                                    type="number"
                                                    value={editForm.carbs || 0}
                                                    onChange={e => handleChange('carbs', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-pink-500 mb-1">Fat (g)</label>
                                                <input
                                                    type="number"
                                                    value={editForm.fat || 0}
                                                    onChange={e => handleChange('fat', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 mt-4">
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 bg-transparent"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        {/* View Mode */}
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {item.quantity} {item.unit} {item.name}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex gap-3">
                                                <span>{Math.round(item.calories)} cal</span>
                                                <span className="text-blue-500">P: {Math.round(item.protein)}g</span>
                                                <span className="text-amber-500">C: {Math.round(item.carbs)}g</span>
                                                <span className="text-pink-500">F: {Math.round(item.fat)}g</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEditClick(item)}
                                                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
