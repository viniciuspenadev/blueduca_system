import { type FC } from 'react';
import { Clock, BookOpen, Download, Target, PenTool, CheckCircle2 } from 'lucide-react';
import type { DailyTimelineItem } from '../../types/timeline';
import { BottomSheet } from '../ui/BottomSheet';

interface LessonPlanDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    lesson: DailyTimelineItem | null;
}

export const LessonPlanDrawer: FC<LessonPlanDrawerProps> = ({ isOpen, onClose, lesson }) => {
    // If no lesson, we don't render content but BottomSheet handles open state.

    return (
        <BottomSheet
            isOpen={isOpen}
            onClose={onClose}

        >
            {lesson && (
                <div className="space-y-6 pb-8">
                    {/* Header Card */}
                    <div className="bg-gray-50 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BookOpen className="w-24 h-24 text-brand-600" />
                        </div>

                        <div className="relative z-10">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 shadow-sm">
                                {lesson.type === 'academic' ? 'Acadêmico' :
                                    lesson.type === 'food' ? 'Alimentação' :
                                        lesson.type === 'rest' ? 'Descanso' : 'Atividade'}
                            </span>

                            <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
                                {lesson.title}
                            </h2>

                            <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
                                {(lesson.start_time || lesson.end_time) && (
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-brand-500" />
                                        <span>{lesson.start_time} {lesson.end_time ? `- ${lesson.end_time}` : ''}</span>
                                    </div>
                                )}
                                {lesson.teacher_name && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center text-[10px] font-bold text-brand-700">
                                            {lesson.teacher_name.charAt(0)}
                                        </div>
                                        <span>Prof. {lesson.teacher_name}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Content Sections */}
                    <div className="space-y-5">

                        {/* Topic */}
                        {lesson.topic && (
                            <div className="flex gap-4">
                                <div className="mt-1">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">Tópico da Aula</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">{lesson.topic}</p>
                                </div>
                            </div>
                        )}

                        {/* Objectives - NEW */}
                        {lesson.objective && (
                            <div className="flex gap-4">
                                <div className="mt-1">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                        <Target className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">Objetivos de Aprendizagem</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{lesson.objective}</p>
                                </div>
                            </div>
                        )}

                        {/* Materials - NEW */}
                        {lesson.materials && (
                            <div className="flex gap-4">
                                <div className="mt-1">
                                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                                        <PenTool className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">Materiais Necessários</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{lesson.materials}</p>
                                </div>
                            </div>
                        )}



                        {/* Homework */}
                        {lesson.homework && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mt-2">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    </div>
                                    <h3 className="text-sm font-bold text-amber-900">Lição de Casa</h3>
                                </div>
                                <p className="text-amber-800 text-sm font-medium pl-8">{lesson.homework}</p>
                            </div>
                        )}

                        {/* Attachments */}
                        {lesson.attachments && lesson.attachments.length > 0 && (
                            <div className="pt-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Materiais de Apoio</h3>
                                <div className="space-y-2">
                                    {lesson.attachments.map((file, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => window.open(file.url, '_blank')}
                                            className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-brand-300 hover:shadow-sm transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                                                    <Download className="w-4 h-4 text-gray-400 group-hover:text-brand-600" />
                                                </div>
                                                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 text-left line-clamp-1">
                                                    {file.name || 'Arquivo Anexo'}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </BottomSheet>
    );
};
