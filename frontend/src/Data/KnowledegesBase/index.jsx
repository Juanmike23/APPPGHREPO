/*
 * PGH-DOC
 * File: src/Data/KnowledegesBase/index.jsx
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
import { Aperture, BookOpen, FileText } from 'react-feather';

const Paras = 'How little experience or technical knowledge you currently have. The web is a very big place, and if you are the typical internet user, you probably visit several websites every day.';
const Paras1 = 'A Website Designing course enables learners to use essential designing and programming tools required to do the job efficiently. The curriculum is a blend of various themes.';
const Paras2 = 'The customer support industry is renaissance. Customer support as a specialty is coming into its own, offering companies a competitive advantage that’s difficult to copy.';


export const MainCardPara1 = 'Knowledge can be defined as awareness of facts or as practical skills, and may also refer to familiarity with objects or situations. Knowledge of facts, also called propositional knowledge, is often defined as true belief that is distinct from opinion or guesswork by virtue of justification. While there is wide agreement among philosophers that it is a form of true belief, many controversies in philosophy focus on justification: whether it is needed at all, how to understand it, and whether something else besides it is needed.';
export const MainCardPara2 = 'Knowledge can be produced in many different ways. The most important source is perception, which refers to the usage of the five senses. Many theorists also include introspection as a source of knowledge, not of external physical objects, but of one own mental states. Other sources often discussed include memory, rational intuition, inference, and testimony. According to foundationalism, some of these sources are basic in the sense that they can justify beliefs without depending on other mental states. This claim is rejected by coherentists.';

export const ArticalsData = [
    {
        id: 1,
        title: 'Articles',
        para: Paras,
        icon: <BookOpen />
    },
    {
        id: 2,
        title: 'Knowledgebase',
        para: Paras1,
        icon: <Aperture />
    },
    {
        id: 3,
        title: 'Support',
        para: Paras2,
        icon: <FileText />
    },
];

export const DetailesSidebarData = [
    {
        id: 1,
        title1: 'UX Development',
        title2: 'Course By',
        title3: ' Development Team',
        date: '18',
        month: 'Dec'
    },
    {
        id: 2,
        title1: 'Business Analyst',
        title2: 'Course By',
        title3: ' Analyst Team',
        date: '28',
        month: 'Oct'
    },
    {
        id: 3,
        title1: 'Web Development',
        title2: 'Course By',
        title3: 'Designer',
        date: '1',
        month: 'May'
    },
];