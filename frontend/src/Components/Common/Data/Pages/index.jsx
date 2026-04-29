/*
 * PGH-DOC
 * File: src/Components/Common/Data/Pages/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const ecommerceData = [
    {
        id: 1,
        product: 'email-template/4.png',
        desc: 'Three seater Wood Style sofa for Leavingroom',
        size: 'L',
        qty: '1',
        price: '500'
    },
    {
        id: 2,
        product: 'email-template/1.png',
        desc: 'Three seater Wood Style sofa for Leavingroom',
        size: 'L',
        qty: '1',
        price: '500'
    },
    {
        id: 3,
        product: 'email-template/4.png',
        desc: 'Three seater Wood Style sofa for Leavingroom',
        size: 'L',
        qty: '1',
        price: '500'
    },
    {
        id: 4,
        product: 'email-template/1.png',
        desc: 'Three seater Wood Style sofa for Leavingroom',
        size: 'L',
        qty: '1',
        price: '500'
    }
];

export const productData = [
    {
        id: 1,
        img: 'email-template/2.png',
        title: 'When an unknown.',
        price: '$45.00',
        star: false
    },
    {
        id: 2,
        img: 'email-template/2.png',
        title: 'When an unknown.',
        price: '$45.00',
        star: true
    },
    {
        id: 3,
        img: 'email-template/2.png',
        title: 'When an unknown.',
        price: '$45.00',
        star: true
    }
];