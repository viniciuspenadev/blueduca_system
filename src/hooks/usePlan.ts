import { useAuth } from '../contexts/AuthContext';

export interface PlanConfig {
    modules: Record<string, boolean>;
    limits: Record<string, number>;
}

export const usePlan = () => {
    const { currentSchool } = useAuth();

    // The currentSchool should already have its config_modules and config_limits
    // resolved by the backend (get_effective_school_config RPC) via AuthContext.

    const config: PlanConfig = {
        modules: currentSchool?.config_modules || {},
        limits: currentSchool?.config_limits || {}
    };

    /**
     * Checks if a specific module is enabled for the current school.
     */
    const hasModule = (moduleId: string): boolean => {
        // We strictly trust the resolved configuration from currentSchool
        return !!config.modules[moduleId];
    };

    /**
     * Checks if a specific limit has been reached.
     * @param limitKey Key of the limit (e.g., 'max_students')
     * @param currentCount Current amount used
     */
    const isOverLimit = (limitKey: string, currentCount: number): boolean => {
        const limitValue = config.limits[limitKey];
        if (!limitValue) return false;
        return currentCount >= limitValue;
    };

    return {
        config,
        hasModule,
        isOverLimit,
        planTier: currentSchool?.plan_tier || 'FREE'
    };
};
