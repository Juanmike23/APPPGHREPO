/*
 * PGH-DOC
 * File: src/Components/Common/Data/Task/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { AssignedToMe, Business, CreatedByMe, DelayedTasks, Holidays, MyTasks, Newsletter, ThisMonthTasks, ThisWeekTask, TodayTasks, UpcomingTasks } from "../../../../Constant";

export const taskData = [
    {
        id: 1,
        activeTab: '1',
        title: CreatedByMe,
    },
    {
        id: 2,
        activeTab: '2',
        title: TodayTasks,
    },
    {
        id: 3,
        activeTab: '3',
        title: DelayedTasks,
    },
    {
        id: 4,
        activeTab: '4',
        title: UpcomingTasks,
    },
    {
        id: 5,
        activeTab: '5',
        title: ThisWeekTask,
    },
    {
        id: 6,
        activeTab: '6',
        title: ThisMonthTasks,
    },
    {
        id: 7,
        activeTab: '7',
        title: AssignedToMe,
    },
    {
        id: 8,
        activeTab: '8',
        title: MyTasks,
    },
];

export const tagData = [
    {
        id: 1,
        activeTab: '9',
        title: Newsletter,
    },
    {
        id: 2,
        activeTab: '10',
        title: Business,
    },
    {
        id: 3,
        activeTab: '11',
        title: Holidays,
    },
];
