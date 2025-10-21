const BaseEvent = require("../utils/BaseEvent");
const Logger = require("../utils/Logger");
const { EmbedBuilder } = require("discord.js");

class VoiceStateUpdateEvent extends BaseEvent {
    constructor() {
        super({
            name: "voiceStateUpdate",
            module: "voiceLogger",
        });
    }

    async execute(oldState, newState) {
        const client = oldState.client || newState.client;
        const voiceLogger = client.moduleManager.getModule("voiceLogger");

        if (!voiceLogger) return;

        const guild = newState.guild;
        const member = newState.member;
        const userId = member.id;
        const username = member.user.tag;

        const settings = await voiceLogger.getGuildSettings(guild.id);
        if (!settings.enabled) return;

        const now = new Date();

        if (!oldState.channelId && newState.channelId) {
            await this.handleJoin(voiceLogger, guild, member, newState, now);
        }
        // User left a voice channel
        else if (oldState.channelId && !newState.channelId) {
            await this.handleLeave(voiceLogger, guild, member, oldState, now);
        }
        // User moved between voice channels
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await this.handleMove(voiceLogger, guild, member, oldState, newState, now);
        }
        // User state changed (mute, deaf, stream, video)
        else if (oldState.channelId && newState.channelId) {
            await this.handleStateChange(voiceLogger, guild, member, oldState, newState, now);
        }
    }

    async handleJoin(voiceLogger, guild, member, state, timestamp) {
        const channelId = state.channelId;
        const channel = state.channel;
        const channelName = channel ? channel.name : "Unknown Channel";

        await voiceLogger.logVoiceActivity(
            guild.id,
            member.id,
            member.user.tag,
            channelId,
            channelName,
            "join"
        );

        await voiceLogger.startVoiceSession(
            guild.id,
            member.id,
            member.user.tag,
            channelId,
            channelName,
            timestamp
        );

        const embed = new EmbedBuilder()
            .setColor("#00ff00")
            .setAuthor({
                name: member.user.tag,
                iconURL: member.user.displayAvatarURL(),
            })
            .setDescription(`🟢 **Joined voice channel**`)
            .addFields({
                name: "Channel",
                value: `🔊 ${channelName}`,
                inline: true,
            })
            .setTimestamp(timestamp)
            .setFooter({ text: `User ID: ${member.id}` });

        await voiceLogger.sendLogToChannel(guild, "join", embed);
    }

    async handleLeave(voiceLogger, guild, member, state, timestamp) {
        const channelId = state.channelId;
        const channel = state.channel;
        const channelName = channel ? channel.name : "Unknown Channel";

        const session = voiceLogger.voiceSessions.get(member.id);
        await voiceLogger.endVoiceSession(member.id, channelId, timestamp);

        let duration = "Unknown";
        if (session) {
            const durationSeconds = Math.floor((timestamp - new Date(session.joinTime)) / 1000);
            duration = voiceLogger.formatDuration(durationSeconds);
        }

        await voiceLogger.logVoiceActivity(
            guild.id,
            member.id,
            member.user.tag,
            channelId,
            channelName,
            "leave",
            { duration: duration }
        );

        const embed = new EmbedBuilder()
            .setColor("#ff0000")
            .setAuthor({
                name: member.user.tag,
                iconURL: member.user.displayAvatarURL(),
            })
            .setDescription(`🔴 **Left voice channel**`)
            .addFields(
                {
                    name: "Channel",
                    value: `🔊 ${channelName}`,
                    inline: true,
                },
                {
                    name: "Duration",
                    value: `⏱️ ${duration}`,
                    inline: true,
                }
            )
            .setTimestamp(timestamp)
            .setFooter({ text: `User ID: ${member.id}` });

        await voiceLogger.sendLogToChannel(guild, "leave", embed);
    }

    async handleMove(voiceLogger, guild, member, oldState, newState, timestamp) {
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        const oldChannel = oldState.channel;
        const newChannel = newState.channel;
        const oldChannelName = oldChannel ? oldChannel.name : "Unknown";
        const newChannelName = newChannel ? newChannel.name : "Unknown";

        await voiceLogger.endVoiceSession(member.id, oldChannelId, timestamp);

        await voiceLogger.startVoiceSession(
            guild.id,
            member.id,
            member.user.tag,
            newChannelId,
            newChannelName,
            timestamp
        );

        await voiceLogger.logVoiceActivity(
            guild.id,
            member.id,
            member.user.tag,
            newChannelId,
            newChannelName,
            "move",
            { from: oldChannelName, to: newChannelName }
        );

        const embed = new EmbedBuilder()
            .setColor("#ffaa00")
            .setAuthor({
                name: member.user.tag,
                iconURL: member.user.displayAvatarURL(),
            })
            .setDescription(`🔄 **Moved voice channels**`)
            .addFields(
                {
                    name: "From",
                    value: `🔊 ${oldChannelName}`,
                    inline: true,
                },
                {
                    name: "To",
                    value: `🔊 ${newChannelName}`,
                    inline: true,
                }
            )
            .setTimestamp(timestamp)
            .setFooter({ text: `User ID: ${member.id}` });

        await voiceLogger.sendLogToChannel(guild, "move", embed);
    }

    async handleStateChange(voiceLogger, guild, member, oldState, newState, timestamp) {
        const channelId = newState.channelId;
        const channel = newState.channel;
        const channelName = channel ? channel.name : "Unknown Channel";
        const changes = [];

        if (oldState.serverMute !== newState.serverMute) {
            const action = newState.serverMute ? "Server Muted" : "Server Unmuted";
            const emoji = newState.serverMute ? "🔇" : "🔊";
            changes.push({ action, emoji, type: "mute" });

            await voiceLogger.logVoiceActivity(
                guild.id,
                member.id,
                member.user.tag,
                channelId,
                channelName,
                newState.serverMute ? "mute" : "unmute",
                { type: "server" }
            );
        }

        // Self mute
        if (oldState.selfMute !== newState.selfMute) {
            const action = newState.selfMute ? "Self Muted" : "Self Unmuted";
            const emoji = newState.selfMute ? "🔇" : "🔊";
            changes.push({ action, emoji, type: "mute" });

            await voiceLogger.logVoiceActivity(
                guild.id,
                member.id,
                member.user.tag,
                channelId,
                channelName,
                newState.selfMute ? "mute" : "unmute",
                { type: "self" }
            );
        }

        // Server deaf
        if (oldState.serverDeaf !== newState.serverDeaf) {
            const action = newState.serverDeaf ? "Server Deafened" : "Server Undeafened";
            const emoji = newState.serverDeaf ? "🔇" : "🔊";
            changes.push({ action, emoji, type: "deaf" });

            await voiceLogger.logVoiceActivity(
                guild.id,
                member.id,
                member.user.tag,
                channelId,
                channelName,
                newState.serverDeaf ? "deaf" : "undeaf",
                { type: "server" }
            );
        }

        // Self deaf
        if (oldState.selfDeaf !== newState.selfDeaf) {
            const action = newState.selfDeaf ? "Self Deafened" : "Self Undeafened";
            const emoji = newState.selfDeaf ? "🔇" : "🔊";
            changes.push({ action, emoji, type: "deaf" });

            await voiceLogger.logVoiceActivity(
                guild.id,
                member.id,
                member.user.tag,
                channelId,
                channelName,
                newState.selfDeaf ? "deaf" : "undeaf",
                { type: "self" }
            );
        }

        // Streaming
        if (oldState.streaming !== newState.streaming) {
            const action = newState.streaming ? "Started Streaming" : "Stopped Streaming";
            const emoji = newState.streaming ? "📹" : "⏹️";
            changes.push({ action, emoji, type: "stream" });

            await voiceLogger.logVoiceActivity(
                guild.id,
                member.id,
                member.user.tag,
                channelId,
                channelName,
                newState.streaming ? "stream_start" : "stream_stop"
            );
        }

        // Video
        if (oldState.selfVideo !== newState.selfVideo) {
            const action = newState.selfVideo ? "Camera On" : "Camera Off";
            const emoji = newState.selfVideo ? "📷" : "📷";
            changes.push({ action, emoji, type: "video" });

            await voiceLogger.logVoiceActivity(
                guild.id,
                member.id,
                member.user.tag,
                channelId,
                channelName,
                newState.selfVideo ? "video_on" : "video_off"
            );
        }

        // Send embed for each change
        for (const change of changes) {
            const embed = new EmbedBuilder()
                .setColor("#0099ff")
                .setAuthor({
                    name: member.user.tag,
                    iconURL: member.user.displayAvatarURL(),
                })
                .setDescription(`${change.emoji} **${change.action}**`)
                .addFields({
                    name: "Channel",
                    value: `🔊 ${channelName}`,
                    inline: true,
                })
                .setTimestamp(timestamp)
                .setFooter({ text: `User ID: ${member.id}` });

            // Map change type to action for logging
            const actionMap = {
                mute: newState.serverMute || newState.selfMute ? "mute" : "unmute",
                deaf: newState.serverDeaf || newState.selfDeaf ? "deaf" : "undeaf",
                stream: newState.streaming ? "stream_start" : "stream_stop",
                video: newState.selfVideo ? "video_on" : "video_off",
            };

            await voiceLogger.sendLogToChannel(guild, actionMap[change.type], embed);
        }
    }
}

module.exports = VoiceStateUpdateEvent;
