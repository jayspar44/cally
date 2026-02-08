import { useState, useRef } from 'react';
import { cn } from '../../utils/cn';
import { isNative, takePhoto } from '../../utils/camera';
import { Send, Image, X, Loader2 } from 'lucide-react';

export default function ChatInput({ onSend, sending, disabled, onImageChange }) {
    const [message, setMessage] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const fileInputRef = useRef(null);
    const textAreaRef = useRef(null);

    const handleCameraClick = async () => {
        if (isNative()) {
            try {
                const base64 = await takePhoto();
                if (base64) {
                    setImageBase64(base64);
                    setImagePreview(`data:image/jpeg;base64,${base64}`);
                    onImageChange?.(true);
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
        const imgToSend = imageBase64;

        if (sending || disabled || (!msgToSend && !imgToSend)) return;

        try {
            // Pass a callback that clears the input ONLY when upload is 100% complete
            await onSend(msgToSend, imgToSend, () => {
                setMessage('');
                setImagePreview(null);
                setImageBase64(null);
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
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            alert('Image must be less than 50MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target.result);
            const base64 = e.target.result.split(',')[1];
            setImageBase64(base64);
            onImageChange?.(true);
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setImagePreview(null);
        setImageBase64(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onImageChange?.(false);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-accent/15 backdrop-blur-xl border border-accent/20 rounded-[2rem] p-3 shadow-[0_8px_32px_rgba(196,90,60,0.1)] relative z-10 transition-all duration-300 focus-within:bg-accent/20 focus-within:shadow-[0_8px_32px_rgba(196,90,60,0.15)]"
        >
            {/* Image Preview */}
            {imagePreview && (
                <div className="mb-3 relative inline-block animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-24 rounded-xl border border-border shadow-sm object-cover"
                    />
                    <button
                        type="button"
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}

            <div className="flex items-end gap-3">
                {/* Photo Button */}
                <button
                    type="button"
                    onClick={handleCameraClick}
                    disabled={sending || disabled}
                    className={cn(
                        'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200',
                        'bg-primary/5 text-primary/60 border border-transparent',
                        'hover:bg-primary/10 hover:text-primary active:scale-95',
                        (sending || disabled) && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    <Image className="w-5 h-5" strokeWidth={2} />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
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
                            'w-full px-4 py-3 rounded-xl resize-none font-sans text-sm',
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
                    disabled={sending || disabled || (!message.trim() && !imageBase64)}
                    className={cn(
                        'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300',
                        'bg-accent text-white shadow-lg shadow-accent/20',
                        'hover:bg-accent/90 hover:shadow-accent/30 active:scale-95',
                        (sending || disabled || (!message.trim() && !imageBase64)) && 'opacity-50 cursor-not-allowed bg-gray-300 shadow-none'
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
