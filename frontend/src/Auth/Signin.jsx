/*
 * PGH-DOC
 * File: src/Auth/Signin.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useContext, useState } from "react";
import { Form, FormGroup, Input, Label } from "@pgh/ui-bootstrap";
import { Btn, H4, P } from "../AbstractElements";
import { EmailAddress, Password, RememberPassword } from "../Constant";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "react-feather";
import "./Signin.scss";

import { useAuth } from "../Auth/AuthContext";
import CheckContext from "../_helper/Customizer";
import AuthThemeToggleButton from "./AuthThemeToggleButton";
import useAuthThemeMode from "./useAuthThemeMode";
import FeedbackState from "../Components/Common/FeedbackState";

const resolveHomePath = () => {
  const rawPublicUrl = String(process.env.PUBLIC_URL || "").trim();
  if (!rawPublicUrl) return "/";
  return rawPublicUrl.startsWith("/") ? rawPublicUrl : `/${rawPublicUrl}`;
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { toggleSidebar } = useContext(CheckContext);
  const navigate = useNavigate();
  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const { isDarkMode, toggleThemeMode } = useAuthThemeMode();

  const loginAuth = async (event) => {
    event.preventDefault();
    setLoading(true);

    const result = await login(email.trim(), password);

    if (result.success) {
      clearSessionNotice();
      toast.success(result.message || "Login berhasil!");
      // Default setelah login: sidebar terbuka.
      toggleSidebar(false);
      navigate(resolveHomePath(), { replace: true });
      return;
    }

    toast.error(result.message || "Invalid email or password");
    setLoading(false);
  };

  return (
    <Fragment>
      <div className="auth-screen">
        <AuthThemeToggleButton isDarkMode={isDarkMode} onToggle={toggleThemeMode} />
        <div className="auth-screen__card">
          <div className="auth-screen__content">
            <Form className="theme-form" onSubmit={loginAuth}>
              <H4 className="d-flex align-items-center gap-2">
                <LogIn size={22} /> Sign In
              </H4>

              <P>Enter your email & password to login</P>

              {sessionNotice ? (
                <div className="auth-session-notice">
                  <FeedbackState
                    variant="error"
                    title={sessionNotice.title}
                    description={sessionNotice.description}
                    actionLabel="Refresh Halaman"
                    onAction={() => window.location.reload()}
                  />
                  <button
                    type="button"
                    className="auth-session-notice__dismiss"
                    onClick={clearSessionNotice}
                  >
                    Tutup
                  </button>
                </div>
              ) : null}

              <FormGroup>
                <Label className="col-form-label">{EmailAddress}</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="your@email.com"
                  autoFocus
                />
              </FormGroup>

              <FormGroup>
                <Label className="col-form-label">{Password}</Label>

                <div className="login-password-field">
                  <Input
                    className="login-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="********"
                  />

                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormGroup>

              <div className="form-group mb-0">
                <div className="checkbox ms-3">
                  <Input id="remember" type="checkbox" />
                  <Label className="text-muted" htmlFor="remember">
                    {RememberPassword}
                  </Label>
                </div>

                <Btn
                  attrBtn={{
                    color: "primary",
                    className: "btn-block auth-submit-btn",
                    type: "submit",
                    disabled: loading,
                  }}
                >
                  {loading ? "Loading..." : "Login"}
                </Btn>
              </div>

              <div className="text-center mt-3">
                <span>Don&apos;t have an account? </span>
                <Link to={`${process.env.PUBLIC_URL}/signup`}>
                  <strong>Sign Up</strong>
                </Link>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default Login;
