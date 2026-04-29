/*
 * PGH-DOC
 * File: src/Components/Audit/ListAudit/TargetCard.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

// import { H6, LI, P, UL } from '../../../AbstractElements';
// import React from 'react';
// import { Card, CardBody, CardHeader } from '@pgh/ui-bootstrap';
// import { Link } from 'react-router-dom';

// const TargetCard = () => {
//     return (
//         <Card className="target-sec">
//             <CardHeader>
//                 <UL attrUL={{ className: 'target-list flex-row' }} >
//                     <LI>
//                         <Link to={`${process.env.PUBLIC_URL}/app/todo`}>
//                             <H6>Our Target</H6></Link>
//                         <P>Completed</P><span>$687.780</span>
//                     </LI>
//                     <LI attrLI={{ className: 'bg-primary' }} >
//                         <Link to={`${process.env.PUBLIC_URL}/app/todo`}><H6>We Archieve</H6></Link>
//                         <P>Completed in After 3 Hours</P><span>$687.780k</span>
//                     </LI>
//                 </UL>
//             </CardHeader>
//             <CardBody className="p-0">
//                 <div className="traget-img-sec"></div>
//                 <div className="animat-block"><i className="fa fa-times close1"></i><i className="fa fa-times close2"></i><i className="fa fa-times close3"></i>
//                     <div className="circle1"></div>
//                     <div className="circle2"></div>
//                     <div className="circle3"></div>
//                 </div>
//             </CardBody>
//         </Card>
//     );
// };

// export default TargetCard;