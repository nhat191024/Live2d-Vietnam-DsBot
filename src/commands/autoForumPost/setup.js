const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../../utils/BaseCommand');

class SetupCommand extends BaseCommand {
    constructor() {
        super();
        this.name = 'autoforumpost_setup';
        this.description = 'Setup automatic forum posting for a channel';
        this.category = 'AutoForumPost';
        this.cooldown = 0;
        this.permissions = [PermissionFlagsBits.ManageChannels];
    }

    getSlashCommandData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption(option =>
                option.setName('source-channel')
                    .setDescription('Channel to monitor for messages')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true))
            .addChannelOption(option =>
                option.setName('forum-channel')
                    .setDescription('Forum channel to create posts in')
                    .addChannelTypes(ChannelType.GuildForum)
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('tag-name')
                    .setDescription('Tag name to apply to forum posts')
                    .setRequired(true))
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);
    }

    async execute(interaction) {
        try {
            if (this.isSlashCommand(interaction)) {
                const sourceChannel = interaction.options.getChannel('source-channel');
                const forumChannel = interaction.options.getChannel('forum-channel');
                const tagName = interaction.options.getString('tag-name');

                return await this.handleSetup(interaction, sourceChannel, forumChannel, tagName);
            } else {
                // Prefix command: !autoforumpost-setup #source #forum "tag name"
                const commandArgs = interaction._args || [];
                if (commandArgs.length < 3) {
                    return await interactions.reply({
                        content: '❌ Cách dùng: `!autoforumpost-setup #kênh-nguồn #kênh-forum "tên tag"`',
                        ephemeral: true
                    });
                }

                // Parse channel mentions and tag name
                const sourceChannelId = commandArgs[0].replace(/[<#>]/g, '');
                const forumChannelId = commandArgs[1].replace(/[<#>]/g, '');
                const tagName = commandArgs.slice(2).join(' ').replace(/"/g, '');

                const sourceChannel = interaction.guild.channels.cache.get(sourceChannelId);
                const forumChannel = interaction.guild.channels.cache.get(forumChannelId);

                if (!sourceChannel || !forumChannel) {
                    return await interaction.reply('❌ Kênh không hợp lệ!');
                }

                return await this.handleSetup(interaction, sourceChannel, forumChannel, tagName);
            }
        } catch (error) {
            console.error('Error in autoforumpost setup command:', error);
            return await interaction.reply({
                content: '❌ Đã xảy ra lỗi khi thiết lập tự động tạo forum post.',
                ephemeral: true
            });
        }
    }

    async handleSetup(interaction, sourceChannel, forumChannel, tagName) {
        // Validate channels
        if (sourceChannel.type !== ChannelType.GuildText) {
            return await interaction.reply({
                content: '❌ Kênh nguồn phải là kênh text!',
                ephemeral: true
            });
        }

        if (forumChannel.type !== ChannelType.GuildForum) {
            return await interaction.reply({
                content: '❌ Kênh forum phải là kênh forum!',
                ephemeral: true
            });
        }

        // Check if tag exists in forum
        const availableTag = forumChannel.availableTags.find(tag => tag.name === tagName);
        if (!availableTag) {
            const availableTags = forumChannel.availableTags.map(tag => tag.name).join(', ');
            return await interaction.reply({
                content: `❌ Không tìm thấy tag "${tagName}" trong kênh forum!\n**Các tag có sẵn:** ${availableTags || 'Không có'}`,
                ephemeral: true
            });
        }

        // Get the AutoForumPost module
        const autoForumModule = interaction.client.moduleManager.modules.get('autoForumPost');
        if (!autoForumModule) {
            return await interaction.reply({
                content: '❌ Module AutoForumPost chưa được khởi chạy!',
                ephemeral: true
            });
        }

        // Save settings to database
        const success = await autoForumModule.saveSettings(
            interaction.guild.id,
            sourceChannel.id,
            forumChannel.id,
            tagName
        );

        if (success) {
            return await interaction.reply({
                content: `✅ **Thiết lập Auto Forum Post hoàn tất!**\n\n` +
                    `📝 **Kênh nguồn:** ${sourceChannel}\n` +
                    `📋 **Kênh forum:** ${forumChannel}\n` +
                    `🏷️ **Tag:** ${tagName}\n\n` +
                    `Tin nhắn trong ${sourceChannel} sẽ tự động tạo post trong ${forumChannel} với tag "${tagName}".`,
                ephemeral: true
            });
        } else {
            return await interaction.reply({
                content: '❌ Không thể lưu cài đặt auto forum post. Vui lòng thử lại.',
                ephemeral: true
            });
        }
    }
}

module.exports = SetupCommand;
