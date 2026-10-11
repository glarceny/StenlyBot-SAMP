# StenlyBot-SAMP

WhatsApp Bot khusus untuk manajemen SA-MP (San Andreas Multiplayer) Whitelist via direct SFTP connection, dilengkapi sistem plugin dinamis, manajemen grup, dan tools utilitas.

Dibangun menggunakan Node.js dan Baileys (`@itsliaaa/baileys`).

---

## Fitur Utama

- **SA-MP Whitelist Manager (Direct SFTP)**
  - Terintegrasi langsung via protokol SFTP (SSH) ke direktori server SA-MP (`/scriptfiles/whitelist/`).
  - Request whitelist karakter SA-MP (`/whitelist <Nama_Karakter>`).
  - Hapus whitelist karakter (`/unwhitelist <Nama_Karakter>`).
  - Cek daftar whitelist (`/listwl`).
  - Konfigurasi SFTP dinamis dari WhatsApp (`/setconfigwl`).
- **WhatsApp Pairing Code** (Dukungan custom pairing code).
- **Interactive Menu** (WhatsApp Button / List Menu).
- **Role & Access Control** (Owner, Premium, Creator).
- **Group Moderation** (Antilink otomatis).
- **Tools & Utility** (HD / Upscaler, CRM reply tools, Exec command).
- **Dynamic Plugin System** (Hot-reload plugin tanpa perlu restart bot).

---

## Instalasi

### 1. Clone Repository
```bash
git clone https://github.com/glarceny/StenlyBot-SAMP.git
cd StenlyBot-SAMP
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi
Buka file `control/settings.js` dan sesuaikan pengaturan bot serta akses SFTP server SA-MP Anda:

```javascript
global.namaown = "Nama Owner"
global.prefix = "/"
global.botname = "StenlyBot-SAMP"
global.owner = ["6285199553371"]

global.samp = {
    sftp: {
        host: "103.xxx.xxx.xxx",
        port: 22,
        username: "root",
        password: "your_password"
    },
    path: "/scriptfiles/whitelist/",
    extension: ".txt",
    serverName: "Nama Server SA-MP Anda",
    ip: "103.xxx.xxx.xxx",
    port: "7777",
    gamemode: "Roleplay"
}
```

---

## Menjalankan Bot

### Mode CLI Biasa
```bash
npm start
```
Atau berikan nomor pairing langsung:
```bash
node index.js 628xxxxxxxxxx
```
atau:
```bash
PAIRING_NUMBER=628xxxxxxxxxx node index.js
```

### Background Service (PM2)
```bash
pm2 start index.js --name stenly-samp -- 628xxxxxxxxxx
pm2 save
```

Melihat logs bot:
```bash
pm2 logs stenly-samp
```

---

## Daftar Perintah

Default Prefix: `/`

### 🎮 SA-MP Whitelist
```text
/whitelist <Nama_Karakter>    - Daftarkan karakter ke whitelist SA-MP via SFTP
/unwhitelist <Nama_Karakter>  - Hapus karakter dari whitelist via SFTP
/listwl                       - Tampilkan daftar karakter terdaftar via SFTP
```

### 👑 Owner
```text
/setconfigwl                  - Ubah konfigurasi SFTP dan server SA-MP
/addowner <nomor>             - Tambah nomor owner
/delowner <nomor>             - Hapus owner
/addprem <nomor>              - Tambah user premium
/delprem <nomor>              - Hapus user premium
/public                       - Ubah mode ke Public
/self                         - Ubah mode ke Self
/uptime                       - Cek status uptime bot
=> <eval js>                  - Evaluasi JavaScript
$ <bash cmd>                  - Eksekusi bash terminal
```

### 🛠️ Tools & Utility
```text
/hd                           - Menjernihkan gambar (reply media)
/crm                          - CRM reply utilities
```

### 👥 Grup
```text
/antilink on/off              - Proteksi anti tautan di grup
```

### 📋 Menu & Informasi
```text
/menu                         - Menampilkan menu utama
/allmenu                      - Menampilkan semua menu
/owner                        - Menampilkan kontak owner
/sc                           - Menampilkan info source code
```

---

## Struktur Folder

```text
StenlyBot-SAMP/
├── control/
│   └── settings.js       # Konfigurasi bot dan SFTP SA-MP
├── index.js              # Entry point koneksi Baileys & pairing code
├── stenly.js             # Handler event pesan utama
├── lib/
│   ├── sftp.js           # Client SFTP untuk read/write/delete whitelist remote
│   ├── database/         # Database JSON lokal (whitelist, antilink, owner, premium)
│   ├── plugins.js        # Plugin loader & auto hot-reload
│   ├── menu.js           # Layout menu interaktif
│   └── ...
└── plugins/
    ├── samp/             # Plugin fitur whitelist SA-MP via SFTP
    ├── owner/            # Plugin kontrol owner
    ├── grup/             # Plugin fitur grup
    ├── tools/            # Plugin utilitas
    └── main/             # Plugin menu utama
```

---

## Lisensi

[MIT License](LICENSE)
