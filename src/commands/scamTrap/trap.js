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
            guildOnly: true
        });
    }

    getSlashCommandData() {
        return super.getSlashCommandData()
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(sub => sub.setName('setup').setDescription('Set trap, alerts, and ban duration')
                .addChannelOption(opt => opt.setName('trap').setDescription('Trap text channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
                .addIntegerOption(opt => opt.setName('minutes').setDescription('Temporary ban duration (1–10080 minutes)').setMinValue(1).setMaxValue(10080).setRequired(true))
                .addChannelOption(opt => opt.setName('alerts').setDescription('Optional private admin alert channel').addChannelTypes(ChannelType.GuildText)))
            .addSubcommand(sub => sub.setName('disable').setDescription('Disable the trap'))
            .addSubcommand(sub => sub.setName('status').setDescription('Show trap settings'));
    }

    async execute(interaction) {
        if (!interaction.guild || typeof interaction.options.getSubcommand !== 'function') {
            return interaction.reply({ content: 'Chỉ dùng lệnh slash trong server: `/scam-trap`.', ephemeral: true });
        }
        const trap = interaction.client.moduleManager.getModule('scamTrap');
        const action = interaction.options.getSubcommand();
        const current = await trap.getSettings(interaction.guildId);

        if (action === 'status') {
            return interaction.reply({ content: current
                ? `Kênh bẫy: <#${current.trap_channel_id}>\nBáo admin: ${current.alert_channel_id ? `<#${current.alert_channel_id}>` : 'không'}\nBan: ${current.ban_minutes} phút\nTrạng thái: ${current.enabled ? 'bật' : 'tắt'}`
                : 'Chưa cấu hình kênh bẫy.', ephemeral: true });
        }
        if (action === 'disable') {
            if (!current) return interaction.reply({ content: 'Chưa cấu hình kênh bẫy.', ephemeral: true });
            await trap.setEnabled(interaction.guildId, false);
            return interaction.reply({ content: 'Đã tắt kênh bẫy. Các lịch gỡ ban cũ vẫn được xử lý.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('trap');
        const alerts = interaction.options.getChannel('alerts');
        const minutes = interaction.options.getInteger('minutes');
        if (alerts?.id === channel.id) {
            return interaction.reply({ content: 'Kênh báo admin phải khác kênh bẫy.', ephemeral: true });
        }
        const me = await interaction.guild.members.fetchMe();
        if (!me.permissions.has(PermissionFlagsBits.BanMembers) ||
            !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ content: 'Bot cần quyền Ban Members và Manage Messages trong kênh bẫy.', ephemeral: true });
        }
        if (alerts && !alerts.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({ content: 'Bot cần quyền Send Messages trong kênh báo admin.', ephemeral: true });
        }
        await trap.configure(interaction.guildId, channel.id, alerts?.id || null, minutes);
        return interaction.reply({ content: `Đã bật bẫy tại ${channel}. **Mọi tài khoản gửi tin nhắn tại đây**, kể cả admin, sẽ bị xóa tin nhắn và ban ${minutes} phút. ${alerts ? `Báo tại ${alerts}.` : 'Chưa đặt kênh báo admin.'}`, ephemeral: true });
    }
}

module.exports = TrapCommand;
