-- =====================================================================
-- MshindiRoom Production PostgreSQL Database Schema & Triggers
-- Architecture: Multi-tenant, Scalable, Atomic RP/MMR Rating Engine
-- =====================================================================

-- 1. ENUMS
CREATE TYPE tier_level AS ENUM ('ROOKIE', 'RISING', 'SKILLED', 'ELITE', 'LEGEND');
CREATE TYPE jackpot_status AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'CANCELLED');

-- 2. TABLE: PlayerRatings (Master Rating & Profile State)
CREATE TABLE IF NOT EXISTS player_ratings (
    user_id VARCHAR(128) PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    rp INT NOT NULL DEFAULT 0 CHECK (rp >= 0),
    mmr INT NOT NULL DEFAULT 1000 CHECK (mmr >= 0),
    stars NUMERIC(2,1) NOT NULL DEFAULT 1.0 CHECK (stars >= 0.5 AND stars <= 5.0),
    tier_name VARCHAR(32) NOT NULL DEFAULT 'Rookie Predictor',
    tier tier_level NOT NULL DEFAULT 'ROOKIE',
    
    -- Accumulated Statistics
    total_jackpots_played INT NOT NULL DEFAULT 0,
    jackpots_won INT NOT NULL DEFAULT 0,
    top3_finishes INT NOT NULL DEFAULT 0,
    perfect_slips INT NOT NULL DEFAULT 0,
    total_correct_picks INT NOT NULL DEFAULT 0,
    total_picks_submitted INT NOT NULL DEFAULT 0,
    accuracy_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    
    -- Streak & Consistency
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    average_correct_picks NUMERIC(4,1) NOT NULL DEFAULT 0.0,
    consistency_rating INT NOT NULL DEFAULT 50 CHECK (consistency_rating BETWEEN 0 AND 100),
    skill_index INT NOT NULL DEFAULT 50 CHECK (skill_index BETWEEN 0 AND 100),
    best_finish_rank INT DEFAULT NULL,
    
    -- Rolling Window Performance
    last10_accuracy NUMERIC(5,2) DEFAULT 0.00,
    last25_accuracy NUMERIC(5,2) DEFAULT 0.00,
    last50_accuracy NUMERIC(5,2) DEFAULT 0.00,
    
    -- Activity & Decay Timestamps
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_player_ratings_mmr ON player_ratings (mmr DESC);
CREATE INDEX idx_player_ratings_rp ON player_ratings (rp DESC);
CREATE INDEX idx_player_ratings_stars ON player_ratings (stars DESC);

-- 3. TABLE: RatingHistory (Immutable Audit Log of RP/MMR Shifts)
CREATE TABLE IF NOT EXISTS rating_history (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES player_ratings(user_id) ON DELETE CASCADE,
    jackpot_id VARCHAR(128) NOT NULL,
    old_rp INT NOT NULL,
    new_rp INT NOT NULL,
    rp_gained INT NOT NULL,
    old_stars NUMERIC(2,1) NOT NULL,
    new_stars NUMERIC(2,1) NOT NULL,
    mmr_change INT NOT NULL,
    
    -- Breakdown
    rank_bonus INT NOT NULL DEFAULT 0,
    accuracy_bonus INT NOT NULL DEFAULT 0,
    near_miss_bonus INT NOT NULL DEFAULT 0,
    difficulty_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    streak_bonus INT NOT NULL DEFAULT 0,
    consistency_bonus INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rating_history_user ON rating_history (user_id, created_at DESC);

-- 4. TABLE: JackpotResults (Master Settled Jackpot Records)
CREATE TABLE IF NOT EXISTS jackpot_results (
    jackpot_id VARCHAR(128) PRIMARY KEY,
    bookie VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    status jackpot_status NOT NULL DEFAULT 'OPEN',
    total_matches INT NOT NULL DEFAULT 17,
    total_participants INT NOT NULL DEFAULT 0,
    winning_slip JSONB NOT NULL, -- Array of results ['1', 'X', '2', ...]
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. FUNCTION & TRIGGER: Auto Update Stars on RP Change
CREATE OR REPLACE FUNCTION update_stars_and_tier()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rp >= 700 THEN
        NEW.stars := 5.0;
        NEW.tier_name := '⭐⭐⭐⭐⭐ Legend';
        NEW.tier := 'LEGEND';
    ELSIF NEW.rp >= 350 THEN
        NEW.stars := LEAST(4.5, 4.0 + FLOOR((NEW.rp - 350) / 175.0) * 0.5);
        NEW.tier_name := '⭐⭐⭐⭐ Elite Predictor';
        NEW.tier := 'ELITE';
    ELSIF NEW.rp >= 150 THEN
        NEW.stars := LEAST(3.5, 3.0 + FLOOR((NEW.rp - 150) / 100.0) * 0.5);
        NEW.tier_name := '⭐⭐⭐ Skilled Predictor';
        NEW.tier := 'SKILLED';
    ELSIF NEW.rp >= 50 THEN
        NEW.stars := LEAST(2.5, 2.0 + FLOOR((NEW.rp - 50) / 50.0) * 0.5);
        NEW.tier_name := '⭐⭐ Rising Player';
        NEW.tier := 'RISING';
    ELSE
        NEW.stars := LEAST(1.5, 1.0 + FLOOR(NEW.rp / 25.0) * 0.5);
        NEW.tier_name := '⭐ Rookie Predictor';
        NEW.tier := 'ROOKIE';
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stars_before_write
BEFORE INSERT OR UPDATE OF rp ON player_ratings
FOR EACH ROW
EXECUTE FUNCTION update_stars_and_tier();

-- 6. FUNCTION: Scheduled Activity Decay (Run via Cron Daily)
CREATE OR REPLACE FUNCTION apply_inactivity_decay()
RETURNS INT AS $$
DECLARE
    affected_count INT := 0;
BEGIN
    UPDATE player_ratings
    SET 
        rp = GREATEST(0, rp - LEAST(
            ROUND(rp * CASE 
                WHEN EXTRACT(DAY FROM (NOW() - last_active_at)) >= 90 THEN 0.05
                WHEN EXTRACT(DAY FROM (NOW() - last_active_at)) >= 60 THEN 0.03
                ELSE 0.01
            END),
            ROUND(rp * 0.15)
        )::INT),
        updated_at = NOW()
    WHERE 
        EXTRACT(DAY FROM (NOW() - last_active_at)) >= 30
        AND rp > 0;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;
