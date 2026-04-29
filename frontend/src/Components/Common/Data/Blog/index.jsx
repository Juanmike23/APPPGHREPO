/*
 * PGH-DOC
 * File: src/Components/Common/Data/Blog/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

export const BlogData = [
    {
        id: 1,
        img: 'blog/blog-5.jpg',
        date: '9 April 2022',
        admin: 'by: Admin',
        hits: '0 Hits',
        details: 'A huge part of it is the incomparable you can encounter every day. People just do anymore profound.'
    },
    {
        id: 2,
        img: 'blog/blog-6.jpg',
        date: '9 April 2022',
        admin: 'by: Admin',
        hits: '0 Hits',
        details: 'People just dont do it anymore. We have to change that. Sometimes the simplest things are the most profound.'
    },
    {
        id: 3,
        img: 'blog/blog-5.jpg',
        date: '9 April 2022',
        admin: 'by: Admin',
        hits: '0 Hits',
        details: 'A huge part of it is the incomparable you can encounter every day. People just do anymore profound.'
    },
    {
        id: 4,
        img: 'blog/blog-6.jpg',
        date: '9 April 2022',
        admin: 'by: Admin',
        hits: '0 Hits',
        details: 'People just dont do it anymore. We have to change that. Sometimes the simplest things are the most profound.'
    }
];

export const BlogSingleData = [
    {
        id: 1,
        name: 'JolioMark',
        post: 'Designer',
        hits: '02 Hits',
        comments: '598 Comments',
        para: `The best thing is location and drive through the forest. The resort is 35km from Ramnagar. The gardens are well kept and maintained. Its a good place for relaxation away from the city noise. The staff is very friendly and overall we had a really good & fun time, thanks to staff member - Bhairav, Rajat, Gunanand, Lokesh & everyone else. And also we went for an adventurous night safari and saw barking deers, tuskar elephant.`
    },
    {
        id: 2,
        name: 'Helsenky Roi',
        post: 'Designer',
        hits: '02 Hits',
        comments: '598 Comments',
        para: `Clean resort with maintained garden but rooms are average Lack of communication between the staff members. Receptionsit full of attitude. Arrogant staff. Except good view there is nothing great in this property.Resort is 35 kms away from Ramnagar Town.`
    },
    {
        id: 3,
        name: 'Rio Martin',
        post: 'Designer',
        hits: '02 Hits',
        comments: '598 Comments',
        para: `There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text.`
    },
    {
        id: 4,
        name: 'Jack Helson',
        post: 'Designer',
        hits: '02 Hits',
        comments: '598 Comments',
        para: `From the east coast to the west, each river has its own beauty and character. Each river has its own story. There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text.`
    },
    {
        id: 5,
        name: 'Addy Mark',
        post: 'Designer',
        hits: '02 Hits',
        comments: '598 Comments',
        para: `Harpeth rises in the westernmost part of Rutherford County, just to the east of the community of College Grove in eastern Williamson County.but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text.`
    }
];