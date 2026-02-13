import { type FC, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import {
    CheckCircle2,
    Circle,
    Building2,
    Calendar,
    BookOpen,
    FileText,
    CreditCard,
    Users,
    ArrowRight,
    Rocket
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Progress, Modal } from './ui';

interface OnboardingStep {
    id: string;
    label: string;
    description: string;
    icon: any;
    link: string;
    completed: boolean;
    cta: string;
}

export const SchoolOnboardingProgress: FC = () => {
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [progress, setProgress] = useState(0);
    const [steps, setSteps] = useState<OnboardingStep[]>([
        {
            id: 'identity',
            label: 'Identidade da Escola',
            description: 'Nome, logo e endereço.',
            icon: Building2,
            link: '/config/hub?tab=school',
            completed: false,
            cta: 'Configurar'
        },
        {
            id: 'year',
            label: 'Ano Letivo',
            description: 'Crie o ano letivo vigente.',
            icon: Calendar,
            link: '/config/hub?tab=academic&sub=years',
            completed: false,
            cta: 'Criar'
        },
        {
            id: 'subjects',
            label: 'Matérias',
            description: 'Cadastre as disciplinas.',
            icon: BookOpen,
            link: '/config/hub?tab=academic&sub=subjects',
            completed: false,
            cta: 'Cadastrar'
        },
        {
            id: 'docs',
            label: 'Documentos',
            description: 'Template de matrícula.',
            icon: FileText,
            link: '/config/hub?tab=academic',
            completed: false,
            cta: 'Revisar'
        },
        {
            id: 'plans',
            label: 'Planos',
            description: 'Mensalidades e preços.',
            icon: CreditCard,
            link: '/financeiro/planos',
            completed: false,
            cta: 'Criar'
        },
        {
            id: 'classes',
            label: 'Turmas',
            description: 'Salas de aula.',
            icon: Users,
            link: '/turmas',
            completed: false,
            cta: 'Criar'
        }
    ]);

    useEffect(() => {
        if (currentSchool) {
            checkProgress();
        }
    }, [currentSchool]);

    const checkProgress = async () => {
        try {
            if (!currentSchool) return;

            // 1. Check Identity (school_info)
            const { data: infoData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('school_id', currentSchool.id)
                .eq('key', 'school_info')
                .maybeSingle();
            const hasIdentity = !!infoData?.value;

            // 2. Check Years
            const { count: yearsCount } = await supabase
                .from('school_years')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentSchool.id);

            // 3. Check Subjects
            const { count: subjectsCount } = await supabase
                .from('subjects')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentSchool.id);

            // 4. Check Docs Template
            const { data: docsData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('school_id', currentSchool.id)
                .eq('key', 'enrollment_docs_template')
                .maybeSingle();
            const hasDocs = !!docsData;

            // 5. Check Financial Plans
            const { count: plansCount } = await supabase
                .from('financial_plans')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentSchool.id);

            // 6. Check Classes
            const { count: classesCount } = await supabase
                .from('classes')
                .select('*', { count: 'exact', head: true })
                .eq('school_id', currentSchool.id);

            // Update Steps
            const newSteps = steps.map(step => {
                let isComplete = false;
                switch (step.id) {
                    case 'identity': isComplete = hasIdentity; break;
                    case 'year': isComplete = (yearsCount || 0) > 0; break;
                    case 'subjects': isComplete = (subjectsCount || 0) > 0; break;
                    case 'docs': isComplete = hasDocs; break;
                    case 'plans': isComplete = (plansCount || 0) > 0; break;
                    case 'classes': isComplete = (classesCount || 0) > 0; break;
                }
                return { ...step, completed: isComplete };
            });

            setSteps(newSteps);

            const completedCount = newSteps.filter(s => s.completed).length;
            const progressPercent = Math.round((completedCount / newSteps.length) * 100);
            setProgress(progressPercent);

            // Open modal if not complete
            if (progressPercent < 100) {
                // Check snooze
                const snoozeKey = `onboarding_snooze_${currentSchool.id}`;
                const snoozed = localStorage.getItem(snoozeKey);

                if (snoozed) {
                    const snoozeTime = parseInt(snoozed);
                    const now = Date.now();
                    // Snooze for 1 hour (3600000 ms)
                    if (now - snoozeTime < 3600000) {
                        return;
                    }
                }

                setIsOpen(true);
            }

        } catch (error) {
            console.error('Error checking onboarding progress:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = () => {
        setIsOpen(false);
        // Set snooze ONLY when manually dismissed/closed without action
        if (currentSchool?.id) {
            localStorage.setItem(`onboarding_snooze_${currentSchool.id}`, Date.now().toString());
        }
    };

    const handleAction = () => {
        setIsOpen(false);
        // Do NOT snooze if taking action - we want users to see progress when they return
    };

    if (loading || progress === 100) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleDismiss}
            title="Vamos configurar sua escola"
            size="lg"
        >
            <div className="space-y-6">

                <div className="flex items-center gap-4 bg-brand-50 p-4 rounded-xl border border-brand-100">
                    <div className="bg-brand-100 p-3 rounded-full">
                        <Rocket className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-brand-900">Configuração Inicial</h3>
                        <p className="text-sm text-brand-700">Complete as etapas abaixo para liberar todos os recursos do sistema.</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div>
                    <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
                        <span>Progresso Geral</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto p-1">
                    {steps.map((step) => {
                        const Icon = step.icon;
                        return (
                            <div
                                key={step.id}
                                className={`p-4 rounded-xl border transition-all ${step.completed
                                    ? 'bg-gray-50 border-gray-100 opacity-60'
                                    : 'bg-white border-brand-200 shadow-sm ring-1 ring-brand-100'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`p-2 rounded-lg ${step.completed ? 'bg-green-100 text-green-600' : 'bg-brand-50 text-brand-600'}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    {step.completed ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-300" />
                                    )}
                                </div>

                                <h3 className={`font-bold text-sm mb-1 ${step.completed ? 'text-gray-700' : 'text-gray-900'}`}>
                                    {step.label}
                                </h3>
                                <p className="text-xs text-gray-500 mb-3 h-8 line-clamp-2 leading-relaxed">
                                    {step.description}
                                </p>

                                {step.completed ? (
                                    <div className="flex items-center text-xs font-medium text-green-600 bg-green-50 py-1.5 px-3 rounded-lg justify-center">
                                        <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                        Feito
                                    </div>
                                ) : (
                                    <Link to={step.link} onClick={handleAction}>
                                        <Button size="sm" className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs h-8">
                                            {step.cta} <ArrowRight className="w-3 h-3 ml-1.5" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 text-xs">
                        Configurar mais tarde
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
