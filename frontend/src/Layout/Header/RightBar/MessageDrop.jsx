/*
 * PGH-DOC
 * File: src/Layout/Header/RightBar/MessageDrop.jsx
 * Apa fungsi bagian ini:
 * - File ini mengatur layout shell aplikasi (header/sidebar/footer).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment } from 'react';
import { MessageSquare } from 'react-feather';
import { Link } from 'react-router-dom';
import { Image, LI, P, UL } from '../../../AbstractElements';
import { messageData } from '../../../Data/Layouts';

const MessageDrop = () => {
    return (
        <Fragment>
            <LI attrLI={{ className: 'onhover-dropdown' }}>
                <MessageSquare />
                <UL attrUL={{ className: 'chat-dropdown onhover-show-div' }} >
                {messageData.map((item,index)=>(
                    <LI>
                        <div className="media">
                            <Image attrImage={{ className: 'img-fluid rounded-circle me-3', src: item.img, alt: '' }} />
                                <div className="media-body">
                                    <Link to="#javascript">
                                        <span>{item.name}</span>
                                    </Link>
                                    <P attrPara={{ className: 'f-12 light-font' }} >{item.mess}</P>
                                </div>
                            <P attrPara={{ className: 'f-12' }} >{item.time}</P>
                        </div>
                    </LI>
                ))}
                    <LI attrLI={{ className: 'text-center' }} >
                        <Link className="f-w-700" to={`${process.env.PUBLIC_URL}/app/chat-app`}>
                            See All</Link>
                    </LI>
                </UL>
            </LI>
        </Fragment>
    );
};

export default MessageDrop;