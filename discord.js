const Discord = require('discord.js');
const { CommandoClient } = require('discord.js-commando');
const request = require('request');
const luaparse = require('luaparse');

const TOKEN = 'YOUR_DISCORD_BOT_TOKEN_HERE';
const bot = new CommandoClient({
    commandPrefix: '!'
});

bot.on('ready', () => {
    console.log(`Logged in as ${bot.user.tag}!`);
});

bot.registry.registerGroup('convert', 'Convert');
bot.registry.registerDefaults();
bot.registry.registerCommandsIn(__dirname + "/commands");

function convert_lua_to_qbcore(file) {
    const fs = require('fs');
    const lua_code = fs.readFileSync(file, 'utf8');

    // parse the Lua code using luaparse
    const parsed = luaparse.parse(lua_code);

    // convert the parsed Lua code to qbcore Lua code
    let qbcore_lua_code = "";

    for (const statement of parsed.body) {
        // check for ESX-specific statements and convert them to qbcore
        if (statement.type === "CallStatement" && statement.expression.base.name === "ESX") {
            // check for ESX server events
            if (statement.expression.identifier.name === "RegisterServerEvent") {
                qbcore_statement = `QB.RegisterServerCallback(${statement.expression.arguments.map(arg => arg.raw).join(", ")})`;
            } else if (statement.expression.identifier.name === "TriggerServerEvent") {
                qbcore_statement = `QB.TriggerServerCallback(${statement.expression.arguments.map(arg => arg.raw).join(", ")})`;
            } else {
                qbcore_statement = statement.raw.replace("ESX", "QB");
            }
        } else {
            qbcore_statement = statement.raw;
        }

        // add the converted statement to the qbcore Lua code
        qbcore_lua_code += qbcore_statement + "\n";
    }

    return qbcore_lua_code;
}

function submit_to_paste_ee(text) {
    const api_url = "https://api.paste.ee/v1/pastes";
    const data = {
        "description": "Converted Lua code",
        "sections": [{
            "name": "converted.lua",
            "contents": text
        }],
        "visibility": "public"
    };
    request.post({
        url: api_url,
        json: data
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            result_url = body.link;
            return result_url;
        } else {
            return null;
        }
    });
}

bot.on('message', async (message) => {
    if (message.content === '!convert') {
        // check if there is an attachment
        if (message.attachments.size === 0) {
            await message.channel.send("Please attach a file to convert");
            return;
        }

        // download the attached file
        const attachment = message.attachments.first();
        const file = await attachment.download();

        // convert the Lua file to qbcore Lua code
        const converted_code = convert_lua_to_qbcore(file);

        // submit the converted code to Paste.ee and get the resulting URL
        const result_url = submit_to_paste_ee(converted_code);

        if (result_url) {
            // send the resulting URL as a message to the channel
            await message.channel.send(`Conversion successful! Here's the result: ${result_url}`);
        } else {
            await message.channel.send("Error submitting to Paste.ee");
        }
    }
});

bot.login(TOKEN);
