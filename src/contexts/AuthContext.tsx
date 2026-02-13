import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../services/supabase';
import type { User, School } from '../types';
import { useToast } from './ToastContext';

import { useNavigate } from 'react-router-dom';

interface AuthContextType {
    user: User | null;
    currentSchool: School | null;
    schools: School[]; // Available schools for this user
    loading: boolean;
    signIn: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    switchSchool: (schoolId: string) => Promise<void>;
    refreshProfile: () => Promise<void>;
    impersonateSchool: (schoolId: string) => Promise<void>;
    stopImpersonation: () => Promise<void>;
    isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [currentSchool, setCurrentSchool] = useState<School | null>(null);
    const [schools, setSchools] = useState<School[]>([]);
    const [memberships, setMemberships] = useState<any[]>([]); // Store raw memberships to recall roles
    const [loading, setLoading] = useState(true);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const { addToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        // Initial Session Check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) updateUser(session);
            else setLoading(false);
        });

        // Listen for Auth Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                updateUser(session);
            } else {
                setUser(null);
                setCurrentSchool(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const updateUser = async (session: any) => {
        try {
            // 0. Global Access Check (Ban/Inactive)
            // We ignore error here to allow new users (who might not have status yet) or handle gracefully
            const { data: status } = await supabase.rpc('check_user_status', { p_user_id: session.user.id });

            if (status && status !== 'ACTIVE') {
                addToast('error', status === 'BANNED' ? 'Esta conta foi banida permanentemente.' : 'Sua conta está desativada. Entre em contato com o suporte.');
                await supabase.auth.signOut();
                setUser(null);
                setCurrentSchool(null);
                setLoading(false);
                return;
            }

            // 1. Fetch Profile
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, name')
                .eq('id', session.user.id)
                .single();

            if (profileError) throw profileError;

            // 2. Fetch User's Memberships (IDs only)
            const { data: userMemberships, error: memberError } = await supabase
                .from('school_members')
                .select('role, school_id')
                .eq('user_id', session.user.id)
                .eq('status', 'ACTIVE'); // Only active memberships

            if (memberError) console.error('Error fetching memberships:', memberError);

            // 3. Fetch Guardian Links (IDs only)
            const { data: guardianLinks } = await supabase
                .from('student_guardians')
                .select('school_id')
                .eq('guardian_id', session.user.id)
                .eq('status', 'ACTIVE'); // Only active guardian links

            // Collect all unique school IDs
            const allSchoolIds = new Set<string>();
            (userMemberships || []).forEach(m => m.school_id && allSchoolIds.add(m.school_id));
            (guardianLinks || []).forEach(l => l.school_id && allSchoolIds.add(l.school_id));

            // 4. Fetch Full School Objects (*)
            let availableSchools: School[] = [];
            if (allSchoolIds.size > 0) {
                const { data: schoolsData, error: schoolsError } = await supabase
                    .from('schools')
                    .select('*')
                    .in('id', Array.from(allSchoolIds));

                if (schoolsError) console.error('Error fetching schools data:', schoolsError);
                availableSchools = schoolsData || [];
            }

            setSchools(availableSchools);
            setMemberships(userMemberships || []);

            // Determine Active School
            let activeSchool = availableSchools.length > 0 ? availableSchools[0] : null;

            // Try to restore last session if valid
            const savedSchoolId = localStorage.getItem('last_school_id');
            const impersonatedId = localStorage.getItem('impersonating_school_id');

            // Restore Impersonation
            if (impersonatedId && profile.role === 'SUPER_ADMIN') {
                try {
                    const { data: impSchool } = await supabase
                        .from('schools')
                        .select('*')
                        .eq('id', impersonatedId)
                        .single();

                    if (impSchool) {
                        activeSchool = impSchool;
                        setIsImpersonating(true);
                    }
                } catch (e) {
                    console.error('Failed to restore impersonation', e);
                    localStorage.removeItem('impersonating_school_id');
                }
            }
            else if (savedSchoolId) {
                // Verify if the saved school is still in the allowed list
                const saved = availableSchools.find(s => s.id === savedSchoolId);
                if (saved) activeSchool = saved;
            }

            // Find role for the active school
            const memberRecord = (userMemberships || []).find((m: any) => m.school_id === activeSchool?.id);
            const activeRole = memberRecord?.role || (activeSchool ? 'PARENT' : profile?.role || 'PARENT');

            // Define User
            setUser({
                id: session.user.id,
                email: session.user.email!,
                name: profile?.name || session.user.user_metadata?.name || 'Usuário',
                role: activeRole as any
            });

            // Set Current School Context
            if (activeSchool) {
                // Fetch effective config (Plan + Overrides)
                const { data: effectiveConfig } = await supabase.rpc('get_effective_school_config', {
                    p_school_id: activeSchool.id
                });

                const schoolWithConfig = {
                    ...activeSchool,
                    config_modules: effectiveConfig?.modules || activeSchool.config_modules,
                    config_limits: effectiveConfig?.limits || activeSchool.config_limits
                };

                setCurrentSchool(schoolWithConfig);
                localStorage.setItem('last_school_id', activeSchool.id);
            } else {
                // If user is not SUPER_ADMIN and has no schools, warn them and signOut
                if (availableSchools.length === 0 && activeRole !== 'SUPER_ADMIN' && profile?.role !== 'SUPER_ADMIN') {
                    addToast('error', 'Acesso negado: Nenhuma escola ativa vinculada à sua conta.');
                    await supabase.auth.signOut();
                    setUser(null);
                    setCurrentSchool(null);
                    setLoading(false);
                    return;
                }
                setCurrentSchool(null);
            }

        } catch (error) {
            console.error('Error fetching auth context:', error);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Error signing out:', error);
        } catch (error) {
            console.error('Unexpected error signing out:', error);
        } finally {
            setUser(null);
            setCurrentSchool(null);
            localStorage.clear(); // Wipe clean
        }
    };

    const signIn = async (_email: string) => {
        // Placeholder
    }

    const refreshProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await updateUser(session);
    };

    const switchSchool = async (schoolId: string) => {
        const targetSchool = schools.find(s => s.id === schoolId);
        if (targetSchool) {
            // Find role for this school
            const memberRecord = memberships.find(m => m.school?.id === schoolId);
            const activeRole = memberRecord?.role || 'PARENT';

            // Fetch effective config (Plan + Overrides)
            const { data: effectiveConfig } = await supabase.rpc('get_effective_school_config', {
                p_school_id: targetSchool.id
            });

            const schoolWithConfig = {
                ...targetSchool,
                config_modules: effectiveConfig?.modules || targetSchool.config_modules,
                config_limits: effectiveConfig?.limits || targetSchool.config_limits
            };

            setCurrentSchool(schoolWithConfig);
            localStorage.setItem('last_school_id', targetSchool.id);

            // Update User Role Immediately
            if (user) {
                setUser({
                    ...user,
                    role: activeRole
                });
            }

            // Optional: Reload page to ensure all components re-mount with clean state?
            // For now, React State update should suffice for most things.
            // window.location.reload(); 
        }
    };

    const impersonateSchool = async (schoolId: string) => {
        if (user?.role !== 'SUPER_ADMIN') {
            addToast('error', 'Apenas Super Admins podem acessar outras escolas.');
            return;
        }

        try {
            setLoading(true);
            const { data: targetSchool, error } = await supabase
                .from('schools')
                .select('*')
                .eq('id', schoolId)
                .single();

            if (error || !targetSchool) throw new Error('Escola não encontrada ou acesso negado.');

            const { data: effectiveConfig } = await supabase.rpc('get_effective_school_config', {
                p_school_id: targetSchool.id
            });

            const schoolWithConfig = {
                ...targetSchool,
                config_modules: effectiveConfig?.modules || targetSchool.config_modules,
                config_limits: effectiveConfig?.limits || targetSchool.config_limits
            };

            setCurrentSchool(schoolWithConfig);
            setIsImpersonating(true);
            localStorage.setItem('impersonating_school_id', schoolId);
            addToast('success', `Acessando ${targetSchool.name} como Super Admin`);
            navigate('/dashboard');

        } catch (err) {
            console.error(err);
            addToast('error', 'Falha ao acessar escola.');
        } finally {
            setLoading(false);
        }
    }

    const stopImpersonation = async () => {
        localStorage.removeItem('impersonating_school_id');
        setIsImpersonating(false);
        await refreshProfile();
        addToast('info', 'Modo de acesso encerrado.');
        navigate('/sys/admin'); // Added redirect
    }

    return (
        <AuthContext.Provider value={{ user, currentSchool, schools, loading, isImpersonating, signIn, signOut, switchSchool, refreshProfile, impersonateSchool, stopImpersonation }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

