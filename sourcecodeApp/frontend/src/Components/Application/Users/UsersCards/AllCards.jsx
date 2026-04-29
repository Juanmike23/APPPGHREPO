/*
 * PGH-DOC
 * File: src/Components/Application/Users/UsersCards/AllCards.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Card, CardFooter, CardHeader, Col } from '@pgh/ui-bootstrap';
import { H3, H4, H6, LI, UL, Image } from '../../../../AbstractElements';
import { UserCardApi } from '../../../../api';

const AllCards = () => {
    const [cards, setCards] = useState([]);
    useEffect(() => {
        axios.get(UserCardApi).then(res => setCards(res.data));
    }, []);
    var images = require.context('../../../../assets/images', true);
    const dynamicImage = (image) => {
        return images(`./${image}`);
    };
    return (
        <Fragment>
            {
                cards.map((item) => {
                    return (
                        <Col md="6" xl="4" lg="12" className="box-col-6" key={item.id}>
                            <Card className="custom-card">
                                <CardHeader className="p-0">
                                    <Image attrImage={{ src: `${dynamicImage(item.card_bg)}`, className: 'img-fluid', alt: '' }} />
                                </CardHeader>
                                <div className="card-profile">
                                    <Image attrImage={{ src: `${dynamicImage(item.avatar)}`, className: 'rounded-circle', alt: '' }} />
                                </div>
                                <UL attrUL={{ as: 'ul', className: 'simple-list card-social list-group' }}>
                                    <LI><a href="https://www.facebook.com/"><i className="fa fa-facebook"></i></a></LI>
                                    <LI><a href="https://accounts.google.com/"><i className="fa fa-google-plus"></i></a></LI>
                                    <LI><a href="https://twitter.com/"><i className="fa fa-twitter"></i></a></LI>
                                    <LI><a href="https://www.instagram.com/"><i className="fa fa-instagram"></i></a></LI>
                                    <LI><a href="https://dashboard.rss.com/auth/sign-in/"><i className="fa fa-rss"></i></a></LI>
                                </UL>
                                <Link to={`${process.env.PUBLIC_URL}/app/users/userprofile`}>
                                    <div className="text-center profile-details">
                                        <H4>{item.name}</H4>
                                        <H6>{item.post}</H6>
                                    </div>
                                </Link>
                                <CardFooter className="row">
                                    <Col sm="4" className="col-4">
                                        <H6>Follower</H6>
                                        <H3 attrH3={{ className: 'counter' }}>{item.follower}</H3>
                                    </Col>
                                    <Col sm="4" className="col-4">
                                        <H6>Following</H6>
                                        <H3><span className="counter">{item.following}</span>K</H3>
                                    </Col>
                                    <Col sm="4" className="col-4">
                                        <H6>Total Post</H6>
                                        <H3><span className="counter">{item.totalPost}</span>M</H3>
                                    </Col>
                                </CardFooter>
                            </Card>
                        </Col>
                    );
                })
            }
        </Fragment>
    );
};
export default AllCards;