-- ==========================================
-- MIGRATION: Sistema de Avaliações Flexível
-- Data: 2026-02-14
-- Descrição: Recria sistema de notas com suporte a múltiplos tipos
-- ==========================================

-- ==========================================
-- FASE 1: DROPAR TABELAS ANTIGAS
-- ==========================================

DROP TABLE IF EXISTS student_grades CASCADE;
DROP TABLE IF EXISTS grade_books CASCADE;

-- ==========================================
-- FASE 2: CRIAR NOVAS TABELAS
-- ==========================================

-- 1. ASSESSMENT_CONFIGS (Configurações por Escola/Nível)
CREATE TABLE IF NOT EXISTS assessment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    education_level TEXT NOT NULL, -- 'infantil', 'fundamental_i', 'fundamental_ii', 'medio'
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('numeric', 'concept', 'descriptive', 'diagnostic')),
    periodicity TEXT NOT NULL CHECK (periodicity IN ('monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual')),
    
    -- Configurações específicas por tipo
    config JSONB DEFAULT '{}',
    -- Exemplos de config:
    -- numeric: {"min_score": 0, "max_score": 10, "decimal_places": 1, "passing_score": 6}
    -- concept: {"scale": ["A", "B", "C", "D", "E"], "labels": {"A": "Excelente", "B": "Bom", ...}}
    -- descriptive: {"areas": ["Linguagem", "Raciocínio", "Artes", "Movimento", "Socialização"]}
    -- diagnostic: {"competencies": [...]}
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(school_id, education_level)
);

-- 2. ASSESSMENT_PERIODS (Períodos de Avaliação)
CREATE TABLE IF NOT EXISTS assessment_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    school_year INT NOT NULL,
    period_number INT NOT NULL, -- 1, 2, 3, 4...
    period_name TEXT NOT NULL, -- '1º Bimestre', '1º Semestre', etc.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(school_id, school_year, period_number),
    CHECK (end_date >= start_date)
);

-- 3. GRADE_BOOKS (Avaliações - Nova Estrutura)
CREATE TABLE IF NOT EXISTS grade_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    period_id UUID REFERENCES assessment_periods(id) ON DELETE SET NULL,
    
    -- Identificação
    subject TEXT NOT NULL, -- 'Matemática', 'Português', etc.
    title TEXT NOT NULL, -- 'Prova Cap. 1', 'Trabalho em Grupo'
    description TEXT,
    
    -- Tipo de avaliação
    assessment_type TEXT NOT NULL DEFAULT 'numeric' CHECK (assessment_type IN ('numeric', 'concept', 'descriptive', 'diagnostic')),
    
    -- Configurações
    max_score NUMERIC DEFAULT 10.0, -- Para tipo numeric
    weight INT DEFAULT 1, -- Peso na média
    date DATE,
    
    -- Flags
    is_diagnostic BOOLEAN DEFAULT false, -- Se é uma sondagem
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. STUDENT_GRADES (Notas - Nova Estrutura)
CREATE TABLE IF NOT EXISTS student_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    grade_book_id UUID NOT NULL REFERENCES grade_books(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
    
    -- Múltiplos tipos de notas (apenas um será preenchido)
    score_numeric NUMERIC, -- 8.5, 7.0, 9.2
    score_concept TEXT, -- 'A', 'B', 'C', 'D', 'E'
    score_descriptive TEXT, -- Texto livre
    score_diagnostic JSONB, -- {"competency_1": "atingido", "competency_2": "em_desenvolvimento", ...}
    
    -- Feedback geral
    feedback TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(grade_book_id, student_id)
);

-- 5. DESCRIPTIVE_REPORTS (Pareceres Descritivos - Opcional)
CREATE TABLE IF NOT EXISTS descriptive_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES assessment_periods(id) ON DELETE CASCADE,
    
    -- Áreas de desenvolvimento
    areas JSONB DEFAULT '{}',
    -- Exemplo: {
    --   "linguagem": "Demonstra interesse...",
    --   "raciocinio": "Resolve problemas...",
    --   "artes": "Expressa criatividade...",
    --   "movimento": "Participa ativamente...",
    --   "socializacao": "Interage bem..."
    -- }
    
    -- Observações gerais
    general_observations TEXT,
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(student_id, period_id)
);

-- ==========================================
-- FASE 3: ÍNDICES PARA PERFORMANCE
-- ==========================================

CREATE INDEX idx_assessment_configs_school ON assessment_configs(school_id);
CREATE INDEX idx_assessment_periods_school_year ON assessment_periods(school_id, school_year);
CREATE INDEX idx_grade_books_class ON grade_books(class_id);
CREATE INDEX idx_grade_books_period ON grade_books(period_id);
CREATE INDEX idx_student_grades_student ON student_grades(student_id);
CREATE INDEX idx_student_grades_grade_book ON student_grades(grade_book_id);
CREATE INDEX idx_descriptive_reports_student ON descriptive_reports(student_id);

-- ==========================================
-- FASE 4: ROW LEVEL SECURITY (RLS)
-- ==========================================

-- assessment_configs
ALTER TABLE assessment_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see configs from their school"
    ON assessment_configs FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM school_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins manage configs from their school"
    ON assessment_configs FOR ALL
    USING (
        school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM school_members 
            WHERE user_id = auth.uid() 
                AND school_id = assessment_configs.school_id
                AND role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- assessment_periods
ALTER TABLE assessment_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see periods from their school"
    ON assessment_periods FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM school_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Admins manage periods from their school"
    ON assessment_periods FOR ALL
    USING (
        school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM school_members 
            WHERE user_id = auth.uid() 
                AND school_id = assessment_periods.school_id
                AND role IN ('ADMIN', 'COORDINATOR')
        )
    );

-- grade_books
ALTER TABLE grade_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see grade_books from their school"
    ON grade_books FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM school_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Staff manage grade_books from their school"
    ON grade_books FOR ALL
    USING (
        school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM school_members 
            WHERE user_id = auth.uid() 
                AND school_id = grade_books.school_id
                AND role IN ('ADMIN', 'COORDINATOR', 'TEACHER', 'SECRETARY')
        )
    );

-- student_grades
ALTER TABLE student_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see grades from their school"
    ON student_grades FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM school_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Staff manage grades from their school"
    ON student_grades FOR ALL
    USING (
        school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM school_members 
            WHERE user_id = auth.uid() 
                AND school_id = student_grades.school_id
                AND role IN ('ADMIN', 'COORDINATOR', 'TEACHER', 'SECRETARY')
        )
    );

-- descriptive_reports
ALTER TABLE descriptive_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see reports from their school"
    ON descriptive_reports FOR SELECT
    USING (school_id IN (
        SELECT school_id FROM school_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Staff manage reports from their school"
    ON descriptive_reports FOR ALL
    USING (
        school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM school_members 
            WHERE user_id = auth.uid() 
                AND school_id = descriptive_reports.school_id
                AND role IN ('ADMIN', 'COORDINATOR', 'TEACHER')
        )
    );

-- ==========================================
-- FASE 5: FUNCTIONS AUXILIARES
-- ==========================================

-- Function: Gerar períodos automaticamente
CREATE OR REPLACE FUNCTION generate_assessment_periods(
    p_school_id UUID,
    p_school_year INT,
    p_periodicity TEXT,
    p_start_date DATE,
    p_end_date DATE
) RETURNS VOID AS $$
DECLARE
    v_period_count INT;
    v_period_duration INT;
    v_current_start DATE;
    v_current_end DATE;
    v_period_name TEXT;
    i INT;
BEGIN
    -- Determinar número de períodos
    v_period_count := CASE p_periodicity
        WHEN 'monthly' THEN 12
        WHEN 'bimonthly' THEN 6
        WHEN 'quarterly' THEN 4
        WHEN 'semiannual' THEN 2
        WHEN 'annual' THEN 1
        ELSE 4 -- Default: bimestral
    END;
    
    -- Calcular duração de cada período em dias
    v_period_duration := (p_end_date - p_start_date) / v_period_count;
    
    -- Gerar períodos
    FOR i IN 1..v_period_count LOOP
        v_current_start := p_start_date + ((i - 1) * v_period_duration);
        v_current_end := p_start_date + (i * v_period_duration) - 1;
        
        -- Ajustar último período para terminar na data final
        IF i = v_period_count THEN
            v_current_end := p_end_date;
        END IF;
        
        -- Gerar nome do período
        v_period_name := CASE p_periodicity
            WHEN 'monthly' THEN i || 'º Mês'
            WHEN 'bimonthly' THEN i || 'º Bimestre'
            WHEN 'quarterly' THEN i || 'º Trimestre'
            WHEN 'semiannual' THEN i || 'º Semestre'
            WHEN 'annual' THEN 'Ano Letivo'
            ELSE i || 'º Período'
        END;
        
        -- Inserir período
        INSERT INTO assessment_periods (school_id, school_year, period_number, period_name, start_date, end_date)
        VALUES (p_school_id, p_school_year, i, v_period_name, v_current_start, v_current_end);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function: Validar nota baseada no tipo
CREATE OR REPLACE FUNCTION validate_grade_score() RETURNS TRIGGER AS $$
DECLARE
    v_assessment_type TEXT;
BEGIN
    -- Buscar tipo de avaliação
    SELECT assessment_type INTO v_assessment_type
    FROM grade_books
    WHERE id = NEW.grade_book_id;
    
    -- Validar baseado no tipo
    CASE v_assessment_type
        WHEN 'numeric' THEN
            IF NEW.score_numeric IS NULL THEN
                RAISE EXCEPTION 'score_numeric é obrigatório para avaliações numéricas';
            END IF;
        WHEN 'concept' THEN
            IF NEW.score_concept IS NULL THEN
                RAISE EXCEPTION 'score_concept é obrigatório para avaliações conceituais';
            END IF;
        WHEN 'descriptive' THEN
            IF NEW.score_descriptive IS NULL THEN
                RAISE EXCEPTION 'score_descriptive é obrigatório para avaliações descritivas';
            END IF;
        WHEN 'diagnostic' THEN
            IF NEW.score_diagnostic IS NULL THEN
                RAISE EXCEPTION 'score_diagnostic é obrigatório para avaliações diagnósticas';
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Validar nota antes de inserir/atualizar
CREATE TRIGGER validate_grade_before_save
    BEFORE INSERT OR UPDATE ON student_grades
    FOR EACH ROW
    EXECUTE FUNCTION validate_grade_score();

-- ==========================================
-- FASE 6: SEEDS DE EXEMPLO (Opcional)
-- ==========================================

-- Exemplo de configuração para Ensino Infantil
-- INSERT INTO assessment_configs (school_id, education_level, assessment_type, periodicity, config)
-- VALUES (
--     '6d3e7a82-8b92-4fb3-ba47-99f140825d9c',
--     'infantil',
--     'descriptive',
--     'semiannual',
--     '{"areas": ["Linguagem", "Raciocínio Lógico", "Artes", "Movimento", "Socialização"]}'
-- );

-- Exemplo de configuração para Fundamental I
-- INSERT INTO assessment_configs (school_id, education_level, assessment_type, periodicity, config)
-- VALUES (
--     '6d3e7a82-8b92-4fb3-ba47-99f140825d9c',
--     'fundamental_i',
--     'concept',
--     'bimonthly',
--     '{"scale": ["A", "B", "C", "D", "E"], "labels": {"A": "Excelente", "B": "Bom", "C": "Regular", "D": "Insuficiente", "E": "Muito Insuficiente"}}'
-- );

-- Exemplo de configuração para Fundamental II / Médio
-- INSERT INTO assessment_configs (school_id, education_level, assessment_type, periodicity, config)
-- VALUES (
--     '6d3e7a82-8b92-4fb3-ba47-99f140825d9c',
--     'fundamental_ii',
--     'numeric',
--     'bimonthly',
--     '{"min_score": 0, "max_score": 10, "decimal_places": 1, "passing_score": 6}'
-- );

-- ==========================================
-- FIM DA MIGRATION
-- ==========================================

COMMENT ON TABLE assessment_configs IS 'Configurações de avaliação por escola e nível de ensino';
COMMENT ON TABLE assessment_periods IS 'Períodos de avaliação (bimestres, semestres, etc.)';
COMMENT ON TABLE grade_books IS 'Avaliações criadas pelos professores';
COMMENT ON TABLE student_grades IS 'Notas dos alunos (suporta múltiplos tipos)';
COMMENT ON TABLE descriptive_reports IS 'Pareceres descritivos para ensino infantil';
