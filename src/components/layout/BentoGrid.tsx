import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface BentoGridProps {
    children: React.ReactNode;
    className?: string;
}

export const BentoGrid = ({ children, className }: BentoGridProps) => {
    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(120px,auto)]",
            className
        )}>
            {children}
        </div>
    );
};

interface BentoItemProps {
    children: React.ReactNode;
    className?: string;
    colSpan?: 1 | 2 | 3 | 4;
    rowSpan?: 1 | 2;
    delay?: number;
}

export const BentoItem = ({
    children,
    className,
    colSpan = 1,
    rowSpan = 1,
    delay = 0
}: BentoItemProps) => {
    const colSpanClass = {
        1: 'md:col-span-1',
        2: 'md:col-span-2',
        3: 'md:col-span-3',
        4: 'md:col-span-4',
    }[colSpan];

    const rowSpanClass = {
        1: 'row-span-1',
        2: 'row-span-2',
    }[rowSpan];

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.4,
                delay: delay,
                ease: [0.2, 0.6, 0.2, 1]
            }}
            className={cn(
                colSpanClass,
                rowSpanClass,
                "group relative flex flex-col justify-between overflow-hidden rounded-3xl",
                "bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md",
                className
            )}
        >
            {children}
        </motion.div>
    );
};
