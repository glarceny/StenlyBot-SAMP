const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { generateWAMessageFromContent } = require("@itsliaaa/baileys");
const { categorySections } = require("../../lib/menu");

const DB_PATH = path.join(__dirname, "../../lib/database/whitelist.json");

function readDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) return {};
        const data = fs.readFileSync(DB_PATH, "utf8");
        return JSON.parse(data || "{}");
    } catch (_) {
        return {};
    }
}

async function fetchPterodactylWhitelist(sampConfig) {
    const domain = (sampConfig.domain || "").replace(/\/+$/, "");
    const serverId = sampConfig.serverId;
    const apiKey = sampConfig.pltc;
    const folderPath = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normalizedFolder = folderPath.replace(/\/+$/, "");

    if (!apiKey || apiKey.includes("YOUR_PTERODACTYL") || !domain || domain.includes("example.com") || !serverId) {
        return {
            success: false,
            error: "Konfigurasi Pterodactyl di control/settings.js belum diatur."
        };
    }

    try {
        const url = `${domain}/api/client/servers/${serverId}/files/list?directory=${encodeURIComponent(normalizedFolder)}`;
        const response = await axios({
            method: "GET",
            url,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json"
            },
            timeout: 15000
        });

        const rawFiles = response.data?.data || [];
        const ext = (sampConfig.extension || ".txt").toLowerCase();

        const files = rawFiles
            .filter(item => item.attributes?.is_file)
            .map(item => {
                const fullName = item.attributes.name;
                const cleanName = fullName.replace(new RegExp(`\\${ext}$`, "i"), "");
                return {
                    fileName: fullName,
                    playerName: cleanName,
                    size: item.attributes.size,
                    modifiedAt: item.attributes.modified_at
                };
            });

        return {
            success: true,
            files,
            folderPath: normalizedFolder
        };
    } catch (error) {
        const status = error.response?.status;
        const errDetail = error.response?.data?.errors?.[0]?.detail || error.message;
        console.error(`[LISTWL PTERODACTYL ERROR] ${status || "NET"}: ${errDetail}`);
        return {
            success: false,
            error: errDetail,
            status
        };
    }
}

function makeButtons(prefix, plugins) {
    return [
        {
            buttonId: "allmenu",
            buttonText: { displayText: "Pilih Menu" },
            nativeFlowInfo: {
                name: "single_select",
                paramsJson: JSON.stringify({
                    title: "Pilih Kategori Menu",
                    sections: categorySections(plugins, prefix)
                })
            },
            type: 1
        },
        {
            buttonId: `${prefix}owner`,
            buttonText: { displayText: "Owner" },
            type: 1
        }
    ];
}

async function sendMenuStyle(sock, m, ctx, title, lines) {
    const { botName, prefix, thumb, plugins } = ctx;
    const contentText = `\`「 ${botName} 」\``;
    const footerText = `\`「 ${title} 」\`\n${lines.join('\n')}\n\n_*Tekan tombol di bawah untuk melihat semua menu*_`;
    
    try {
        const menuMessage = generateWAMessageFromContent(m.chat, {
            buttonsMessage: {
                buttons: makeButtons(prefix, plugins),
                locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                    name: botName,
                    address: global.namaown || "WhatsApp Bot",
                    jpegThumbnail: thumb ? thumb.toString('base64') : ''
                },
                contentText,
                footerText,
                headerType: 6
            }
        }, { userJid: m.chat, upload: sock.waUploadToServer });
        
        return await sock.relayMessage(m.chat, menuMessage.message, { messageId: menuMessage.key.id });
    } catch (_) {
        return ctx.reply(`${contentText}\n\n${footerText}`);
    }
}

async function handleListWhitelist(context) {
    const { sock, m } = context;
    const sampConfig = global.samp || {};

    const serverName = sampConfig.serverName || "SA-MP Server";
    const ip = sampConfig.ip || "127.0.0.1";
    const port = sampConfig.port || "7777";
    const savePath = sampConfig.path || "/scriptfiles/whitelist/";

    const result = await fetchPterodactylWhitelist(sampConfig);

    if (!result.success) {
        return sendMenuStyle(sock, m, context, "List Whitelist Gagal", [
            "> Status : *Gagal Mengakses Panel Pterodactyl*",
            `> Server : *${serverName}*`,
            `> Error : *${result.error || "Connection Timeout / Unauthorized"}*`,
            "",
            "*Keterangan:*",
            "Pastikan domain, token PLTC, dan Server ID di settings.js sudah sesuai dan server panel online."
        ]);
    }

    const files = result.files || [];
    const db = readDatabase();

    if (files.length === 0) {
        return sendMenuStyle(sock, m, context, "Daftar Whitelist SA-MP", [
            `> Server : *${serverName}*`,
            `> IP:Port : *${ip}:${port}*`,
            `> Lokasi : *${savePath}*`,
            "> Total Whitelist : *0 Pemain*",
            "",
            "*Keterangan:*",
            "Belum ada pemain yang terdaftar di whitelist server ini.",
            "Ketik *.wl Nama_Pemain* untuk mendaftarkan akun whitelist baru."
        ]);
    }

    const listLines = files.map((file, index) => {
        const matchedEntry = Object.values(db).find(data => {
            return (data.name || "").toLowerCase() === file.playerName.toLowerCase() ||
                   (data.fileName || "").toLowerCase() === file.fileName.toLowerCase();
        });

        const waInfo = matchedEntry ? ` (WA: ${matchedEntry.senderNumber || "-"})` : "";
        return `${index + 1}. *${file.playerName}*${waInfo}`;
    });

    return sendMenuStyle(sock, m, context, "Daftar Whitelist SA-MP", [
        `> Server : *${serverName}*`,
        `> IP:Port : *${ip}:${port}*`,
        `> Direktori : *${savePath}*`,
        `> Total Pemain : *${files.length} Terdaftar*`,
        "",
        "*Daftar Pemain Terdaftar:*",
        ...listLines,
        "",
        "*Keterangan:*",
        "Daftar di atas diambil langsung secara real-time dari direktori server Pterodactyl."
    ]);
}

module.exports = {
    name: "listwl",
    category: "samp",
    command: ["listwl", "listwhitelist"],
    description: "Melihat seluruh daftar pemain whitelist langsung dari Pterodactyl",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [".listwl", ".listwhitelist", `${prefix}listwl`, `${prefix}listwhitelist`];

        if (validTriggers.includes(firstWord)) {
            await handleListWhitelist(context);
            return true;
        }
        return false;
    },
    run: async (context) => {
        await handleListWhitelist(context);
    }
};
