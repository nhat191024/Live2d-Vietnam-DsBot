const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const BaseCommand = require("../../utils/BaseCommand");

class VoiceLoggerToggleCommand extends BaseCommand {
    constructor() {
        super({
            name: "voicelog-toggle",
            description: "Enable or disable voice logging",
            category: "voiceLogger",
            module: "voiceLogger",
            cooldown: 3,
            permissions: [PermissionFlagsBits.ManageGuild],
            guildOnly: true,
            ownerOnly: false,
        });
    }

    getSlashCommandData() {
        return super
            .getSlashCommandData()
            .addBooleanOption((option) =>
                option
                    .setName("enabled")
                    .setDescription("Enable or disable voice logging")
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const enabled = interaction.options.getBoolean("enabled");

        // Get voice logger module
        const voiceLogger = interaction.client.moduleManager.getModule("voiceLogger");
        if (!voiceLogger) {
            await interaction.reply({
                content: "❌ Voice Logger module is not loaded!",
                ephemeral: true,
            });
            return;
        }

        // Check if logging is set up
        const settings = await voiceLogger.getGuildSettings(interaction.guildId);
        if (!settings.log_channel_id) {
            await interaction.reply({
                content: "❌ Voice logging is not set up yet! Use `/voicelog-setup` first.",
                ephemeral: true,
            });
            return;
        }

        // Update settings
        await voiceLogger.updateGuildSettings(interaction.guildId, {
            enabled: enabled ? 1 : 0,
        });

        const embed = new EmbedBuilder()
            .setColor(enabled ? "#00ff00" : "#ff0000")
            .setTitle(enabled ? "✅ Voice Logging Enabled" : "❌ Voice Logging Disabled")
            .setDescription(
                enabled
                    ? "Voice activity will now be logged"
                    : "Voice activity will no longer be logged"
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}

module.exports = VoiceLoggerToggleCommand;
