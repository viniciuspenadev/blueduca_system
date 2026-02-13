import { processDunning } from './dunning-engine';

/**
 * Script de Teste para Régua de Cobrança
 * 
 * Como usar:
 * 1. Certifique-se de ter as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * 2. Execute este script (pode ser via node se tiver suporte a ESM, ou adaptando para um endpoint de teste)
 */

export async function runTest() {
    const URL = 'SUA_URL_SUPABASE';
    const KEY = 'SUA_SERVICE_ROLE_KEY';

    console.log('--- INICIANDO TESTE DA RÉGUA ---');

    try {
        await processDunning(URL, KEY);
        console.log('--- TESTE FINALIZADO ---');
        console.log('Verifique a tabela dunning_logs no painel do Supabase para ver os resultados.');
    } catch (error) {
        console.error('Erro durante o teste:', error);
    }
}

// runTest();
