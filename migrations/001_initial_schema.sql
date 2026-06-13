-- DeskGuard initial schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('student', 'librarian', 'admin');
CREATE TYPE desk_status AS ENUM ('free', 'occupied', 'away', 'abandoned', 'maintenance');
CREATE TYPE session_status AS ENUM ('active', 'away', 'liveness_pending', 'ended', 'abandoned');

CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    floor INTEGER NOT NULL DEFAULT 1,
    map_svg_ref VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'student',
    active_desk_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE desks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    desk_code VARCHAR(20) UNIQUE NOT NULL,
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    floor INTEGER NOT NULL DEFAULT 1,
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    status desk_status NOT NULL DEFAULT 'free',
    x_coord NUMERIC(8,2) NOT NULL DEFAULT 0,
    y_coord NUMERIC(8,2) NOT NULL DEFAULT 0,
    width NUMERIC(8,2) NOT NULL DEFAULT 60,
    height NUMERIC(8,2) NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_active_desk
    FOREIGN KEY (active_desk_id) REFERENCES desks(id) ON DELETE SET NULL;

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    desk_id UUID NOT NULL REFERENCES desks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checkin_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checkout_time TIMESTAMPTZ,
    away_start TIMESTAMPTZ,
    away_count INTEGER NOT NULL DEFAULT 0,
    liveness_due TIMESTAMPTZ,
    liveness_prompted_at TIMESTAMPTZ,
    status session_status NOT NULL DEFAULT 'active',
    end_reason VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    desk_id UUID REFERENCES desks(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_desks_zone ON desks(zone_id);
CREATE INDEX idx_desks_status ON desks(status);
CREATE INDEX idx_desks_floor ON desks(floor);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_desk ON sessions(desk_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_desk ON audit_logs(desk_id);

-- Seed zones
INSERT INTO zones (id, name, floor, map_svg_ref) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Reading Room A', 1, 'floor1'),
    ('a0000000-0000-0000-0000-000000000002', 'Quiet Zone B', 1, 'floor1'),
    ('a0000000-0000-0000-0000-000000000003', 'Study Hall', 2, 'floor2');

-- Seed desks (floor 1)
INSERT INTO desks (desk_code, zone_id, floor, qr_code, status, x_coord, y_coord) VALUES
    ('D-101', 'a0000000-0000-0000-0000-000000000001', 1, 'deskguard://checkin/D-101', 'free', 80, 80),
    ('D-102', 'a0000000-0000-0000-0000-000000000001', 1, 'deskguard://checkin/D-102', 'free', 180, 80),
    ('D-103', 'a0000000-0000-0000-0000-000000000001', 1, 'deskguard://checkin/D-103', 'free', 280, 80),
    ('D-104', 'a0000000-0000-0000-0000-000000000001', 1, 'deskguard://checkin/D-104', 'free', 380, 80),
    ('D-105', 'a0000000-0000-0000-0000-000000000002', 1, 'deskguard://checkin/D-105', 'free', 80, 200),
    ('D-106', 'a0000000-0000-0000-0000-000000000002', 1, 'deskguard://checkin/D-106', 'free', 180, 200),
    ('D-107', 'a0000000-0000-0000-0000-000000000002', 1, 'deskguard://checkin/D-107', 'free', 280, 200),
    ('D-108', 'a0000000-0000-0000-0000-000000000002', 1, 'deskguard://checkin/D-108', 'free', 380, 200);

-- Seed desks (floor 2)
INSERT INTO desks (desk_code, zone_id, floor, qr_code, status, x_coord, y_coord) VALUES
    ('D-201', 'a0000000-0000-0000-0000-000000000003', 2, 'deskguard://checkin/D-201', 'free', 100, 100),
    ('D-202', 'a0000000-0000-0000-0000-000000000003', 2, 'deskguard://checkin/D-202', 'free', 220, 100),
    ('D-203', 'a0000000-0000-0000-0000-000000000003', 2, 'deskguard://checkin/D-203', 'free', 340, 100),
    ('D-204', 'a0000000-0000-0000-0000-000000000003', 2, 'deskguard://checkin/D-204', 'free', 100, 220),
    ('D-205', 'a0000000-0000-0000-0000-000000000003', 2, 'deskguard://checkin/D-205', 'free', 220, 220),
    ('D-206', 'a0000000-0000-0000-0000-000000000003', 2, 'deskguard://checkin/D-206', 'free', 340, 220);

-- Users seeded via: npm run seed (password: password123)

INSERT INTO system_config (key, value) VALUES
    ('timers', '{"awayLimitMinutes":20,"livenessIntervalHours":2,"livenessGraceMinutes":10,"maxAwayPeriods":3}');
