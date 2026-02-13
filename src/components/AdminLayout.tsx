import { type FC, type ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { SystemBanner } from './SystemBanner';
import logo from '../assets/IMG/logo_completo.png';
import {
    LayoutDashboard,
    FileText,
    Users,
    Calendar,
    LogOut,
    Menu,
    X,
    Bell,
    DollarSign,
    ChevronDown,
    ChevronRight,
    GraduationCap,
    AlertTriangle,
    Settings,
    Megaphone,
    TrendingUp,
    UtensilsCrossed,
    Shield,
    ClipboardCheck,
    School,
    Star,
    MessageSquare,
    BookOpen,
    Clock
} from 'lucide-react';
import { Button } from './ui/Button';
import { usePlan } from '../hooks/usePlan';
import { useAuth } from '../contexts/AuthContext';


interface AdminLayoutProps {
    children: ReactNode;
    user: any;
    onLogout: () => void;
}

export const AdminLayout: FC<AdminLayoutProps> = ({ children, user, onLogout }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const { hasModule } = usePlan();
    const { isImpersonating, stopImpersonation, currentSchool } = useAuth();
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

    // Fetch School Branding
    useEffect(() => {
        if (currentSchool?.id) {
            import('../services/supabase').then(({ supabase }) => {
                supabase
                    .from('app_settings')
                    .select('value')
                    .eq('school_id', currentSchool.id)
                    .eq('key', 'school_info')
                    .maybeSingle()
                    .then(({ data }) => {
                        if (data?.value) {
                            try {
                                const info = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                                if (info.logo_url) setSchoolLogo(info.logo_url);
                            } catch (e) { console.error('Error parsing school branding', e); }
                        }
                    });
            });
        }
    }, [currentSchool?.id]);

    // Define nav items with role restrictions and grouping
    const allNavItems = [
        {
            section: 'Visão Geral',
            items: [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['*'] },
                { icon: Shield, label: 'Painel do Diretor', path: '/diretoria/dashboard', roles: ['ADMIN'] },
                hasModule('crm') && { icon: TrendingUp, label: 'Leads CRM', path: '/admin/leads', roles: ['ADMIN', 'SECRETARY'] },
            ].filter(Boolean) as any[]
        },
        {
            section: 'Pedagógico',
            items: [
                hasModule('academic') && { icon: Calendar, label: 'Agenda Escolar', path: '/agenda', roles: ['*'] },
                hasModule('academic') && { icon: GraduationCap, label: 'Turmas', path: '/turmas', roles: ['*'] },
                hasModule('academic') && { icon: Users, label: 'Alunos', path: '/alunos', roles: ['ADMIN', 'SECRETARY', 'COORDINATOR'] },
                hasModule('academic') && { icon: LayoutDashboard, label: 'Plano de Atividades', path: '/planejamento', roles: ['ADMIN', 'COORDINATOR', 'TEACHER'] },
                hasModule('academic') && { icon: AlertTriangle, label: 'Gestão de Faltas', path: '/frequencia', roles: ['ADMIN', 'SECRETARY', 'COORDINATOR'] },
            ].filter(Boolean) as any[]
        },
        hasModule('menu') && {
            section: 'Alimentação',
            items: [
                { icon: UtensilsCrossed, label: 'Cardápio', path: '/admin/cardapio', roles: ['ADMIN', 'SECRETARY'] },
            ]
        },
        hasModule('communications') && {
            section: 'Comunicação',
            items: [
                { icon: FileText, label: 'Mensagens', path: '/admin/comunicados', roles: ['ADMIN', 'SECRETARY', 'COORDINATOR', 'TEACHER'] },
            ]
        },
        {
            section: 'Administrativo',
            items: [
                { icon: ClipboardCheck, label: 'Secretaria', path: '/secretaria', roles: ['ADMIN', 'SECRETARY'] },
                hasModule('academic') && { icon: FileText, label: 'Matrículas', path: '/matriculas', roles: ['ADMIN', 'SECRETARY'] },
                hasModule('finance') && {
                    icon: DollarSign,
                    label: 'Financeiro',
                    path: '/financeiro/recebiveis',
                    roles: ['ADMIN', 'SECRETARY'],
                    subItems: [
                        { label: 'Mensalidades', path: '/financeiro/recebiveis', end: true },
                        { label: 'Matric/Mensalidade', path: '/financeiro/alunos' },
                        { label: 'Régua de Cobrança', path: '/financeiro/regua', module: 'dunning' },
                        { label: 'Contas a Pagar', path: '/financeiro/pagar' },
                        { label: 'Planos & Preços', path: '/financeiro/planos' },
                    ]
                }
            ].filter(Boolean) as any[]
        },
        {
            section: 'Sistema',
            items: [
                {
                    icon: Settings,
                    label: 'Configurações',
                    path: '/config',
                    roles: ['ADMIN', 'SECRETARY'],
                    subItems: [
                        { label: 'INSTITUCIONAL', isHeader: true },
                        { label: 'Dados da Escola', path: '/config/hub?tab=school', icon: School },
                        { label: 'Meu Plano', path: '/config/hub?tab=plan', icon: Star },

                        { label: 'INTEGRAÇÕES', isHeader: true },
                        { label: 'WhatsApp', path: '/config/hub?tab=whatsapp', icon: MessageSquare },
                        { label: 'Financeiro', path: '/config/hub?tab=finance', icon: DollarSign, module: 'finance' },

                        { label: 'ACADÊMICO', isHeader: true },
                        { label: 'Liberação de Agendas', path: '/config/hub?tab=acad_general', icon: Settings, module: 'academic' },
                        { label: 'Anos Letivos', path: '/config/hub?tab=acad_years', icon: Calendar, module: 'academic' },
                        { label: 'Catálogo de Matérias', path: '/config/hub?tab=acad_subjects', icon: BookOpen, module: 'academic' },
                        { label: 'Rotinas Diárias', path: '/config/hub?tab=acad_timelines', icon: Clock, module: 'academic' },
                        { label: 'Documentos de Matrícula', path: '/config/hub?tab=acad_docs', icon: FileText, module: 'academic' },

                        { label: 'ACESSO', isHeader: true },
                        { label: 'Usuários & Permissões', path: '/config/hub?tab=users', icon: Users },
                    ]
                }
            ]
        }
    ].filter(Boolean) as any[];

    // Flatten and Filter nav items for state/rendering helper
    const filteredGroups = allNavItems.map(group => ({
        ...group,
        items: group.items.filter((item: any) => {
            // Check roles
            const hasRole = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'SECRETARY' || item.roles.includes('*') || item.roles.includes(user.role);
            if (!hasRole) return false;

            // Handle sub-items module filtering
            if (item.subItems) {
                item.subItems = item.subItems.filter((sub: any) => {
                    if (!sub.module) return true;
                    return hasModule(sub.module);
                });
                return item.subItems.length > 0;
            }

            return true;
        })
    })).filter(group => group.items.length > 0);

    // Flat list for expanded menu logic helper (keeps original logic working)
    const flatNavItems = filteredGroups.flatMap(g => g.items);

    // State for expanded submenus - Initialize based on current path
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
        const initialState: Record<string, boolean> = {};
        flatNavItems.forEach(item => {
            if (item.subItems) {
                // Check if any sub-item is active
                const hasActiveSub = item.subItems.some((sub: any) => sub.path === location.pathname);
                if (hasActiveSub) {
                    initialState[item.label] = true;
                }
            }
        });
        return initialState;
    });

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    const isActiveLink = (path: string) => {
        if (!path) return false;
        if (path.includes('?')) {
            const [base, query] = path.split('?');
            return location.pathname === base && location.search.includes(query);
        }
        return location.pathname === path;
    };
    const isParentActive = (item: any) => item.subItems?.some((sub: any) => isActiveLink(sub.path));

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);



    return (
        <div className="min-h-screen flex flex-col">
            <SystemBanner />
            <div className="flex flex-1">
                {/* Sidebar Desktop */}
                <aside className="hidden md:flex flex-col w-64 lg:w-56 xl:w-64 bg-white border-r border-slate-200 fixed h-full z-10 shadow-sm transition-all duration-300">
                    <div className="p-6 border-b border-slate-100 flex items-center">
                        <img src={schoolLogo || logo} alt="Logo" className="h-14 w-auto object-contain" />
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                        {filteredGroups.map((group) => (
                            <div key={group.section} className="mb-2">
                                {/* Only show section label if NOT the first group (Visão Geral usually doesn't need label if at top) OR if explicit desired */}
                                {group.section !== 'Visão Geral' && (
                                    <div className="px-4 py-2 mt-4 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        {group.section}
                                    </div>
                                )}

                                {group.items.map((item: any) => {
                                    const hasSub = !!item.subItems;
                                    const isExpanded = expandedMenus[item.label];
                                    const active = isActiveLink(item.path) || isParentActive(item);

                                    if (hasSub) {
                                        return (
                                            <div key={item.label} className="space-y-1 mb-1">
                                                <button
                                                    onClick={() => toggleMenu(item.label)}
                                                    className={`
                                                    w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                                                    ${active
                                                            ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100'
                                                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                                                        }
                                                `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <item.icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                                                        <span>{item.label}</span>
                                                    </div>
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>

                                                <div
                                                    className={`
                                                    pl-4 ml-4 space-y-1 border-l-2 border-slate-100 overflow-hidden transition-all duration-300 ease-in-out
                                                    ${isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}
                                                `}
                                                >
                                                    {item.subItems?.map((sub: any) => {
                                                        if (sub.isHeader) {
                                                            return (
                                                                <div key={sub.label} className="mt-4 mb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                                                                    {sub.label}
                                                                </div>
                                                            );
                                                        }

                                                        const isSubActive = isActiveLink(sub.path);

                                                        return (
                                                            <NavLink
                                                                key={sub.path}
                                                                to={sub.path}
                                                                end={sub.end}
                                                                className={`
                                                                    flex items-center gap-3 py-2 px-3 text-sm rounded-lg transition-all
                                                                    ${isSubActive
                                                                        ? 'text-brand-700 font-bold bg-brand-50 shadow-sm border border-brand-100/50'
                                                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                                                    }
                                                                `}
                                                            >
                                                                {sub.icon ? (
                                                                    <sub.icon className={`w-4 h-4 ${isSubActive ? 'text-brand-600' : 'text-slate-400'}`} strokeWidth={isSubActive ? 2.5 : 2} />
                                                                ) : (
                                                                    <div className="w-4" />
                                                                )}
                                                                <span className="truncate">{sub.label}</span>
                                                            </NavLink>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) => `
                                            flex items-center gap-3 px-4 py-2.5 mb-1 rounded-xl transition-all font-medium text-sm border border-transparent
                                            ${isActive
                                                    ? 'bg-white text-brand-700 shadow-sm border-brand-100 bg-gradient-to-r from-white to-brand-50'
                                                    : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                                                }
                                        `}
                                        >
                                            <item.icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                                            {item.label}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-100 bg-white">
                        <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs border border-brand-200">
                                {user?.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
                                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={onLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sair
                        </Button>
                    </div>
                </aside>

                {/* Mobile Header */}
                <div className="md:hidden fixed top-0 w-full bg-white border-b border-slate-200 z-50 px-4 flex justify-between items-center shadow-sm h-16 pt-[env(safe-area-inset-top)]">
                    <div className="flex items-center gap-2 h-full">
                        <img src={schoolLogo || logo} alt="Logo" className="h-10 w-auto object-contain" />
                    </div>
                    <button onClick={toggleMobileMenu} className="p-2 text-slate-600">
                        {isMobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className="md:hidden fixed inset-0 z-[100] flex">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                        <div className="relative bg-white w-72 h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 pointer-events-auto" onClick={e => e.stopPropagation()}>
                            <div className="px-6 pb-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
                                <img src={schoolLogo || logo} alt="Logo" className="h-10 w-auto object-contain" />
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 text-slate-400 bg-white rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                                {filteredGroups.map((group) => (
                                    <div key={group.section} className="mb-4">
                                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {group.section}
                                        </div>
                                        {group.items.map((item: any) => (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={({ isActive }) => `
                                                flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all
                                                ${isActive ? 'bg-brand-50 text-brand-700 shadow-sm border-brand-100 ring-1 ring-brand-100/50' : 'text-slate-500 hover:bg-slate-50'}
                                            `}
                                            >
                                                <item.icon className={`w-5 h-5 ${isActiveLink(item.path) ? 'text-brand-600' : 'text-slate-400'}`} />
                                                {item.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                ))}
                            </nav>

                            <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto pb-safe-area">
                                <div className="flex items-center gap-3 px-3 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm mb-3">
                                    <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-brand-100">
                                        {user?.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-800 truncate">{user?.name}</p>
                                        <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest">{user?.role}</p>
                                    </div>
                                    <button onClick={onLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <main className="flex-1 md:ml-64 lg:ml-56 xl:ml-64 min-h-screen flex flex-col pt-0 md:pt-0 transition-all duration-300">
                    {/* Mobile Header Spacer */}
                    <div className="md:hidden h-16 pt-safe-area pb-2 shrink-0" />

                    {/* Impersonation Banner */}
                    {isImpersonating && (
                        <div className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between shadow-md relative z-50 mt-16 md:mt-0">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Shield size={16} />
                                <span>
                                    Modo Super Admin: Acessando <strong>{currentSchool?.name}</strong>
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={stopImpersonation}
                                className="h-7 text-white hover:bg-amber-700 hover:text-white border border-white/20 hover:border-white/50"
                            >
                                Sair do Acesso
                            </Button>
                        </div>
                    )}

                    {/* Desktop Top Bar (Hidden on mobile) */}
                    <header className="hidden md:flex justify-end items-center h-16 bg-white border-b border-gray-200 px-8 fixed top-0 left-64 lg:left-56 xl:left-64 right-0 z-50 shadow-sm transition-all duration-300">
                        <div className="flex items-center gap-4">
                            {hasModule('communications') && (
                                <Link to="/admin/comunicados" className="flex items-center gap-3 p-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
                                    <Megaphone size={20} />
                                    <span className="font-medium">Mensagens</span>
                                </Link>
                            )}
                            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                                <Bell className="w-5 h-5" />
                            </button>

                        </div>
                    </header>
                    <div className="hidden md:block h-16" /> {/* Desktop Spacer */}

                    <div className="w-full flex-1 p-4 sm:p-6 lg:p-6 xl:p-8 animate-fade-in mx-auto max-w-full">
                        {children}
                    </div>
                </main>
            </div>

        </div>
    );
};
