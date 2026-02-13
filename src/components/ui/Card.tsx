
import { type ReactNode, type FC, type HTMLAttributes } from 'react';
import { cn } from './Button';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    title?: string;
    description?: string;
    noPadding?: boolean;
}

export const Card: FC<CardProps> = ({
    children,
    className,
    contentClassName,
    title,
    description,
    noPadding = false,
    ...props
}) => {
    return (
        <div className={cn("bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col", className)} {...props}>
            {(title || description) && (
                <div className="px-6 py-4 border-b border-slate-50 flex-shrink-0">
                    {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
                    {description && <p className="text-sm text-slate-500">{description}</p>}
                </div>
            )}
            <div className={cn(noPadding ? "" : "p-6", "flex-1 min-h-0 flex flex-col", contentClassName)}>
                {children}
            </div>
        </div>
    );
};
