const { PermissionFlagsBits, ChannelType } = require('discord.js');
const BaseCommand = require('../../utils/BaseCommand');

class TrapCommand extends BaseCommand {
    constructor() {
        super({
            name: 'scam-trap',
            description: 'Configure the scam trap channel',
            category: 'Moderation',
            module: 'scamTrap',
            permissions: [PermissionFlagsBits.Administrator],
            guildOnly: true,
            developerBypass: true
        });
    }

    getSlashCommandData() {
        return super.getSlashCommandData()
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(sub => sub.setName('setup').setDescription('Set trap channel, 5-channel spam detection, and ban duration')
                .addChannelOption(opt => opt.setName('trap').setDescription('Trap text channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
                .addIntegerOption(opt => opt.setName('minutes').setDescription('Temporary ban duration (1–10080 minutes)').setMinValue(1).setMaxValue(10080).setRequired(true))
                .addChannelOption(opt => opt.setName('alerts').setDescription('Optional private admin alert channel').addChannelTypes(ChannelType.GuildText)))
            .addSubcommand(sub => sub.setName('trap').setDescription('Change trap channel or toggle trap detection')
                .addChannelOption(opt => opt.setName('channel').setDescription('Trap text channel').addChannelTypes(ChannelType.GuildText))
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable trap detection')))
            .addSubcommand(sub => sub.setName('spam').setDescription('Change cross-channel spam detection')
                .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable spam detection'))
                .addIntegerOption(opt => opt.setName('channels').setDescription('Distinct channels (2–20)').setMinValue(2).setMaxValue(20))
                .addIntegerOption(opt => opt.setName('seconds').setDescription('Time window (1–60 seconds)').setMinValue(1).setMaxValue(60)))
            .addSubcommand(sub => sub.setName('ban').setDescription('Change temporary ban duration')
                .addIntegerOption(opt => opt.setName('minutes').setDescription('Duration (1–10080 minutes)').setMinValue(1).setMaxValue(10080).setRequired(true)))
            .addSubcommand(sub => sub.setName('alerts').setDescription('Set admin alert channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Private admin text channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
            .addSubcommand(sub => sub.setName('alerts-off').setDescription('Stop sending admin alerts'))
            .addSubcommand(sub => sub.setName('enable').setDescription('Enable configured features'))
            .addSubcommand(sub => sub.setName('disable').setDescription('Disable both features'))
            .addSubcommand(sub => sub.setName('status').setDescription('Show trap settings'));
    }

    async execute(interaction) {
        if (!interaction.guild || typeof interaction.options.getSubcommand !== 'function') {
            return interaction.reply({ content: 'Chỉ dùng lệnh slash trong server: `/scam-trap`.', ephemeral: true });
        }
        const trap = interaction.client.moduleManager.getModule('scamTrap');
        const action = interaction.options.getSubcommand();
        const current = await trap.getSettings(interaction.guildId);
        const reply = content => interaction.reply({ content, ephemeral: true });

        if (action === 'status') {
            if (!current) return reply('Chưa cấu hình scam trap. Dùng `/scam-trap setup` hoặc `/scam-trap spam`.');
            return reply(`Trạng thái chung: ${current.enabled ? 'bật' : 'tắt'}\n` +
                `Kênh bẫy: ${current.trap_channel_id ? `<#${current.trap_channel_id}>` : 'chưa đặt'} (${current.trap_enabled ? 'bật' : 'tắt'})\n` +
                `Spam: ${current.spam_channel_count} kênh khác nhau trong ${current.spam_window_seconds} giây (${current.spam_enabled ? 'bật' : 'tắt'})\n` +
                `Ban: ${current.ban_minutes} phút\nBáo admin: ${current.alert_channel_id ? `<#${current.alert_channel_id}>` : 'không'}`);
        }
        if (action === 'disable') {
            if (!current) return reply('Chưa cấu hình scam trap.');
            await trap.setEnabled(interaction.guildId, false);
            return reply('Đã tắt cả kênh bẫy và phát hiện spam. Lịch gỡ ban cũ vẫn được xử lý.');
        }
        if (action === 'enable') {
            if (!current) return reply('Chưa cấu hình scam trap. Dùng `/scam-trap setup` hoặc `/scam-trap spam`.');
            if (!current.trap_enabled && !current.spam_enabled) return reply('Hãy bật ít nhất một phần bằng `/scam-trap trap` hoặc `/scam-trap spam`.');
            if (current.trap_enabled && !current.trap_channel_id) return reply('Hãy đặt kênh bẫy trước khi bật.');
            await trap.setEnabled(interaction.guildId, true);
            return reply('Đã bật lại các phần đã cấu hình.');
        }

        const me = await interaction.guild.members.fetchMe();
        if (!me.permissions.has(PermissionFlagsBits.BanMembers)) return reply('Bot cần quyền Ban Members trên server.');

        if (action === 'setup' || action === 'trap') {
            const channel = interaction.options.getChannel(action === 'setup' ? 'trap' : 'channel');
            const enabled = action === 'trap' ? interaction.options.getBoolean('enabled') : true;
            if (action === 'trap' && !channel && enabled === null) return reply('Chọn `channel` hoặc `enabled` để cập nhật.');
            if (enabled === true && !channel && !current?.trap_channel_id) return reply('Hãy chọn kênh bẫy trước khi bật.');
            if (channel && !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) return reply('Bot cần quyền Manage Messages trong kênh bẫy.');
            const alerts = action === 'setup' ? interaction.options.getChannel('alerts') : null;
            if (alerts && alerts.id === (channel?.id || current?.trap_channel_id)) return reply('Kênh báo admin phải khác kênh bẫy.');
            if (channel && channel.id === (alerts?.id || current?.alert_channel_id)) return reply('Kênh bẫy phải khác kênh báo admin.');
            if (alerts && !alerts.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return reply('Bot cần quyền Send Messages trong kênh báo admin.');

            if (action === 'setup') {
                const minutes = interaction.options.getInteger('minutes');
                await trap.updateSettings(interaction.guildId, {
                    trap_channel_id: channel.id, ban_minutes: minutes, enabled: true,
                    trap_enabled: true, spam_enabled: true,
                    ...(alerts ? { alert_channel_id: alerts.id } : {})
                });
                return reply(`Đã bật kênh bẫy ${channel}, phát hiện spam ${current?.spam_channel_count || 5} kênh trong ${current?.spam_window_seconds || 5} giây và ban ${minutes} phút. ${alerts ? `Báo tại ${alerts}.` : 'Giữ nguyên kênh báo admin hiện có nếu đã đặt.'}`);
            }
            const updates = {};
            if (channel) updates.trap_channel_id = channel.id;
            if (channel || enabled === true) {
                updates.trap_enabled = true;
                if (enabled !== false) updates.enabled = true;
            }
            if (enabled === false) updates.trap_enabled = false;
            await trap.updateSettings(interaction.guildId, updates);
            return reply('Đã cập nhật kênh bẫy. Dùng `/scam-trap status` để xem toàn bộ cấu hình.');
        }

        if (action === 'spam') {
            const enabled = interaction.options.getBoolean('enabled');
            const channels = interaction.options.getInteger('channels');
            const seconds = interaction.options.getInteger('seconds');
            if (enabled === null && channels === null && seconds === null) return reply('Chọn ít nhất một trong `enabled`, `channels`, `seconds`.');
            const updates = {};
            if (enabled !== null) {
                updates.spam_enabled = enabled;
                if (enabled) updates.enabled = true;
            }
            if (channels !== null) updates.spam_channel_count = channels;
            if (seconds !== null) updates.spam_window_seconds = seconds;
            await trap.updateSettings(interaction.guildId, updates);
            return reply('Đã cập nhật phát hiện spam. Dùng `/scam-trap status` để xem toàn bộ cấu hình.');
        }

        if (action === 'ban') {
            await trap.updateSettings(interaction.guildId, { ban_minutes: interaction.options.getInteger('minutes') });
            return reply('Đã cập nhật thời gian ban tạm.');
        }
        if (action === 'alerts') {
            const channel = interaction.options.getChannel('channel');
            if (channel.id === current?.trap_channel_id) return reply('Kênh báo admin phải khác kênh bẫy.');
            if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return reply('Bot cần quyền Send Messages trong kênh báo admin.');
            await trap.updateSettings(interaction.guildId, { alert_channel_id: channel.id });
            return reply(`Sẽ báo admin tại ${channel}.`);
        }
        if (action === 'alerts-off') {
            await trap.updateSettings(interaction.guildId, { alert_channel_id: null });
            return reply('Đã tắt báo admin.');
        }
    }
}

module.exports = TrapCommand;
