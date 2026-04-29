/*
 * PGH-DOC
 * File: src/Components/Application/Users/UsersEdit/MyProfile.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { Card, CardBody, CardHeader, Form, FormGroup, Input, Label, Row } from '@pgh/ui-bootstrap';
import { H3, H4, H6, P, Image, Btn } from '../../../../AbstractElements';
import { Link } from 'react-router-dom';
import { MyProfile, Bio, Password, Website, Save, EmailAddress } from '../../../../Constant';

const MyProfileEdit = () => {
    return (
        <Fragment>
            <Card>
                <CardHeader className="pb-0">
                    <H4 attrH4={{ className: 'card-title mb-0' }}>{MyProfile}</H4>
                    <div className="card-options">
                        <a className="card-options-collapse" href="#javascript">
                            <i className="fe fe-chevron-up"></i>
                        </a>
                        <a className="card-options-remove" href="#javascript">
                            <i className="fe fe-x"></i>
                        </a>
                    </div>
                </CardHeader>
                <CardBody>
                    <Form>
                        <Row className="mb-2">
                            <div className="profile-title">
                                <div className="media d-flex">
                                    <Image attrImage={{ className: 'img-70 rounded-circle', alt: '', src: `${require('../../../../assets/images/user/7.jpg')}` }} />
                                    <div className="media-body">
                                        <Link to={`${process.env.PUBLIC_URL}/app/users/userProfile`}>
                                            <H3 attrH3={{ className: 'mb-1 f-20 txt-primary' }}>MARK JECNO</H3>
                                        </Link>
                                        <P>DESIGNER</P>
                                    </div>
                                </div>
                            </div>
                        </Row>
                        <FormGroup className="mb-3">
                            <H6 attrH6={{ className: 'form-label' }}>{Bio}</H6>
                            <Input type="textarea" className="form-control" rows="5" defaultValue="On the other hand, we denounce with righteous indignation" />
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="form-label">{EmailAddress}</Label>
                            <Input className="form-control" placeholder="your-email@domain.com" />
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="form-label">{Password}</Label>
                            <Input className="form-control" type="password" defaultValue="password" />
                        </FormGroup>
                        <FormGroup className="mb-3">
                            <Label className="form-label">{Website}</Label>
                            <Input className="form-control" placeholder="http://Uplor .com" />
                        </FormGroup>
                        <div className="form-footer">
                            <Btn attrBtn={{ className: 'btn-block', color: 'primary' }} >{Save}</Btn>
                        </div>
                    </Form>
                </CardBody>
            </Card>
        </Fragment>
    );
};
export default MyProfileEdit;