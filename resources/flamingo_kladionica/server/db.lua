DB = {}

local SCHEMA = {
    [[CREATE TABLE IF NOT EXISTS `kladionica_events` (
        `id` VARCHAR(64) NOT NULL,
        `sport_key` VARCHAR(80) NOT NULL,
        `sport` VARCHAR(20) NOT NULL,
        `league` VARCHAR(120) NOT NULL,
        `home` VARCHAR(120) NOT NULL,
        `away` VARCHAR(120) NOT NULL,
        `commence` INT UNSIGNED NOT NULL,
        `odds` LONGTEXT NULL,
        `odds_updated` INT UNSIGNED NOT NULL DEFAULT 0,
        `status` VARCHAR(16) NOT NULL DEFAULT 'open',
        `home_score` SMALLINT NULL,
        `away_score` SMALLINT NULL,
        PRIMARY KEY (`id`),
        KEY `idx_status` (`status`, `commence`),
        KEY `idx_sport_key` (`sport_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],

    [[CREATE TABLE IF NOT EXISTS `kladionica_tickets` (
        `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `code` VARCHAR(16) NOT NULL,
        `identifier` VARCHAR(64) NOT NULL,
        `player_name` VARCHAR(100) NULL,
        `stake` INT UNSIGNED NOT NULL,
        `total_odds` DECIMAL(12,2) NOT NULL,
        `potential_win` INT UNSIGNED NOT NULL,
        `win_amount` INT UNSIGNED NOT NULL DEFAULT 0,
        `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
        `paid` TINYINT(1) NOT NULL DEFAULT 0,
        `created_at` INT UNSIGNED NOT NULL,
        `settled_at` INT UNSIGNED NULL,
        `paid_at` INT UNSIGNED NULL,
        `paid_to` VARCHAR(64) NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_code` (`code`),
        KEY `idx_status` (`status`),
        KEY `idx_identifier` (`identifier`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],

    [[CREATE TABLE IF NOT EXISTS `kladionica_selections` (
        `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        `ticket_id` INT UNSIGNED NOT NULL,
        `event_id` VARCHAR(64) NOT NULL,
        `market` VARCHAR(16) NOT NULL,
        `pick` VARCHAR(16) NOT NULL,
        `point` DECIMAL(8,2) NULL,
        `odds` DECIMAL(8,2) NOT NULL,
        `result` VARCHAR(16) NOT NULL DEFAULT 'pending',
        PRIMARY KEY (`id`),
        KEY `idx_ticket` (`ticket_id`),
        KEY `idx_event` (`event_id`, `result`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],

    [[CREATE TABLE IF NOT EXISTS `kladionica_state` (
        `k` VARCHAR(100) NOT NULL,
        `v` BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (`k`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4]],
}

local state = {}

function DB.init()
    for _, query in ipairs(SCHEMA) do
        MySQL.query.await(query)
    end
    local rows = MySQL.query.await('SELECT k, v FROM kladionica_state') or {}
    for _, row in ipairs(rows) do
        state[row.k] = tonumber(row.v) or 0
    end
end

function DB.getState(key)
    return state[key] or 0
end

function DB.setState(key, value)
    state[key] = value
    MySQL.query('INSERT INTO kladionica_state (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', { key, value })
end
