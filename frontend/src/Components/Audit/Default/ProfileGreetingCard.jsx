/*
 * PGH-DOC
 * File: src/Components/Audit/Default/ProfileGreetingCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { Btn, H3, P } from '../../../AbstractElements';
import React, { Fragment } from 'react';
import { Card, CardBody, CardHeader } from '@pgh/ui-bootstrap';
import { Link } from 'react-router-dom';


const ProfileGreeting = () => {
    return (
        <Fragment>
            <Card className="profile-greeting">
                <CardHeader className="pb-0"></CardHeader>
                <CardBody className="text-center p-t-0">
                    <H3 attrH3={{ className: 'font-light' }} >Wellcome Back, Andi!!</H3>
                    <P>Welcome to the PGH Family!we are glad that you are visite our website.we will be happy to help you grow your managerial business.</P>
                    <Link to={`${process.env.PUBLIC_URL}/app/users/userProfile`} ><Btn attrBtn={{ as: Card.Header, className: 'btn btn-light', color: 'default' }} >Update</Btn></Link>
                </CardBody>
                <div className="confetti">
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                    <div className="confetti-piece"></div>
                </div>
            </Card>
        </Fragment>
    );
};

export default ProfileGreeting;