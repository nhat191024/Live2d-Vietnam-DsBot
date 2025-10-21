const Logger = require("../utils/Logger");
const Database = require("../utils/Database");
const { EmbedBuilder, ChannelType } = require("discord.js");

class VoiceLogger {
    constructor(client) {
        this.client = client;
        this.name = "voiceLogger";
        this.description = "Log voice channel activities";
        this.version = "1.0.0";
        this.enabled = true;

        // Voice session tracking
        this.voiceSessions = new Map(); // userId -> { joinTime, channelId }
    }

    async load() {
        Logger.loading(`Loading ${this.name} module v${this.version}...`);

        try {
            // Create tables if they don't exist
            await this.initializeTables();

            Logger.success(`${this.name} module loaded successfully`);
        } catch (error) {
            Logger.error(`Failed to load ${this.name} module:`, error);
            throw error;
        }
    }

    async unload() {
        Logger.info(`Unloading ${this.name} module...`);

        // Save any pending sessions
        for (const [userId, session] of this.voiceSessions.entries()) {
            await this.endVoiceSession(userId, session.channelId, new Date());
        }
        this.voiceSessions.clear();

        Logger.success(`${this.name} module unloaded`);
    }

    async reload() {
        await this.unload();
        await this.load();
    }

    getModuleInfo() {
        return {
            name: this.name,
            description: this.description,
            version: this.version,
            enabled: this.enabled,
        };
    }

    healthCheck() {
        const issues = [];

        // Module is healthy if no critical issues
        return {
            healthy: issues.length === 0,
            issues: issues,
        };
    }

    async initializeTables() {
        // Voice logs table
        await Database.execute(`
            CREATE TABLE IF NOT EXISTS voice_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(20) NOT NULL,
                user_id VARCHAR(20) NOT NULL,
                username VARCHAR(255) NOT NULL,
                channel_id VARCHAR(20),
                channel_name VARCHAR(255),
                action VARCHAR(50) NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                details TEXT,
                INDEX idx_voice_logs_guild (guild_id),
                INDEX idx_voice_logs_user (user_id)
            )
        `);

        // Voice sessions table (for tracking time in voice)
        await Database.execute(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(20) NOT NULL,
                user_id VARCHAR(20) NOT NULL,
                username VARCHAR(255) NOT NULL,
                channel_id VARCHAR(20) NOT NULL,
                channel_name VARCHAR(255) NOT NULL,
                join_time TIMESTAMP NOT NULL,
                leave_time TIMESTAMP NULL,
                duration INT NULL,
                INDEX idx_voice_sessions_guild (guild_id),
                INDEX idx_voice_sessions_user (user_id)
            )
        `);

        // Guild settings table
        await Database.execute(`
            CREATE TABLE IF NOT EXISTS voice_logger_settings (
                guild_id VARCHAR(20) PRIMARY KEY,
                log_channel_id VARCHAR(20),
                enabled TINYINT(1) DEFAULT 1,
                log_join TINYINT(1) DEFAULT 1,
                log_leave TINYINT(1) DEFAULT 1,
                log_move TINYINT(1) DEFAULT 1,
                log_mute TINYINT(1) DEFAULT 1,
                log_deaf TINYINT(1) DEFAULT 1,
                log_stream TINYINT(1) DEFAULT 1,
                log_video TINYINT(1) DEFAULT 1
            )
        `);
    }

    // Get guild settings
    async getGuildSettings(guildId) {
        const results = await Database.execute(
            "SELECT * FROM voice_logger_settings WHERE guild_id = ?",
            [guildId]
        );

        if (!results || results.length === 0) {
            // Return default settings
            return {
                guild_id: guildId,
                log_channel_id: null,
                enabled: 1,
                log_join: 1,
                log_leave: 1,
                log_move: 1,
                log_mute: 1,
                log_deaf: 1,
                log_stream: 1,
                log_video: 1,
            };
        }

        return results[0];
    }

    // Update guild settings
    async updateGuildSettings(guildId, settings) {
        const keys = Object.keys(settings);
        const values = Object.values(settings);

        const setClause = keys.map((key) => `${key} = VALUES(${key})`).join(", ");
        const columns = ['guild_id', ...keys].join(", ");
        const placeholders = ['?', ...keys.map(() => '?')].join(", ");

        await Database.execute(
            `INSERT INTO voice_logger_settings (${columns})
             VALUES (${placeholders})
             ON DUPLICATE KEY UPDATE ${setClause}`,
            [guildId, ...values]
        );
    }

    // Log voice activity
    async logVoiceActivity(guildId, userId, username, channelId, channelName, action, details = null) {
        await Database.execute(
            `INSERT INTO voice_logs (guild_id, user_id, username, channel_id, channel_name, action, details)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [guildId, userId, username, channelId, channelName, action, details ? JSON.stringify(details) : null]
        );
    }

    // Start voice session
    async startVoiceSession(guildId, userId, username, channelId, channelName, joinTime) {
        // Store in memory for quick access
        this.voiceSessions.set(userId, { guildId, channelId, channelName, joinTime });

        // Also store in database
        await Database.execute(
            `INSERT INTO voice_sessions (guild_id, user_id, username, channel_id, channel_name, join_time)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [guildId, userId, username, channelId, channelName, joinTime.toISOString().slice(0, 19).replace('T', ' ')]
        );
    }

    // End voice session
    async endVoiceSession(userId, channelId, leaveTime) {
        const session = this.voiceSessions.get(userId);
        if (!session) return;

        const duration = Math.floor((leaveTime - new Date(session.joinTime)) / 1000); // in seconds

        await Database.execute(
            `UPDATE voice_sessions
             SET leave_time = ?, duration = ?
             WHERE user_id = ? AND channel_id = ? AND leave_time IS NULL`,
            [leaveTime.toISOString().slice(0, 19).replace('T', ' '), duration, userId, channelId]
        );

        this.voiceSessions.delete(userId);
    }

    // Send log to channel
    async sendLogToChannel(guild, action, embed) {
        const settings = await this.getGuildSettings(guild.id);

        if (!settings.enabled || !settings.log_channel_id) return;

        // Check if this action type should be logged
        const logActions = {
            join: settings.log_join,
            leave: settings.log_leave,
            move: settings.log_move,
            mute: settings.log_mute,
            unmute: settings.log_mute,
            deaf: settings.log_deaf,
            undeaf: settings.log_deaf,
            stream_start: settings.log_stream,
            stream_stop: settings.log_stream,
            video_on: settings.log_video,
            video_off: settings.log_video,
        };

        if (!logActions[action]) return;

        try {
            const logChannel = await guild.channels.fetch(settings.log_channel_id);
            if (logChannel && logChannel.type === ChannelType.GuildText) {
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            Logger.error(`Failed to send voice log to channel:`, error);
        }
    }

    // Get user voice statistics
    async getUserVoiceStats(guildId, userId) {
        const sessionResults = await Database.execute(
            `SELECT COUNT(*) as count FROM voice_sessions 
             WHERE guild_id = ? AND user_id = ? AND leave_time IS NOT NULL`,
            [guildId, userId]
        );

        const timeResults = await Database.execute(
            `SELECT SUM(duration) as total FROM voice_sessions 
             WHERE guild_id = ? AND user_id = ? AND leave_time IS NOT NULL`,
            [guildId, userId]
        );

        const recentLogs = await Database.execute(
            `SELECT * FROM voice_logs 
             WHERE guild_id = ? AND user_id = ? 
             ORDER BY timestamp DESC LIMIT 10`,
            [guildId, userId]
        );

        return {
            totalSessions: sessionResults[0]?.count || 0,
            totalTime: timeResults[0]?.total || 0,
            recentLogs: recentLogs || [],
        };
    }

    // Get guild voice statistics
    async getGuildVoiceStats(guildId, limit = 10) {
        const topUsers = await Database.execute(
            `SELECT user_id, username, SUM(duration) as total_time, COUNT(*) as sessions
             FROM voice_sessions 
             WHERE guild_id = ? AND leave_time IS NOT NULL
             GROUP BY user_id, username
             ORDER BY total_time DESC 
             LIMIT ?`,
            [guildId, limit]
        );

        const sessionResults = await Database.execute(
            `SELECT COUNT(*) as count FROM voice_sessions 
             WHERE guild_id = ? AND leave_time IS NOT NULL`,
            [guildId]
        );

        return {
            topUsers: topUsers || [],
            totalSessions: sessionResults[0]?.count || 0,
        };
    }

    // Format duration
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(" ");
    }
}

module.exports = VoiceLogger;
