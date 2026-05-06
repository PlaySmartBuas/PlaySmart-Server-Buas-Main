import React from 'react';

interface FeedbackCardProps {
    feedback: {
        id: number;
        timestamp: number;
        category?: string;
        error_code?: string;
        coach_username: string;
        created_at: string;
        feedback_text: string;
    };
    formatTime: (seconds: number) => string;
    onClick: () => void;
    onDelete?: () => void;
    isSelected?: boolean;
    canDelete?: boolean;
}

const FeedbackCard: React.FC<FeedbackCardProps> = ({
    feedback,
    formatTime,
    onClick,
    onDelete,
    isSelected = false,
    canDelete = false,
}) => {
    // Get category color based on type
    const getCategoryColor = (category: string): string => {
        const colorMap: Record<string, string> = {
            mechanical: 'bg-red-600/80 text-white',           // Red for mechanical errors
            positioning: 'bg-orange-600/80 text-white',        // Orange for positioning issues
            decision_making: 'bg-rose-600/80 text-white',      // Rose for decision-making
            mental_psychological: 'bg-purple-600/80 text-white', // Purple for mental/psychological
            resource_management: 'bg-yellow-600/80 text-white', // Yellow for resource management
            communication: 'bg-green-600/80 text-white',       // Green for communication
            scientific: 'bg-blue-600/80 text-white'            // Blue for scientific
        };
        return colorMap[category] || 'bg-gray-600/80 text-white';
    };

    return (
        <div
            onClick={onClick}
            className={`bg-gray-700 rounded-lg p-4 border cursor-pointer transition-all hover:border-blue-500 ${isSelected ? 'border-blue-500 bg-gray-600' : 'border-gray-600'
                }`}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold">
                        {formatTime(feedback.timestamp)}
                    </span>
                    {feedback.category && (
                        <span className={`px-3 py-1 rounded text-sm font-semibold ${getCategoryColor(feedback.category)}`}>
                            {feedback.category.replace(/_/g, ' ')}
                        </span>
                    )}
                    {feedback.error_code && (
                        <span className="px-3 py-1 bg-red-600/80 text-white rounded text-sm font-semibold">
                            {feedback.error_code}
                        </span>
                    )}
                    <span className="text-gray-300 text-sm font-semibold">
                        by {feedback.coach_username}
                    </span>
                    <span className="text-gray-500 text-xs">
                        {new Date(feedback.created_at).toLocaleDateString()}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {canDelete && onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="text-red-400 hover:text-red-300 text-sm transition-colors font-semibold"
                        >
                            Delete
                        </button>
                    )}
                </div>
            </div>
            <p className="text-white text-base leading-relaxed font-medium break-words">{feedback.feedback_text}</p>
        </div>
    );
};

export default FeedbackCard;
