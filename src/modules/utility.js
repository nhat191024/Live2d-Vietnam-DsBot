const Logger = require('../utils/Logger');

class UtilityModule {
    constructor(client) {
        this.client = client;
        this.name = 'utility';
        this.description = 'Basic utility commands and features';
        this.enabled = true;
    }

    async load() {
        Logger.loading(`Loading ${this.name} module...`);

        // Initialize module-specific features here
        // For example: database connections, external APIs, etc.

        Logger.module(`${this.name} module loaded successfully`);
    }

    async unload() {
        Logger.loading(`Unloading ${this.name} module...`);

        // Clean up module-specific resources here

        Logger.module(`${this.name} module unloaded successfully`);
    }

    async reload() {
        await this.unload();
        await this.load();
    }

    // Module-specific methods can be added here
    getModuleInfo() {
        return {
            name: this.name,
            description: this.description,
            enabled: this.enabled,
            commands: this.client.moduleManager.commands.size,
            events: this.client.moduleManager.events.size
        };
    }
}

module.exports = UtilityModule;
