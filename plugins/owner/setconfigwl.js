const fs = require("fs");
const path = require("path");
const { generateWAMessageFromContent } = require("@itsliaaa/baileys");
const { categorySections } = require("../../lib/menu");

const SETTINGS_PATH = path.join(__dirname, "../../control/settings.js");

function saveSettingsFile(sampConfig) {
    try {
        let content = fs.readFileSync(SETTINGS_PATH, "utf8");
        const sampRegex = /global\.samp\s*=\s*\{[\s\S]*?\n\}/;
        const newSampBlock = `global.samp = {
    domain: ${JSON.stringify(sampConfig.domain || "")},
    pltc: ${JSON.stringify(sampConfig.pltc || "")},
    serverId: ${JSON.stringify(sampConfig.serverId || "")},
    path: ${JSON.stringify(sampConfig.path || "/scriptfiles/whitelist/")},
    extension: ${JSON.stringify(sampConfig.extension || ".txt")},
    serverName: ${JSON.stringify(sampConfig.serverName || "")},
    ip: ${JSON.stringify(sampConfig.ip || "")},
    port: ${JSON.stringify(sampConfig.port || "")},
    gamemode: ${JSON.stringify(sampConfig.gamemode || "")}
}`;
        if (sampRegex.test(content)) {
            content = content.replace(sampRegex, newSampBlock);
        } else {
            content += `\n\n${newSampBlock}\n`;
        }
        fs.writeFileSync(SETTINGS_PATH, content, "utf8");
        return true;
    } catch (err) {
        console.error("[SETCONFIGWL WRITE ERROR]", err);
        return false;
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

async function handleSetConfigWl(context) {
    const { sock, m, args, prefix, isOwner, isCreator } = context;

    if (!isOwner && !isCreator) {
        return sendMenuStyle(sock, m, context, "Akses Ditolak", [
            "> Status : *Akses Ditolak*",
            "> Fitur setconfigwl khusus untuk Owner bot.",
            "> Hubungi Owner untuk mengubah konfigurasi."
        ]);
    }

    if (!global.samp) {
        global.samp = {
            domain: "",
            pltc: "",
            serverId: "",
            path: "/scriptfiles/whitelist/",
            extension: ".txt",
            serverName: "SA-MP Server",
            ip: "127.0.0.1",
            port: "7777",
            gamemode: "Roleplay"
        };
    }

    const cfg = global.samp;
    const sub = (args[0] || "").toLowerCase().trim();

    if (!sub) {
        return sendMenuStyle(sock, m, context, "Config Whitelist SA-MP", [
            "> Akses : *Khusus Owner*",
            "",
            "*Status Konfigurasi Saat Ini:*",
            `> Domain : *${cfg.domain || "-"}*`,
            `> Server ID : *${cfg.serverId || "-"}*`,
            `> PLTC : *${cfg.pltc ? (cfg.pltc.slice(0, 10) + "..." + cfg.pltc.slice(-4)) : "-"}*`,
            `> Path : *${cfg.path || "/scriptfiles/whitelist/"}*`,
            `> Ext : *${cfg.extension || ".txt"}*`,
            `> Nama Server : *${cfg.serverName || "-"}*`,
            `> IP : *${cfg.ip || "-"}*`,
            `> Port : *${cfg.port || "-"}*`,
            `> Gamemode : *${cfg.gamemode || "-"}*`,
            "",
            "*Cara Mengubah Konfigurasi:*",
            `> *${prefix}setconfigwl domain <url>*`,
            `> *${prefix}setconfigwl pltc <token>*`,
            `> *${prefix}setconfigwl serverid <id>*`,
            `> *${prefix}setconfigwl path <path_folder>*`,
            `> *${prefix}setconfigwl ext <ekstensi>*`,
            `> *${prefix}setconfigwl name <nama_server>*`,
            `> *${prefix}setconfigwl ip <ip_server>*`,
            `> *${prefix}setconfigwl port <port_server>*`,
            `> *${prefix}setconfigwl gamemode <mode>*`,
            "",
            "*Contoh:*",
            `> *${prefix}setconfigwl ip 103.123.45.67*`,
            `> *${prefix}setconfigwl port 7777*`,
            `> *${prefix}setconfigwl name Stenly Pride RP*`
        ]);
    }

    const value = args.slice(1).join(" ").trim();
    if (!value) {
        return sendMenuStyle(sock, m, context, "Nilai Kosong", [
            "> Status : *Gagal Mengubah*",
            `> Kunci : *${sub}*`,
            "",
            "*Keterangan:*",
            "Nilai baru belum dimasukkan.",
            `Contoh: *${prefix}setconfigwl ${sub} <nilai_baru>*`
        ]);
    }

    let keyLabel = "";
    if (sub === "domain") {
        cfg.domain = value.replace(/\/+$/, "");
        keyLabel = "Domain Panel Pterodactyl";
    } else if (sub === "pltc") {
        cfg.pltc = value;
        keyLabel = "Token Client API (PLTC)";
    } else if (sub === "serverid" || sub === "id") {
        cfg.serverId = value;
        keyLabel = "Server Identifier ID";
    } else if (sub === "path") {
        const norm = value.replace(/\\/g, "/");
        cfg.path = norm.endsWith("/") ? norm : `${norm}/`;
        keyLabel = "Path Folder Whitelist";
    } else if (sub === "ext" || sub === "extension") {
        cfg.extension = value.startsWith(".") ? value : `.${value}`;
        keyLabel = "Ekstensi File Whitelist";
    } else if (sub === "name" || sub === "servername") {
        cfg.serverName = value;
        keyLabel = "Nama Server SA-MP";
    } else if (sub === "ip") {
        cfg.ip = value;
        keyLabel = "IP Server SA-MP";
    } else if (sub === "port") {
        cfg.port = value;
        keyLabel = "Port Server SA-MP";
    } else if (sub === "gamemode" || sub === "mode") {
        cfg.gamemode = value;
        keyLabel = "Gamemode Server SA-MP";
    } else {
        return sendMenuStyle(sock, m, context, "Kunci Tidak Dikenal", [
            "> Status : *Kunci Konfigurasi Salah*",
            `> Pilihan yang Disediakan:`,
            "- domain",
            "- pltc",
            "- serverid / id",
            "- path",
            "- ext",
            "- name",
            "- ip",
            "- port",
            "- gamemode",
            "",
            `Ketik *${prefix}setconfigwl* tanpa parameter untuk melihat menu panduan.`
        ]);
    }

    const saved = saveSettingsFile(cfg);

    return sendMenuStyle(sock, m, context, "Config Berhasil Diubah", [
        "> Status : *SUCCESS / BERHASIL DIPERBARUI*",
        `> Item : *${keyLabel}*`,
        `> Nilai Baru : *${sub === "pltc" ? (value.slice(0, 10) + "..." + value.slice(-4)) : cfg[sub === "ext" ? "extension" : (sub === "name" ? "serverName" : (sub === "serverid" || sub === "id" ? "serverId" : (sub === "mode" ? "gamemode" : sub)))]}*`,
        `> Realtime : *Aktif Langsung Tanpa Restart*`,
        `> File Tersimpan : *control/settings.js*`,
        "",
        "*Keterangan:*",
        "Konfigurasi telah aktif di memori bot saat ini dan tersimpan permanen di file settings.js."
    ]);
}

module.exports = {
    name: "setconfigwl",
    category: "owner",
    command: ["setconfigwl", "setcfgwl", "configwl", "cfgwl"],
    owner: true,
    description: "Mengatur konfigurasi whitelist SA-MP secara realtime tanpa restart (Owner Only)",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [
            ".setconfigwl", ".setcfgwl", ".configwl", ".cfgwl",
            `${prefix}setconfigwl`, `${prefix}setcfgwl`, `${prefix}configwl`, `${prefix}cfgwl`
        ];

        if (validTriggers.includes(firstWord)) {
            const parts = bodyTrim.split(/\s+/);
            parts.shift();
            context.args = parts;
            context.text = parts.join(" ");
            context.q = context.text;
            await handleSetConfigWl(context);
            return true;
        }
        return false;
    },
    run: async (context) => {
        await handleSetConfigWl(context);
    }
};
