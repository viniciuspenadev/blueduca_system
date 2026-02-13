
import { useState } from 'react';
import {
    Sun, Menu, X, CheckCircle2,
    Save, Calendar, LogOut, ChevronDown,
    ChevronRight, Utensils, Moon, FileText,
    LayoutDashboard, GraduationCap, AlertTriangle, Bell, Search, Clock, BookOpen
} from 'lucide-react';
import { Button } from '../../components/ui';
import logo from '../../assets/IMG/logo_completo.png';

// --- MOCK DATA ---
const MOCK_TEACHER = {
    name: 'Prof. Ana Souza',
    email: 'ana.souza@escolav2.com',
    photo: null
};

const MOCK_CLASSES = [
    { id: '1', name: 'Berçário II B', period: 'Tarde' },
    { id: '2', name: 'Maternal I A', period: 'Manhã' },
    { id: '3', name: 'Jardim II C', period: 'Tarde' }
];

const MOCK_STUDENTS = [
    { id: '1', name: 'Alice Silva', photo: null, status: 'present' },
    { id: '2', name: 'Bernardo Costa', photo: null, status: 'absent' },
    { id: '3', name: 'Carolina Oliveira', photo: null, status: null }, // Pending
    { id: '4', name: 'Davi Santos', photo: null, status: 'present' },
    { id: '5', name: 'Enzo Gabriel', photo: null, status: 'late' },
];

export const TeacherMobileMockup = () => {
    // State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [expandedMenu, setExpandedMenu] = useState<string | null>('Turmas');
    const [activeTab, setActiveTab] = useState<'attendance' | 'diary'>('diary');
    const [selectedClass, setSelectedClass] = useState(MOCK_CLASSES[0]);

    // Observation Modal State
    const [observationStudent, setObservationStudent] = useState<any | null>(null);
    const [observationMap, setObservationMap] = useState<Record<string, string>>({});

    // General Activities State
    const [expandedActivities, setExpandedActivities] = useState(false);

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

            {/* --- 1. PREMIUM HEADER --- */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleMenu}
                            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="font-bold text-slate-800 text-sm leading-tight">{selectedClass.name}</h1>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                {selectedClass.period} • 2024
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-brand-600 rounded-full">
                            <Search className="w-5 h-5" />
                        </button>
                        <button className="relative p-2 text-slate-400 hover:text-brand-600 rounded-full">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                    </div>
                </div>

                {/* --- TABS --- */}
                <div className="flex px-4 gap-6 overflow-x-auto no-scrollbar border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('attendance')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap px-1 
                            ${activeTab === 'attendance' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`
                        }
                    >
                        Chamada
                    </button>
                    <button
                        onClick={() => setActiveTab('diary')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap px-1
                            ${activeTab === 'diary' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`
                        }
                    >
                        Diário
                    </button>
                </div>
            </div>

            {/* --- 2. SIDEBAR MENU (Overlay) --- */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-50 flex">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsMenuOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="relative w-[300px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                            <img src={logo} alt="Logo" className="h-8 w-auto object-contain" />
                            <button onClick={toggleMenu} className="p-1 text-slate-400 hover:text-slate-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Navigation */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Principal</div>

                            <NavItem icon={LayoutDashboard} label="Dashboard" />
                            <NavItem icon={Calendar} label="Minha Agenda" />

                            {/* Dropdown for Classes */}
                            <div className="space-y-1 pt-2">
                                <button
                                    onClick={() => setExpandedMenu(expandedMenu === 'Turmas' ? null : 'Turmas')}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all
                                        ${expandedMenu === 'Turmas' ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <GraduationCap className={`w-5 h-5 ${expandedMenu === 'Turmas' ? 'text-brand-600' : 'text-slate-400'}`} />
                                        <span>Minhas Turmas</span>
                                    </div>
                                    {expandedMenu === 'Turmas' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>

                                {expandedMenu === 'Turmas' && (
                                    <div className="pl-4 ml-4 space-y-1 border-l-2 border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {MOCK_CLASSES.map(cls => (
                                            <button
                                                key={cls.id}
                                                onClick={() => {
                                                    setSelectedClass(cls);
                                                    setIsMenuOpen(false);
                                                }}
                                                className={`w-full text-left flex items-center gap-2 py-2 px-3 text-sm rounded-lg transition-colors
                                                    ${selectedClass.id === cls.id ? 'text-brand-700 font-medium bg-brand-50' : 'text-slate-500 hover:text-slate-900'}
                                                `}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${selectedClass.id === cls.id ? 'bg-brand-500' : 'bg-slate-300'}`} />
                                                {cls.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <NavItem icon={AlertTriangle} label="Ocorrências" />
                            <NavItem icon={FileText} label="Comunicados" badge={2} />
                        </div>

                        {/* User Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                                <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs border border-brand-200">
                                    AS
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-800 truncate">{MOCK_TEACHER.name}</p>
                                    <p className="text-xs text-slate-500 truncate">Professor(a)</p>
                                </div>
                            </div>
                            <Button variant="ghost" className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700">
                                <LogOut className="w-4 h-4 mr-2" /> Sair
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 3. MAIN CONTENT --- */}
            <div className="p-4 space-y-4 max-w-md mx-auto pb-24">

                {/* Status Bar */}
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 sticky top-[120px] z-20 backdrop-blur-md bg-white/90">
                    <div className="flex-1 pl-2">
                        <p className="text-xs text-slate-500 font-medium">Progresso Diário</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-slate-900">3/5</span>
                            <span className="text-xs text-slate-400">alunos salvos</span>
                        </div>
                    </div>
                    <Button size="sm" className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20 text-xs h-10 px-6 rounded-xl transition-all active:scale-95">
                        <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                </div>

                {/* --- GENERAL ACTIVITIES CARD --- */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-3">
                    <button
                        onClick={() => setExpandedActivities(!expandedActivities)}
                        className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-bold text-slate-800 text-sm">Resumo do Dia</h3>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Atividades & Para Casa</p>
                            </div>
                        </div>
                        {expandedActivities ? <ChevronDown className="w-5 h-5 text-slate-400 rotate-180 transition-transform" /> : <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" />}
                    </button>

                    {expandedActivities && (
                        <div className="p-4 border-t border-slate-100 space-y-4 bg-slate-50/30 animate-in slide-in-from-top-1 duration-200">
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                                    <LayoutDashboard className="w-3 h-3" /> Em Sala
                                </label>
                                <textarea
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none shadow-sm"
                                    rows={3}
                                    placeholder="O que a turma aprendeu hoje?"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                                    <GraduationCap className="w-3 h-3" /> Para Casa
                                </label>
                                <textarea
                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none shadow-sm"
                                    rows={2}
                                    placeholder="Lição de casa ou recados..."
                                />
                            </div>
                            <Button className="w-full bg-slate-900 text-white h-10 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/10">
                                Salvar Atividades
                            </Button>
                        </div>
                    )}
                </div>

                {/* Student Cards List */}
                {MOCK_STUDENTS.map(student => (
                    <div key={student.id} className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-brand-200">
                        {/* Card Header */}
                        <div className="p-4 flex items-center justify-between border-b border-slate-50 bg-gradient-to-r from-slate-50/50 to-white">
                            <div className="flex items-center gap-3">
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm text-sm transition-colors
                                    ${student.status === 'present' ? 'bg-brand-100 text-brand-600' : ''}
                                    ${student.status === 'absent' ? 'bg-red-100 text-red-500' : ''}
                                    ${!student.status ? 'bg-slate-100 text-slate-400' : ''}
                                `}>
                                    {student.name.substring(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">{student.name}</h3>
                                    <StatusBadge status={student.status} />
                                </div>
                            </div>

                            <button className="h-9 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm active:bg-slate-50">
                                Editar
                            </button>
                        </div>

                        {/* Card Body - Simplified but Rich */}
                        <div className="p-4 space-y-5">
                            {/* Mood */}
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 flex items-center gap-1">
                                    <Sun className="w-3 h-3" /> Humor
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {[
                                        { label: 'Feliz', emoji: '😄' },
                                        { label: 'Cansado', emoji: '😴' },
                                        { label: 'Choroso', emoji: '😭' },
                                        { label: 'Doente', emoji: '🤒' }
                                    ].map((m) => (
                                        <button key={m.label} className={`
                                            flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all flex flex-col items-center gap-1 min-w-[70px]
                                            ${m.label === 'Feliz'
                                                ? 'bg-gradient-to-br from-green-50 to-white border-green-200 text-green-700 shadow-sm ring-1 ring-green-100'
                                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                            }
                                        `}>
                                            <span className="text-lg leading-none">{m.emoji}</span>
                                            <span className="text-[10px] uppercase">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center gap-1">
                                        <Utensils className="w-3 h-3" /> Almoço
                                    </label>
                                    <select className="w-full text-sm bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer">
                                        <option>🥘 Comeu Tudo</option>
                                        <option>🍛 Comeu Bem</option>
                                        <option>🥡 Comeu Pouco</option>
                                        <option>❌ Recusou</option>
                                    </select>
                                </div>

                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center gap-1">
                                        <Utensils className="w-3 h-3" /> Lanche
                                    </label>
                                    <select className="w-full text-sm bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer">
                                        <option>🍎 Aceitou Bem</option>
                                        <option>🍪 Comeu Pouco</option>
                                        <option>❌ Recusou</option>
                                    </select>
                                </div>

                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center gap-1">
                                        <Moon className="w-3 h-3" /> Descanso
                                    </label>
                                    <select className="w-full text-sm bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer">
                                        <option>😴 Dormiu Bem</option>
                                        <option>🥴 Agitado</option>
                                        <option>👀 Não Dormiu</option>
                                    </select>
                                </div>

                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Higiene
                                    </label>
                                    <select className="w-full text-sm bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer">
                                        <option>✨ Normal</option>
                                        <option>🧻 Troca Extra</option>
                                        <option>⚠️ Irregular</option>
                                    </select>
                                </div>
                            </div>

                            {/* Observation Button */}
                            <button
                                onClick={() => setObservationStudent(student)}
                                className={`w-full py-3 px-4 rounded-xl border-dashed border-2 text-sm font-medium transition-all flex items-center justify-center gap-2
                                    ${observationMap[student.id]
                                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                                        : 'border-slate-200 text-slate-400 hover:border-brand-200 hover:text-brand-600'
                                    }
                                `}
                            >
                                <FileText className="w-4 h-4" />
                                {observationMap[student.id] ? 'Editar Observação' : 'Adicionar Observação'}
                                {observationMap[student.id] && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-1" />
                                )}
                            </button>
                        </div>
                    </div>
                ))}

            </div>

            {/* --- 4. OBSERVATION MODAL --- */}
            {observationStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setObservationStudent(null)} />
                    <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800">Observação: {observationStudent.name}</h3>
                            <button onClick={() => setObservationStudent(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <textarea
                                autoFocus
                                className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl resize-none text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="Descreva aqui observações importantes sobre o dia do aluno..."
                                value={observationMap[observationStudent.id] || ''}
                                onChange={(e) => setObservationMap(prev => ({ ...prev, [observationStudent.id]: e.target.value }))}
                            />
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
                            <Button onClick={() => setObservationStudent(null)} className="bg-brand-600 text-white w-full">
                                Salvar e Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper Components

const NavItem = ({ icon: Icon, label, badge }: any) => (
    <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-50 transition-all">
        <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-slate-400" />
            <span>{label}</span>
        </div>
        {badge && (
            <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {badge}
            </span>
        )}
    </button>
);

const StatusBadge = ({ status }: { status: string | null }) => {
    if (status === 'present') return <span className="text-[10px] text-brand-600 font-bold uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Presente</span>;
    if (status === 'absent') return <span className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1"><X className="w-3 h-3" /> Falta</span>;
    if (status === 'late') return <span className="text-[10px] text-amber-500 font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Atraso</span>;
    return <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pendente</span>;
};
