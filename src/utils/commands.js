const fs = require('fs');
const path = require('path');
const { DiscordInteractions } = require('slash-commands');
const { grantToken } = require('./discord');

const getCommands = module.exports.getCommands = () => {
    const commands = [];

    // Get all files in the commands directory
    const commandDirectory = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandDirectory);

    // Work through each file
    for (const commandFile of commandFiles) {
        // Load the file in if JS
        if (!commandFile.endsWith('.js')) continue;
        const commandData = require(path.join(commandDirectory, commandFile));

        // Validate it is a command
        if (!('name' in commandData)) continue;
        if (!('execute' in commandData)) continue;
        commands.push(commandData);
    }

    return commands;
};

module.exports.registerCommands = async () => {
    // Get a token to talk to Discord
    const token = await grantToken();

    // Define the builder
    const interaction = new DiscordInteractions({
        applicationId: process.env.CLIENT_ID,
        authToken: token.access_token,
        tokenPrefix: token.token_type,
        publicKey: process.env.CLIENT_PUBLIC_KEY,
    });

    // Define the commands and get what Discord currently has
    const commands = getCommands();
    const discordCommands = await interaction.getApplicationCommands(process.env.TEST_GUILD_ID);

    // Remove old commands
    for (const command of discordCommands) {
        if (commands.find(cmd => cmd.name === command.name)) continue;
        await interaction.deleteApplicationCommand(command.id, process.env.TEST_GUILD_ID);
    }

    // Register or update the commands with Discord
    const commandData = [];
    for (const command of commands) {
        // This command already exists in Discord
        const discordCommand = discordCommands.find(cmd => cmd.name === command.name);
        if (discordCommand) {
            // TODO: Compare discordCommand & command, only edit if needed
            const data = await interaction.editApplicationCommand(discordCommand.id, command, process.env.TEST_GUILD_ID);
            commandData.push({ ...command, ...data });
            continue;
        }

        // Register the new command
        const data = await interaction.createApplicationCommand(command, process.env.TEST_GUILD_ID);
        commandData.push({ ...command, ...data });
    }

    // Done
    return commandData;
};

const optSignature = module.exports.optSignature = opt =>
    `${opt.required ? '<' : '['}${opt.name}${opt.required ? '>' : ']'}`;

const cmdSignature = module.exports.cmdSignature = cmd =>
    `/${cmd.name} ${(cmd.options || []).map(optSignature).join(' ')}`.trim();

const optExplainer = opt =>
    `${optSignature(opt)}:\n  ${opt.description}\n\n  ${(opt.help || '').replace(/\n/g, '\n  ')}`.trim();

const optsExplainer = opts =>
    (opts || []).map(optExplainer).join('\n\n').trim();

module.exports.cmdExplainer = cmd =>
    `${cmdSignature(cmd)}\n\n${cmd.description}\n\n${optsExplainer(cmd.options)}`.trim();
