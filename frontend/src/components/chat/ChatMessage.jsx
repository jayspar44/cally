import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/dateUtils';
import FoodLogCard from './FoodLogCard';

import { Trash2, Loader2, AlertCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';

// Strip <details>...</details> HTML blocks that Gemini sometimes includes in responses
const stripDetailsBlocks = (content) => {
    if (!content) return '';
    return content.replace(/<details>[\s\S]*?<\/details>/gi, '').trim();
};

const RANGE_LABELS = { '1W': 'weekly', '1M': 'monthly', '3M': 'quarterly' };

export default function ChatMessage({ message, onEditLog, onDelete, onRetry }) {
    const isUser = message.role === 'user';
    const isSending = message.status === 'sending';
    const isFailed = message.status === 'failed';
    const { developerMode } = useUserPreferences();

    // Render context pill instead of user bubble for insight follow-ups
    if (message.insightContext) {
        const { text, range } = message.insightContext;
        const truncated = text.length > 120 ? text.slice(0, 120) + '…' : text;
        return (
            <div className="flex justify-center my-4">
                <div className="max-w-[85%] bg-accent/5 border border-accent/15 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3 h-3 text-accent" />
                        <span className="font-sans text-xs font-semibold text-accent">From your {RANGE_LABELS[range] || 'weekly'} insight</span>
                    </div>
                    <p className="font-sans text-xs text-primary/60 leading-relaxed">{truncated}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            'flex w-full mb-5',
            isUser ? 'justify-end' : 'justify-start'
        )}>
            <div className={cn(
                'relative group',
                isUser ? 'max-w-[85%] items-end' : 'max-w-[98%] items-start'
            )}>
                {/* Bubble */}
                <div className={cn(
                    'px-3.5 py-2 shadow-sm backdrop-blur-sm relative',
                    isUser
                        ? 'bg-primary text-primary-foreground dark:bg-[#232525] dark:text-[#E2E5E1] rounded-[1.25rem] rounded-tr-sm'
                        : 'bg-surface border border-border/60 rounded-[1.25rem] rounded-tl-sm',
                    isSending && 'opacity-80'
                )}>
                    {/* Content */}
                    <div className={cn(
                        "text-base leading-normal break-words markdown-body",
                        isUser && "text-white [&_*]:text-white/90"
                    )}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {isUser ? message.content : stripDetailsBlocks(message.content)}
                        </ReactMarkdown>
                    </div>

                    {/* Image Attachment Indicator */}
                    {isUser && message.imageData && (
                        <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-2 text-xs text-white/80 font-mono">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" strokeWidth="2" />
                            </svg>
                            <span>{(message.imageCount || 1) > 1 ? `${message.imageCount} Images Attached` : 'Image Attached'}</span>
                        </div>
                    )}

                    {/* Inline Error for Failed Messages */}
                    {isFailed && message.errorMessage && (
                        <div className="mt-2 pt-2 border-t border-red-300/30 dark:border-red-500/20 flex items-center gap-1.5">
                            <AlertCircle className="w-3 h-3 text-red-400 dark:text-red-400 shrink-0" />
                            <span className="text-[10px] text-red-400 dark:text-red-400">
                                {message.errorMessage}
                            </span>
                        </div>
                    )}

                    {/* Food Log Card (Assistant Only) */}
                    {!isUser && message.foodLog && (
                        <div className="mt-3 -mx-0.5">
                            <FoodLogCard foodLog={message.foodLog} onEdit={onEditLog} />
                        </div>
                    )}

                    {/* Developer Delete Button */}
                    {developerMode && onDelete && !isSending && !isFailed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className={cn(
                                "absolute -top-2 w-6 h-6 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200",
                                isUser ? "-left-2" : "-right-2"
                            )}
                            title="Delete Message (Dev Mode)"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Timestamp & Status (Outside Bubble) */}
                <div className={cn(
                    'text-[10px] font-mono mt-1 absolute -bottom-4 min-w-max flex items-center gap-1',
                    isUser ? 'right-2' : 'left-2',
                    isFailed ? 'text-red-500 dark:text-red-400' : 'text-primary/50 dark:text-primary/30'
                )}>
                    {isSending ? (
                        <>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>Sending</span>
                        </>
                    ) : isFailed ? (
                        <button
                            onClick={() => onRetry?.(message.id)}
                            className="flex items-center gap-1 text-accent hover:underline"
                        >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Tap to retry</span>
                        </button>
                    ) : (
                        formatTime(message.timestamp)
                    )}
                </div>
            </div>
        </div>
    );
}
