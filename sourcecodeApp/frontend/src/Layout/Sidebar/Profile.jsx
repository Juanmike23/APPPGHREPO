/*
 * PGH-DOC
 * File: src/Layout/Sidebar/Profile.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from "react";
import { Settings } from "react-feather";
import { Link } from "react-router-dom";
import { H6, P } from "../../AbstractElements";
import man from "../../assets/images/dashboard/1.png";
import { useAuth } from "../../Auth/AuthContext"; // ✅ use auth context

const Profile = () => {
  const auth = useAuth(); // may be null at first
  const user = auth?.user; // safe fallback
  const authLoading = Boolean(auth?.loading);
  const isAuthenticated = !!user; // true if user is logged in

  // fallback profile data
  const profileURL = user?.profileURL || man;
  const displayName = authLoading ? "Checking session..." : user?.name || "? User";
  const role = authLoading ? "Loading profile" : user?.level || "? Role";
  const badgeMeta = authLoading
    ? {
        label: "Checking",
        className: "badge badge-light text-dark border",
      }
      : isAuthenticated
      ? {
          label: "Active",
          className: "badge badge-primary",
        }
      : {
          label: "Guest",
          className: "badge badge-secondary",
        };

  return (
    <Fragment>
      <div className="sidebar-user text-center">
        <Link className="setting-primary" to={`${process.env.PUBLIC_URL}/settings`}>
          <Settings />
        </Link>

        <Link to={`${process.env.PUBLIC_URL}/settings`}>
          {/* Circular Avatar (balanced crop) */}
          <div
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
              background: "#FFECEC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              margin: "0 auto",
            }}
          >
            {/* inner circle */}
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                overflow: "hidden",
              }}
            >
            <img
  src={profileURL}
  alt="profile"
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    transform: "scale(1.35)",
  }}
/>

            </div>
          </div>

          <div className="badge-bottom">
            <div className={badgeMeta.className}>{badgeMeta.label}</div>
          </div>
          <H6 attrH6={{ className: "mt-2 f-14 f-w-600" }}>{displayName}</H6>
        </Link>

        <P attrPara={{ className: "font-roboto" }}>{role}</P>

        {/* Example stats */}
        {/* <UL attrUL={{ className: "flex-row simple-list" }}>
          <LI>
            <span>
              <span className="counter">19.8</span>k
            </span>
            <P>Follow</P>
          </LI>
          <LI>
            <span>2 year</span>
            <P>Experience</P>
          </LI>
          <LI>
            <span>
              <span className="counter">95.2</span>k
            </span>
            <P>Follower</P>
          </LI>
        </UL> */}
      </div>
    </Fragment>
  );
};

export default Profile;
