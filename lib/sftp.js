const { Client } = require("ssh2");

function getSftpConfig(sampConfig) {
    const sftp = sampConfig?.sftp || {};
    return {
        host: sftp.host || sampConfig.ip || "",
        port: Number(sftp.port || 22),
        username: sftp.username || "",
        password: sftp.password || "",
        privateKey: sftp.privateKey || ""
    };
}

function isSftpConfigured(sampConfig) {
    const cfg = getSftpConfig(sampConfig);
    return Boolean(cfg.host && cfg.username && (cfg.password || cfg.privateKey));
}

function openSftpSession(sftpConfig) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on("ready", () => {
            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                resolve({ conn, sftp });
            });
        });
        conn.on("error", (err) => reject(err));

        const connectOpts = {
            host: sftpConfig.host,
            port: sftpConfig.port,
            username: sftpConfig.username,
            readyTimeout: 10000
        };
        if (sftpConfig.privateKey) {
            connectOpts.privateKey = sftpConfig.privateKey;
        } else {
            connectOpts.password = sftpConfig.password;
        }

        conn.connect(connectOpts);
    });
}

function ensureRemoteDir(sftp, fullDirPath) {
    return new Promise((resolve, reject) => {
        const segments = fullDirPath.replace(/\\/g, "/").split("/").filter(Boolean);
        let current = fullDirPath.startsWith("/") ? "/" : "";

        function next(index) {
            if (index >= segments.length) return resolve();
            current = (current === "/" ? "/" : current + "/") + segments[index];
            sftp.stat(current, (statErr) => {
                if (statErr) {
                    sftp.mkdir(current, (mkdirErr) => {
                        if (mkdirErr && mkdirErr.code !== 4) return reject(mkdirErr);
                        next(index + 1);
                    });
                } else {
                    next(index + 1);
                }
            });
        }
        next(0);
    });
}

async function writeRemoteFile(sampConfig, fileName, content) {
    const folder = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normFolder = folder.endsWith("/") ? folder : `${folder}/`;
    const fullPath = `${normFolder}${fileName}`;

    if (!isSftpConfigured(sampConfig)) {
        return { success: true, simulated: true, filePath: fullPath };
    }

    const { conn, sftp } = await openSftpSession(getSftpConfig(sampConfig));
    try {
        await ensureRemoteDir(sftp, normFolder.replace(/\/+$/, ""));
        await new Promise((resolve, reject) => {
            const stream = sftp.createWriteStream(fullPath);
            stream.on("close", resolve);
            stream.on("error", reject);
            stream.end(Buffer.from(content, "utf8"));
        });
        return { success: true, simulated: false, filePath: fullPath };
    } finally {
        conn.end();
    }
}

async function checkRemoteFileExists(sampConfig, fileName) {
    const folder = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normFolder = folder.endsWith("/") ? folder : `${folder}/`;
    const fullPath = `${normFolder}${fileName}`;

    if (!isSftpConfigured(sampConfig)) return null;

    const { conn, sftp } = await openSftpSession(getSftpConfig(sampConfig));
    try {
        return await new Promise((resolve) => {
            sftp.stat(fullPath, (err) => resolve(!err));
        });
    } finally {
        conn.end();
    }
}

async function deleteRemoteFile(sampConfig, fileName) {
    const folder = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normFolder = folder.endsWith("/") ? folder : `${folder}/`;
    const fullPath = `${normFolder}${fileName}`;

    if (!isSftpConfigured(sampConfig)) {
        return { success: true, simulated: true, filePath: fullPath };
    }

    const { conn, sftp } = await openSftpSession(getSftpConfig(sampConfig));
    try {
        await new Promise((resolve, reject) => {
            sftp.unlink(fullPath, (err) => {
                if (err && err.code !== 2) return reject(err);
                resolve();
            });
        });
        return { success: true, simulated: false, filePath: fullPath };
    } finally {
        conn.end();
    }
}

async function listRemoteFiles(sampConfig) {
    const folder = (sampConfig.path || "/scriptfiles/whitelist/").replace(/\\/g, "/");
    const normFolder = folder.endsWith("/") ? folder : `${folder}/`;

    if (!isSftpConfigured(sampConfig)) {
        return { success: false, error: "SFTP belum dikonfigurasi di settings." };
    }

    const { conn, sftp } = await openSftpSession(getSftpConfig(sampConfig));
    try {
        const rawFiles = await new Promise((resolve, reject) => {
            sftp.readdir(normFolder, (err, list) => {
                if (err) return reject(err);
                resolve(list || []);
            });
        });

        const ext = (sampConfig.extension || ".txt").toLowerCase();
        const files = rawFiles
            .filter((item) => item.filename && !item.filename.startsWith("."))
            .map((item) => {
                const fullName = item.filename;
                const cleanName = fullName.replace(new RegExp(`\\${ext}$`, "i"), "");
                return {
                    fileName: fullName,
                    playerName: cleanName,
                    size: item.attrs?.size || 0,
                    modifiedAt: item.attrs?.mtime ? new Date(item.attrs.mtime * 1000).toISOString() : null
                };
            });

        return { success: true, files, folderPath: normFolder };
    } finally {
        conn.end();
    }
}

module.exports = {
    getSftpConfig,
    isSftpConfigured,
    writeRemoteFile,
    checkRemoteFileExists,
    deleteRemoteFile,
    listRemoteFiles
};
