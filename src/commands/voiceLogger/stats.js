const { EmbedBuilder } = require("discord.js");
const BaseCommand = require("../../utils/BaseCommand");

class VoiceLoggerStatsCommand extends BaseCommand {
    constructor() {
        super({
            name: "voicelog-stats",
            description: "View voice activity statistics",
            category: "voiceLogger",
            module: "voiceLogger",
            cooldown: 5,
            permissions: [],
            guildOnly: true,
            ownerOnly: false,
        });
    }

    getSlashCommandData() {
        return super
            .getSlashCommandData()
            .addUserOption((option) =>
                option
                    .setName("user")
                    .setDescription("View stats for a specific user (leave empty for server stats)")
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        if (!this.isSlashCommand(interaction)) {
            return await interaction.reply({
                content: "❌ This command can only be used as a slash command!",
                ephemeral: true,
            });
        }

        const targetUser = interaction.options.getUser("user");

        // Get voice logger module
        const voiceLogger = interaction.client.moduleManager.getModule("voiceLogger");
        if (!voiceLogger) {
            await interaction.reply({
                content: "❌ Voice Logger module is not loaded!",
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        if (targetUser) {
            // Show user stats
            await this.showUserStats(interaction, voiceLogger, targetUser);
        } else {
            // Show guild stats
            await this.showGuildStats(interaction, voiceLogger);
        }
    }

    async showUserStats(interaction, voiceLogger, user) {
        const stats = await voiceLogger.getUserVoiceStats(interaction.guildId, user.id);

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`🎤 Voice Statistics for ${user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                {
                    name: "📊 Total Sessions",
                    value: `${stats.totalSessions}`,
                    inline: true,
                },
                {
                    name: "⏱️ Total Time",
                    value: voiceLogger.formatDuration(stats.totalTime),
                    inline: true,
                },
                {
                    name: "📈 Average Session",
                    value:
                        stats.totalSessions > 0
                            ? voiceLogger.formatDuration(Math.floor(stats.totalTime / stats.totalSessions))
                            : "N/A",
                    inline: true,
                }
            )
            .setTimestamp();

        // Add recent activity
        if (stats.recentLogs.length > 0) {
            const recentActivity = stats.recentLogs
                .slice(0, 5)
                .map((log) => {
                    const timestamp = new Date(log.timestamp);
                    const timeStr = `<t:${Math.floor(timestamp.getTime() / 1000)}:R>`;
                    const actionEmoji = this.getActionEmoji(log.action);
                    return `${actionEmoji} **${this.formatAction(log.action)}** ${timeStr}`;
                })
                .join("\n");

            embed.addFields({
                name: "📝 Recent Activity",
                value: recentActivity || "No recent activity",
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }

    async showGuildStats(interaction, voiceLogger) {
        const stats = await voiceLogger.getGuildVoiceStats(interaction.guildId, 10);

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`🎤 Voice Statistics for ${interaction.guild.name}`)
            .setThumbnail(interaction.guild.iconURL())
            .addFields({
                name: "📊 Total Sessions",
                value: `${stats.totalSessions}`,
                inline: true,
            })
            .setTimestamp();

        // Add top users
        if (stats.topUsers.length > 0) {
            const topUsersText = stats.topUsers
                .map((user, index) => {
                    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
                    const timeStr = voiceLogger.formatDuration(user.total_time);
                    return `${medal} **${user.username}** - ${timeStr} (${user.sessions} sessions)`;
                })
                .join("\n");

            embed.addFields({
                name: "🏆 Most Active Users",
                value: topUsersText,
            });
        } else {
            embed.addFields({
                name: "🏆 Most Active Users",
                value: "No data available yet",
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }

    getActionEmoji(action) {
        const emojis = {
            join: "🟢",
            leave: "🔴",
            move: "🔄",
            mute: "🔇",
            unmute: "🔊",
            deaf: "🔇",
            undeaf: "🔊",
            stream_start: "📹",
            stream_stop: "⏹️",
            video_on: "📷",
            video_off: "📷",
        };
        return emojis[action] || "📝";
    }

    formatAction(action) {
        const actions = {
            join: "Joined",
            leave: "Left",
            move: "Moved",
            mute: "Muted",
            unmute: "Unmuted",
            deaf: "Deafened",
            undeaf: "Undeafened",
            stream_start: "Started Streaming",
            stream_stop: "Stopped Streaming",
            video_on: "Camera On",
            video_off: "Camera Off",
        };
        return actions[action] || action;
    }
}

module.exports = VoiceLoggerStatsCommand;
