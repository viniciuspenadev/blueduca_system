
import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from './Button';

interface Country {
    name: string;
    code: string;
    ddi: string;
    flag: string;
}

const countries: Country[] = [
    { name: 'Brasil', code: 'BR', ddi: '55', flag: '🇧🇷' },
    { name: 'Estados Unidos', code: 'US', ddi: '1', flag: '🇺🇸' },
    { name: 'Portugal', code: 'PT', ddi: '351', flag: '🇵🇹' },
    { name: 'Angola', code: 'AO', ddi: '244', flag: '🇦🇴' },
    { name: 'Moçambique', code: 'MZ', ddi: '258', flag: '🇲🇿' },
    { name: 'Argentina', code: 'AR', ddi: '54', flag: '🇦🇷' },
    { name: 'Paraguai', code: 'PY', ddi: '595', flag: '🇵🇾' },
    { name: 'Uruguai', code: 'UY', ddi: '598', flag: '🇺🇾' },
    { name: 'Reino Unido', code: 'UK', ddi: '44', flag: '🇬🇧' },
    { name: 'Espanha', code: 'ES', ddi: '34', flag: '🇪🇸' },
    { name: 'França', code: 'FR', ddi: '33', flag: '🇫🇷' },
    // Adicione mais conforme necessário
];

interface PhoneInputProps {
    label?: string;
    value: string; // Salva apenas números: DDI + DDD + Numero
    onChange: (value: string) => void;
    error?: string;
    className?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({ label, value, onChange, error, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial sync from value to selected country
    useEffect(() => {
        if (value) {
            const found = countries.slice().sort((a, b) => b.ddi.length - a.ddi.length).find(c => value.startsWith(c.ddi));
            if (found) setSelectedCountry(found);
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.ddi.includes(searchTerm)
    );

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(selectedCountry.ddi + digits);
    };

    const getLocalNumber = () => {
        if (!value) return '';
        if (value.startsWith(selectedCountry.ddi)) {
            return value.slice(selectedCountry.ddi.length);
        }
        return value;
    };

    return (
        <div className={cn("w-full space-y-1", className)}>
            {label && <label className="text-sm font-medium text-slate-700">{label}</label>}

            <div className="relative flex">
                {/* DDI Selector */}
                <div ref={dropdownRef} className="relative">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={cn(
                            "h-full flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl hover:bg-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20 z-10",
                            error && "border-red-500 text-red-500"
                        )}
                    >
                        <span className="text-lg">{selectedCountry.flag}</span>
                        <span className="text-sm font-semibold">+{selectedCountry.ddi}</span>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 animate-fade-in overflow-hidden">
                            <div className="p-2 border-b border-slate-100">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        autoFocus
                                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border-none rounded-lg focus:ring-0"
                                        placeholder="Buscar país ou DDI..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {filteredCountries.map(country => (
                                    <button
                                        key={country.code}
                                        type="button"
                                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-brand-50 text-left transition-colors"
                                        onClick={() => {
                                            setSelectedCountry(country);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                            // Keep existing local number if possible
                                            const local = getLocalNumber();
                                            onChange(country.ddi + local);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{country.flag}</span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{country.name}</p>
                                                <p className="text-xs text-gray-500">+{country.ddi}</p>
                                            </div>
                                        </div>
                                        {selectedCountry.code === country.code && (
                                            <Check className="w-4 h-4 text-brand-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Number Input */}
                <input
                    type="tel"
                    className={cn(
                        "flex-1 rounded-r-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-slate-50/30 hover:bg-white transition-all duration-300 shadow-sm",
                        error && "border-red-500 focus:ring-red-500/20"
                    )}
                    placeholder="(00) 00000-0000"
                    value={getLocalNumber()}
                    onChange={handlePhoneChange}
                />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
};
