const fs = require("fs");
const path = require("path");
const { generateWAMessageFromContent } = require("@itsliaaa/baileys");
const { categorySections } = require("../../lib/menu");
const { listRemoteFiles } = require("../../lib/sftp");

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

async function handleListWl(context) {
    const { sock, m, args, prefix } = context;
    const sampConfig = global.samp || {};

    const serverName = sampConfig.serverName || "SA-MP Server";
    const ip = sampConfig.ip || "127.0.0.1";
    const port = sampConfig.port || "7777";
    const gamemode = sampConfig.gamemode || "Roleplay";
    const targetSource = (args[0] || "").toLowerCase().trim();

    const db = readDatabase();
    const localEntries = Object.values(db);

    let remoteResult = null;
    try {
        remoteResult = await listRemoteFiles(sampConfig);
    } catch (err) {
        remoteResult = { success: false, error: err.message };
    }

    if (targetSource === "local" || (!remoteResult?.success && localEntries.length > 0)) {
        if (localEntries.length === 0) {
            return sendMenuStyle(sock, m, context, "List Whitelist Kosong", [
                `> Server : *${serverName}*`,
                "> Status : *Belum Ada Data Whitelist*",
                "",
                `Gunakan *${prefix}wl Nama_Pemain* untuk mendaftarkan akun baru.`
            ]);
        }

        const lines = [
            `> Server : *${serverName}*`,
            `> IP:Port : *${ip}:${port}*`,
            `> Gamemode : *${gamemode}*`,
            `> Sumber Data : *Database Bot (Lokal)*`,
            `> Total Terdaftar : *${localEntries.length} Pemain*`,
            "",
            "*Daftar Pemain Terdaftar:*"
        ];

        localEntries.slice(0, 30).forEach((entry, idx) => {
            lines.push(`${idx + 1}. *${entry.name}* (WA: ${entry.senderNumber || "-"})`);
        });

        if (localEntries.length > 30) {
            lines.push("", `_...dan ${localEntries.length - 30} pemain lainnya._`);
        }

        return sendMenuStyle(sock, m, context, "Daftar Whitelist (Lokal)", lines);
    }

    if (!remoteResult?.success) {
        return sendMenuStyle(sock, m, context, "Daftar Whitelist", [
            `> Server : *${serverName}*`,
            `> Status : *Gagal Menghubungi Server via SFTP*`,
            `> Error : *${remoteResult?.error || "Koneksi Gagal"}*`,
            "",
            "Ketik *.listwl local* untuk melihat riwayat pendaftaran di database lokal bot."
        ]);
    }

    const files = remoteResult.files || [];
    if (files.length === 0) {
        return sendMenuStyle(sock, m, context, "List Whitelist Kosong", [
            `> Server : *${serverName}*`,
            `> Path : *${remoteResult.folderPath}*`,
            "> Status : *Tidak Ada File Whitelist di Server SA-MP*",
            "",
            `Gunakan *${prefix}wl Nama_Pemain* untuk mendaftarkan pemain pertama.`
        ]);
    }

    const lines = [
        `> Server : *${serverName}*`,
        `> IP:Port : *${ip}:${port}*`,
        `> Gamemode : *${gamemode}*`,
        `> Sumber Data : *SFTP Server*`,
        `> Total di Server : *${files.length} File*`,
        "",
        "*Daftar Karakter Terdaftar:*"
    ];

    files.slice(0, 30).forEach((f, idx) => {
        lines.push(`${idx + 1}. *${f.playerName}*`);
    });

    if (files.length > 30) {
        lines.push("", `_...dan ${files.length - 30} karakter lainnya._`);
    }

    return sendMenuStyle(sock, m, context, "Daftar Whitelist SA-MP", lines);
}

module.exports = {
    name: "listwl",
    category: "samp",
    command: ["listwl", "daftarwl", "ceklistwl"],
    description: "Melihat daftar pemain yang terdaftar di whitelist via SFTP",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [
            ".listwl", ".daftarwl", ".ceklistwl",
            `${prefix}listwl`, `${prefix}daftarwl`, `${prefix}ceklistwl`
        ];

        if (validTriggers.includes(firstWord)) {
            const parts = bodyTrim.split(/\s+/);
            parts.shift();
            context.args = parts;
            context.text = parts.join(" ");
            context.q = context.text;
            await handleListWl(context);
            return true;
        }
        return false;
    },
    run: async (context) => {
        await handleListWl(context);
    }
};
