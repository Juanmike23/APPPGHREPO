/*
 * PGH-DOC
 * File: src/Components/Human/Resource/index.jsx
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
import { User, UserPlus, Activity } from "react-feather";
import { Container, Row } from "@pgh/ui-bootstrap";
import { useSearchParams } from "react-router-dom";

import TableFTE from "./TableFTE";
import TableNonFTE from "./TableNonFTE";
import KebutuhanFTE from "./KebutuhanFTE";
import DashboardHeader from "../../../Variables/Dashboard/DashboardHeader";
import useHeaderTabRefreshToken from "../../../Variables/Dashboard/useHeaderTabRefreshToken";
import "../../Audit/Utils/auditArea.scss";
import "../../Audit/DashboardAudit/auditDashboard.scss";
import "./humanResourceList.scss";

const TAB_CONFIGS = [
  { key: "fte", label: "FTE Resource", icon: User, component: TableFTE },
  { key: "nonfte", label: "Non-FTE Resource", icon: UserPlus, component: TableNonFTE },
  {
    key: "kebutuhanfte",
    label: "FTE Requirement",
    icon: Activity,
    component: KebutuhanFTE,
  },
];

const DEFAULT_TAB = TAB_CONFIGS[0].key;

const Resource = () => {
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

  const tabs = useMemo(() => {
    return TAB_CONFIGS.map(({ key, label, icon }) => ({
      key,
      label,
      icon,
    }));
  }, []);

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

          <div key={`human-resource-content-${activeTab}-${headerRefreshToken}`} className="human-resource-content">{activeContent}</div>
        </Row>
      </Container>
    </Fragment>
  );
};

export default Resource;
