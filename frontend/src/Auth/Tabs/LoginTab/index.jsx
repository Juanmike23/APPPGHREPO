/*
 * PGH-DOC
 * File: src/Auth/Tabs/LoginTab/index.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur autentikasi, login flow, dan kontrol akses user.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useState } from "react";
import { Form, FormGroup, Input, Label } from "@pgh/ui-bootstrap";
import { Btn, H4, P } from "../../../AbstractElements";
import { useAuth } from "../../../Auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const loginAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      toast.error(result.message || "Invalid email or password");
      setLoading(false);
      return;
    }

    toast.success(result.message || "Login berhasil!");
    navigate("/", { replace: true });
  };

  return (
    <Form className="theme-form" onSubmit={loginAuth}>
      <H4>Sign In</H4>
      <P>Enter your email & password to login</P>

      <FormGroup>
        <Label>Email Address</Label>
        <Input type="email" required onChange={(e) => setEmail(e.target.value)} />
      </FormGroup>

      <FormGroup className="position-relative">
        <Label>Password</Label>
        <Input type="password" required onChange={(e) => setPassword(e.target.value)} />
      </FormGroup>

      <Btn attrBtn={{ color: "primary", className: "btn-block", disabled: loading }}>
        {loading ? "Loading..." : "Login"}
      </Btn>
    </Form>
  );
};

export default Login;
