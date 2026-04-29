/*
 * PGH-DOC
 * File: src/Variables/utils/GroupTableFormat.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// utils/treeUtils.js
export const buildTree = (data = []) => {
  if (!Array.isArray(data)) return [];

  const level0 = [
    "Beban Administrasi dan Umum",
    "Beban Personalia",
    "Beban Lainnya",
    "Jumlah Beban Operasional Lainnya",
  ];

  const level05 = [
    "Beban Kantor",
    "Beban Teknologi & Telekomunikasi",
    "Beban Penyusutan dan Amortisasi",
  ];

  const lookup = {};
  const roots = [];

  // normalize
  data.forEach((item) => {
    const id = item.ID ?? item.Id;
    const parentId = item.ParentID ?? item.ParentId ?? item.parent_id ?? null;
    lookup[id] = { ...item, ID: id, ParentID: parentId, children: [] };
  });

  // link relationships
  Object.values(lookup).forEach((item) => {
    if (item.ParentID && lookup[item.ParentID]) {
      lookup[item.ParentID].children.push(item);
    } else {
      roots.push(item);
    }
  });

  // assign levels based on rules
  const assignLevels = (nodes, level = 0) => {
    nodes.forEach((node) => {
      const name = node.MataAnggaranParent?.trim();

      if (level0.includes(name)) {
        node.level = 0;
      } else if (level05.includes(name)) {
        node.level = 0.5;
      } else {
        node.level = level; // inherit from parent if not matched
      }

      if (node.children?.length) {
        const nextLevel =
          level0.includes(name) || level05.includes(name)
            ? Math.floor(node.level) + 1
            : level + 1;
        assignLevels(node.children, nextLevel);
      }
    });
  };

  assignLevels(roots);
  return roots;
};


export const flattenTree = (nodes = [], collapseState = {}, level = 0) => {
  let flat = [];

  nodes.forEach((node) => {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCollapsed = collapseState[node.ID];
    flat.push({
      ...node,
      __level: level,
      hasChildren,
      isCollapsed,
    });

    if (hasChildren && !isCollapsed) {
      flat = flat.concat(flattenTree(node.children, collapseState, level + 1));
    }
  });

  return flat;
};
