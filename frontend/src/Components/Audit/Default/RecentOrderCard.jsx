/*
 * PGH-DOC
 * File: src/Components/Audit/Default/RecentOrderCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { H5, Image, P } from '../../../AbstractElements';
import { RecentOrders } from '../../Common/Data/Dashboard';
import { Card, CardBody } from '@pgh/ui-bootstrap';
import React from 'react';
import { Link } from 'react-router-dom';

const RecentOrderClass = () => {
    return (
        <Card>
            <CardBody>
                <div className="table-responsive">
                    <H5>Recent Orders</H5>
                    <table className="table table-bordernone">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Date</th>
                                <th>Quantity</th>
                                <th>Value</th>
                                <th>Rate</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                RecentOrders.map((items) =>
                                    <tr key={items.id}>
                                        <td>
                                            <div className="media">
                                                <Image attrImage={{ className: 'img-fluid rounded-circle', src: `${items.img}`, alt: '', title: '' }} />
                                                <div className="media-body">
                                                    <Link to={`${process.env.PUBLIC_URL}/app/ecommerce/product`} ><span>{items.name}</span></Link></div>
                                            </div>
                                        </td>
                                        <td>
                                            <P>{items.date}</P>
                                        </td>
                                        <td>
                                            <P>{items.quantity}</P>
                                        </td>
                                        <td>
                                            <Image attrImage={{ className: 'img-fluid', src: `${items.value}`, alt: '', title: '' }} />
                                        </td>
                                        <td>
                                            <P>{items.rate}</P>
                                        </td>
                                        <td>
                                            <P>{items.status}</P>
                                        </td>
                                    </tr>
                                )
                            }
                        </tbody>
                    </table>
                </div>
            </CardBody>
        </Card>
    );
};

export default RecentOrderClass;