-- Session storage v DB – pro Railway / více instancí (ephemeral filesystem by session ztrácel)
-- Použije se, když je nastaveno SESSION_USE_DB=1 (config.default.php).

CREATE TABLE IF NOT EXISTS _sessions (
    id              VARCHAR(128) NOT NULL PRIMARY KEY,
    data            TEXT NOT NULL,
    last_activity   INT UNSIGNED NOT NULL,
    INDEX idx_last_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;
