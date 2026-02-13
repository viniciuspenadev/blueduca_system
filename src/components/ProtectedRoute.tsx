import { type FC, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { TeacherLayout } from '../layouts/TeacherLayout';
import { hasRouteAccess, getDefaultRoute } from '../utils/rolePermissions';
import type { User } from '../types';
import { usePlan } from '../hooks/usePlan';

interface ProtectedRouteProps {
    children: ReactNode;
    user: User;
    onLogout: () => void;
    skipLayout?: boolean; // New prop to skip AdminLayout
    requiredModule?: string; // Module required to access this route
}

/**
 * ProtectedRoute component
 * Checks if user has access to the current route based on their role
 * If not authorized, redirects to appropriate default route
 */
export const ProtectedRoute: FC<ProtectedRouteProps> = ({
    children,
    user,
    onLogout,
    skipLayout = false,
    requiredModule
}) => {
    const location = useLocation();
    const { hasModule } = usePlan();
    const currentPath = location.pathname;

    // 1. Check if user has access to this route based on role
    let hasRoleAccess = hasRouteAccess(user.role, currentPath);

    // Special bypass for teacher messaging portal access
    if (user.role === 'TEACHER' && currentPath.startsWith('/admin/comunicados')) {
        hasRoleAccess = true;
    }

    if (!hasRoleAccess) {
        const defaultRoute = getDefaultRoute(user.role);
        return <Navigate to={defaultRoute} replace />;
    }

    // 2. Check if school has the required module enabled
    // Super Admins bypass module checks
    // Teachers bypass academic module check (implicitly required for their portal)
    const isTeacherAcademicBypass = user.role === 'TEACHER' && (requiredModule === 'academic' || requiredModule === 'communications');

    if (requiredModule && user.role !== 'SUPER_ADMIN' && !isTeacherAcademicBypass) {
        if (!hasModule(requiredModule)) {
            console.warn(`Access denied to module: ${requiredModule}`);
            return <Navigate to="/dashboard" replace />;
        }
    }

    // User has access
    if (skipLayout) {
        return <>{children}</>;
    }

    // Render with TeacherLayout if teacher
    if (user.role === 'TEACHER') {
        return (
            <TeacherLayout>
                {children}
            </TeacherLayout>
        );
    }

    // Render with AdminLayout for others
    return (
        <AdminLayout user={user} onLogout={onLogout}>
            {children}
        </AdminLayout>
    );
};
