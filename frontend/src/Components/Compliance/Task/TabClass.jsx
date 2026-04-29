/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/TabClass.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from "react";
import { Col, TabContent, TabPane } from "@pgh/ui-bootstrap";

import ListOfTask from "./ListTask";

const TabClass = ({
  activeGroup,
  reports,
  onDelete,
  onUpdate,
  onUploadDocument,
  onAddRow,
  contentRef,
  highlightRowId,
  canManageCompliance,
  isAllEventsView = false,
}) => {
  return (
    <Fragment>
      <Col xl="12" md="12" className="compliance-events-detail-col">
        <div className="compliance-events-detail-panel" ref={contentRef}>
          <div className="compliance-events-detail-panel__inner">
            <TabContent activeTab="1">
              <TabPane tabId="1">
                <ListOfTask
                  activeGroup={activeGroup}
                  reports={reports}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  onUploadDocument={onUploadDocument}
                  onAddRow={onAddRow}
                  highlightRowId={highlightRowId}
                  canManageCompliance={canManageCompliance}
                  isAllEventsView={isAllEventsView}
                />
              </TabPane>
            </TabContent>
          </div>
        </div>
      </Col>
    </Fragment>
  );
};

export default TabClass;
