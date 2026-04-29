/*
 * PGH-DOC
 * File: src/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mendukung rendering frontend agar fitur berjalan stabil dan konsisten.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/montserrat/latin-300.css";
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/roboto/latin-300.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/rubik/latin-300.css";
import "@fontsource/rubik/latin-400.css";
import "@fontsource/rubik/latin-500.css";
import "@fontsource/rubik/latin-600.css";
import "@fontsource/rubik/latin-700.css";
import "react-datepicker/dist/react-datepicker.css";
import "react-toastify/dist/ReactToastify.css";
import { Button, Card, CardBody, Col, Container, Row } from "@pgh/ui-bootstrap";
import "./index.scss";
import "./i18n";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { AuthProvider } from "./Auth/AuthContext";
import FeedbackState from "./Components/Common/FeedbackState";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Keep runtime errors visible during development.
    // eslint-disable-next-line no-console
    console.error("Unhandled React error:", error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container fluid className="py-5">
          <Row className="justify-content-center">
            <Col lg="6" md="8" sm="12">
              <Card className="border-0 shadow-sm">
                <CardBody className="p-4">
                  <FeedbackState
                    variant="error"
                    title="Terjadi error pada aplikasi"
                    description="Silakan refresh halaman. Jika masalah berulang, hubungi admin aplikasi."
                  />
                  <div className="d-flex justify-content-center mt-3">
                    <Button color="primary" onClick={this.handleRefresh}>
                      Refresh Halaman
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>,
);

reportWebVitals();
