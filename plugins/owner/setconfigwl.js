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
    sftp: {
        host: ${JSON.stringify(sampConfig.sftp?.host || "")},
        port: ${Number(sampConfig.sftp?.port || 22)},
        username: ${JSON.stringify(sampConfig.sftp?.username || "")},
        password: ${JSON.stringify(sampConfig.sftp?.password || "")}
    },
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
            sftp: { host: "", port: 22, username: "", password: "" },
            path: "/scriptfiles/whitelist/",
            extension: ".txt",
            serverName: "SA-MP Server",
            ip: "127.0.0.1",
            port: "7777",
            gamemode: "Roleplay"
        };
    }
    if (!global.samp.sftp) {
        global.samp.sftp = { host: "", port: 22, username: "", password: "" };
    }

    const cfg = global.samp;
    const sub = (args[0] || "").toLowerCase().trim();

    if (!sub) {
        return sendMenuStyle(sock, m, context, "Config Whitelist SA-MP", [
            "> Akses : *Khusus Owner*",
            "",
            "*Status Konfigurasi Saat Ini:*",
            `> SFTP Host : *${cfg.sftp.host || "-"}*`,
            `> SFTP Port : *${cfg.sftp.port || 22}*`,
            `> SFTP User : *${cfg.sftp.username || "-"}*`,
            `> SFTP Pass : *${cfg.sftp.password ? "******" : "-"}*`,
            `> Path : *${cfg.path || "/scriptfiles/whitelist/"}*`,
            `> Ext : *${cfg.extension || ".txt"}*`,
            `> Nama Server : *${cfg.serverName || "-"}*`,
            `> IP Server : *${cfg.ip || "-"}*`,
            `> Port Server : *${cfg.port || "-"}*`,
            `> Gamemode : *${cfg.gamemode || "-"}*`,
            "",
            "*Cara Mengubah Konfigurasi:*",
            `> *${prefix}setconfigwl sftphost <host>*`,
            `> *${prefix}setconfigwl sftpport <port>*`,
            `> *${prefix}setconfigwl sftpuser <user>*`,
            `> *${prefix}setconfigwl sftppass <password>*`,
            `> *${prefix}setconfigwl path <path_folder>*`,
            `> *${prefix}setconfigwl ext <ekstensi>*`,
            `> *${prefix}setconfigwl name <nama_server>*`,
            `> *${prefix}setconfigwl ip <ip_server>*`,
            `> *${prefix}setconfigwl port <port_server>*`,
            `> *${prefix}setconfigwl gamemode <mode>*`,
            "",
            "*Contoh:*",
            `> *${prefix}setconfigwl sftphost 103.123.45.67*`,
            `> *${prefix}setconfigwl sftpuser root*`,
            `> *${prefix}setconfigwl sftppass rahasia123*`
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
    if (sub === "sftphost" || sub === "host") {
        cfg.sftp.host = value;
        keyLabel = "SFTP Host";
    } else if (sub === "sftpport") {
        cfg.sftp.port = Number(value) || 22;
        keyLabel = "SFTP Port";
    } else if (sub === "sftpuser" || sub === "user") {
        cfg.sftp.username = value;
        keyLabel = "SFTP Username";
    } else if (sub === "sftppass" || sub === "pass") {
        cfg.sftp.password = value;
        keyLabel = "SFTP Password";
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
            "- sftphost / host",
            "- sftpport",
            "- sftpuser / user",
            "- sftppass / pass",
            "- path",
            "- ext",
            "- name",
            "- ip",
            "- port",
            "- gamemode"
        ]);
    }

    const saved = saveSettingsFile(cfg);

    if (!saved) {
        return sendMenuStyle(sock, m, context, "Gagal Menyimpan", [
            "> Status : *Gagal Menulis ke control/settings.js*",
            "Periksa izin akses file server."
        ]);
    }

    const displayVal = (sub === "sftppass" || sub === "pass") ? "******" : value;

    return sendMenuStyle(sock, m, context, "Konfigurasi Berhasil Diubah", [
        "> Status : *SUCCESS / BERHASIL DISIMPAN*",
        `> Pengaturan : *${keyLabel}*`,
        `> Nilai Baru : *${displayVal}*`,
        "",
        "*Keterangan:*",
        "Perubahan langsung aktif dan tersimpan permanen di settings."
    ]);
}

module.exports = {
    name: "setconfigwl",
    category: "owner",
    command: ["setconfigwl", "setwl", "configsamp"],
    owner: true,
    description: "Mengubah pengaturan SFTP dan server SA-MP secara langsung (Owner Only)",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [
            ".setconfigwl", ".setwl", ".configsamp",
            `${prefix}setconfigwl`, `${prefix}setwl`, `${prefix}configsamp`
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
