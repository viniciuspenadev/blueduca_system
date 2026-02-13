import React from 'react';
import type { CommunicationChannel } from '../../types';
import CommunicationCard from './CommunicationCard';
import { Wifi, Battery, Signal } from 'lucide-react';

interface PhonePreviewProps {
    channel?: CommunicationChannel;
    title: string;
    content: string;
    isSchoolWide: boolean;
}

export const PhonePreview: React.FC<PhonePreviewProps> = ({
    channel,
    title,
    content,
}) => {
    // Mock a recipient object for the card
    const mockRecipient: any = {
        id: 'preview',
        read_at: null,
        communication: {
            id: 'preview',
            title: title || 'Título do Comunicado',
            preview_text: content || 'O texto do comunicado aparecerá aqui...',
            created_at: new Date().toISOString(),
            channel: channel || {
                name: 'Exemplo',
                icon_name: 'message-square',
                color: 'blue'
            },
            priority: 1
        }
    };

    return (
        <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
            <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute z-20"></div>
            <div className="h-[32px] w-[3px] bg-gray-800 absolute -start-[17px] top-[72px] rounded-s-lg"></div>
            <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[124px] rounded-s-lg"></div>
            <div className="h-[46px] w-[3px] bg-gray-800 absolute -start-[17px] top-[178px] rounded-s-lg"></div>
            <div className="h-[64px] w-[3px] bg-gray-800 absolute -end-[17px] top-[142px] rounded-e-lg"></div>

            <div className="rounded-[2rem] overflow-hidden w-full h-full bg-gray-50 flex flex-col relative">
                {/* Status Bar */}
                <div className="h-8 bg-white flex items-center justify-between px-6 text-[10px] font-bold text-gray-800 z-10 pt-2">
                    <span>9:41</span>
                    <div className="flex gap-1">
                        <Signal size={12} />
                        <Wifi size={12} />
                        <Battery size={12} />
                    </div>
                </div>

                {/* App Header */}
                <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between">
                    <span className="font-bold text-gray-800 text-sm">Comunicados</span>
                    <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-3 overflow-y-auto">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-2 text-center">
                        Hoje
                    </p>

                    {/* The Card Being Created */}
                    <div className="animate-fade-in opacity-100 transform translate-y-0 transition-all duration-500">
                        <CommunicationCard
                            recipient={mockRecipient}
                            onClick={() => { }}
                        />
                    </div>

                    {/* Dummy Previous Cards for context */}
                    <div className="opacity-50 scale-95 origin-top mt-4 grayscale-[0.5]">
                        <div className="bg-white p-3 rounded-xl border border-gray-100 mb-3">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                    <span className="text-green-600 text-xs">🍎</span>
                                </div>
                                <div className="flex-1">
                                    <div className="h-2 w-20 bg-gray-200 rounded mb-2"></div>
                                    <div className="h-3 w-32 bg-gray-100 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notification Banner Preview (Optional overlay) */}
                <div className="absolute top-10 left-2 right-2 bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-3 transform transition-all duration-500 translate-y-0 border border-gray-100/50">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
                            <img src="/logo_school.png" className="w-5 h-5 object-contain invert brightness-0 opacity-100" alt="" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <h4 className="text-xs font-bold text-gray-900">Escola V2</h4>
                                <span className="text-[10px] text-gray-400">agora</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-800 mt-0.5 truncate">
                                {channel?.name || 'Escola'}: {title || 'Novo Comunicado'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {content || 'Toque para visualizar...'}
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
