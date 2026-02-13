import type { FC, HTMLAttributes } from 'react';

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
    value?: number;
    max?: number;
    className?: string;
    indicatorClassName?: string;
}

export const Progress: FC<ProgressProps> = ({
    value = 0,
    max = 100,
    className = '',
    indicatorClassName = '',
    ...props
}) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
        <div
            className={`w-full bg-gray-100 rounded-full h-2.5 overflow-hidden ${className}`}
            {...props}
        >
            <div
                className={`bg-brand-600 h-2.5 rounded-full transition-all duration-500 ease-in-out ${indicatorClassName}`}
                style={{ width: `${percentage}%` }}
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={max}
            />
        </div>
    );
};
