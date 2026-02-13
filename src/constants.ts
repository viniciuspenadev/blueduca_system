
import { type User, UserRole } from './types';

export const MOCK_USERS: User[] = [
    {
        id: 'mock-admin',
        email: 'admin@escola.com',
        name: 'Diretora Maria',
        role: UserRole.ADMIN,
        avatar_url: 'https://ui-avatars.com/api/?name=Maria+Silva&background=0284c7&color=fff'
    },
    {
        id: 'mock-secretary',
        email: 'sec@escola.com',
        name: 'Ana Secretaria',
        role: UserRole.SECRETARY,
        avatar_url: 'https://ui-avatars.com/api/?name=Ana+Sec&background=7dd3fc&color=000'
    },
    {
        id: 'mock-parent',
        email: 'pai@escola.com',
        name: 'Carlos Pais',
        role: UserRole.PARENT,
        avatar_url: 'https://ui-avatars.com/api/?name=Carlos+Pais&background=f59e0b&color=fff'
    }
];
