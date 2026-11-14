const { PermissionsBitField } = require('discord.js');
const { SET_VOICE_CHANNEL_STATUS } = require('./voiceChannelStatus');

const REQUIRED_PERMISSIONS = [
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
    SET_VOICE_CHANNEL_STATUS,
];

function generateInviteUrl(clientId) {
    const permissions = new PermissionsBitField(REQUIRED_PERMISSIONS);
    return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions.bitfield}&scope=bot%20applications.commands`;
}

module.exports = { generateInviteUrl };
