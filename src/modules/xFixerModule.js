const Logger = require('../utils/Logger');

class XFixerModule {
    constructor(client) {
        this.client = client;
        this.name = 'XFixer';
        this.description = 'Automatically fixes X.com (Twitter) links to use fixvx.com for better embeds';
        this.enabled = true;
        this.version = '1.0.0';
    }

    async load() {
        Logger.loading(`Loading ${this.name} module v${this.version}...`);

        try {
            // Register event listener for message creation
            this.client.on('messageCreate', this.handleMessage.bind(this));

            Logger.module(`${this.name} module loaded successfully`);
        } catch (error) {
            Logger.error(`Failed to load ${this.name} module: ${error.message}`);
            throw error;
        }
    }

    async unload() {
        try {
            // Remove event listeners
            this.client.removeListener('messageCreate', this.handleMessage.bind(this));
            Logger.module(`${this.name} module unloaded successfully`);
        } catch (error) {
            Logger.error(`Failed to unload ${this.name} module: ${error.message}`);
        }
    }

    async handleMessage(message) {
        try {
            // Ignore bot messages and system messages
            if (message.author.bot || message.system) return;

            // Check if message contains X.com links
            const xLinkRegex = /https?:\/\/(www\.)?(x\.com|twitter\.com)\/[\w\/\?\=\&\.\-\%\#]+/gi;
            const matches = message.content.match(xLinkRegex);

            if (!matches || matches.length === 0) return;

            // Replace x.com/twitter.com with fixvx.com
            let fixedContent = message.content;
            let hasChanges = false;

            matches.forEach(link => {
                const fixedLink = this.fixXLink(link);
                if (fixedLink !== link) {
                    fixedContent = fixedContent.replace(link, fixedLink);
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                // Send the fixed message
                await message.channel.send({
                    content: `**Fixed links from ${message.author}:**\n${fixedContent}`,
                    allowedMentions: { parse: [] } // Prevent mentioning users in the fixed message
                });

                Logger.info(`Fixed X.com links in message from ${message.author.tag} in #${message.channel.name}`);
            }

        } catch (error) {
            Logger.error(`Error handling message for X fixer: ${error.message}`);
        }
    }

    /**
     * Fix X.com/Twitter.com link to use fixvx.com
     * @param {string} link - Original X.com or Twitter.com link
     * @returns {string} - Fixed link using fixvx.com
     */
    fixXLink(link) {
        try {
            const url = new URL(link);

            // Only fix x.com and twitter.com domains
            if (url.hostname === 'x.com' || url.hostname === 'www.x.com' ||
                url.hostname === 'twitter.com' || url.hostname === 'www.twitter.com') {

                // Replace domain with fixvx.com
                url.hostname = 'fixvx.com';

                return url.toString();
            }

            return link;
        } catch (error) {
            Logger.error(`Error fixing X link: ${error.message}`);
            return link;
        }
    }

    getModuleInfo() {
        return {
            name: this.name,
            description: this.description,
            version: this.version,
            enabled: this.enabled,
            commands: [],
            events: ['messageCreate'],
            stats: {
                linksFixed: this.linksFixed || 0
            }
        };
    }

    async healthCheck() {
        try {
            // Simple health check - ensure we can create URL objects
            new URL('https://x.com/test');

            return {
                status: 'healthy',
                healthy: true,
                service: 'running'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                healthy: false,
                error: error.message
            };
        }
    }
}

module.exports = XFixerModule;
