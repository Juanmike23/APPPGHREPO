/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/CreateTag.jsx
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
import { useForm } from 'react-hook-form';
import { Form, FormGroup, Label, Modal, ModalBody, ModalHeader } from '@pgh/ui-bootstrap';
import { Btn } from '../../../AbstractElements';
import { Cancel, Save } from '../../../Constant';

const CreateTag = ({ tagCallback, tagModal }) => {

    const { register, formState: { errors } } = useForm(); // initialise the hook
    const tagToggle = () => {
        tagCallback(false);
    };

    return (
        <Fragment>
            <Modal className="fade show modal-bookmark" isOpen={tagModal} toggle={tagToggle} size="lg">
                <ModalHeader className="modal-title" toggle={tagToggle}>
                    {'Create Tag'}
                </ModalHeader>
                <ModalBody>
                    <Form className="form-bookmark needs-validation">
                        <div className="form-row">
                            <FormGroup className="col-md-12">
                                <Label>{'Tag Name'}</Label>
                                <input className="form-control" name="name" type="text" {...register('name', { required: true })} />
                                <span style={{ color: 'red' }}>{errors.name && 'First name is required'}</span>
                            </FormGroup>
                            <FormGroup className="form-group col-md-12 mb-0 mb-3">
                                <Label>{'Tag color'}</Label>
                                <input className="form-control fill-color" name="color" type="color" {...register('color', { required: true })} defaultValue="#24695c" />
                            </FormGroup>
                        </div>
                        <Btn attrBtn={{ color: 'secondary' }} >{Save}</Btn>
                        <Btn attrBtn={{ color: 'primary m-l-5', onClick: tagToggle }} >{Cancel}</Btn>
                    </Form>
                </ModalBody>
            </Modal>
        </Fragment>
    );
};
export default CreateTag;