/*
 * PGH-DOC
 * File: src/Components/Compliance/Task/NewTask.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { Fragment, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal, ModalHeader, ModalBody, Form, FormGroup, Label } from "@pgh/ui-bootstrap";
import { toast } from "react-toastify";
import { CheckCircle } from "react-feather";
import { Btn } from "../../../AbstractElements";
import axios from "axios";


const NewTaskClass = ({ onAddPeriod }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const [addModal, setAddModal] = useState(false);

  const addToggle = () => setAddModal(!addModal);

 const createPeriod = async (data) => {
  console.log("Form data submitted:", data);

  const payload = {
    Period: data.period || null,         // allow null
    PeriodName: data.periodName || null,
    DocumentId: null,
    DocumentToSubmit: null,
  };

  console.log("Payload to send:", payload);

  try {
    const res = await axios.post(
      `${process.env.REACT_APP_API_BASE_URL}DocumentPeriodReport`,
      payload,
      { withCredentials: true }
    );
    toast.success("New Period Created!");
    onAddPeriod?.(res.data.inserted);
    reset();
    setAddModal(false);
  } catch (err) {
    console.error("Create period failed:", err.response?.data || err.message);
    toast.error("Failed to create period");
  }
};


  return (
    <Fragment>
      {/* Button to open modal */}
      <button className="compliance-events-new-btn" onClick={addToggle}>
        <CheckCircle className="me-2" /> New Events
      </button>

      {/* Modal */}
      <Modal isOpen={addModal} toggle={addToggle} size="lg">
        <ModalHeader toggle={addToggle}>Add Period</ModalHeader>
        <ModalBody>
         <Form
  className="form-bookmark needs-validation"
  onSubmit={handleSubmit((data) => {
    console.log("🚀 handleSubmit triggered with:", data);
    createPeriod(data);
  })}
>
  <div className="form-row">
    {/* Period Name */}
    <FormGroup className="col-md-12">
      <Label>Period Name</Label>
      <input
        className="form-control"
        name="periodName"
        type="text"
        {...register("periodName")}
      />
      {errors.periodName && (
        <span style={{ color: "red" }}>Period Name is required</span>
      )}
    </FormGroup>

    {/* Period Type */}
   <FormGroup className="col-md-12">
  <Label>Period</Label>
  <select
    className="form-control"
    {...register("period")}
    defaultValue=""
  >
    <option value="">-- Select --</option>
    <option value="Daily">Daily</option>
    <option value="Monthly">Monthly</option>
    <option value="Yearly">Yearly</option>
  </select>
</FormGroup>

  </div>

  {/* ✅ Must be type="submit" */}
  <Btn attrBtn={{ color: "secondary", className: "me-2", type: "submit" }}>
    Save
  </Btn>
  <Btn attrBtn={{ color: "primary", type: "button", onClick: addToggle }}>
    Cancel
  </Btn>
</Form>

        </ModalBody>
      </Modal>
    </Fragment>
  );
};

export default NewTaskClass;
