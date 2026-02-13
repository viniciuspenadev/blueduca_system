
import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from './Button'; // Reusing cn utility

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: ReactNode;
    rightIcon?: ReactNode;
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, containerClassName, label, error, icon, rightIcon, ...props }, ref) => {
    return (
        <div className={cn("w-full space-y-1", containerClassName)}>
            {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
            <div className="relative group">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                        {icon}
                    </div>
                )}
                <input
                    className={cn(
                        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-400 transition-all duration-200 shadow-sm",
                        icon && "pl-10",
                        rightIcon && "pr-10",
                        error && "border-red-500 focus:ring-red-500/20 focus:border-red-500",
                        className
                    )}
                    ref={ref}
                    {...props}
                />
                {rightIcon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                        {rightIcon}
                    </div>
                )}
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
    );
});
