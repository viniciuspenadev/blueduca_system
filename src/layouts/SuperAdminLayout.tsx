import { type FC, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    School,
    Settings,
    LogOut,
    Menu,
    X,
    CreditCard,
    Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const SuperAdminLayout: FC = () => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate('/');
    };

    const navItems = [
        { path: '/sys/admin/dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
        { path: '/sys/admin/escolas', icon: School, label: 'Escolas' },
        { path: '/sys/admin/planos', icon: CreditCard, label: 'Planos e Cobrança' },
        { path: '/sys/admin/admins', icon: Shield, label: 'Admins do Sistema' },
        { path: '/sys/admin/config', icon: Settings, label: 'Config. Globais' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar - Dark Slate Theme for distinction */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
                    <img
                        src="/src/assets/IMG/logo_completo.png"
                        alt="SaaS Manager"
                        className="h-8 w-auto object-contain brightness-0 invert opacity-90"
                    />
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden text-slate-400 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="bg-slate-800 rounded-lg p-3 mb-6">
                        <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Logado como</p>
                        <p className="font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-emerald-400 mt-1">Super Admin</p>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                                    ${isActive
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }
                                `}
                            >
                                <item.icon size={20} />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="absolute bottom-0 w-full p-4 border-t border-slate-800 bg-slate-900">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors"
                    >
                        <LogOut size={20} />
                        <span className="font-medium">Sair do Sistema</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:hidden">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="text-gray-600 p-2 -ml-2 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-gray-800">Gerenciador SaaS</span>
                    <div className="w-8" />
                </header>

                <main className="flex-1 overflow-auto overscroll-none p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>

            {/* Overlay for mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
        </div>
    );
};
