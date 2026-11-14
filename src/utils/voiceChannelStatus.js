const { PermissionsBitField, RESTJSONErrorCodes } = require('discord.js');
const { cleanAuthor } = require('./trackText');
const logger = require('./logger');

// Shows the current track as the voice channel status ("🎵 Title - Artist").
// On by default; set VOICE_CHANNEL_STATUS=false to turn it off.
// Every failure is logged and swallowed: a missing status must never affect playback.

const MAX_STATUS_LENGTH = 500;
const SET_VOICE_CHANNEL_STATUS = PermissionsBitField.Flags.SetVoiceChannelStatus ?? (1n << 48n);
const PERMISSION_ERRORS = new Set([RESTJSONErrorCodes.MissingAccess, RESTJSONErrorCodes.MissingPermissions]);

// Guilds already warned about a missing permission, so the log is not spammed on every track.
const warnedGuilds = new Set();
// Channels whose status we set, so we only clear statuses we own.
const ownedChannels = new Map();

function isEnabled() {
    return (process.env.VOICE_CHANNEL_STATUS || 'true').toLowerCase() !== 'false';
}

function formatStatus(track) {
    const title = track?.info?.title?.trim();
    if (!title) return null;

    const author = cleanAuthor(track.info.author || '');
    const text = author && !title.toLowerCase().includes(author.toLowerCase())
        ? `🎵 ${title} - ${author}`
        : `🎵 ${title}`;

    return text.length > MAX_STATUS_LENGTH ? `${text.slice(0, MAX_STATUS_LENGTH - 1)}…` : text;
}

function hasPermission(client, guildId, channelId) {
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    const me = guild?.members.me;
    if (!channel || !me) return true; // Unknown state: let the API decide.
    return channel.permissionsFor(me)?.has(SET_VOICE_CHANNEL_STATUS) ?? true;
}

function warnMissingPermission(guildId) {
    if (warnedGuilds.has(guildId)) return;
    warnedGuilds.add(guildId);
    logger.warn(`Voice channel status: missing "Set Voice Channel Status" permission in guild ${guildId}; skipping.`);
}

async function putStatus(client, guildId, channelId, status) {
    try {
        await client.rest.put(`/channels/${channelId}/voice-status`, { body: { status } });
        return true;
    } catch (error) {
        if (PERMISSION_ERRORS.has(error?.code)) {
            warnMissingPermission(guildId);
        } else {
            logger.debug('Voice channel status update failed:', error?.message || error);
        }
        return false;
    }
}

async function setVoiceStatus(client, player, track) {
    if (!isEnabled() || !player?.voiceChannelId) return;

    const status = formatStatus(track);
    if (!status) return;

    const { guildId, voiceChannelId } = player;
    if (!hasPermission(client, guildId, voiceChannelId)) {
        warnMissingPermission(guildId);
        return;
    }

    // The bot was moved: clear the status it left behind in the old channel.
    const previousChannelId = ownedChannels.get(guildId);
    if (previousChannelId && previousChannelId !== voiceChannelId) {
        ownedChannels.delete(guildId);
        await putStatus(client, guildId, previousChannelId, '');
    }

    warnedGuilds.delete(guildId);
    if (await putStatus(client, guildId, voiceChannelId, status)) {
        ownedChannels.set(guildId, voiceChannelId);
    }
}

async function clearVoiceStatus(client, guildId) {
    const channelId = ownedChannels.get(guildId);
    if (!isEnabled() || !channelId) return;

    ownedChannels.delete(guildId);
    await putStatus(client, guildId, channelId, '');
}

module.exports = {
    SET_VOICE_CHANNEL_STATUS,
    formatStatus,
    setVoiceStatus,
    clearVoiceStatus,
};
