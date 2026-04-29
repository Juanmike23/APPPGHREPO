/*
 * PGH-DOC
 * File: src/Components/Audit/DashboardAudit/BUTTONCONCEN.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { useRef } from "react";
import { Card, CardBody, CardTitle, CardText } from "@pgh/ui-bootstrap";

export default function App() {
  const cardRefs = useRef([]);

  const focusCard = (index) => {
    cardRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  return (
    <div style={{ height: "200vh", padding: "40px" }}>
      {[1, 2, 3, 4, 5].map((num, index) => (
        <Card
          key={num}
          innerRef={(el) => (cardRefs.current[index] = el)}
          onClick={() => focusCard(index)}
          style={{
            marginBottom: "40px",
            cursor: "pointer",
          }}
        >
          <CardBody>
            <CardTitle tag="h5">Card {num}</CardTitle>
            <CardText>Click me to scroll & center</CardText>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
