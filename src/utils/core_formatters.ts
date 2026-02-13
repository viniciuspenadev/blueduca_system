/**
 * Parse a YYYY-MM-DD string as a Local Date (preventing UTC timezone shifts).
 * Used primarily for Supabase 'date' columns which return ISO strings but represent local dates.
 */
export const parseLocalDate = (dateStr: string | null | undefined): Date => {
    if (!dateStr) return new Date();

    // Handle ISO datetime strings (e.g. 2026-01-23T10:00:00) by taking just the date part if needed,
    // but usually for 'date' columns we get 'YYYY-MM-DD'
    const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

    const parts = cleanDateStr.split('-'); // 2026-01-23
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }

    return new Date(dateStr);
};

/**
 * Format a numeric value or string to BRL Currency (R$ 0,00).
 */
export const formatCurrency = (value: number | string | undefined | null): string => {
    const num = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

/**
 * Format a date string safely for the UI.
 * Returns ONLY the date (pt-BR format) to avoid timezone confusion (e.g. 21:00 instead of midnight).
 */
export const formatDateSafe = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '--';

    // Extract only the date part YYYY-MM-DD
    const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];

    const parts = cleanDateStr.split('-');
    if (parts.length === 3) {
        // Create date explicitly in local time to avoid shift
        const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return localDate.toLocaleDateString('pt-BR');
    }

    return new Date(dateStr).toLocaleDateString('pt-BR');
};

/**
 * Mask a string as BRL currency for input fields.
 * Example: "2500" -> "25,00" -> "2.500,00"
 */
export const maskCurrency = (value: string): string => {
    if (!value) return '';
    let cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) return '';
    let numValue = Number(cleanValue) / 100;

    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(numValue);
};

/**
 * Parse a masked currency string back to a number.
 * Example: "2.500,00" -> 2500
 */
export const parseCurrencyToNumber = (value: string): number => {
    if (!value) return 0;
    return Number(value.replace(/\./g, '').replace(',', '.'));
};
