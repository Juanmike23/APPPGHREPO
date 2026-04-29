/*
 * PGH-DOC
 * File: src/Data/FAQ/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from 'react';
import { Articles, Knowledgebase, AskOurCommunity, Tutorials, HelpCenter, ContactUs, VideoTutorials, VictoriaWilson } from '../../Constant';
import { Edit, Globe, BookOpen, FileText, Youtube, MessageCircle, Mail, RotateCcw, DollarSign, Check, Link, Codepen } from 'react-feather';

export const ASKQUESData = [
    {
        icon: <Edit />,
        title: Tutorials
    },
    {
        icon: <Globe />,
        title: HelpCenter
    },
    {
        icon: <BookOpen />,
        title: Knowledgebase
    },
    {
        icon: <FileText />,
        title: Articles,
        class: 'badge badge-primary badge-pill pull-right',
        val: '42'
    },
    {
        icon: <Youtube />,
        title: VideoTutorials,
        class: 'badge badge-primary badge-pill pull-right',
        val: '642'
    },
    {
        icon: <MessageCircle />,
        title: AskOurCommunity
    },
    {
        icon: <Mail />,
        title: ContactUs
    },
];

export const LatestData = [
    {
        Iconclass: <RotateCcw className="font-primary" />,
        name: 'DavidLinner',
        title: 'requested money back for a double debit card charge',
        time: '10 minutes ago'
    },
    {
        Iconclass: <DollarSign className="font-primary" />,
        title: 'All sellers have received monthly payouts',
        time: '2 hours ago'
    },
    {
        Iconclass: <Link className="font-primary" />,
        name: 'UserChristopher',
        val: 'Wallace',
        title: 'is on hold and awaiting for staff reply',
        time: '45 minutes ago'
    },
    {
        Iconclass: <Check className="font-primary" />,
        val: VictoriaWilson,
        title: 'Ticket #43683 has been closed by',
        time: 'Dec 7, 11:48'
    },
];

export const ArticeVideoData1 = [
    {
        IconClass: <Codepen className="m-r-30" />,
        title: 'Knows your sources',
        discription: 'A book giving information on many subjects or on many aspects of one subject.'
    },
    {
        IconClass: <Codepen className="m-r-30" />,
        title: 'Validate website',
        discription: 'Website is the process of ensuring that the pages on the website conform.'
    },
    {
        IconClass: <Codepen className="m-r-30" />,
        title: 'Sources Demos',
        discription: 'Simple demos of frequently asked questions about using the Libraries and information resources'
    },
];

export const ArticeVideoData2 = [
    {
        IconClass: <FileText className="m-r-30" />,
        title: 'Validate website',
        discription: 'Website is the process of ensuring that the pages on the website conform.'
    },
    {
        IconClass: <FileText className="m-r-30" />,
        title: 'Tailwind Design',
        discription: 'Tailwind is so low-level, it never encourages you to design the same site twice.'
    },
    {
        IconClass: <FileText className="m-r-30" />,
        title: 'Validate Html',
        discription: 'Website is the process of ensuring that the pages on the website conform.'
    }
];

export const ArticeVideoData3 = [
    {
        IconClass: <Youtube className="m-r-30" />,
        title: 'Sources credible/reliable',
        discription: 'Simple demos of frequently asked questions about using the Libraries and information resources'
    },
    {
        IconClass: <Youtube className="m-r-30" />,
        title: 'Knows your sources',
        discription: 'A book giving information on many subjects or on many aspects of one subject.'
    },
    {
        IconClass: <Youtube className="m-r-30" />,
        title: 'Web Design',
        discription: 'Web is so high-level, it never encourages you to design the same site twice'
    },

];