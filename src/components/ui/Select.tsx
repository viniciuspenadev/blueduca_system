import { type SelectHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from './Button';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    icon?: ReactNode;
    containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, icon, className = '', containerClassName, children, ...props }, ref) => {
        return (
            <div className={cn("w-full space-y-1", containerClassName)}>
                {label && (
                    <label className="block text-sm font-medium text-slate-700">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                            {icon}
                        </div>
                    )}
                    <select
                        ref={ref}
                        className={cn(
                            "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-400 transition-all duration-200 shadow-sm",
                            icon && "pl-10",
                            error && "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                            className
                        )}
                        {...props}
                    >
                        {children}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            </div>
        );
    }
);

Select.displayName = 'Select';
