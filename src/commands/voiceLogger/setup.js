const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const BaseCommand = require("../../utils/BaseCommand");

class VoiceLoggerSetupCommand extends BaseCommand {
    constructor() {
        super({
            name: "voicelog-setup",
            description: "Setup voice logger for this server",
            category: "voiceLogger",
            module: "voiceLogger",
            cooldown: 5,
            permissions: [PermissionFlagsBits.ManageGuild],
            guildOnly: true,
            ownerOnly: false,
        });
    }

    getSlashCommandData() {
        return super
            .getSlashCommandData()
            .addChannelOption((option) =>
                option
                    .setName("channel")
                    .setDescription("The channel to send voice logs to")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const channel = interaction.options.getChannel("channel");

        const voiceLogger = interaction.client.moduleManager.getModule("voiceLogger");
        if (!voiceLogger) {
            await interaction.reply({
                content: "❌ Voice Logger module is not loaded!",
                ephemeral: true,
            });
            return;
        }

        // Check if bot has permission to send messages in the channel
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        const permissions = channel.permissionsFor(botMember);

        if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
            await interaction.reply({
                content: `❌ I don't have permission to send messages or embed links in ${channel}!`,
                ephemeral: true,
            });
            return;
        }

        await voiceLogger.updateGuildSettings(interaction.guildId, {
            log_channel_id: channel.id,
            enabled: 1,
        });

        const embed = new EmbedBuilder()
            .setColor("#00ff00")
            .setTitle("✅ Voice Logger Setup Complete")
            .setDescription(`Voice activity logs will be sent to ${channel}`)
            .addFields(
                {
                    name: "📋 Logged Events",
                    value:
                        "• User joins voice channel\n" +
                        "• User leaves voice channel\n" +
                        "• User moves between channels\n" +
                        "• Mute/Unmute changes\n" +
                        "• Deafen/Undeafen changes\n" +
                        "• Streaming start/stop\n" +
                        "• Camera on/off",
                },
                {
                    name: "⚙️ Configuration",
                    value:
                        "Use `/voicelog-settings` to customize which events to log\n" +
                        "Use `/voicelog-toggle` to enable/disable logging\n" +
                        "Use `/voicelog-stats` to view voice statistics",
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        const testEmbed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("🎤 Voice Logger Activated")
            .setDescription("This channel will now receive voice activity logs")
            .setTimestamp();

        await channel.send({ embeds: [testEmbed] });
    }
}

module.exports = VoiceLoggerSetupCommand;
