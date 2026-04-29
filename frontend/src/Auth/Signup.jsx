/*
 * PGH-DOC
 * File: src/Auth/Signup.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState, Fragment } from "react";
import { Form, FormGroup, Input, Label } from "@pgh/ui-bootstrap";
import { Btn, H4, P } from "../AbstractElements";
import { toast } from "react-toastify";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, UserPlus } from "react-feather";
import "./Signin.scss";
import AuthThemeToggleButton from "./AuthThemeToggleButton";
import useAuthThemeMode from "./useAuthThemeMode";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isDarkMode, toggleThemeMode } = useAuthThemeMode();

  const handleSignup = async (e) => {
    e.preventDefault();
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName) {
      toast.error("Nama wajib diisi.");
      return;
    }
    if (!normalizedEmail) {
      toast.error("Email wajib diisi.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE_URL}Auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            name: normalizedName,
          }),
        }
      );

      let payload = null;
      try {
        payload = await response.json();
      } catch {}

      if (response.ok) {
        toast.success("Akun berhasil dibuat! Silakan login.");
        navigate(`${process.env.PUBLIC_URL}/login`, { replace: true });
      } else {
        toast.error(payload?.message || `Gagal membuat akun (HTTP ${response.status})`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan koneksi server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fragment>
      <div className="auth-screen">
        <AuthThemeToggleButton isDarkMode={isDarkMode} onToggle={toggleThemeMode} />
        <div className="auth-screen__card">
          <div className="auth-screen__content">
            <Form className="theme-form" onSubmit={handleSignup}>
              <H4 className="d-flex align-items-center gap-2">
                <UserPlus size={22} /> Sign Up
              </H4>

              <P>Make new account to continue</P>

              <FormGroup>
                <Label className="col-form-label">Name</Label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
              </FormGroup>

              <FormGroup>
                <Label className="col-form-label">Email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </FormGroup>

              <FormGroup>
                <Label className="col-form-label">Password</Label>
                <div className="login-password-field">
                  <Input
                    className="login-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <FormGroup>
                <Label className="col-form-label">Confirm Password</Label>
                <div className="login-password-field">
                  <Input
                    className="login-password-input"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowConfirmPassword((previous) => !previous)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormGroup>

              <Btn
                attrBtn={{
                  color: "primary",
                  className: "btn-block auth-submit-btn",
                  type: "submit",
                  disabled: loading,
                }}
              >
                {loading ? "Loading..." : "Sign Up"}
              </Btn>

              <div className="text-center mt-3">
                <span>Sudah punya akun? </span>
                <Link to={`${process.env.PUBLIC_URL}/login`}>
                  <strong>Login</strong>
                </Link>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </Fragment>
  );
};

export default Signup;
