/*
 * PGH-DOC
 * File: src/Components/Human/Training/index.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useMemo, useState } from "react";
import { BookOpen, Briefcase, Award } from "react-feather";
import { Container, Row } from "@pgh/ui-bootstrap";
import { useSearchParams } from "react-router-dom";

import TableBNU from "./TableBNU";
import TableInternal from "./TableInternal";
import TableKompetensiPegawai from "./TableKompetensiPegawai";
import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";
import "../../Audit/Utils/auditArea.scss";
import "../../Audit/DashboardAudit/auditDashboard.scss";
import "../Resource/humanResourceList.scss";

const TAB_CONFIGS = [
  { key: "bnu", label: "Training Plan", icon: BookOpen, component: TableBNU },
  {
    key: "internaltraining",
    label: "Training Class",
    icon: Briefcase,
    component: TableInternal,
  },
  {
    key: "kompetensipegawai",
    label: "Employee Competency",
    icon: Award,
    component: TableKompetensiPegawai,
  },
];

const DEFAULT_TAB = TAB_CONFIGS[0].key;

const Training = () => {
  const [params, setParams] = useSearchParams();
  const urlTab = params.get("tab") || DEFAULT_TAB;
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const headerRefreshToken = useHeaderTabRefreshToken(activeTab);

  const tabLookup = useMemo(
    () => new Set(TAB_CONFIGS.map((tab) => tab.key)),
    [],
  );

  useEffect(() => {
    const normalizedTab = tabLookup.has(urlTab) ? urlTab : DEFAULT_TAB;
    if (normalizedTab !== activeTab) {
      setActiveTab(normalizedTab);
    }
  }, [activeTab, tabLookup, urlTab]);

  const handleTabChange = (key) => {
    if (!tabLookup.has(key)) return;
    setActiveTab(key);
    setParams({ tab: key });
  };

  const tabs = useMemo(
    () =>
      TAB_CONFIGS.map(({ key, label, icon }) => ({
        key,
        label,
        icon,
      })),
    [],
  );

  const activeContent = useMemo(() => {
    const activeConfig =
      TAB_CONFIGS.find((tab) => tab.key === activeTab) || TAB_CONFIGS[0];
    const ActiveComponent = activeConfig.component;
    return <ActiveComponent title={activeConfig.label} />;
  }, [activeTab]);

  useEffect(() => {
    if (tabLookup.has(urlTab)) return;
    setParams({ tab: DEFAULT_TAB });
  }, [setParams, tabLookup, urlTab]);

  return (
    <Fragment>
      <Container fluid className="human-resource-page audit-module-page audit-dashboard-page">
        <Row className="human-resource-shell audit-dashboard-shell g-3">
          <DashboardHeader
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          <div key={`human-training-content-${activeTab}-${headerRefreshToken}`} className="human-resource-content">{activeContent}</div>
        </Row>
      </Container>
    </Fragment>
  );
};

export default Training;
