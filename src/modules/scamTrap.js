const Database = require('../utils/Database');
const Logger = require('../utils/Logger');

class ScamTrap {
    constructor(client) {
        this.client = client;
        this.timer = null;
        this.pending = new Set();
        this.recentMessages = new Map();
        this.onMessage = this.handleMessage.bind(this);
    }

    async load() {
        await Database.execute(`CREATE TABLE IF NOT EXISTS scam_trap_settings (
            guild_id VARCHAR(20) PRIMARY KEY,
            trap_channel_id VARCHAR(20) NULL,
            alert_channel_id VARCHAR(20) NULL,
            ban_minutes INT NOT NULL DEFAULT 60,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            trap_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            spam_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            spam_channel_count INT NOT NULL DEFAULT 5,
            spam_window_seconds INT NOT NULL DEFAULT 5
        )`);
        const columns = await Database.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scam_trap_settings'`);
        const names = new Set(columns.map(column => column.COLUMN_NAME));
        if (!names.has('trap_enabled')) await Database.execute('ALTER TABLE scam_trap_settings ADD COLUMN trap_enabled BOOLEAN NOT NULL DEFAULT TRUE');
        if (!names.has('spam_enabled')) await Database.execute('ALTER TABLE scam_trap_settings ADD COLUMN spam_enabled BOOLEAN NOT NULL DEFAULT TRUE');
        if (!names.has('spam_channel_count')) await Database.execute('ALTER TABLE scam_trap_settings ADD COLUMN spam_channel_count INT NOT NULL DEFAULT 5');
        if (!names.has('spam_window_seconds')) await Database.execute('ALTER TABLE scam_trap_settings ADD COLUMN spam_window_seconds INT NOT NULL DEFAULT 5');
        await Database.execute('ALTER TABLE scam_trap_settings MODIFY COLUMN trap_channel_id VARCHAR(20) NULL');
        await Database.execute(`CREATE TABLE IF NOT EXISTS scam_trap_bans (
            guild_id VARCHAR(20) NOT NULL,
            user_id VARCHAR(20) NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (guild_id, user_id),
            INDEX idx_expires_at (expires_at)
        )`);
        this.timer = setInterval(() => {
            this.releaseExpired().catch(error => Logger.error(`Scam trap release: ${error.message}`));
            this.pruneRecentMessages(Date.now());
        }, 30000);
        this.timer.unref?.();
        this.client.on('messageCreate', this.onMessage);
    }

    async unload() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.client.off('messageCreate', this.onMessage);
        this.recentMessages.clear();
    }

    async getSettings(guildId) {
        const rows = await Database.execute('SELECT * FROM scam_trap_settings WHERE guild_id = ?', [guildId]);
        return rows[0] || null;
    }

    async configure(guildId, trapId, alertId, minutes) {
        await this.updateSettings(guildId, {
            trap_channel_id: trapId, alert_channel_id: alertId, ban_minutes: minutes,
            enabled: true, trap_enabled: true, spam_enabled: true
        });
    }

    async updateSettings(guildId, updates) {
        const allowed = new Set(['trap_channel_id', 'alert_channel_id', 'ban_minutes', 'enabled',
            'trap_enabled', 'spam_enabled', 'spam_channel_count', 'spam_window_seconds']);
        const entries = Object.entries(updates);
        if (!entries.length || entries.some(([name]) => !allowed.has(name))) throw new Error('Invalid scam trap setting');
        await Database.execute(`INSERT IGNORE INTO scam_trap_settings
            (guild_id, enabled, trap_enabled, spam_enabled) VALUES (?, FALSE, FALSE, FALSE)`, [guildId]);
        await Database.execute(`UPDATE scam_trap_settings SET ${entries.map(([name]) => `${name} = ?`).join(', ')} WHERE guild_id = ?`,
            [...entries.map(([, value]) => value), guildId]);
        if (updates.enabled === false || updates.spam_enabled !== undefined ||
            updates.spam_window_seconds !== undefined || updates.spam_channel_count !== undefined) {
            this.clearRecentMessages(guildId);
        }
    }

    clearRecentMessages(guildId) {
        for (const key of this.recentMessages.keys()) {
            if (key.startsWith(`${guildId}:`)) this.recentMessages.delete(key);
        }
    }

    async setEnabled(guildId, enabled) {
        await this.updateSettings(guildId, { enabled });
    }

    async handleMessage(message) {
        if (!message.guild || message.author.id === this.client.user.id ||
            !this.client.moduleManager.isModuleEnabled('scamTrap')) return;
        const settings = await this.getSettings(message.guild.id);
        if (!settings?.enabled) return;

        const inTrap = !!settings.trap_enabled && message.channelId === settings.trap_channel_id;
        const key = `${message.guild.id}:${message.author.id}`;
        if (this.pending.has(key)) {
            await message.delete().catch(error => Logger.warn(`Scam trap delete failed: ${error.message}`));
            return;
        }
        if (!inTrap && (!settings.spam_enabled || message.author.bot)) return;

        const recent = inTrap ? [] : this.recordMessage(key, message, settings.spam_window_seconds);
        const channels = new Set(recent.map(item => item.channelId));
        if (!inTrap && channels.size < settings.spam_channel_count) return;

        this.pending.add(key);
        this.recentMessages.delete(key);
        try {
            const messages = inTrap ? [message] : recent.map(item => item.message);
            const deletion = await Promise.allSettled(messages.map(item => item.delete()));
            const deleted = deletion.filter(result => result.status === 'fulfilled').length;
            for (const result of deletion) {
                if (result.status === 'rejected') Logger.warn(`Scam trap delete failed: ${result.reason?.message || result.reason}`);
            }

            let banned = false;
            let detail = '';
            try {
                const existing = await message.guild.bans.fetch(message.author.id).catch(error => {
                    if (error.code === 10026) return null;
                    throw error;
                });
                if (existing) {
                    detail = 'Tài khoản đã bị ban trước đó; không đặt lịch gỡ ban.';
                } else {
                    const member = message.member || await message.guild.members.fetch(message.author.id);
                    if (!member.bannable) throw new Error('Bot không thể ban thành viên này (quyền hoặc role hierarchy).');
                    await message.guild.members.ban(message.author.id, { reason: inTrap
                        ? `Scam trap: sent a message in ${message.channel.name}`
                        : `Scam trap: sent messages in ${settings.spam_channel_count} channels within ${settings.spam_window_seconds} seconds` });
                    banned = true;
                    try {
                        await Database.execute(`INSERT INTO scam_trap_bans (guild_id, user_id, expires_at)
                        VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
                        ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)`,
                        [message.guild.id, message.author.id, settings.ban_minutes]);
                    } catch (error) {
                        await message.guild.members.unban(message.author.id, 'Scam trap scheduling failed').catch(() => {});
                        banned = false;
                        throw error;
                    }
                }
            } catch (error) {
                detail = `Ban thất bại: ${error.message}`;
                Logger.error(`Scam trap ban failed: ${error.message}`);
            }

            if (settings.alert_channel_id) {
                try {
                    const channel = await message.guild.channels.fetch(settings.alert_channel_id);
                    await channel.send({
                        content: `🚨 ${inTrap ? `Kênh bẫy ${message.channel}` : `Spam ${channels.size} kênh trong ${settings.spam_window_seconds} giây (${[...channels].map(id => `<#${id}>`).join(', ')})`}: <@${message.author.id}> (${message.author.id}). Xóa: ${deleted}/${messages.length} tin. Ban tạm: ${banned ? `${settings.ban_minutes} phút` : detail || 'không thực hiện'}.`,
                        allowedMentions: { parse: [] }
                    });
                } catch (error) {
                    Logger.error(`Scam trap alert failed: ${error.message}`);
                }
            }
        } finally {
            this.pending.delete(key);
        }
    }

    recordMessage(key, message, windowSeconds = 5) {
        const now = message.createdTimestamp || Date.now();
        const recent = this.recentMessages.get(key) || [];
        recent.push({ message, channelId: message.channelId, timestamp: now });
        const latest = Math.max(...recent.map(item => item.timestamp));
        const active = recent.filter(item => latest - item.timestamp <= windowSeconds * 1000);
        // Bound memory while retaining at least one message from each channel.
        while (active.length > 100) {
            const duplicate = active.findIndex((item, index) =>
                active.some((other, otherIndex) => otherIndex > index && other.channelId === item.channelId));
            active.splice(duplicate >= 0 ? duplicate : 0, 1);
        }
        this.recentMessages.set(key, active);
        return active;
    }

    pruneRecentMessages(now) {
        for (const [key, messages] of this.recentMessages) {
            const recent = messages.filter(item => now - item.timestamp <= 60000);
            if (recent.length) this.recentMessages.set(key, recent);
            else this.recentMessages.delete(key);
        }
    }

    async releaseExpired() {
        const rows = await Database.execute('SELECT guild_id, user_id FROM scam_trap_bans WHERE expires_at <= UTC_TIMESTAMP()');
        for (const row of rows) {
            try {
                const guild = await this.client.guilds.fetch(row.guild_id);
                await guild.members.unban(row.user_id, 'Scam trap temporary ban expired').catch(error => {
                    if (error.code !== 10026) throw error;
                });
                await Database.execute('DELETE FROM scam_trap_bans WHERE guild_id = ? AND user_id = ?', [row.guild_id, row.user_id]);
            } catch (error) {
                Logger.error(`Scam trap unban failed for ${row.guild_id}/${row.user_id}: ${error.message}`);
            }
        }
    }
}

module.exports = ScamTrap;
