const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const BaseCommand = require('../../../utils/BaseCommand');

class ModuleCommand extends BaseCommand {
    constructor() {
        super({
            name: 'module',
            description: 'Manage bot modules',
            category: 'admin',
            module: 'utility',
            permissions: [PermissionFlagsBits.Administrator],
            cooldown: 5
        });
    }

    getSlashCommandData() {
        return super.getSlashCommandData()
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all modules and their status')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('info')
                    .setDescription('Get detailed information about a module')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Module name')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('reload')
                    .setDescription('Reload a module')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Module name')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('health')
                    .setDescription('Check module health')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Module name')
                            .setRequired(false)
                    )
            );
    }

    async execute(interaction) {
        const { moduleManager, config } = interaction.client;

        // Handle both slash and prefix commands
        if (this.isSlashCommand(interaction)) {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'list':
                    await this.listModules(interaction, moduleManager, config);
                    break;
                case 'info':
                    await this.moduleInfo(interaction, moduleManager);
                    break;
                case 'reload':
                    await this.reloadModule(interaction, moduleManager);
                    break;
                case 'health':
                    await this.checkHealth(interaction, moduleManager);
                    break;
            }
        } else {
            // This is a prefix command, redirect to executePrefix
            await this.executePrefix(interaction, interaction._args || [], moduleManager, config);
        }
    }

    async listModules(interaction, moduleManager, config) {
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📦 Trạng thái Module')
            .setDescription('Tổng quan các module của bot')
            .setTimestamp();

        // Get configured modules
        const configModules = config.get('modules') || {};

        // Get loaded modules
        const loadedModules = Array.from(moduleManager.modules.keys());

        // Combine all module names
        const allModules = new Set([...Object.keys(configModules), ...loadedModules]);

        const moduleList = [];
        for (const moduleName of allModules) {
            const isEnabled = configModules[moduleName] === true;
            const isLoaded = moduleManager.modules.has(moduleName);

            let status = '❌ Disabled';
            if (isEnabled && isLoaded) {
                status = '✅ Active';
            } else if (isEnabled && !isLoaded) {
                status = '⚠️ Enabled but not loaded';
            }

            moduleList.push(`**${moduleName}**: ${status}`);
        }

        embed.addFields(
            { name: 'Các module', value: moduleList.join('\n') || 'Không tìm thấy module nào' },
            { name: 'Thống kê', value: `Tổng: ${allModules.size}\nĐã tải: ${loadedModules.length}`, inline: true }
        );

        if (this.isSlashCommand(interaction)) {
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }

    async moduleInfo(interaction, moduleManager, moduleNameArg = null) {
        const moduleName = moduleNameArg || (this.isSlashCommand(interaction) ? interaction.options.getString('name') : null);

        if (!moduleName) {
            const errorMsg = 'Bạn cần cung cấp tên module.';
            await interaction.reply({
                content: errorMsg,
                ephemeral: true
            });
            return;
        }

        const module = moduleManager.getModule(moduleName);

        if (!module) {
            await interaction.reply({
                content: `Module '${moduleName}' chưa được tải!`,
                ephemeral: true
            });
            return;
        }

        const info = module.getModuleInfo ? module.getModuleInfo() : {
            name: module.name || moduleName,
            description: module.description || 'Không có mô tả'
        };

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle(`📋 Module: ${info.name}`)
            .setDescription(info.description)
            .addFields(
                { name: 'Phiên bản', value: info.version || 'Không rõ', inline: true },
                { name: 'Trạng thái', value: info.enabled ? '✅ Đang bật' : '❌ Đang tắt', inline: true }
            )
            .setTimestamp();

        if (info.stats) {
            const statsText = Object.entries(info.stats)
                .map(([key, value]) => `**${key}**: ${value}`)
                .join('\n');
            embed.addFields({ name: 'Thống kê', value: statsText });
        }

        if (this.isSlashCommand(interaction)) {
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed] });
        }
    }

    async reloadModule(interaction, moduleManager, moduleNameArg = null) {
        const moduleName = moduleNameArg || (this.isSlashCommand(interaction) ? interaction.options.getString('name') : null);

        if (!moduleName) {
            const errorMsg = 'Bạn cần cung cấp tên module.';
            await interaction.reply({
                content: errorMsg,
                ephemeral: true
            });
            return;
        }

        if (this.isSlashCommand(interaction)) {
            await interaction.deferReply();
        }

        try {
            const success = await moduleManager.reloadModule(moduleName);

            if (success) {
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Module đã được tải lại')
                    .setDescription(`Module '${moduleName}' đã được tải lại thành công!`)
                    .setTimestamp();

                if (this.isSlashCommand(interaction)) {
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.reply({ embeds: [embed] });
                }
            } else {
                const errorMsg = `Không thể reload module '${moduleName}'. Kiểm tra logs để biết chi tiết.`;
                // ...existing code...
                if (this.isSlashCommand(interaction)) {
                    await interaction.editReply({ content: errorMsg });
                } else {
                    await interaction.reply({ content: errorMsg });
                }
            }
        } catch (error) {
            const errorMsg = `Lỗi khi reload module '${moduleName}': ${error.message}`;
            // ...existing code...
            if (this.isSlashCommand(interaction)) {
                await interaction.editReply({ content: errorMsg });
            } else {
                await interaction.reply({ content: errorMsg });
            }
        }
    }

    async checkHealth(interaction, moduleManager, moduleNameArg = null) {
        const moduleName = moduleNameArg || (this.isSlashCommand(interaction) ? interaction.options.getString('name') : null);

        if (moduleName) {
            // Check specific module
            const module = moduleManager.getModule(moduleName);

            if (!module) {
                await interaction.reply({
                    content: `Module '${moduleName}' chưa được tải!`,
                    ephemeral: true
                });
                return;
            }

            const health = module.healthCheck ? module.healthCheck() : { healthy: true, issues: [] };

            const embed = new EmbedBuilder()
                .setColor(health.healthy ? '#00FF00' : '#FF0000')
                .setTitle(`🏥 Kiểm tra sức khỏe: ${moduleName}`)
                .setDescription(health.healthy ? '✅ Module hoạt động tốt' : '❌ Module gặp vấn đề')
                .setTimestamp();

            if (health.issues && health.issues.length > 0) {
                embed.addFields({ name: 'Các vấn đề', value: health.issues.join('\n') });
            }

            await interaction.reply({ embeds: [embed] });
        } else {
            // Check all modules
            const embed = new EmbedBuilder()
                .setColor('#3498DB')
                .setTitle('🏥 Kiểm tra sức khỏe hệ thống')
                .setDescription('Trạng thái sức khỏe của tất cả các module đã tải')
                .setTimestamp();

            const healthResults = [];
            for (const [name, module] of moduleManager.modules) {
                const health = module.healthCheck ? module.healthCheck() : { healthy: true };
                const status = health.healthy ? '✅' : '❌';
                healthResults.push(`${status} **${name}**: ${health.healthy ? 'Khỏe mạnh' : 'Có vấn đề'}`);
            }

            embed.addFields({
                name: 'Sức khỏe các module',
                value: healthResults.join('\n') || 'Không có module nào được tải'
            });

            await interaction.reply({ embeds: [embed] });
        }
    }

    async executePrefix(message, args, moduleManager, config) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await message.reply('❌ Bạn cần quyền Quản trị viên để sử dụng lệnh này.');
            return;
        }

        const subcommand = args[0];

        try {
            switch (subcommand) {
                case 'list':
                    await this.listModules(message, moduleManager, config);
                    break;
                case 'info':
                    if (args.length < 2) {
                        await message.reply('Cách dùng: `!module info <tên_module>`');
                        return;
                    }
                    await this.moduleInfo(message, moduleManager, args[1]);
                    break;
                case 'reload':
                    if (args.length < 2) {
                        await message.reply('Cách dùng: `!module reload <tên_module>`');
                        return;
                    }
                    await this.reloadModule(message, moduleManager, args[1]);
                    break;
                case 'health':
                    await this.checkHealth(message, moduleManager, args[1]);
                    break;
                default:
                    await message.reply('Các subcommand có sẵn: `list`, `info`, `reload`, `health`');
            }
        } catch (error) {
            console.error('Module command error:', error);
            await message.reply('❌ Đã xảy ra lỗi khi thực thi lệnh module.');
        }
    }
}

module.exports = ModuleCommand;
