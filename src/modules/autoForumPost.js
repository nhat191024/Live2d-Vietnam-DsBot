const Logger = require('../utils/Logger');
const Database = require('../utils/Database');

class AutoForumPostModule {
    constructor(client) {
        this.client = client;
        this.name = 'AutoForumPost';
        this.description = 'Automated forum posting features';
        this.enabled = true;
        this.version = '1.0.0';
    }

    async load() {
        Logger.loading(`Loading ${this.name} module v${this.version}...`);

        try {
            // Create database tables if they don't exist
            await this.createTables();

            this.client.on('messageCreate', this.handleMessage.bind(this));

            Logger.module(`${this.name} module loaded successfully`);
        } catch (error) {
            Logger.error(`Failed to load ${this.name} module: ${error.message}`);
            throw error;
        }
    }

    async unload() {
        try {
            this.client.removeListener('messageCreate', this.handleMessage.bind(this));
            Logger.module(`${this.name} module unloaded successfully`);
        } catch (error) {
            Logger.error(`Failed to unload ${this.name} module: ${error.message}`);
        }
    }

    async createTables() {
        try {
            const query = `
                CREATE TABLE IF NOT EXISTS auto_forum_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    guild_id VARCHAR(20) NOT NULL,
                    channel_id VARCHAR(20) NOT NULL,
                    forum_id VARCHAR(20) NOT NULL,
                    tag_name VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_guild_channel (guild_id, channel_id)
                )
            `;

            await Database.execute(query);
            Logger.success('AutoForumPost tables created/verified');
        } catch (error) {
            Logger.error(`Failed to create AutoForumPost tables: ${error.message}`);
            throw error;
        }
    }

    async handleMessage(message) {
        try {
            // Ignore bot messages and system messages
            if (message.author.bot || message.system) return;

            // Check if this channel has auto forum posting enabled
            const settings = await this.getChannelSettings(message.guild.id, message.channel.id);

            if (!settings) return;

            // Create forum post
            await this.createForumPost(message, settings);

        } catch (error) {
            Logger.error(`Error handling message for auto forum post: ${error.message}`);
        }
    }

    async getChannelSettings(guildId, channelId) {
        try {
            const query = `
                SELECT * FROM auto_forum_settings 
                WHERE guild_id = ? AND channel_id = ?
            `;
            const rows = await Database.execute(query, [guildId, channelId]);

            if (rows && rows.length > 0) {
                return rows[0];
            }

            return null;
        } catch (error) {
            Logger.error(`Failed to get channel settings: ${error.message}`);
            return null;
        }
    }

    async createForumPost(message, settings) {
        try {
            const guild = message.guild;
            const forumChannel = guild.channels.cache.get(settings.forum_id);

            if (!forumChannel) {
                Logger.warn(`Forum channel ${settings.forum_id} not found`);
                return;
            }

            // Find the tag by name
            const tag = forumChannel.availableTags.find(t => t.name === settings.tag_name);
            const appliedTags = tag ? [tag.id] : [];

            const lines = message.content.split('\n');
            const firstLine = lines[0] || ''; // Dòng đầu
            const lastLine = lines[lines.length - 1] || '';
            console.log(`Dòng đầu: ${firstLine}`);

            // Create the forum post
            const thread = await forumChannel.threads.create({
                name: firstLine,
                message: {
                    content: `**Original message from ${message.author}:**\n\n${message.content}`,
                    embeds: message.embeds,
                    files: Array.from(message.attachments.values())
                },
                appliedTags: appliedTags
            });

            Logger.success(`Created forum post: ${thread.name} in ${forumChannel.name}`);

            // Optional: React to original message to show it was processed
            await message.react('✅');

        } catch (error) {
            Logger.error(`Failed to create forum post: ${error.message}`);
        }
    }

    async saveSettings(guildId, channelId, forumId, tagName) {
        try {
            const query = `
                INSERT INTO auto_forum_settings (guild_id, channel_id, forum_id, tag_name)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                forum_id = VALUES(forum_id),
                tag_name = VALUES(tag_name)
            `;

            await Database.execute(query, [guildId, channelId, forumId, tagName]);
            Logger.success(`Saved auto forum settings for guild ${guildId}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to save auto forum settings: ${error.message}`);
            return false;
        }
    }

    async removeSettings(guildId, channelId) {
        try {
            const query = `
                DELETE FROM auto_forum_settings 
                WHERE guild_id = ? AND channel_id = ?
            `;

            const result = await Database.execute(query, [guildId, channelId]);
            Logger.success(`Removed auto forum settings for guild ${guildId}, channel ${channelId}`);
            return result.affectedRows > 0;
        } catch (error) {
            Logger.error(`Failed to remove auto forum settings: ${error.message}`);
            return false;
        }
    }

    async getGuildSettings(guildId) {
        try {
            const query = `
                SELECT * FROM auto_forum_settings 
                WHERE guild_id = ?
                ORDER BY created_at DESC
            `;
            const rows = await Database.execute(query, [guildId]);

            return rows;
        } catch (error) {
            Logger.error(`Failed to get guild settings: ${error.message}`);
            return [];
        }
    }

    getModuleInfo() {
        return {
            name: this.name,
            description: this.description,
            version: this.version,
            enabled: this.enabled,
            commands: ['setup', 'remove', 'list'],
            events: ['messageCreate']
        };
    }

    async healthCheck() {
        try {
            // Check database connection
            await Database.execute('SELECT 1');

            // Check if tables exist
            const tables = await Database.execute(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name = 'auto_forum_settings'
            `);

            return {
                status: 'healthy',
                database: 'connected',
                tables: tables[0].count > 0 ? 'exists' : 'missing'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = AutoForumPostModule;