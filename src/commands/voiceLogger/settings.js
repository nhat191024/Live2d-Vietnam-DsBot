const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const BaseCommand = require("../../utils/BaseCommand");

class VoiceLoggerSettingsCommand extends BaseCommand {
    constructor() {
        super({
            name: "voicelog-settings",
            description: "Configure which voice events to log",
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
                    .setName("join")
                    .setDescription("Log when users join voice channels")
                    .setRequired(false)
            )
            .addBooleanOption((option) =>
                option
                    .setName("leave")
                    .setDescription("Log when users leave voice channels")
                    .setRequired(false)
            )
            .addBooleanOption((option) =>
                option
                    .setName("move")
                    .setDescription("Log when users move between voice channels")
                    .setRequired(false)
            )
            .addBooleanOption((option) =>
                option
                    .setName("mute")
                    .setDescription("Log when users mute/unmute")
                    .setRequired(false)
            )
            .addBooleanOption((option) =>
                option
                    .setName("deaf")
                    .setDescription("Log when users deafen/undeafen")
                    .setRequired(false)
            )
            .addBooleanOption((option) =>
                option
                    .setName("stream")
                    .setDescription("Log when users start/stop streaming")
                    .setRequired(false)
            )
            .addBooleanOption((option) =>
                option
                    .setName("video")
                    .setDescription("Log when users turn camera on/off")
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        // Get voice logger module
        const voiceLogger = interaction.client.moduleManager.getModule("voiceLogger");
        if (!voiceLogger) {
            await interaction.reply({
                content: "❌ Voice Logger module is not loaded!",
                ephemeral: true,
            });
            return;
        }

        // Get current settings
        const currentSettings = await voiceLogger.getGuildSettings(interaction.guildId);

        // Check if any options were provided
        const join = interaction.options.getBoolean("join");
        const leave = interaction.options.getBoolean("leave");
        const move = interaction.options.getBoolean("move");
        const mute = interaction.options.getBoolean("mute");
        const deaf = interaction.options.getBoolean("deaf");
        const stream = interaction.options.getBoolean("stream");
        const video = interaction.options.getBoolean("video");

        const hasUpdates =
            join !== null ||
            leave !== null ||
            move !== null ||
            mute !== null ||
            deaf !== null ||
            stream !== null ||
            video !== null;

        if (hasUpdates) {
            // Update settings
            const updates = {};
            if (join !== null) updates.log_join = join ? 1 : 0;
            if (leave !== null) updates.log_leave = leave ? 1 : 0;
            if (move !== null) updates.log_move = move ? 1 : 0;
            if (mute !== null) updates.log_mute = mute ? 1 : 0;
            if (deaf !== null) updates.log_deaf = deaf ? 1 : 0;
            if (stream !== null) updates.log_stream = stream ? 1 : 0;
            if (video !== null) updates.log_video = video ? 1 : 0;

            await voiceLogger.updateGuildSettings(interaction.guildId, updates);

            // Get updated settings
            const updatedSettings = await voiceLogger.getGuildSettings(interaction.guildId);

            const embed = new EmbedBuilder()
                .setColor("#00ff00")
                .setTitle("✅ Voice Logger Settings Updated")
                .setDescription("The following events will be logged:")
                .addFields(
                    {
                        name: "Join/Leave",
                        value:
                            `${updatedSettings.log_join ? "✅" : "❌"} Join\n` +
                            `${updatedSettings.log_leave ? "✅" : "❌"} Leave\n` +
                            `${updatedSettings.log_move ? "✅" : "❌"} Move`,
                        inline: true,
                    },
                    {
                        name: "Audio State",
                        value:
                            `${updatedSettings.log_mute ? "✅" : "❌"} Mute/Unmute\n` +
                            `${updatedSettings.log_deaf ? "✅" : "❌"} Deaf/Undeaf`,
                        inline: true,
                    },
                    {
                        name: "Streaming",
                        value:
                            `${updatedSettings.log_stream ? "✅" : "❌"} Stream\n` +
                            `${updatedSettings.log_video ? "✅" : "❌"} Video`,
                        inline: true,
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else {
            // Show current settings
            const embed = new EmbedBuilder()
                .setColor("#0099ff")
                .setTitle("⚙️ Voice Logger Settings")
                .setDescription("Current logging configuration:")
                .addFields(
                    {
                        name: "Join/Leave",
                        value:
                            `${currentSettings.log_join ? "✅" : "❌"} Join\n` +
                            `${currentSettings.log_leave ? "✅" : "❌"} Leave\n` +
                            `${currentSettings.log_move ? "✅" : "❌"} Move`,
                        inline: true,
                    },
                    {
                        name: "Audio State",
                        value:
                            `${currentSettings.log_mute ? "✅" : "❌"} Mute/Unmute\n` +
                            `${currentSettings.log_deaf ? "✅" : "❌"} Deaf/Undeaf`,
                        inline: true,
                    },
                    {
                        name: "Streaming",
                        value:
                            `${currentSettings.log_stream ? "✅" : "❌"} Stream\n` +
                            `${currentSettings.log_video ? "✅" : "❌"} Video`,
                        inline: true,
                    },
                    {
                        name: "How to Update",
                        value:
                            "Use the command options to change settings:\n" +
                            "`/voicelog-settings join:false` - Disable join logging\n" +
                            "`/voicelog-settings stream:true` - Enable stream logging",
                    }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
}

module.exports = VoiceLoggerSettingsCommand;
