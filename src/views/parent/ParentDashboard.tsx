import { type FC, useEffect, useState } from 'react';
import {
    CreditCard, AlertCircle, CheckCircle2,
    Utensils, Moon, Smile, Baby, Clock, MessageCircle, User, LogOut
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useStudent } from '../../contexts/StudentContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useNavigate } from 'react-router-dom';
import { planningService } from '../../services/planningService';
import { DailyTimelineComponent } from '../../components/parent/DailyTimeline';
import { useAppSettings } from '../../hooks/useAppSettings';
import { motion, AnimatePresence } from 'framer-motion';
import { useUnreadCommunications } from '../../hooks/useUnreadCommunications';
import { usePlan } from '../../hooks/usePlan';

interface DashboardData {
    studentProfile: {
        name: string;
        photo_url?: string;
        class_name?: string;
    };
    smartBanner: {
        type: 'finance-overdue' | 'event-today' | 'finance-warning' | 'mural-highlight' | 'empty';
        title: string;
        message: string;
        actionLabel?: string;
        actionLink?: string;
        imageUrl?: string;
        data?: any;
    };
    dailyHighlights: {
        hasData: boolean;
        food: string;
        sleep: string;
        mood: string;
        bathroom: string;
    };
    feed: FeedItem[];
    todaysClasses?: any[];
    isTomorrowMode?: boolean;
}

interface FeedItem {
    id: string;
    type: 'grade' | 'attendance' | 'event' | 'finance' | 'diary' | 'notice' | 'alert';
    title: string;
    today: boolean;
    isClassSpecific: boolean;
    date: Date;
    description?: string;
    value?: string;
    status?: 'good' | 'bad' | 'neutral' | 'info';
    is_pinned?: boolean;
    location?: string;
}

// Global cache for Dashboard to prevent reload flashes
let cachedDashboardData: any = null;

export const ParentDashboard: FC = () => {
    const { user } = useAuth();
    const { selectedStudent } = useStudent();
    const navigate = useNavigate();
    const { value: timelineMode } = useAppSettings('daily_timeline_display_mode', 'card');
    const { hasModule } = usePlan();
    const { unreadCount } = useUnreadCommunications();
    const { value: releaseTime } = useAppSettings('diary_release_time', '17:00');

    const initialData = cachedDashboardData || {
        studentProfile: { name: '' },
        smartBanner: { type: 'empty', title: '', message: '' },
        smartBanners: [],
        dailyHighlights: { hasData: false, food: '-', sleep: '-', mood: '-', bathroom: '-' },
        feed: []
    };

    const [loading, setLoading] = useState(!cachedDashboardData);
    const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
    const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
    const [data, setData] = useState<DashboardData & { smartBanners: any[] }>(initialData);
    const [pendingFinanceCount, setPendingFinanceCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        if (!selectedStudent) {
            setLoading(false);
            return;
        }
        fetchDashboardData();
    }, [user, selectedStudent]);

    // Carousel Auto-Rotation 
    useEffect(() => {
        const relevantBanners = data.smartBanners.filter(b => b.type === 'mural-highlight' || b.type === 'event-today');
        if (relevantBanners.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentBannerIndex(prev => (prev + 1) % relevantBanners.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [data.smartBanners]);

    const fetchDashboardData = async () => {
        if (!selectedStudent) {
            setLoading(false);
            return;
        }

        try {
            if (!cachedDashboardData) {
                setLoading(true);
            }

            const studentId = selectedStudent.id;
            // 2. Smart Banner Logic (Collection)
            const banners: any[] = [];

            // Check Overdue Finance (Priority 1) - GLOBAL CHECK (All Years)
            // First, get ALL enrollment IDs for this student to check past debts too
            const { data: allEnrollments } = await supabase
                .from('enrollments')
                .select('id')
                .eq('student_id', studentId);

            const allEnrollmentIds = allEnrollments?.map(e => e.id) || [selectedStudent.enrollment_id];


            const todayStr = format(new Date(), 'yyyy-MM-dd');

            // Fetch ALL pending installments that are older than today
            const { data: overdue } = await supabase
                .from('installments')
                .select('*')
                .in('enrollment_id', allEnrollmentIds)
                .eq('status', 'pending') // Items are still marked as pending in DB
                .lt('due_date', todayStr) // But due date is in the past
                .order('due_date', { ascending: true }) // Oldest debt first
                .limit(1);

            if (overdue && overdue.length > 0) {
                banners.push({
                    type: 'finance-overdue',
                    title: 'Mensalidade em Atraso',
                    message: `Fatura de R$ ${overdue[0].value} venceu em ${format(new Date(overdue[0].due_date + 'T12:00:00'), 'dd/MM/yyyy')}.`,
                    actionLabel: 'Pagar Agora',
                    actionLink: '/pais/financeiro'
                });
            }

            // Check Events Today (Priority 2)
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const { data: eventsToday } = await supabase
                .from('events')
                .select('*')
                .gte('start_time', startOfDay.toISOString())
                .lte('start_time', endOfDay.toISOString())
                .limit(1);

            if (eventsToday && eventsToday.length > 0) {
                banners.push({
                    type: 'event-today',
                    title: eventsToday[0].title, // Show Event Title as main Title
                    message: eventsToday[0].location ? `Local: ${eventsToday[0].location}` : 'Confira os detalhes na agenda.', // Show details as message
                    actionLabel: 'Ver Agenda',
                    actionLink: '/pais/agenda',
                    data: eventsToday[0]
                });
            }

            // Check Upcoming Bills (Priority 3)
            const { data: upcoming } = await supabase
                .from('installments')
                .select('*')
                .eq('enrollment_id', selectedStudent.enrollment_id)
                .eq('status', 'pending')
                .order('due_date', { ascending: true })
                .limit(1);

            if (upcoming && upcoming.length > 0) {
                // Get start of today (local time)
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                // Get due date (already YYYY-MM-DD)
                const dueDate = new Date(upcoming[0].due_date + 'T12:00:00');
                dueDate.setHours(0, 0, 0, 0);

                // Calculate difference in days
                const diffTime = dueDate.getTime() - today.getTime();
                const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (days <= 5 && days >= 0) {
                    let title = 'Fatura Próxima';
                    let message = `Vence em ${days} dia${days !== 1 ? 's' : ''}`;

                    if (days === 0) {
                        title = 'Vencimento Hoje ⏳';
                        message = 'Sua fatura vence hoje. Evite multas e juros!';
                    } else if (days === 1) {
                        title = 'Vencimento Amanhã';
                        message = 'Lembrete: sua fatura vence amanhã.';
                    }

                    banners.push({
                        type: 'finance-warning',
                        title: title,
                        message: message,
                        actionLabel: 'Ver Fatura',
                        actionLink: '/pais/financeiro',
                        isDueToday: days === 0 // Adicionando flag para estilo
                    });
                }
            }

            // Fetch Pending Finance Count for Badge
            // Logic: Only due today or overdue
            const { count: pendingCount } = await supabase
                .from('installments')
                .select('*', { count: 'exact', head: true })
                .in('enrollment_id', allEnrollmentIds)
                .in('status', ['pending', 'overdue'])
                .lte('due_date', todayStr)
                .eq('is_published', true);

            setPendingFinanceCount(pendingCount || 0);



            // 2.5 Mural Highlights (New!) 🎨
            const { data: muralHighlights } = await supabase
                .from('events')
                .select('*')
                .eq('show_on_mural', true)
                .order('start_time', { ascending: false }) // Show newest/future first, or maybe by creation? Let's use start_time desc (Newest events)
                .limit(5); // Limit to 5 items to not flood carousel

            if (muralHighlights) {
                muralHighlights.forEach(h => {
                    banners.push({
                        type: 'mural-highlight',
                        title: h.title,
                        message: h.description || '',
                        imageUrl: h.image_url,
                        actionLabel: 'Ver Detalhes',
                        actionLink: `/pais/mural/${h.id}`,
                        data: h
                    });
                });
            }

            // Fallback empty banner if none found (optional: or just show nothing? UI seems to expect one)
            // Existing logic had 'empty' type.
            // If empty, we can just leave array empty and not render banner section.

            // 3. Daily Highlights (Today's Diary)
            // todayStr is already defined above
            const { data: todayDiary } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('student_id', studentId)
                .eq('date', todayStr)
                .maybeSingle();

            const dailyHighlights = {
                hasData: !!todayDiary,
                food: 'Sem dados',
                sleep: 'Sem dados',
                mood: 'Sem dados',
                bathroom: 'Sem dados'
            };

            if (todayDiary && todayDiary.routine_data) {
                const r = todayDiary.routine_data as any;

                // Parse mood
                dailyHighlights.mood = r.mood || 'Sem dados';

                // Parse meals (lunch or snack)
                if (r.meals) {
                    const breakfast = r.meals.breakfast || '';
                    const lunch = r.meals.lunch || '';
                    const snack = r.meals.snack || '';
                    dailyHighlights.food = breakfast || lunch || snack || 'Sem dados';
                }

                // Parse sleep (nap)
                if (r.sleep && r.sleep.nap) {
                    dailyHighlights.sleep = r.sleep.nap;
                }

                // Parse hygiene as bathroom indicator
                if (r.hygiene) {
                    dailyHighlights.bathroom = typeof r.hygiene === 'object' ? r.hygiene.status : r.hygiene;
                }
                if (!dailyHighlights.bathroom) dailyHighlights.bathroom = 'Sem dados';
            }

            // 3.5 Schedules Today (or Next School Day) - SMART LOGIC 🧠
            const now = new Date();
            const currentHour = now.getHours();
            const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)

            let targetDate = new Date(now);
            let isTomorrow = false;

            // Logic:
            // - If Weekday evening (> 13:00? No, let's say > 14:00 to catch afternoon shift end) -> Show Next Day
            // - If Friday afternoon -> Show Monday
            // - If Sat/Sun -> Show Monday

            if (currentDay === 6) { // Saturday
                targetDate.setDate(now.getDate() + 2); // -> Monday
                isTomorrow = true;
            } else if (currentDay === 0) { // Sunday
                targetDate.setDate(now.getDate() + 1); // -> Monday
                isTomorrow = true;
            } else if (currentDay === 5 && currentHour >= 13) { // Friday Afternoon
                targetDate.setDate(now.getDate() + 3); // -> Monday
                isTomorrow = true;
            } else if (currentHour >= 13) { // Mon-Thu Afternoon
                targetDate.setDate(now.getDate() + 1); // -> Next Day
                isTomorrow = true;
            }


            const targetYear = selectedStudent?.academic_year || new Date().getFullYear();

            // Get class (Active + Target Year)
            const { data: classRel } = await supabase
                .from('class_enrollments')
                .select('class_id, class:classes!inner(status, school_year)')
                .eq('student_id', studentId)
                .eq('class.status', 'active')
                .eq('class.school_year', targetYear)
                .limit(1)
                .maybeSingle();

            if (classRel) {
                // Use Planning Service to get REAL lesson plans
                // We will fetch this later in step 4 to avoid variable coloring issues
            }

            // 4. Mural Feed (Events + Notices) 📌
            // Logic: Pinned first, then by date (Newest Notices OR Closest Events)
            // For simplicity in MVP: Fetch all valid events/notices for this student
            const { data: muralEvents } = await supabase
                .from('events')
                .select('*')
                // Filter: Global OR Student's Class
                .or(`class_id.is.null,class_id.eq.${classRel?.class_id}`)
                .or(`is_pinned.eq.true,start_time.gte.${format(new Date(), 'yyyy-MM-dd')}T00:00:00`)
                .order('is_pinned', { ascending: false })
                .order('start_time', { ascending: true })
                .limit(20);

            const feed: FeedItem[] = (muralEvents || []).map(event => {
                const date = new Date(event.start_time);
                return {
                    id: event.id,
                    type: event.category === 'notice' || event.category === 'alert' ? event.category : 'event',
                    title: event.title,
                    description: event.description,
                    date: date,
                    today: new Date().toDateString() === date.toDateString(),
                    isClassSpecific: !!event.class_id,
                    is_pinned: event.is_pinned,
                    location: event.location,
                    eventType: event.type // pass the specific type (academic, etc)
                };
            });



            // 4. Today's Lesson Plans (For Timeline Widget)
            let todaysClasses: any[] = [];

            // Get current class enrollment first
            const { data: enrollment } = await supabase
                .from('class_enrollments')
                .select('class_id')
                .eq('student_id', selectedStudent.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (enrollment) {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                todaysClasses = await planningService.getLessonPlans(enrollment.class_id, todayStr, todayStr);
            }

            const payload = {
                studentProfile: {
                    name: selectedStudent.name,
                    photo_url: selectedStudent.photo_url,
                    class_name: selectedStudent.class_name
                },
                smartBanner: banners[0] || { type: 'empty' },
                smartBanners: banners,
                dailyHighlights,
                todaysClasses,
                isTomorrowMode: isTomorrow,
                feed
            };

            setData(payload);
            cachedDashboardData = payload; // Update Cache

        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div></div>;
    }




    // const activeBanner = data.smartBanners.length > 0 ? data.smartBanners[currentBannerIndex] : null;

    return (
        <div className="space-y-6 pb-24 md:pb-0">

            {/* 1. Finance / Critical Alerts (Global Full Width) 🚨 */}
            <AnimatePresence mode="popLayout">
                {(() => {
                    const alert = data.smartBanners.find(b =>
                        hasModule('finance') &&
                        (b.type === 'finance-overdue' || b.type === 'finance-warning') &&
                        !dismissedAlerts.includes(b.type + b.title)
                    );

                    if (!alert) return null;
                    const isOverdue = alert.type === 'finance-overdue';

                    return (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`
                            bg-gradient-to-r rounded-xl p-4 shadow-lg text-white text-white flex items-center justify-between relative group mb-4 overflow-hidden
                            ${isOverdue ? 'from-red-600 to-red-800' :
                                    (alert as any).isDueToday ? 'from-amber-500 to-amber-600' : 'from-brand-600 to-brand-800'}
                        `}
                        >
                            {/* Dismiss Button */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    setDismissedAlerts(prev => [...prev, alert.type + alert.title]);
                                }}
                                className="absolute -top-2 -right-2 p-1 rounded-full shadow-sm bg-white text-gray-400 hover:text-red-500 z-10 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                                    <AlertCircle className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-white">
                                        {alert.title}
                                    </h4>
                                    <p className="text-xs text-white/90">
                                        {alert.message}
                                    </p>
                                </div>
                            </div>
                            {alert.actionLink && (
                                <button
                                    onClick={() => navigate(alert.actionLink!)}
                                    className="bg-white text-brand-900 text-xs font-bold px-4 py-2 rounded-lg shadow-sm hover:bg-white/90 active:scale-95 transition-transform whitespace-nowrap ml-2"
                                    style={{ color: isOverdue ? '#dc2626' : '#4f46e5' }}
                                >
                                    {alert.actionLabel || 'Resolver'}
                                </button>
                            )}
                        </motion.div>
                    );
                })()}
            </AnimatePresence>

            {/* MAIN GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                {/* LEFT COLUMN (Content Stream) */}
                <div className="md:col-span-8 space-y-6">




                    {/* 2. Mural / Highlights Carousel */}
                    {(() => {
                        const relevantBanners = data.smartBanners.filter(b => b.type === 'mural-highlight' || b.type === 'event-today');
                        if (relevantBanners.length === 0) return null;

                        const banner = relevantBanners[currentBannerIndex];

                        return (
                            <div className="relative h-[200px] md:h-[320px] w-full rounded-3xl overflow-hidden shadow-lg group">
                                <AnimatePresence mode='wait'>
                                    <motion.div
                                        key={currentBannerIndex}
                                        initial={{ opacity: 0, scale: 1.05 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        onClick={() => banner.actionLink && navigate(banner.actionLink)}
                                        className="absolute inset-0 cursor-pointer"
                                    >
                                        <img
                                            src={banner.imageUrl || 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?q=80&w=1000&auto=format&fit=crop'}
                                            alt={banner.title}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                        {/* Content */}
                                        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`
                                                    text-[10px] md:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg backdrop-blur-xl border border-white/20 shadow-sm
                                                    ${banner.type === 'event-today' ? 'bg-purple-500/90 text-white' : 'bg-brand-500/90 text-white'}
                                                `}>
                                                    {banner.type === 'event-today' ? 'HOJE' : 'DESTAQUE'}
                                                </span>
                                            </div>
                                            <h4 className="text-xl md:text-3xl font-bold text-white leading-tight mb-2 drop-shadow-md max-w-2xl">{banner.title}</h4>
                                            <p className="text-sm md:text-base font-medium text-gray-200 line-clamp-1 md:line-clamp-2 opacity-90 max-w-xl">{banner.message}</p>
                                        </div>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Dots Indicator */}
                                {relevantBanners.length > 1 && (
                                    <div className="absolute bottom-3 right-4 md:bottom-6 md:right-8 flex gap-1.5 z-10">
                                        {relevantBanners.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`
                                                    w-1.5 h-1.5 rounded-full transition-all duration-300 
                                                    ${idx === currentBannerIndex ? 'bg-white w-3 md:w-4' : 'bg-white/40'}
                                                `}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* 3. Daily Highlight or Timeline (Desktop: Horizontal Timeline) */}
                    {hasModule('academic') && (
                        <div className="flex flex-col gap-2">
                            {/* Header for Desktop */}
                            <div className="hidden md:flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-gray-900">Agenda do Dia</h3>
                                <button onClick={() => navigate('/pais/agenda')} className="text-sm text-brand-600 font-medium hover:underline">Ver completa</button>
                            </div>

                            {selectedStudent && timelineMode !== 'disabled' && (
                                <DailyTimelineComponent
                                    enrollmentId={selectedStudent.enrollment_id}
                                    externalItems={(data?.todaysClasses || []).map((cls: any) => ({
                                        id: cls.id,
                                        timeline_id: 'external',
                                        title: cls.subject?.name || 'Aula',
                                        description: cls.notes || '', // Use notes for description field
                                        start_time: cls.start_time?.slice(0, 5),
                                        end_time: cls.end_time?.slice(0, 5),
                                        order_index: 0, // Sort handled in component
                                        type: 'academic',
                                        topic: cls.topic,
                                        objective: cls.objective,
                                        materials: cls.materials,
                                        homework: cls.homework,
                                        teacher_name: cls.teacher?.name, // If available
                                        attachments: cls.attachments || [] // If available
                                    }))}
                                />
                            )}
                        </div>
                    )}

                    {/* Quick Actions (Moved Below Routine) ⚡ */}
                    <div>
                        <div className="grid grid-cols-4 gap-3">
                            {[
                                { label: 'Cronograma', icon: Clock, link: '/pais/cronograma', color: 'text-brand-600', bg: 'bg-brand-50', disabled: !hasModule('academic') },
                                { label: 'Mensagens', icon: MessageCircle, link: '/pais/comunicados', badge: unreadCount, color: 'text-brand-600', bg: 'bg-brand-50', disabled: !hasModule('communications') },
                                { label: 'Financeiro', icon: CreditCard, link: '/pais/financeiro', badge: pendingFinanceCount, color: 'text-brand-600', bg: 'bg-brand-50', disabled: !hasModule('finance') },
                                { label: 'Menu', icon: Utensils, link: '/pais/menu', color: 'text-brand-600', bg: 'bg-brand-50', iconComponent: (props: any) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg> },
                            ].map((item: any, idx) => (
                                <motion.button
                                    key={idx}
                                    onClick={() => !item.disabled && item.link && navigate(item.link)}
                                    whileTap={!item.disabled ? { scale: 0.95 } : {}}
                                    disabled={item.disabled}
                                    className={`flex flex-col items-center gap-2 group relative ${item.disabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                >
                                    <div className={`
                                            w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-lg ${item.bg} ${item.color}
                                            flex items-center justify-center shadow-sm border border-black/5
                                            transition-transform relative
                                        `}>
                                        {item.iconComponent ? <item.iconComponent className="w-6 h-6 md:w-7 md:h-7" /> : <item.icon className="w-6 h-6 md:w-7 md:h-7" />}
                                        {!!item.badge && item.badge > 0 && !item.disabled && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
                                                {item.badge}
                                            </span>
                                        )}
                                        {item.disabled && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 rounded-2xl md:rounded-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs md:text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{item.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Daily Summary (Widget) - Moved HERE below Agenda */}
                    <div className="mt-4">
                        {(() => {
                            const now = new Date();
                            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                            const isDiaryLocked = currentTime < releaseTime;

                            if (!hasModule('academic') || isDiaryLocked) return null;

                            if (data.dailyHighlights.hasData) {
                                return (
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 my-1">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                                <Baby className="w-4 h-4 text-brand-500" />
                                                Resumo do Dia
                                            </h3>
                                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">Atualizado</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            {[
                                                { label: data.dailyHighlights.food, icon: Utensils, bg: 'bg-orange-50', text: 'text-orange-500' },
                                                { label: data.dailyHighlights.sleep, icon: Moon, bg: 'bg-indigo-50', text: 'text-indigo-500' },
                                                { label: data.dailyHighlights.mood, icon: Smile, bg: 'bg-yellow-50', text: 'text-yellow-500' },
                                                { label: data.dailyHighlights.bathroom, icon: CheckCircle2, bg: 'bg-blue-50', text: 'text-blue-500' },
                                            ].map((item, idx) => (
                                                <div key={idx} className={`${item.bg} p-3 rounded-xl flex flex-col items-center justify-center gap-1`}>
                                                    <item.icon className={`w-5 h-5 ${item.text}`} />
                                                    <span className="text-xs font-medium text-gray-600 leading-tight">{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>

                    {/* FEED SECTION */}
                    {hasModule('communications') && (
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h3 className="text-lg font-bold text-gray-900">Mural & Atualizações</h3>
                                {data.feed.length > 0 && (
                                    <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-full">
                                        {data.feed.length} novas
                                    </span>
                                )}
                            </div>

                            <div className="space-y-3">
                                {data.feed.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`
                                        relative bg-white p-4 md:p-5 rounded-xl border shadow-sm hover:shadow-md transition-shadow
                                        ${item.is_pinned ? 'bg-brand-50/30 border-brand-100' : 'border-gray-100'}
                                    `}
                                    >
                                        {/* ... Existing Feed Item Content ... */}
                                        {/* Re-using exact same content structure but slightly adjusted padding above */}

                                        {item.is_pinned && (
                                            <div className="absolute -top-1 -right-1 bg-brand-500 text-white p-0.5 rounded-full shadow-sm z-10">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 3H16.1L18.1 5L18 5L16 3ZM5 21V19H7.09L15.09 11H12.5V8.41L5 15.91V21H5Z" /></svg>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-4">
                                            {/* Date Box */}
                                            <div className={`
                                            w-12 h-12 md:w-14 md:h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border mt-0.5
                                            ${item.type === 'notice' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                    item.type === 'alert' ? 'bg-red-50 border-red-100 text-red-600' :
                                                        'bg-brand-50 border-brand-100 text-brand-600'}
                                        `}>
                                                <span className="text-[10px] md:text-xs uppercase font-bold leading-none mb-0.5">{format(item.date, 'MMM', { locale: ptBR })}</span>
                                                <span className="text-lg md:text-xl font-bold leading-none">{format(item.date, 'dd')}</span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    {/* Badges ... same as before */}
                                                    {item.isClassSpecific && <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 uppercase tracking-wide">Turma</span>}
                                                    {item.today && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wide">Hoje</span>}
                                                    {item.type === 'alert' && <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wide">Importante</span>}
                                                    {item.type === 'event' && (item as any).eventType && (
                                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                                                            {(item as any).eventType === 'academic' ? 'Acadêmico' : (item as any).eventType === 'holiday' ? 'Feriado' : (item as any).eventType === 'meeting' ? 'Reunião' : 'Geral'}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className={`text-sm md:text-base font-bold leading-snug truncate ${item.is_pinned ? 'text-brand-900' : 'text-gray-900'}`}>{item.title}</h4>
                                                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{item.type === 'event' ? format(item.date, 'HH:mm') : ''}</span>
                                                </div>

                                                <p className="text-xs md:text-sm text-gray-600 line-clamp-2 leading-relaxed">{item.description}</p>
                                                {item.location && (
                                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                                        {item.location}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {data.feed.length === 0 && (
                                    <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                        <Baby className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500 font-medium text-sm">Nenhum aviso ou evento próximo.</p>
                                        <button onClick={() => navigate('/pais/agenda')} className="text-xs text-brand-600 font-bold hover:underline mt-2">
                                            Ver calendário completo
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN (Widgets & Context) */}
                <div className="md:col-span-4 space-y-6">

                    {/* Student Mini Profile (Desktop Exclusive Visuals) */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hidden md:block">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border-2 border-brand-100">
                                {data.studentProfile.photo_url ? (
                                    <img src={data.studentProfile.photo_url} className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-8 h-8 text-gray-300 m-auto mt-4" />
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">{data.studentProfile.name}</h3>
                                <p className="text-sm text-gray-500">{data.studentProfile.class_name}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="flex items-center justify-center gap-2 p-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-100 transition-colors">
                                <User size={16} /> Perfil
                            </button>
                            <button className="flex items-center justify-center gap-2 p-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors">
                                <LogOut size={16} /> Sair
                            </button>
                        </div>
                    </div>

                    {/* Quick Actions (Grid) */}




                </div>
            </div>
        </div>
    );
};
