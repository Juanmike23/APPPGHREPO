/*
 * PGH-DOC
 * File: src/Data/Ecommerce/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const StandardData = [
    {
        prize: '$10',
        title: 'Standard',
        month: '/month',
        storage1: '50GB',
        props1: 'Disk Space',
        storage2: '50',
        props2: 'Email Accounts',
        storage3: '50GB',
        props3: 'Bandwidth',
        storage4: '10',
        props4: 'Subdomains',
        storage5: '15',
        props5: 'Domains',
    },
    {
        prize: '$20',
        title: 'PREMIUM',
        month: '/month',
        storage1: '20GB',
        props1: 'Disk Space',
        storage2: '20',
        props2: 'Email Accounts',
        storage3: '20GB',
        props3: 'Bandwidth',
        storage4: '20',
        props4: 'Subdomains',
        storage5: '20',
        props5: 'Domains',
    },
    {
        prize: '$30',
        title: 'AUTHER PACK',
        month: '/month',
        storage1: '30GB',
        props1: 'Disk Space',
        storage2: '30',
        props2: 'Email Accounts',
        storage3: '30GB',
        props3: 'Bandwidth',
        storage4: '25',
        props4: 'Subdomains',
        storage5: '25',
        props5: 'Domains',
    },
    {
        prize: '$40',
        title: 'BUSINESS',
        month: '/month',
        storage1: '40GB',
        props1: 'Disk Space',
        storage2: '40',
        props2: 'Email Accounts',
        storage3: '40GB',
        props3: 'Bandwidth',
        storage4: '30',
        props4: 'Subdomains',
        storage5: '30',
        props5: 'Domains',
    },
]

export const SmallCard = [
    {
        title: 'Standard',
        prize: '$15'
    },
    {
        title: 'Business',
        prize: '$25'
    },
    {
        title: 'Premium',
        prize: '$35'
    },
    {
        title: 'Extra',
        prize: '$45'
    },
]