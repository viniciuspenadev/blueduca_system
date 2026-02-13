import { useState, useRef, useEffect, type FC, type ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import logo from '../assets/IMG/logo_completo.png';
import {
    LayoutDashboard,
    Calendar,
    BookOpen,
    LogOut,
    ChevronDown,
    Check,
    Menu,
    X,
    MessageSquare,
    GraduationCap,
    Circle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Button } from '../components/ui/Button';

interface TeacherLayoutProps {
    children: ReactNode;
}

export const TeacherLayout: FC<TeacherLayoutProps> = ({ children }) => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { currentSchool } = useAuth();

    // Fetch School Branding
    useEffect(() => {
        if (currentSchool?.id) {
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
        }
    }, [currentSchool?.id]);

    // Fetch classes for the switcher
    useEffect(() => {
        const fetchClasses = async () => {
            if (!user?.id) return;
            try {
                const { data, error } = await supabase
                    .from('class_teachers')
                    .select('id, class:classes(id, name, shift)')
                    .eq('teacher_id', user.id)
                    .eq('status', 'ACTIVE');

                if (error) throw error;

                // Format the data to match expected structure
                const formattedClasses = (data || [])
                    .filter((item: any) => item.class)
                    .map((item: any) => ({
                        id: item.class.id,
                        name: item.class.name,
                        period: item.class.shift || 'Não definido'
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));

                setClasses(formattedClasses);
            } catch (err) {
                console.error('Error fetching teacher classes:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchClasses();
    }, [user?.id]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    // Identify selected class from URL
    const selectedClassId = location.pathname.match(/\/turmas\/([a-zA-Z0-9-]+)/)?.[1];
    const selectedClass = classes.find(c => c.id === selectedClassId);

    const navItems = [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Agenda', path: '/agenda', icon: Calendar },
        { label: 'Planejamento', path: '/planejamento', icon: BookOpen },
        { label: 'Mensagens', path: '/admin/comunicados', icon: MessageSquare },
        { label: 'Minhas Turmas', path: '/turmas', icon: GraduationCap },
    ];

    const handleClassSwitch = (classId: string) => {
        navigate(`/turmas/${classId}`);
        setDropdownOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed h-full z-40 shadow-sm">
                <div className="p-6 border-b border-slate-100 mb-4 flex items-center justify-center">
                    <img src={schoolLogo || logo} alt="Logo" className="h-14 w-auto object-contain" />
                </div>

                {/* Class Switcher in Sidebar */}
                <div className="px-4 mb-6">
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => classes.length > 1 && setDropdownOpen(!dropdownOpen)}
                            disabled={loading || classes.length === 0}
                            className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md group
                                ${classes.length > 1 ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                            `}
                        >
                            <div className="flex flex-col text-left min-w-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">Turma Ativa</span>
                                <span className="text-xs font-bold text-slate-700 truncate">
                                    {loading ? 'Carregando...' : (selectedClass?.name || 'Portal Professor')}
                                </span>
                            </div>
                            {classes.length > 1 && <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />}
                        </button>

                        {dropdownOpen && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200 z-50">
                                <div className="p-2 max-h-[300px] overflow-y-auto space-y-1">
                                    {classes.map(cls => (
                                        <button
                                            key={cls.id}
                                            onClick={() => handleClassSwitch(cls.id)}
                                            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all
                                                ${cls.id === selectedClassId ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50 text-slate-600'}
                                            `}
                                        >
                                            <div className="flex-1 text-left min-w-0">
                                                <p className="text-xs font-bold truncate">{cls.name}</p>
                                                <p className="text-[9px] font-medium opacity-70 uppercase">{cls.period}</p>
                                            </div>
                                            {cls.id === selectedClassId && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {navItems.map(item => {
                        const active = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all border border-transparent
                                    ${active ? 'bg-brand-50 text-brand-700 shadow-sm border-brand-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                                `}
                            >
                                <item.icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                    {/* User Profile Footer */}
                    <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-brand-100 shadow-lg">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{user?.name}</p>
                            <p className="text-[9px] font-bold text-brand-600 uppercase tracking-wider">Professor(a)</p>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        className="w-full justify-start text-red-600 font-bold hover:bg-red-50 rounded-xl px-3"
                        onClick={signOut}
                    >
                        <LogOut className="w-4 h-4 mr-2" /> Sair
                    </Button>
                </div>
            </aside>

            {/* Mobile Header (Hidden on Desktop) */}
            <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between shadow-sm pt-safe-area h-[calc(4rem+env(safe-area-inset-top))]">
                <div className="flex items-center gap-3">
                    <button onClick={toggleMenu} className="p-2 -ml-2 text-slate-600">
                        <Menu className="w-6 h-6" />
                    </button>
                    <img src={schoolLogo || logo} alt="School Logo" className="h-8 w-auto object-contain" />
                </div>
                <div className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
                    {selectedClass?.name || 'Portal'}
                </div>
            </header>

            {/* Mobile Drawer Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[100] md:hidden flex">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={toggleMenu} />
                    <div className="relative w-[280px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 pb-safe-area">
                        {/* Logo Header Mobile */}
                        <div className="px-6 pb-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
                            <img src={schoolLogo || logo} alt="Logo" className="h-10 w-auto object-contain" />
                            <button onClick={toggleMenu} className="p-2 text-slate-400 bg-white rounded-xl shadow-sm"><X className="w-5 h-5" /></button>
                        </div>

                        {/* Class Switcher Mobile */}
                        <div className="px-4 py-4 border-b border-slate-50">
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Alternar Turma</span>
                                <div className="space-y-2">
                                    {classes.map(cls => (
                                        <button
                                            key={cls.id}
                                            onClick={() => handleClassSwitch(cls.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all
                                                ${cls.id === selectedClassId ? 'bg-white text-brand-700 shadow-md border-brand-100 ring-1 ring-brand-100' : 'text-slate-500 hover:bg-white'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {cls.id === selectedClassId ? <Check className="w-4 h-4 text-brand-600 shrink-0" /> : <Circle className="w-2 h-2 text-slate-300 shrink-0" />}
                                                <span className="text-xs font-bold truncate">{cls.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {classes.length === 0 && <p className="text-[10px] text-slate-400 italic px-1">Nenhuma turma vinculada</p>}
                                </div>
                            </div>
                        </div>

                        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                            {navItems.map(item => (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={toggleMenu}
                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all
                                        ${location.pathname === item.path ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100' : 'text-slate-500 hover:bg-slate-50'}
                                    `}
                                >
                                    <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-brand-600' : 'text-slate-400'}`} />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto">
                            {/* Mobile User Profile */}
                            <div className="flex items-center gap-3 px-3 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm mb-3">
                                <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-brand-100">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-800 truncate">{user?.name}</p>
                                    <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest">Professor(a)</p>
                                </div>
                                <button onClick={signOut} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 w-full min-w-0 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-0">
                <div className="p-4 md:p-8 animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
};
