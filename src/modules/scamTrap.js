const Database = require('../utils/Database');
const Logger = require('../utils/Logger');

class ScamTrap {
    constructor(client) {
        this.client = client;
        this.timer = null;
        this.pending = new Set();
        this.onMessage = this.handleMessage.bind(this);
    }

    async load() {
        await Database.execute(`CREATE TABLE IF NOT EXISTS scam_trap_settings (
            guild_id VARCHAR(20) PRIMARY KEY,
            trap_channel_id VARCHAR(20) NOT NULL,
            alert_channel_id VARCHAR(20) NULL,
            ban_minutes INT NOT NULL DEFAULT 60,
            enabled BOOLEAN NOT NULL DEFAULT TRUE
        )`);
        await Database.execute(`CREATE TABLE IF NOT EXISTS scam_trap_bans (
            guild_id VARCHAR(20) NOT NULL,
            user_id VARCHAR(20) NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (guild_id, user_id),
            INDEX idx_expires_at (expires_at)
        )`);
        this.timer = setInterval(() => this.releaseExpired().catch(error => Logger.error(`Scam trap release: ${error.message}`)), 30000);
        this.timer.unref?.();
        this.client.on('messageCreate', this.onMessage);
    }

    async unload() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.client.off('messageCreate', this.onMessage);
    }

    async getSettings(guildId) {
        const rows = await Database.execute('SELECT * FROM scam_trap_settings WHERE guild_id = ?', [guildId]);
        return rows[0] || null;
    }

    async configure(guildId, trapId, alertId, minutes) {
        await Database.execute(`INSERT INTO scam_trap_settings (guild_id, trap_channel_id, alert_channel_id, ban_minutes, enabled)
            VALUES (?, ?, ?, ?, TRUE) ON DUPLICATE KEY UPDATE trap_channel_id = VALUES(trap_channel_id),
            alert_channel_id = VALUES(alert_channel_id), ban_minutes = VALUES(ban_minutes), enabled = TRUE`,
        [guildId, trapId, alertId, minutes]);
    }

    async setEnabled(guildId, enabled) {
        await Database.execute('UPDATE scam_trap_settings SET enabled = ? WHERE guild_id = ?', [enabled, guildId]);
    }

    async handleMessage(message) {
        if (!message.guild || message.author.id === this.client.user.id ||
            !this.client.moduleManager.isModuleEnabled('scamTrap')) return;
        const settings = await this.getSettings(message.guild.id);
        if (!settings?.enabled || message.channelId !== settings.trap_channel_id) return;

        // Prevent duplicate moderation if multiple messages arrive together.
        const key = `${message.guild.id}:${message.author.id}`;
        if (this.pending.has(key)) {
            await message.delete().catch(error => Logger.warn(`Scam trap delete failed: ${error.message}`));
            return;
        }
        this.pending.add(key);
        try {
            const deleted = await message.delete().then(() => true).catch(error => {
                Logger.warn(`Scam trap delete failed: ${error.message}`);
                return false;
            });

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
                    await message.guild.members.ban(message.author.id, { reason: `Scam trap: sent a message in ${message.channel.name}` });
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
                        content: `🚨 Kênh bẫy ${message.channel}: <@${message.author.id}> (${message.author.id}) đã gửi tin nhắn. Xóa: ${deleted ? 'thành công' : 'thất bại'}. Ban tạm: ${banned ? `${settings.ban_minutes} phút` : detail || 'không thực hiện'}.`,
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
