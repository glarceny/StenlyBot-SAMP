const fs = require("fs");
const path = require("path");
const { generateWAMessageFromContent } = require("@itsliaaa/baileys");
const { categorySections } = require("../../lib/menu");
const { deleteRemoteFile, checkRemoteFileExists } = require("../../lib/sftp");

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

function writeDatabase(data) {
    try {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error("[UNWHITELIST DB ERROR]", err);
        return false;
    }
}

function cleanNumber(jid) {
    return String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
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

async function handleUnwhitelist(context) {
    const { sock, m, args, prefix, sender, isOwner, isCreator } = context;
    const sampConfig = global.samp || {};

    const serverName = sampConfig.serverName || "SA-MP Server";
    const extension = sampConfig.extension || ".txt";

    const targetInput = (args[0] || "").trim();

    if (!targetInput) {
        return sendMenuStyle(sock, m, context, "Panduan Unwhitelist SA-MP", [
            `> Server : *${serverName}*`,
            "",
            "*Cara Menghapus Whitelist:*",
            `> User Biasa : Ketik *${prefix}unwl* untuk unwhitelist akun sendiri`,
            `> Owner/Admin : Ketik *${prefix}unwl <Nama_Pemain / Nomor_WA>*`,
            "",
            "*Contoh:*",
            `> *${prefix}unwl*`,
            `> *${prefix}unwl Stenly_Christian*`,
            `> *${prefix}unwl 6285199553371*`
        ]);
    }

    const db = readDatabase();
    let targetKey = null;
    let targetData = null;

    if (!isOwner && !isCreator) {
        const senderNum = cleanNumber(sender);
        const match = Object.entries(db).find(([jid, data]) => {
            return cleanNumber(jid) === senderNum || cleanNumber(data.sender) === senderNum;
        });

        if (!match) {
            return sendMenuStyle(sock, m, context, "Data Tidak Ditemukan", [
                "> Status : *Nomor Anda Belum Terdaftar*",
                "",
                "Nomor WhatsApp Anda belum memiliki karakter yang di-whitelist.",
                `Daftarkan karakter baru dengan perintah *${prefix}wl Nama_Karakter*.`
            ]);
        }

        targetKey = match[0];
        targetData = match[1];

        if (targetInput.toLowerCase() !== (targetData.name || "").toLowerCase() && targetInput.toLowerCase() !== "self") {
            return sendMenuStyle(sock, m, context, "Akses Terbatas", [
                "> Status : *Hanya Bisa Hapus Akun Sendiri*",
                `> Karakter Anda : *${targetData.name}*`,
                "",
                `Ketik *${prefix}unwl ${targetData.name}* untuk konfirmasi hapus akun Anda.`,
                "Hanya Owner/Admin yang dapat menghapus karakter pemain lain."
            ]);
        }
    } else {
        const cleanTarget = cleanNumber(targetInput);

        const match = Object.entries(db).find(([jid, data]) => {
            if (cleanTarget && (cleanNumber(jid) === cleanTarget || cleanNumber(data.sender) === cleanTarget)) {
                return true;
            }
            if ((data.name || "").toLowerCase() === targetInput.toLowerCase()) {
                return true;
            }
            return false;
        });

        if (match) {
            targetKey = match[0];
            targetData = match[1];
        } else {
            targetData = {
                name: targetInput.replace(new RegExp(`\\${extension}$`, "i"), ""),
                fileName: `${targetInput.replace(new RegExp(`\\${extension}$`, "i"), "")}${extension}`,
                senderNumber: "-",
                registeredAt: "-"
            };
        }
    }

    const fileName = targetData.fileName || `${targetData.name}${extension}`;

    let delResult;
    try {
        delResult = await deleteRemoteFile(sampConfig, fileName);
    } catch (err) {
        delResult = { success: false, simulated: false, error: err.message };
    }

    if (!delResult.success && !delResult.simulated) {
        return sendMenuStyle(sock, m, context, "Gagal Menghapus File", [
            "> Status : *Gagal Menghubungi Server via SFTP*",
            `> Target File : *${fileName}*`,
            `> Error : *${delResult.error || "SFTP Error"}*`,
            "",
            "File gagal dihapus dari server SA-MP."
        ]);
    }

    if (targetKey && db[targetKey]) {
        delete db[targetKey];
        writeDatabase(db);
    }

    return sendMenuStyle(sock, m, context, "Unwhitelist Berhasil", [
        "> Status : *SUCCESS / BERHASIL DIHAPUS*",
        `> Nama Pemain : *${targetData.name}*`,
        `> Server : *${serverName}*`,
        `> File Terhapus : *${fileName}*`,
        `> Nomor Pemilik : *${targetData.senderNumber || "-"}*`,
        "",
        "*Keterangan:*",
        "Karakter telah berhasil dicabut dari whitelist server.",
        "Pemain ini sekarang tidak dapat login ke server sampai didaftarkan kembali."
    ]);
}

module.exports = {
    name: "unwhitelist",
    category: "samp",
    command: ["unwl", "unwhitelist", "delwl"],
    description: "Menghapus whitelist pemain SA-MP via SFTP",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [
            ".unwl", ".unwhitelist", ".delwl",
            `${prefix}unwl`, `${prefix}unwhitelist`, `${prefix}delwl`
        ];

        if (validTriggers.includes(firstWord)) {
            const parts = bodyTrim.split(/\s+/);
            parts.shift();
            context.args = parts;
            context.text = parts.join(" ");
            context.q = context.text;
            await handleUnwhitelist(context);
            return true;
        }
        return false;
    },
    run: async (context) => {
        await handleUnwhitelist(context);
    }
};
