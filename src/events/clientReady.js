const { ActivityType } = require('discord.js');
const BaseEvent = require('../utils/BaseEvent');
const Logger = require('../utils/Logger');

class ClientReadyEvent extends BaseEvent {
    constructor() {
        super({
            name: 'clientReady',
            once: true,
            module: 'core'
        });
    }

    async execute(client) {
        Logger.discord(`🤖 ${client.user.tag} is online!`);
        Logger.discord(`📊 Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);

        // Register slash commands after bot is ready
        await client.moduleManager.registerSlashCommands();

        // Set bot status
        client.user.setActivity('Discord Bot | /help', { type: ActivityType.Playing });

        Logger.success('🚀 Bot is fully operational and ready to serve!');
    }
}

module.exports = ClientReadyEvent;
