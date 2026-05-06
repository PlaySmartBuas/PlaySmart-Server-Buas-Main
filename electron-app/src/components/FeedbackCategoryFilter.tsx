import React, { useState, useRef, useEffect } from 'react';

interface FeedbackCategoryFilterProps {
    selectedCategories: string[];
    onCategoriesChange: (categories: string[]) => void;
}

const CATEGORIES = [
    { value: 'mechanical', label: 'Mechanical', color: 'bg-red-500' },
    { value: 'positioning', label: 'Positioning', color: 'bg-orange-500' },
    { value: 'decision_making', label: 'Decision Making', color: 'bg-rose-500' },
    { value: 'mental_psychological', label: 'Mental/Psychological', color: 'bg-purple-500' },
    { value: 'resource_management', label: 'Resource Management', color: 'bg-yellow-500' },
    { value: 'communication', label: 'Communication', color: 'bg-green-500' },
    { value: 'scientific', label: 'Scientific', color: 'bg-blue-500' },
];

const FeedbackCategoryFilter: React.FC<FeedbackCategoryFilterProps> = ({
    selectedCategories,
    onCategoriesChange,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggleCategory = (categoryValue: string) => {
        if (selectedCategories.includes(categoryValue)) {
            onCategoriesChange(selectedCategories.filter((cat) => cat !== categoryValue));
        } else {
            onCategoriesChange([...selectedCategories, categoryValue]);
        }
    };

    const handleSelectAll = () => {
        onCategoriesChange(CATEGORIES.map((cat) => cat.value));
    };

    const handleClearAll = () => {
        onCategoriesChange([]);
    };

    const getButtonText = () => {
        if (selectedCategories.length === 0) {
            return 'All Categories';
        } else if (selectedCategories.length === CATEGORIES.length) {
            return 'All Categories';
        } else if (selectedCategories.length === 1) {
            const category = CATEGORIES.find((cat) => cat.value === selectedCategories[0]);
            return category?.label || 'Filter Categories';
        } else {
            return `${selectedCategories.length} Categories`;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors border border-gray-600"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                </svg>
                <span>{getButtonText()}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 right-0 z-50 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
                    {/* Header with Select All / Clear All */}
                    <div className="flex items-center justify-between p-3 border-b border-gray-600">
                        <span className="text-white font-semibold text-sm">Filter by Category</span>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSelectAll}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Select All
                            </button>
                            <span className="text-gray-500">|</span>
                            <button
                                onClick={handleClearAll}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {/* Category Checklist */}
                    <div className="p-2 max-h-80 overflow-y-auto">
                        {CATEGORIES.map((category) => (
                            <label
                                key={category.value}
                                className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.includes(category.value)}
                                    onChange={() => handleToggleCategory(category.value)}
                                    className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <div className="flex items-center gap-2 flex-1">
                                    <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                                    <span className="text-white text-sm">{category.label}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-gray-600 bg-gray-750">
                        <p className="text-xs text-gray-400">
                            {selectedCategories.length === 0
                                ? 'No filters applied - showing all feedback'
                                : `Showing ${selectedCategories.length} of ${CATEGORIES.length} categories`}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeedbackCategoryFilter;
