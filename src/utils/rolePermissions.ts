// Route permissions mapping
// Defines which routes each role can access

import { type UserRole } from '../types';

// Routes that all authenticated users can access
const COMMON_ROUTES = [
    '/dashboard',
];

// Route whitelist per role
export const ROLE_ROUTES: Record<UserRole, string[]> = {
    // ADMIN and SECRETARY have unrestricted access
    SUPER_ADMIN: ['*'],
    ADMIN: ['*'], // Wildcard = all routes
    SECRETARY: ['*'], // Wildcard = all routes

    // COORDINATOR - Define scope when needed
    COORDINATOR: [
        ...COMMON_ROUTES,
        '/turmas',
        '/turmas/:id',
        '/turmas/nova',
        '/agenda',
        '/alunos', // Can view all students
        '/alunos/:id',
        '/admin/comunicados',
        '/admin/comunicados/novo',
    ],

    // TEACHER - Restricted to teaching activities
    TEACHER: [
        ...COMMON_ROUTES,
        '/turmas', // View assigned classes only (RLS enforces)
        '/turmas/:id', // View class details (RLS enforces)
        '/agenda', // School calendar
        '/planejamento', // Annual planning
        '/admin/comunicados',
        '/admin/comunicados/novo',
        '/admin/comunicados/:id',
        // NOT allowed: /matriculas, /financeiro, /usuarios, /config, /turmas/nova
    ],

    // PARENT - Separate portal (handled separately in AppRouter)
    PARENT: [
        '/pais',
        '/pais/home',
        '/pais/agenda',
        '/pais/diario',
        '/pais/financeiro',
        '/pais/boletim',
        '/pais/cronograma',
        '/pais/mural/:id',
        '/pais/comunicados',
        '/pais/comunicados/novo',
        '/pais/comunicados/:id',
        '/pais/notificacoes',
        '/pais/configuracoes/notificacoes',
        '/pais/menu',
        '/pais/cardapio',
        '/pais/documentos',
        '/pais/perfil',
    ]
};

/**
 * Checks if a user role has access to a given route
 * @param role User's role
 * @param route Route path to check
 * @returns true if access allowed, false otherwise
 */
export const hasRouteAccess = (role: UserRole, route: string): boolean => {
    const allowedRoutes = ROLE_ROUTES[role];

    // Wildcard access (ADMIN, SECRETARY)
    if (allowedRoutes.includes('*')) {
        return true;
    }

    // Normalize route to ignore trailing slashes
    const normalizedRoute = route.endsWith('/') && route.length > 1 ? route.slice(0, -1) : route;

    // Exact match
    if (allowedRoutes.includes(normalizedRoute)) {
        return true;
    }

    // Pattern match (e.g., /turmas/:id matches /turmas/abc-123)
    const matchesPattern = allowedRoutes.some(pattern => {
        if (!pattern.includes(':')) return false;

        const patternParts = pattern.split('/');
        const routeParts = normalizedRoute.split('/');

        if (patternParts.length !== routeParts.length) return false;

        return patternParts.every((part, i) => {
            return part.startsWith(':') || part === routeParts[i];
        });
    });

    return matchesPattern;
};

/**
 * Gets the default redirect route for a role
 */
export const getDefaultRoute = (role: UserRole): string => {
    switch (role) {
        case 'PARENT':
            return '/pais/home';
        case 'TEACHER':
            return '/turmas'; // Teachers land directly on their classes
        case 'SUPER_ADMIN':
            return '/sys/admin';
        default:
            return '/dashboard';
    }
};
