const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('../src/utils/Database');
const ScamTrap = require('../src/modules/scamTrap');
const TrapCommand = require('../src/commands/scamTrap/trap');

test('detects five distinct channels in five seconds while retaining the trap channel', async () => {
    const originalExecute = Database.execute;
    const deleted = [];
    const banned = [];
    const alerts = [];
    const settings = { enabled: true, trap_enabled: true, spam_enabled: true,
        trap_channel_id: 'trap', alert_channel_id: 'alerts', ban_minutes: 60,
        spam_channel_count: 5, spam_window_seconds: 5 };
    Database.execute = async query => query.startsWith('SELECT * FROM scam_trap_settings') ? [settings] : [];
    const guild = {
        id: 'guild',
        bans: { fetch: async () => null },
        members: {
            fetch: async () => ({ bannable: true }),
            ban: async userId => banned.push(userId),
            unban: async () => {}
        },
        channels: { fetch: async () => ({ send: async payload => alerts.push(payload) }) }
    };
    const client = { user: { id: 'bot' }, moduleManager: { isModuleEnabled: () => true } };
    const module = new ScamTrap(client);
    const message = (channelId, timestamp, userId = 'user') => ({
        guild, channelId, channel: { name: channelId }, author: { id: userId, bot: false },
        createdTimestamp: timestamp, member: { bannable: true },
        delete: async () => deleted.push(`${userId}:${channelId}:${timestamp}`)
    });

    try {
        for (let i = 0; i < 5; i++) await module.handleMessage(message('same', 1000 + i * 100));
        assert.equal(banned.length, 0);
        for (let i = 1; i < 5; i++) await module.handleMessage(message(`channel-${i}`, 1500 + i * 100));
        assert.deepEqual(banned, ['user']);
        assert.equal(deleted.length, 9);
        assert.equal(alerts.length, 1);

        await module.handleMessage(message('trap', 9000, 'other'));
        assert.deepEqual(banned, ['user', 'other']);
        assert.equal(deleted.length, 10);
        assert.equal(alerts.length, 2);
    } finally {
        Database.execute = originalExecute;
    }
});

test('does not combine messages outside the five-second window', () => {
    const module = new ScamTrap({});
    for (let i = 0; i < 4; i++) module.recordMessage('guild:user', {
        channelId: `old-${i}`, createdTimestamp: 1000, id: String(i)
    });
    const active = module.recordMessage('guild:user', { channelId: 'new', createdTimestamp: 6001, id: 'new' });
    assert.deepEqual(active.map(item => item.channelId), ['new']);
});

test('uses a separately configured spam window', () => {
    const module = new ScamTrap({});
    module.recordMessage('guild:user', { channelId: 'old', createdTimestamp: 1000 }, 2);
    const active = module.recordMessage('guild:user', { channelId: 'new', createdTimestamp: 3001 }, 2);
    assert.deepEqual(active.map(item => item.channelId), ['new']);
});

test('keeps distinct channels when one channel floods the message window', () => {
    const module = new ScamTrap({});
    module.recordMessage('guild:user', { channelId: 'first', createdTimestamp: 1000 }, 5);
    for (let i = 0; i < 150; i++) module.recordMessage('guild:user', {
        channelId: 'flood', createdTimestamp: 1001 + i
    }, 5);
    const active = module.recordMessage('guild:user', { channelId: 'third', createdTimestamp: 1200 }, 5);
    assert.deepEqual(new Set(active.map(item => item.channelId)), new Set(['first', 'flood', 'third']));
    assert.ok(active.length <= 100);
});

test('spam settings command updates only selected values', async () => {
    let saved;
    const replies = [];
    const module = {
        getSettings: async () => ({ spam_enabled: true, spam_channel_count: 5, spam_window_seconds: 5 }),
        updateSettings: async (guildId, updates) => { saved = { guildId, updates }; }
    };
    const interaction = {
        guild: { members: { fetchMe: async () => ({ permissions: { has: () => true } }) } },
        guildId: 'guild',
        client: { moduleManager: { getModule: () => module } },
        options: {
            getSubcommand: () => 'spam',
            getBoolean: () => null,
            getInteger: name => name === 'channels' ? 7 : null
        },
        reply: async payload => replies.push(payload)
    };
    await new TrapCommand().execute(interaction);
    assert.deepEqual(saved, { guildId: 'guild', updates: { spam_channel_count: 7 } });
    assert.equal(replies.length, 1);
});

test('upgrades existing settings without replacing saved rows', async () => {
    const originalExecute = Database.execute;
    const queries = [];
    Database.execute = async query => {
        queries.push(query);
        if (query.includes('information_schema.COLUMNS')) return [
            { COLUMN_NAME: 'guild_id' }, { COLUMN_NAME: 'trap_channel_id' },
            { COLUMN_NAME: 'alert_channel_id' }, { COLUMN_NAME: 'ban_minutes' },
            { COLUMN_NAME: 'enabled' }
        ];
        return [];
    };
    const client = { on: () => {}, off: () => {} };
    const module = new ScamTrap(client);
    try {
        await module.load();
        assert.equal(queries.filter(query => query.startsWith('ALTER TABLE scam_trap_settings ADD COLUMN')).length, 4);
        assert.equal(queries.some(query => query.includes('MODIFY COLUMN trap_channel_id')), true);
        assert.equal(queries.some(query => query.startsWith('DELETE FROM scam_trap_settings')), false);
    } finally {
        await module.unload();
        Database.execute = originalExecute;
    }
});

test('a new settings row starts with both detectors off', async () => {
    const originalExecute = Database.execute;
    const queries = [];
    Database.execute = async (query, params) => { queries.push({ query, params }); return []; };
    try {
        await new ScamTrap({}).updateSettings('guild', { ban_minutes: 90 });
        assert.match(queries[0].query, /VALUES \(\?, FALSE, FALSE, FALSE\)/);
        assert.deepEqual(queries[1].params, [90, 'guild']);
    } finally {
        Database.execute = originalExecute;
    }
});
