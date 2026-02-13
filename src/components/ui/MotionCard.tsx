import { type HTMLMotionProps, motion } from 'framer-motion';
import { cn } from '../../utils/cn.ts';

interface MotionCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    delay?: number;
    glass?: boolean;
    noHover?: boolean;
}

export const MotionCard = ({
    children,
    className,
    delay = 0,
    glass = false,
    noHover = false,
    ...props
}: MotionCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                delay: delay,
                ease: [0.22, 1, 0.36, 1] // Custom "Apple-like" ease
            }}
            whileHover={!noHover ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
            whileTap={!noHover ? { scale: 0.98 } : undefined}
            className={cn(
                "rounded-3xl border overflow-hidden relative",
                glass
                    ? "bg-white/80 backdrop-blur-xl border-white/20 shadow-lg"
                    : "bg-white border-gray-100 shadow-sm",
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
};
