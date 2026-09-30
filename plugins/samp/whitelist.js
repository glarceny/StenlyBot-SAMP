const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { generateWAMessageFromContent } = require("@itsliaaa/baileys");
const { categorySections } = require("../../lib/menu");

const DB_PATH = path.join(__dirname, "../../lib/database/whitelist.json");

function readDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({}, null, 2));
            return {};
        }
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
        console.error("[WHITELIST DB ERROR]", err);
        return false;
    }
}

function cleanNumber(jid) {
    return String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}

async function writePterodactylFile(sampConfig, fileName, content) {
    const domain = (sampConfig.domain || "").replace(/\/+$/, "");
    const serverId = sampConfig.serverId;
    const apiKey = sampConfig.pltc;
    const folderPath = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normalizedFolder = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    const fullFilePath = `${normalizedFolder}${fileName}`;

    if (!apiKey || apiKey.includes("YOUR_PTERODACTYL") || !domain || domain.includes("example.com") || !serverId) {
        console.log(`[WHITELIST SIMULATED] File ${fullFilePath} disimulasikan sukses (konfigurasi panel belum diisi).`);
        return {
            success: true,
            simulated: true,
            filePath: fullFilePath,
            message: "Tersimpan di database lokal (Pterodactyl config belum diatur)."
        };
    }

    try {
        const url = `${domain}/api/client/servers/${serverId}/files/write?file=${encodeURIComponent(fullFilePath)}`;
        const response = await axios({
            method: "POST",
            url,
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "text/plain",
                "Accept": "application/json, text/plain, */*"
            },
            data: content,
            timeout: 15000
        });

        return {
            success: response.status >= 200 && response.status < 300,
            simulated: false,
            status: response.status,
            filePath: fullFilePath
        };
    } catch (error) {
        const status = error.response?.status;
        const errDetail = error.response?.data?.errors?.[0]?.detail || error.message;
        console.error(`[WHITELIST PTERODACTYL ERROR] ${status || "NET"}: ${errDetail}`);
        return {
            success: false,
            simulated: false,
            error: errDetail,
            status
        };
    }
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
        console.error(`[WHITELIST CHECK ERROR] ${error.message}`);
        return null;
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

async function handleWhitelist(context) {
    const { sock, m, args, prefix, sender, pushname } = context;
    const sampConfig = global.samp || {};

    const serverName = sampConfig.serverName || "SA-MP Server";
    const ip = sampConfig.ip || "127.0.0.1";
    const port = sampConfig.port || "7777";
    const gamemode = sampConfig.gamemode || "Roleplay";
    const extension = sampConfig.extension || ".txt";
    const savePath = sampConfig.path || "/scriptfiles/whitelist/";

    const inputName = (args[0] || "").trim();

    if (!inputName) {
        return sendMenuStyle(sock, m, context, "Panduan Whitelist SA-MP", [
            `> Server : *${serverName}*`,
            `> Mode : *${gamemode}*`,
            `> IP & Port : *${ip}:${port}*`,
            "",
            "*Cara Pendaftaran:*",
            `> Ketik : *.wl Nama_Pemain* atau *${prefix}wl Nama_Pemain*`,
            "> Contoh : *.wl Stenly_Christian*",
            "> Contoh : *.wl John_Doe*",
            "",
            "*Ketentuan Standar Roleplay SA-MP:*",
            "1. Format nama wajib *NamaDepan_NamaBelakang*.",
            "2. Awal setiap kata wajib huruf *KAPITAL*.",
            "3. Pemisah nama hanya menggunakan tanda garis bawah (_).",
            "4. Panjang nama 3 sampai 24 karakter.",
            "5. Dilarang nama troll/terkenal/mengandung simbol aneh.",
            "6. *1 Nomor WhatsApp hanya bisa mendaftarkan 1 akun SA-MP.*"
        ]);
    }

    const RP_NAME_REGEX = /^[A-Z][a-zA-Z0-9]{1,15}_[A-Z][a-zA-Z0-9]{1,15}$/;
    if (!RP_NAME_REGEX.test(inputName) || inputName.length < 3 || inputName.length > 24) {
        return sendMenuStyle(sock, m, context, "Format Nama Ditolak", [
            `> Nama Diinput : *${inputName}*`,
            "> Status : *Format Tidak Sesuai Standar SA-MP*",
            "",
            "*Kesalahan Umum:*",
            "- Tidak menggunakan pemisah garis bawah (_)",
            "- Huruf awal nama tidak KAPITAL",
            "- Kurang dari 3 huruf atau lebih dari 24 huruf",
            "",
            "*Contoh Benar:*",
            "> *.wl Stenly_Christian*",
            "> *.wl Carl_Johnson*",
            "> *.wl Arthur_Morgan*"
        ]);
    }

    const senderNum = cleanNumber(sender);
    const db = readDatabase();

    const existingByUser = Object.entries(db).find(([jid, data]) => {
        return cleanNumber(jid) === senderNum || cleanNumber(data.sender) === senderNum;
    });

    if (existingByUser) {
        const prevData = existingByUser[1];
        return sendMenuStyle(sock, m, context, "Whitelist Ditolak", [
            "> Status : *Nomor WhatsApp Sudah Terdaftar*",
            `> Nama Terdaftar : *${prevData.name}*`,
            `> Tanggal Daftar : *${prevData.registeredAt}*`,
            `> Target Server : *${serverName}*`,
            "",
            "*Peringatan:*",
            "> 1 Nomor WhatsApp hanya berhak memiliki *1 Akun Whitelist*.",
            "> Untuk penggantian nama / reset whitelist, silakan hubungi Admin/Owner."
        ]);
    }

    const existingByName = Object.values(db).find(data => {
        return (data.name || "").toLowerCase() === inputName.toLowerCase();
    });

    if (existingByName) {
        return sendMenuStyle(sock, m, context, "Nama Sudah Digunakan", [
            `> Nama : *${inputName}*`,
            "> Status : *Nama Sudah Terdaftar di Server*",
            "",
            "Nama karakter ini telah digunakan oleh pemain lain.",
            "Silakan gunakan kombinasi nama Roleplay yang lain."
        ]);
    }

    const fileName = `${inputName}${extension}`;
    const fileExistsOnPanel = await checkPterodactylFileExists(sampConfig, fileName);

    if (fileExistsOnPanel === true) {
        return sendMenuStyle(sock, m, context, "Nama Sudah Terdaftar", [
            `> Nama : *${inputName}*`,
            "> Status : *File Sudah Ada di Server*",
            `> Server : *${serverName}*`,
            "",
            "*Keterangan:*",
            `File whitelist *${fileName}* sudah terdaftar di server SA-MP.`,
            "Gunakan nama lain atau hubungi Owner untuk reset whitelist."
        ]);
    }

    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

    const fileContent = [
        `===========================================`,
        ` SA-MP Whitelist Player Data`,
        `===========================================`,
        `Player Name  : ${inputName}`,
        `Sender WA    : ${senderNum}`,
        `Pushname     : ${pushname}`,
        `Register Date: ${formattedDate}`,
        `Status       : WHITELISTED`,
        `===========================================`
    ].join("\n");

    const pteroResult = await writePterodactylFile(sampConfig, fileName, fileContent);

    if (!pteroResult.success && !pteroResult.simulated) {
        return sendMenuStyle(sock, m, context, "Gagal Menulis Whitelist", [
            "> Status : *Gagal Menghubungi Panel Pterodactyl*",
            `> Target File : *${fileName}*`,
            `> Error : *${pteroResult.error || "Connection Timeout / Unauthorized"}*`,
            "",
            "Harap laporkan kendala ini kepada Owner/Admin Server."
        ]);
    }

    db[sender] = {
        name: inputName,
        sender: sender,
        senderNumber: senderNum,
        pushname: pushname,
        registeredAt: formattedDate,
        serverName: serverName,
        ip: ip,
        port: port,
        gamemode: gamemode,
        fileName: fileName,
        path: `${savePath}${fileName}`,
        simulated: pteroResult.simulated || false
    };
    writeDatabase(db);

    return sendMenuStyle(sock, m, context, "Whitelist Berhasil", [
        "> Status : *SUCCESS / BERHASIL DAFTAR*",
        `> Nama Pemain : *${inputName}*`,
        `> Server Name : *${serverName}*`,
        `> IP Server : *${ip}*`,
        `> Port Server : *${port}*`,
        `> IP:Port : *${ip}:${port}*`,
        `> Gamemode : *${gamemode}*`,
        `> File Whitelist : *${savePath}${fileName}*`,
        `> Tanggal Daftar : *${formattedDate}*`,
        "",
        "*Selamat Bermain di Server Kami!*",
        `Pastikan gunakan nama *${inputName}* saat login di client SA-MP.`,
        "Patuhi rules server dan selamat ber-Roleplay bersama komunitas!"
    ]);
}

module.exports = {
    name: "whitelist",
    category: "samp",
    command: ["wl", "whitelist"],
    description: "Pendaftaran whitelist pemain SA-MP ke Pterodactyl",
    before: async (context) => {
        const { body, prefix } = context;
        const bodyTrim = (body || "").trim();
        if (!bodyTrim) return false;

        const firstWord = bodyTrim.split(/\s+/)[0].toLowerCase();
        const validTriggers = [".wl", ".whitelist", `${prefix}wl`, `${prefix}whitelist`];
        
        if (validTriggers.includes(firstWord)) {
            const parts = bodyTrim.split(/\s+/);
            parts.shift();
            context.args = parts;
            context.text = parts.join(" ");
            context.q = context.text;
            await handleWhitelist(context);
            return true;
        }
        return false;
    },
    run: async (context) => {
        await handleWhitelist(context);
    }
};
