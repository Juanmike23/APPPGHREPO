/*
 * PGH-DOC
 * File: src/Components/Dashboard/Default/SharedHome.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Row,
} from "@pgh/ui-bootstrap";
import {
  Activity,
  ArrowRight,
  Briefcase,
  Search,
  ShoppingCart,
  Users,
} from "react-feather";
import { useAuth } from "../../../Auth/AuthContext";
import { getPathAccess, isAdminUser } from "../../../Auth/accessControl";
import FeedbackState from "../../Common/FeedbackState";

const HOME_THEME = {
  navy: "#24364a",
  orange: "#f15a22",
  orangeSoft: "rgba(241, 90, 34, 0.16)",
  teal: "#0f766e",
  tealSoft: "rgba(15, 118, 110, 0.16)",
  sand: "#f6efe7",
  sandBorder: "rgba(202, 138, 72, 0.25)",
  whiteSoft: "rgba(255,255,255,0.16)",
};

const summaryBadgeStyle = (variant) => {
  switch (variant) {
    case "home":
      return {
        background: "rgba(255,255,255,0.16)",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.18)",
      };
    case "level":
      return {
        background: HOME_THEME.orangeSoft,
        color: "#fff3eb",
        border: "1px solid rgba(241, 90, 34, 0.38)",
      };
    case "stream":
      return {
        background: HOME_THEME.tealSoft,
        color: "#d8fffb",
        border: "1px solid rgba(45, 212, 191, 0.28)",
      };
    default:
      return {};
  }
};

const summaryBoxStyle = (variant) => {
  const base = {
    minWidth: "180px",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid transparent",
  };

  switch (variant) {
    case "email":
      return {
        ...base,
        background: HOME_THEME.whiteSoft,
        borderColor: "rgba(255,255,255,0.14)",
      };
    case "modules":
      return {
        ...base,
        background: HOME_THEME.orangeSoft,
        borderColor: "rgba(241, 90, 34, 0.28)",
      };
    default:
      return base;
  }
};

const MODULES = [
  {
    key: "audit",
    title: "Audit",
    path: `${process.env.PUBLIC_URL}/audit`,
    icon: Search,
    description: "Dashboard, summary, list, and event calendar.",
    accent: "#1f5eff",
  },
  {
    key: "compliance",
    title: "Compliance",
    path: `${process.env.PUBLIC_URL}/compliance`,
    icon: Briefcase,
    description: "Weekly dashboard, events, template, and review flow.",
    accent: "#d46a32",
  },
  {
    key: "planning",
    title: "Planning",
    path: `${process.env.PUBLIC_URL}/Planning`,
    icon: Activity,
    description: "Planning dashboard, business plan, and realization links.",
    accent: "#198754",
  },
  {
    key: "procurement",
    title: "Procurement",
    path: `${process.env.PUBLIC_URL}/procurement`,
    icon: ShoppingCart,
    description: "Procurement dashboard, list, and reminder tracking.",
    accent: "#7c3aed",
  },
  {
    key: "human",
    title: "Human Resource",
    path: `${process.env.PUBLIC_URL}/human`,
    icon: Users,
    description: "Resource and training management.",
    accent: "#0f766e",
  },
];

const ADMIN_QUICK_ACCESS = {
  key: "admin-user-access",
  title: "User Access",
  path: `${process.env.PUBLIC_URL}/admin/user-access`,
  icon: Users,
  description: "Manage user level, stream, and access audit history.",
  accent: "#b45309",
};

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 11) return "Good morning";
  if (hour < 15) return "Good afternoon";
  if (hour < 19) return "Good evening";
  return "Good night";
};

const SharedHome = () => {
  const { user, loading } = useAuth();

  const quickAccessModules = useMemo(() => {
    const modules = MODULES.filter((module) =>
      getPathAccess(user, module.path).allowed,
    );

    if (isAdminUser(user)) {
      modules.push(ADMIN_QUICK_ACCESS);
    }

    return modules;
  }, [user]);

  const displayName = user?.name || "User";
  const email = user?.email || "-";
  const level = user?.level || "Unassigned";
  const stream = user?.stream || "Not set";

  return (
    <Fragment>
      <Container fluid>
        <Row className="g-4">
          {loading ? (
            <Col sm="12">
              <Card style={{ border: 0 }}>
                <CardBody>
                  <FeedbackState
                    variant="loading"
                    title="Loading home"
                    description="Profil dan akses modul sedang disiapkan."
                  />
                </CardBody>
              </Card>
            </Col>
          ) : (
            <>
          <Col sm="12">
            <Card
              style={{
                border: 0,
                background: `linear-gradient(135deg, ${HOME_THEME.navy} 0%, #30597c 44%, ${HOME_THEME.orange} 100%)`,
                color: "#fff",
                overflow: "hidden",
              }}
            >
              <CardBody style={{ padding: "28px" }}>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <Badge pill style={summaryBadgeStyle("level")}>
                      Level: {level}
                    </Badge>
                    <Badge pill style={summaryBadgeStyle("stream")}>
                      Stream: {stream}
                    </Badge>
                  </div>

                  <div>
                    <h2 className="mb-2" style={{ fontWeight: 700 }}>
                      {getGreeting()}, {displayName}
                    </h2>
                    <p className="mb-0" style={{ fontSize: "1rem", opacity: 0.88 }}>
                      Halaman ini menampilkan ringkasan akses Anda dan shortcut
                      langsung ke modul yang diizinkan.
                    </p>
                  </div>

                  <div className="d-flex flex-wrap gap-3">
                    <div
                      style={summaryBoxStyle("email")}
                    >
                      <div style={{ fontSize: "0.82rem", opacity: 0.72 }}>
                        Email
                      </div>
                      <div style={{ fontWeight: 600 }}>{email}</div>
                    </div>
                    <div
                      style={summaryBoxStyle("modules")}
                    >
                      <div style={{ fontSize: "0.82rem", opacity: 0.72 }}>
                        Accessible modules
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {quickAccessModules.length} modules
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Col>

          <Col sm="12">
            <Card style={{ border: 0 }}>
              <CardHeader className="pb-0" style={{ background: "transparent" }}>
                <h5 className="mb-1">Quick Access</h5>
                <p className="text-muted mb-0">
                  Modul yang tampil di sini mengikuti akses user yang sedang login.
                </p>
              </CardHeader>
              <CardBody>
                {quickAccessModules.length ? (
                  <Row className="g-3">
                    {quickAccessModules.map((module) => {
                      const Icon = module.icon;

                      return (
                        <Col md="6" xl="4" key={module.key}>
                          <Link to={module.path} style={{ textDecoration: "none" }}>
                            <Card
                              style={{
                                borderRadius: "18px",
                                border: `1px solid ${module.accent}22`,
                                height: "100%",
                              }}
                            >
                              <CardBody>
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                  <div
                                    style={{
                                      width: "44px",
                                      height: "44px",
                                      borderRadius: "14px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: `${module.accent}18`,
                                      color: module.accent,
                                    }}
                                  >
                                    <Icon size={20} />
                                  </div>
                                  <ArrowRight size={18} color={module.accent} />
                                </div>
                                <h6 style={{ color: "#111827" }}>{module.title}</h6>
                                <p className="text-muted mb-0">{module.description}</p>
                              </CardBody>
                            </Card>
                          </Link>
                        </Col>
                      );
                    })}
                  </Row>
                ) : (
                  <FeedbackState
                    variant="empty"
                    title="No accessible modules"
                    description="Belum ada modul yang bisa ditampilkan untuk user yang sedang login."
                  />
                )}
              </CardBody>
            </Card>
          </Col>
            </>
          )}
        </Row>
      </Container>
    </Fragment>
  );
};

export default SharedHome;
