/*
 * PGH-DOC
 * File: src/Components/Application/Users/Settings/index.jsx
 * Apa fungsi bagian ini:
 * - Halaman Settings akun user untuk melihat data akun sendiri, ganti nama, ganti foto profil, dan ganti password.
 * Kenapa perlu:
 * - Agar konfigurasi akun terpusat dalam satu halaman dan flow pengelolaan profil konsisten dari tombol Settings header/sidebar.
 * Aturan khususnya apa:
 * - Perubahan akun hanya untuk user yang sedang login (endpoint Auth/profile).
 * - Upload foto profil dibatasi format gambar umum dan ukuran maksimal oleh backend.
 */

import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Col,
  Container,
  Form,
  FormGroup,
  Input,
  Label,
  Row,
} from "@pgh/ui-bootstrap";
import { Btn, H4 } from "../../../../AbstractElements";
import { useAuth } from "../../../../Auth/AuthContext";
import { toast } from "react-toastify";

const SettingsPage = () => {
  const { user, setUser } = useAuth();
  const profileObjectUrlRef = useRef(null);
  const apiRoot = useMemo(
    () => String(process.env.REACT_APP_API_BASE_URL || ""),
    [],
  );

  const [displayName, setDisplayName] = useState(user?.name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    setDisplayName(user?.name || "");
  }, [user?.name]);

  useEffect(
    () => () => {
      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current);
      }
    },
    [],
  );

  const profileSummary = useMemo(
    () => ({
      email: user?.email || "-",
      level: user?.level || "-",
      stream: user?.stream || "-",
      userId: user?.id || "-",
    }),
    [user],
  );

  const syncProfileImage = async () => {
    if (!user?.id) {
      return;
    }

    try {
      const response = await fetch(
        `${apiRoot}UserImages/${user.id}?_=${Date.now()}`,
        { credentials: "include" },
      );

      if (!response.ok) {
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (profileObjectUrlRef.current) {
        URL.revokeObjectURL(profileObjectUrlRef.current);
      }
      profileObjectUrlRef.current = objectUrl;

      setUser((prev) => ({
        ...(prev || {}),
        profileURL: objectUrl,
      }));
    } catch {
      // tetap gunakan gambar yang sudah ada
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();

    if (!displayName.trim()) {
      toast.error("Nama tidak boleh kosong.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await fetch(`${apiRoot}Auth/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.message || "Gagal memperbarui profil.");
        return;
      }

      if (payload?.user) {
        setUser((prev) => ({
          ...(prev || {}),
          ...payload.user,
          profileURL: prev?.profileURL,
        }));
      }

      toast.success(payload?.message || "Profil berhasil diperbarui.");
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingPhoto(true);
    try {
      const response = await fetch(`${apiRoot}Auth/profile/photo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.message || "Gagal mengunggah foto profil.");
        return;
      }

      await syncProfileImage();
      toast.success(payload?.message || "Foto profil berhasil diperbarui.");
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handlePasswordInput = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Semua kolom password wajib diisi.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Konfirmasi password baru tidak sama.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(`${apiRoot}Auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload?.message || "Gagal mengubah password.");
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast.success(payload?.message || "Password berhasil diperbarui.");
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Fragment>
      <Container fluid>
        <Row className="g-3">
          <Col xl="4" lg="5">
            <Card>
              <CardHeader className="pb-0">
                <H4 attrH4={{ className: "card-title mb-0" }}>Account</H4>
              </CardHeader>
              <CardBody>
                <div className="d-flex align-items-center gap-3 mb-3">
                  <img
                    src={user?.profileURL || ""}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="rounded-circle border"
                    style={{ objectFit: "cover" }}
                  />
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{user?.name || "-"}</div>
                    <small className="text-muted">{profileSummary.email}</small>
                  </div>
                </div>

                <FormGroup className="mb-0">
                  <Label className="form-label mb-1">Ganti Foto Profil</Label>
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    disabled={isUploadingPhoto}
                  />
                  <small className="text-muted d-block mt-1">
                    Format: JPG/PNG/WEBP, maksimal 5 MB.
                  </small>
                </FormGroup>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <H4 attrH4={{ className: "card-title mb-0" }}>Informasi Akun</H4>
              </CardHeader>
              <CardBody>
                <div className="mb-2">
                  <small className="text-muted d-block">User ID</small>
                  <div className="fw-semibold">{profileSummary.userId}</div>
                </div>
                <div className="mb-2">
                  <small className="text-muted d-block">Email</small>
                  <div className="fw-semibold">{profileSummary.email}</div>
                </div>
                <div className="mb-2">
                  <small className="text-muted d-block">Level</small>
                  <div className="fw-semibold">{profileSummary.level}</div>
                </div>
                <div>
                  <small className="text-muted d-block">Stream</small>
                  <div className="fw-semibold">{profileSummary.stream}</div>
                </div>
              </CardBody>
            </Card>
          </Col>

          <Col xl="8" lg="7">
            <Card>
              <CardHeader className="pb-0">
                <H4 attrH4={{ className: "card-title mb-0" }}>Edit Profil</H4>
              </CardHeader>
              <CardBody>
                <Form onSubmit={handleSaveProfile}>
                  <Row className="g-2">
                    <Col md="8">
                      <FormGroup className="mb-0">
                        <Label className="form-label">Nama</Label>
                        <Input
                          type="text"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          maxLength={120}
                        />
                      </FormGroup>
                    </Col>
                    <Col md="4" className="d-flex align-items-end">
                      <Btn
                        attrBtn={{
                          color: "primary",
                          type: "submit",
                          disabled: isSavingProfile,
                          className: "w-100",
                        }}
                      >
                        {isSavingProfile ? "Menyimpan..." : "Simpan Perubahan"}
                      </Btn>
                    </Col>
                  </Row>
                </Form>
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <H4 attrH4={{ className: "card-title mb-0" }}>Change Password</H4>
              </CardHeader>
              <CardBody>
                <Form onSubmit={handleChangePassword}>
                  <Row className="g-2">
                    <Col md="12">
                      <FormGroup className="mb-0">
                        <Label className="form-label">Password Saat Ini</Label>
                        <Input
                          type="password"
                          name="currentPassword"
                          value={passwordForm.currentPassword}
                          onChange={handlePasswordInput}
                          autoComplete="current-password"
                        />
                      </FormGroup>
                    </Col>
                    <Col md="6">
                      <FormGroup className="mb-0">
                        <Label className="form-label">Password Baru</Label>
                        <Input
                          type="password"
                          name="newPassword"
                          value={passwordForm.newPassword}
                          onChange={handlePasswordInput}
                          autoComplete="new-password"
                        />
                      </FormGroup>
                    </Col>
                    <Col md="6">
                      <FormGroup className="mb-0">
                        <Label className="form-label">Konfirmasi Password Baru</Label>
                        <Input
                          type="password"
                          name="confirmPassword"
                          value={passwordForm.confirmPassword}
                          onChange={handlePasswordInput}
                          autoComplete="new-password"
                        />
                      </FormGroup>
                    </Col>
                    <Col md="12">
                      <Btn
                        attrBtn={{
                          color: "primary",
                          type: "submit",
                          disabled: isChangingPassword,
                        }}
                      >
                        {isChangingPassword ? "Menyimpan..." : "Ubah Password"}
                      </Btn>
                    </Col>
                  </Row>
                </Form>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </Fragment>
  );
};

export default SettingsPage;
