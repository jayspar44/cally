import { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import { isNative, takePhoto } from '../../utils/camera';
import { Send, Image, X, Loader2 } from 'lucide-react';

const MAX_IMAGES = 5;

export default function ChatInput({ onSend, sending, disabled, onImageChange }) {
    const [message, setMessage] = useState('');
    const [imagePreviews, setImagePreviews] = useState([]);
    const [imageBase64s, setImageBase64s] = useState([]);
    const fileInputRef = useRef(null);
    const textAreaRef = useRef(null);

    useEffect(() => {
        const handleGhostKeyboard = () => {
            textAreaRef.current?.focus();
        };
        window.addEventListener('ghost-keyboard', handleGhostKeyboard);
        return () => window.removeEventListener('ghost-keyboard', handleGhostKeyboard);
    }, []);

    const addImages = (previews, base64s) => {
        setImagePreviews(prev => {
            const combined = [...prev, ...previews].slice(0, MAX_IMAGES);
            onImageChange?.(combined.length > 0);
            return combined;
        });
        setImageBase64s(prev => [...prev, ...base64s].slice(0, MAX_IMAGES));
    };

    const handleCameraClick = async () => {
        if (imagePreviews.length >= MAX_IMAGES) return;

        if (isNative()) {
            try {
                const base64 = await takePhoto();
                if (base64) {
                    addImages([`data:image/jpeg;base64,${base64}`], [base64]);
                }
            } catch {
                // Camera error handled by camera util
            }
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        const msgToSend = message.trim();
        const imgsToSend = [...imageBase64s];

        if (sending || disabled || (!msgToSend && imgsToSend.length === 0)) return;

        try {
            await onSend(msgToSend, imgsToSend.length > 0 ? imgsToSend : null, () => {
                setMessage('');
                setImagePreviews([]);
                setImageBase64s([]);
                if (textAreaRef.current) textAreaRef.current.style.height = 'auto';
                if (fileInputRef.current) fileInputRef.current.value = '';
                onImageChange?.(false);
            });
        } catch {
            // Error handled by context
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleTextChange = (e) => {
        setMessage(e.target.value);
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const remaining = MAX_IMAGES - imagePreviews.length;
        const filesToProcess = files.slice(0, remaining);

        const invalidFile = filesToProcess.find(f => !f.type.startsWith('image/'));
        if (invalidFile) {
            alert('Please select image files only');
            return;
        }

        const oversizedFile = filesToProcess.find(f => f.size > 50 * 1024 * 1024);
        if (oversizedFile) {
            alert('Each image must be less than 50MB');
            return;
        }

        const readPromises = filesToProcess.map(file => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                resolve({
                    preview: ev.target.result,
                    base64: ev.target.result.split(',')[1]
                });
            };
            reader.readAsDataURL(file);
        }));

        Promise.all(readPromises).then(results => {
            addImages(
                results.map(r => r.preview),
                results.map(r => r.base64)
            );
        });
    };

    const removeImage = (index) => {
        setImagePreviews(prev => {
            const updated = prev.filter((_, i) => i !== index);
            onImageChange?.(updated.length > 0);
            return updated;
        });
        setImageBase64s(prev => prev.filter((_, i) => i !== index));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-accent/15 backdrop-blur-xl border border-accent/20 rounded-[1.5rem] p-2 shadow-[0_8px_32px_rgba(196,90,60,0.1)] relative z-10 transition-all duration-300 focus-within:bg-accent/20 focus-within:shadow-[0_8px_32px_rgba(196,90,60,0.15)]"
        >
            {/* Image Previews */}
            {imagePreviews.length > 0 && (
                <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative flex-shrink-0">
                            <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-24 rounded-xl border border-border shadow-sm object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-end gap-2">
                {/* Photo Button */}
                <button
                    type="button"
                    onClick={handleCameraClick}
                    disabled={sending || disabled || imagePreviews.length >= MAX_IMAGES}
                    className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 relative',
                        'bg-primary/5 text-primary/60 border border-transparent',
                        'hover:bg-primary/10 hover:text-primary active:scale-95',
                        (sending || disabled || imagePreviews.length >= MAX_IMAGES) && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    <Image className="w-5 h-5" strokeWidth={2} />
                    {imagePreviews.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {imagePreviews.length}
                        </span>
                    )}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    onClick={(e) => (e.target.value = null)}
                    className="hidden"
                />

                {/* Text Input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textAreaRef}
                        value={message}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Log meal or ask questions..."
                        disabled={sending || disabled}
                        rows={1}
                        className={cn(
                            'w-full px-3 py-2 rounded-lg resize-none font-sans text-sm',
                            'bg-surface text-primary placeholder-primary/40 shadow-sm',
                            'border-transparent focus:ring-2 focus:ring-primary/10 transition-all duration-200',
                            (sending || disabled) && 'opacity-50 cursor-not-allowed'
                        )}
                        style={{ maxHeight: '120px' }}
                    />
                </div>

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={sending || disabled || (!message.trim() && imageBase64s.length === 0)}
                    className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300',
                        'bg-accent text-white shadow-lg shadow-accent/20',
                        'hover:bg-accent/90 hover:shadow-accent/30 active:scale-95',
                        (sending || disabled || (!message.trim() && imageBase64s.length === 0)) && 'opacity-50 cursor-not-allowed bg-gray-300 shadow-none'
                    )}
                >
                    {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5 ml-0.5" strokeWidth={2.5} />
                    )}
                </button>
            </div>
        </form>
    );
}
