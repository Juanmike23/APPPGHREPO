/*
 * PGH-DOC
 * File: src/api/index.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan helper pemanggilan API backend secara terpusat.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

const api = `${process.env.PUBLIC_URL}/api`;
export const TaskApi = `${api}/task.json`;
export const BookmarkApi = `${api}/bookmark.json`;
export const ChartistApi = `${api}/chartistData.json`;
export const ChartjsApi = `${api}/chartjsData.json`;
export const ChatMemberApi = `${api}/chatMember.json`;
export const ChatApi = `${api}/chat.chats.json`;
export const ContactApi = `${api}/contacts.json`;
export const ProductsApi = `${api}/product.json`;
export const ImageLightApi = `${api}/image-light.json`;
export const BigImageApi = `${api}/image-big-light.json`;
export const MasonryApi = `${api}/masonry.json`;
export const GooglechartApi = `${api}/googleChartData.json`;
export const AllProjectApi = `${api}/allProject.json`;
export const TableDataApi = `${api}/tableData.json`;
export const TodoApi = `${api}/todo.json`;
export const JobSearchApi = `${api}/jobSearch.json`;
export const LearningApi = `${api}/learning.json`;
export const KnowledgebaseApi = `${api}/knowledgebaseDB.json`;
export const FaqApi = `${api}/Faq.json`;
export const FileApi = `${api}/files.json`;
export const UserCardApi = `${api}/usercard.json`;
export const StickyApi = `${api}/sticky.json`;
export const TypeaheadDataApi = `${api}/typeaheadData.json`;
export const FeatherDataApi = `${api}/featherData.json`;
export const FlagIconDataApi = `${api}/flagIconData.json`;
export const FontawsomeDataApi = `${api}/fontawsomeData.json`;
export const IcoDataApi = `${api}/icoData.json`;
export const ThemifyDataApi = `${api}/themifyData.json`;





