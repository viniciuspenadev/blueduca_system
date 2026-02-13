import { useState, useRef, useEffect, type FC } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
    Home, GraduationCap, Calendar, BookOpen,
    User, LogOut, ChevronDown, Check, Menu
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStudent } from '../contexts/StudentContext';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { PushNotificationManager } from '../components/PushNotificationManager';
import { useUnreadCommunications } from '../hooks/useUnreadCommunications';
import { usePlan } from '../hooks/usePlan';
import { useDocumentAlerts } from '../hooks/useDocumentAlerts';


export const ParentLayout: FC = () => {
    const { user, signOut } = useAuth();
    const { students, selectedStudent, setSelectedStudent, loading: studentsLoading } = useStudent();
    const { unreadCount } = useUnreadCommunications();
    const { alertCount } = useDocumentAlerts(); // New Hook
    const location = useLocation();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return <Navigate to="/login" replace />;

    const { hasModule } = usePlan();

    const navItems = [
        { path: '/pais/home', icon: Home, label: 'Início', badge: unreadCount, disabled: false },
        { path: '/pais/diario', icon: BookOpen, label: 'Diário', disabled: !hasModule('academic') },
        { path: '/pais/agenda', icon: Calendar, label: 'Agenda', disabled: !hasModule('academic') },
        { path: '/pais/boletim', icon: GraduationCap, label: 'Boletim', disabled: !hasModule('academic') },
        { path: '/pais/menu', icon: Menu, label: 'Menu', disabled: false, badge: alertCount },
    ];

    const isActive = (path: string) => location.pathname.startsWith(path);

    const SidebarItem = ({ item }: { item: typeof navItems[0] }) => {
        const active = isActive(item.path);

        if (item.disabled) {
            return (
                <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 cursor-not-allowed group relative select-none">
                    <div className="p-2 rounded-lg bg-gray-50/50">
                        <item.icon className="w-5 h-5 opacity-50" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium flex-1 text-left opacity-70">{item.label}</span>
                    <div className="bg-gray-100 text-gray-400 p-1 rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </div>
                </div>
            );
        }

        return (
            <button
                onClick={() => navigate(item.path)}
                className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                    ${active
                        ? 'bg-brand-50 text-brand-700 font-bold shadow-sm'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                `}
            >
                <div className={`
                    p-2 rounded-lg transition-colors
                    ${active ? 'bg-white text-brand-600 shadow-sm' : 'bg-transparent group-hover:bg-white'}
                `}>
                    <item.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {item.badge}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="h-[100dvh] bg-gray-50 flex overflow-hidden">
            {/* Desktop Sidebar (Hidden on Mobile) */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed left-0 top-0 bottom-0 z-30 shadow-sm">
                <div className="p-6 flex items-center gap-3 border-b border-gray-100 h-[72px]">
                    <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-brand-sm">
                        <GraduationCap size={20} />
                    </div>
                    <span className="text-lg font-bold text-gray-900 tracking-tight">EscolaV2</span>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    <div className="mb-6 px-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Menu Principal</p>
                        <div className="space-y-1">
                            {navItems.map((item) => (
                                <SidebarItem key={item.path} item={item} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={signOut}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-white hover:text-red-600 hover:shadow-sm transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">Sair do Sistema</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col md:pl-64 min-w-0 transition-all duration-300">

                {/* Header (Responsive) */}
                <header className="bg-brand-600 md:bg-white md:border-b md:border-gray-200 text-white md:text-gray-900 px-5 pt-safe-area pb-2 flex justify-between items-center fixed top-0 left-0 right-0 md:left-64 z-50 shadow-md md:shadow-sm">
                    <div className="flex items-center gap-3 flex-1 min-w-0 h-16 md:h-16">
                        {/* Student Selector Dropdown */}
                        <div className="relative max-w-sm" ref={dropdownRef}>
                            <button
                                onClick={() => !studentsLoading && setDropdownOpen(!dropdownOpen)}
                                disabled={studentsLoading || students.length === 0}
                                className={`
                                    flex items-center gap-3 rounded-xl p-2 transition-all disabled:opacity-50 text-left
                                    md:hover:bg-gray-50 md:border md:border-transparent md:hover:border-gray-200 md:pr-4
                                    ${dropdownOpen ? 'md:bg-gray-50 md:border-gray-200' : ''}
                                `}
                            >
                                {/* Avatar */}
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm border-2 shrink-0 overflow-hidden shadow-sm
                                    md:bg-gray-100 md:border-gray-200 md:text-gray-400
                                    bg-white/20 border-white/30 text-white
                                `}>
                                    {selectedStudent?.photo_url ? (
                                        <img
                                            src={selectedStudent.photo_url}
                                            alt={selectedStudent?.name || 'Aluno'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className="w-5 h-5" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="min-w-0">
                                    <p className="text-xs font-medium md:text-gray-500 text-brand-100">
                                        {studentsLoading ? 'Carregando...' : (selectedStudent?.class_name || 'Aluno')}
                                    </p>
                                    <h1 className="text-sm font-bold truncate md:text-gray-900 leading-tight">
                                        {selectedStudent?.name || 'Selecione o Aluno'}
                                    </h1>
                                </div>

                                {/* Chevron */}
                                {students.length > 1 && (
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform shrink-0 ml-1 md:text-gray-400 text-brand-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                                    />
                                )}
                            </button>

                            {/* Dropdown Menu */}
                            {dropdownOpen && students.length > 1 && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 animate-slide-down md:shadow-2xl z-50">
                                    <div className="p-2 max-h-[320px] overflow-y-auto">
                                        {students.map((student) => {
                                            const isSelected = selectedStudent?.id === student.id;
                                            return (
                                                <button
                                                    key={student.id}
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        setDropdownOpen(false);
                                                    }}
                                                    className={`
                                                        w-full flex items-center gap-3 p-3 rounded-xl transition-all
                                                        ${isSelected
                                                            ? 'bg-brand-50 border-2 border-brand-500'
                                                            : 'hover:bg-gray-50 border-2 border-transparent hover:scale-[1.02]'
                                                        }
                                                    `}
                                                >
                                                    <div className={`
                                                        w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden
                                                        ${isSelected ? 'ring-2 ring-brand-500 ring-offset-2' : 'bg-gray-100'}
                                                    `}>
                                                        {student.photo_url ? (
                                                            <img
                                                                src={student.photo_url}
                                                                alt={student.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <User className="w-5 h-5 text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <h3 className={`font-bold text-sm truncate ${isSelected ? 'text-brand-700' : 'text-gray-900'}`}>
                                                            {student.name}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {student.class_name || 'Aluno'}
                                                        </p>
                                                    </div>
                                                    {isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <NotificationCenter />
                        {/* Logout Button (Mobile Only, since Desktop has it in sidebar) */}
                        <button onClick={signOut} className="md:hidden p-2 hover:bg-white/10 rounded-full text-white">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Header Spacer */}
                <div className="h-16 pt-safe-area pb-16 shrink-0" />

                {/* Main Content Area */}
                <main className={`flex-1 overflow-y-auto pb-24 md:pb-8 scrollbar-hide w-full max-w-[1920px] mx-auto ${location.pathname.includes('/mural/') ? 'p-0' : 'px-4 py-6 md:p-8'}`}>
                    <Outlet />
                </main>
            </div>

            {/* Bottom Navigation (Mobile Only) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 pb-safe-area z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                    {navItems.map((item) => {
                        const active = isActive(item.path);
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {active && (
                                    <div className="absolute top-0 w-12 h-1 bg-brand-500 rounded-b-full shadow-[0_2px_8px_rgba(99,102,241,0.5)] animate-pulse" />
                                )}

                                <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-brand-50/50 -translate-y-1' : 'bg-transparent'}`}>
                                    <item.icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                                </div>
                                <span className={`text-[10px] font-bold mt-0.5 ${active ? 'scale-105' : 'scale-100'}`}>
                                    {item.label}
                                </span>
                                {item.badge !== undefined && item.badge > 0 && (
                                    <span className="absolute top-2 right-1/4 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-white">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Push Notification Manager - Auto-prompt for parents */}
            <PushNotificationManager />

        </div>
    );
};
