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

async function checkPterodactylFileExists(sampConfig, fileName) {
    const domain = (sampConfig.domain || "").replace(/\/+$/, "");
    const serverId = sampConfig.serverId;
    const apiKey = sampConfig.pltc;
    const folderPath = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normalizedFolder = folderPath.replace(/\/+$/, "");

    if (!apiKey || apiKey.includes("YOUR_PTERODACTYL") || !domain || domain.includes("example.com") || !serverId) {
        return null;
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
            timeout: 10000
        });

        const files = response.data?.data || [];
        const exists = files.some(f => (f.attributes?.name || "").toLowerCase() === fileName.toLowerCase());
        return exists;
    } catch (error) {
        console.error(`[UNWHITELIST CHECK ERROR] ${error.message}`);
        return null;
    }
}

async function deletePterodactylFile(sampConfig, fileName) {
    const domain = (sampConfig.domain || "").replace(/\/+$/, "");
    const serverId = sampConfig.serverId;
    const apiKey = sampConfig.pltc;
    const folderPath = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normalizedFolder = folderPath.replace(/\/+$/, "");

    if (!apiKey || apiKey.includes("YOUR_PTERODACTYL") || !domain || domain.includes("example.com") || !serverId) {
        return {
            success: true,
            simulated: true,
            message: "Pterodactyl belum dikonfigurasi (simulated)."
        };
    }

    try {
        const url = `${domain}/api/client/servers/${serverId}/files/delete`;
        const response = await axios({
            method: "POST",
            url,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: {
                root: normalizedFolder,
                files: [fileName]
            },
            timeout: 15000
        });

        return {
            success: response.status >= 200 && response.status < 300,
            simulated: false,
            status: response.status
        };
    } catch (error) {
        const status = error.response?.status;
        const errDetail = error.response?.data?.errors?.[0]?.detail || error.message;
        console.error(`[UNWHITELIST PTERODACTYL ERROR] ${status || "NET"}: ${errDetail}`);
        return {
            success: false,
            simulated: false,
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

async function handleUnwhitelist(context) {
    const { sock, m, args, prefix, isOwner, isCreator } = context;

    if (!isOwner && !isCreator) {
        return sendMenuStyle(sock, m, context, "Akses Ditolak", [
            "> Status : *Akses Ditolak*",
            "> Fitur Unwhitelist khusus untuk Owner bot.",
            "> Hubungi Owner jika ingin menghapus akun whitelist."
        ]);
    }

    const sampConfig = global.samp || {};
    const serverName = sampConfig.serverName || "SA-MP Server";
    const extension = sampConfig.extension || ".txt";

    const target = (args[0] || "").trim();

    if (!target) {
        return sendMenuStyle(sock, m, context, "Panduan Unwhitelist SA-MP", [
            "> Akses : *Khusus Owner*",
            `> Server : *${serverName}*`,
            "",
            "*Cara Penggunaan:*",
            `> Ketik : *${prefix}unwl Nama_Pemain* atau *.unwl Nama_Pemain*`,
            "> Contoh : *.unwl Stenly_Christian*",
            "> Contoh : *.unwl 6285199430173*",
            "",
            "*Keterangan:*",
            "Menghapus file whitelist di server Pterodactyl dan menghapus nomor dari database bot sehingga nomor tersebut dapat mendaftar kembali."
        ]);
    }

    const db = readDatabase();
    const cleanTargetNum = cleanNumber(target);

    let foundKey = null;
    let foundData = null;

    for (const [jid, data] of Object.entries(db)) {
        const isMatchName = (data.name || "").toLowerCase() === target.toLowerCase();
        const isMatchPhone = cleanNumber(jid) === cleanTargetNum || cleanNumber(data.sender) === cleanTargetNum;
        if (isMatchName || isMatchPhone) {
            foundKey = jid;
            foundData = data;
            break;
        }
    }

    const targetName = foundData ? foundData.name : target.replace(new RegExp(`\\${extension}$`, 'i'), '');
    const fileName = foundData?.fileName || (target.toLowerCase().endsWith(extension.toLowerCase()) ? target : `${targetName}${extension}`);
    const targetPhone = foundData ? (foundData.senderNumber || cleanNumber(foundKey)) : (cleanTargetNum || "-");

    const fileExistsOnPanel = await checkPterodactylFileExists(sampConfig, fileName);

    if (!foundData && fileExistsOnPanel === false) {
        return sendMenuStyle(sock, m, context, "Unwhitelist Gagal", [
            "> Status : *File Tidak Ditemukan*",
            `> Target : *${targetName}*`,
            `> File : *${fileName}*`,
            `> Server : *${serverName}*`,
            "",
            "*Keterangan:*",
            `File whitelist *${fileName}* tidak ditemukan di server SA-MP maupun di database bot.`,
            "Pastikan penulisan nama atau nomor WhatsApp sudah tepat."
        ]);
    }

    let pteroResult = { success: true };
    if (fileExistsOnPanel !== false) {
        pteroResult = await deletePterodactylFile(sampConfig, fileName);
    }

    if (foundKey) {
        delete db[foundKey];
        writeDatabase(db);
    }

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    if (!pteroResult.success && !pteroResult.simulated) {
        return sendMenuStyle(sock, m, context, "Unwhitelist Sebagian", [
            "> Status : *File Gagal Dihapus dari Pterodactyl*",
            `> Nama Pemain : *${targetName}*`,
            `> File : *${fileName}*`,
            `> Server : *${serverName}*`,
            `> Error : *${pteroResult.error || "Gagal menghubungi panel"}*`,
            "> Catatan : *Data lokal bot telah dibersihkan.*"
        ]);
    }

    return sendMenuStyle(sock, m, context, "Unwhitelist Berhasil", [
        "> Status : *SUCCESS / BERHASIL DIHAPUS*",
        `> Nama Pemain : *${targetName}*`,
        `> Nomor WA : *${targetPhone}*`,
        `> File Dihapus : *${fileName}*`,
        `> Server : *${serverName}*`,
        `> Tanggal Hapus : *${formattedDate}*`,
        "",
        "*Keterangan:*",
        `Karakter *${targetName}* telah dihapus dari whitelist server.`,
        "Nomor WhatsApp terkait kini dapat mendaftarkan akun baru."
    ]);
}

module.exports = {
    name: "unwhitelist",
    category: "samp",
    command: ["unwhitelist", "unwl"],
    owner: true,
    description: "Hapus whitelist pemain SA-MP dari Pterodactyl (Owner Only)",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [".unwl", ".unwhitelist", `${prefix}unwl`, `${prefix}unwhitelist`];

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
