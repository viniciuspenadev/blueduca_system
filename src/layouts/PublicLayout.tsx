import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function PublicLayout() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            {/* Header Minimalista */}
            <header className="bg-white border-b border-gray-200 py-4 shadow-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                            <GraduationCap size={20} />
                        </div>
                        <span className="text-xl font-bold text-gray-900 tracking-tight">EscolaV2</span>
                    </div>
                    <a href="/login" className="text-sm text-gray-600 hover:text-blue-600 font-medium transition-colors">
                        Já sou aluno
                    </a>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* Footer Minimalista */}
            <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
                <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
                    <p>&copy; {new Date().getFullYear()} EscolaV2. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    );
}
