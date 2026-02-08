import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../utils/cn';
import FoodLogCard from './FoodLogCard';

export default function ChatMessage({ message, onEditLog }) {
    const isUser = message.role === 'user';
    const isPending = message.pending;

    return (
        <div className={cn(
            'flex w-full mb-6',
            isUser ? 'justify-end' : 'justify-start'
        )}>
            <div className={cn(
                'max-w-[85%] sm:max-w-[75%] relative group',
                isUser ? 'items-end' : 'items-start'
            )}>
                {/* Bubble */}
                <div className={cn(
                    'px-5 py-4 shadow-sm backdrop-blur-sm',
                    isUser
                        ? 'bg-primary text-primary-foreground rounded-[1.5rem] rounded-tr-sm'
                        : 'bg-white border border-border/60 rounded-[1.5rem] rounded-tl-sm',
                    isPending && 'opacity-80'
                )}>
                    {/* Content */}
                    <div className={cn(
                        "text-sm leading-relaxed break-words markdown-body",
                        isUser && "text-white [&_*]:text-white/90" // Override markdown styles for user bubble
                    )}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
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
                            <span>Image Attached</span>
                        </div>
                    )}

                    {/* Food Log Card (Assistant Only) */}
                    {!isUser && message.foodLog && (
                        <div className="mt-4 -mx-1">
                            <FoodLogCard foodLog={message.foodLog} onEdit={onEditLog} />
                        </div>
                    )}
                </div>

                {/* Timestamp (Outside Bubble) */}
                <div className={cn(
                    'text-[10px] font-mono text-primary/30 mt-1 absolute -bottom-4 min-w-max',
                    isUser ? 'right-2' : 'left-2'
                )}>
                    {formatTime(message.timestamp)}
                    {isPending && ' • Sending...'}
                </div>
            </div>
        </div>
    );
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
