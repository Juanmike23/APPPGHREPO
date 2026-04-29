/*
 * PGH-DOC
 * File: src/Components/Common/Data/ContactApp/OrgList.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const orgList = [
    {
        activeTab: '1',
        img: 'user/user.png',
        name: 'Mark Jecno',
        email: 'MARKJENCOEMAIL',
        gender: 'Male'
    },
    {
        activeTab: '2',
        img: 'user/3.jpg',
        name: 'Jason Borne',
        email: 'jasonb@gmail.com',
        gender: 'Male'
    },
    {
        activeTab: '3',
        img: 'user/4.jpg',
        name: 'Sarah Loren',
        email: 'barnes@gmail.com',
        gender: 'Female'
    },
    {
        activeTab: '4',
        img: 'user/10.jpg',
        name: 'Andew Jon',
        email: 'andewjon@gmail.com',
        gender: 'Female'
    }
]