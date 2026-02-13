import React, { useState, type KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface DynamicListInputProps {
    label?: string;
    placeholder?: string;
    items: string[];
    onChange: (items: string[]) => void;
    color?: 'brand' | 'red' | 'green' | 'blue';
    helperText?: string;
}

export const DynamicListInput: React.FC<DynamicListInputProps> = ({
    label,
    placeholder = "Digite e pressione Enter...",
    items = [],
    onChange,
    color = 'brand',
    helperText
}) => {
    const [inputValue, setInputValue] = useState('');

    const handleAdd = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !items.includes(trimmed)) {
            onChange([...items, trimmed]);
            setInputValue('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const remove = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    const colorClasses = {
        brand: 'bg-brand-50 text-brand-700 border-brand-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200'
    };

    return (
        <div className="space-y-2">
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                    placeholder={placeholder}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            {helperText && <p className="text-xs text-gray-500">{helperText}</p>}

            <div className="flex flex-wrap gap-2 min-h-[2rem]">
                {items.map((item, idx) => (
                    <span
                        key={idx}
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium border ${colorClasses[color]} animate-fade-in`}
                    >
                        {item}
                        <button
                            type="button"
                            onClick={() => remove(idx)}
                            className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
};
