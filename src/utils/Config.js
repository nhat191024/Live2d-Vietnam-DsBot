require('dotenv').config({ quiet: true });

class Config {
    constructor() {
        // Cache for module states (since we can't persist to .env easily)
        this.moduleStates = new Map();
        this.loadModuleStates();
    }

    // Load module states from environment or set defaults
    loadModuleStates() {
        // Set default module states
        this.moduleStates.set('fun', process.env.MODULE_FUN === 'false' ? false : true);
        this.moduleStates.set('autoforumpost', process.env.MODULE_AUTOFORUMPOST === 'false' ? false : true);
        this.moduleStates.set('xfixer', process.env.MODULE_XFIXER === 'false' ? false : true);
        // Add more modules as needed
    }

    get(key) {
        switch (key) {
            case 'token':
                return process.env.DISCORD_TOKEN;
            case 'prefix':
                return process.env.BOT_PREFIX || '!';
            case 'clientId':
                return process.env.DISCORD_CLIENT_ID;
            case 'guildId':
                return process.env.DISCORD_GUILD_ID;
            case 'environment':
                return process.env.NODE_ENV || 'development';
            default:
                return process.env[key.toUpperCase()];
        }
    }

    set(key, value) {
        // For environment variables, we can only update runtime values
        // Not persisted to .env file (would require manual editing)
        process.env[key.toUpperCase()] = value;
        console.warn(`⚠️  Config change for '${key}' is temporary. Update .env file for persistence.`);
    }

    isModuleEnabled(moduleName) {
        return this.moduleStates.get(moduleName) !== false;
    }

    enableModule(moduleName) {
        this.moduleStates.set(moduleName, true);
        console.log(`✅ Module '${moduleName}' enabled (runtime only)`);
    }

    disableModule(moduleName) {
        this.moduleStates.set(moduleName, false);
        console.log(`❌ Module '${moduleName}' disabled (runtime only)`);
    }

    // Get database configuration
    getDatabase() {
        return {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };
    }

    // Validate required environment variables
    validate() {
        const required = ['DISCORD_TOKEN', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
        const missing = required.filter(key => !process.env[key]);

        if (missing.length > 0) {
            console.error('❌ Missing required environment variables:', missing);
            console.error('📝 Please check your .env file');
            process.exit(1);
        }
    }
}

module.exports = new Config();
