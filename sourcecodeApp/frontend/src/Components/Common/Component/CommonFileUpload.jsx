/*
 * PGH-DOC
 * File: src/Components/Common/Component/CommonFileUpload.jsx
 * Apa fungsi bagian ini:
 * - File ini membangun UI/fitur utama yang dilihat user per unit kerja.
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import { Fragment, useState } from "react";
import Dropzone from "react-dropzone";
import { H5, P } from "../../../AbstractElements";

const CommonFileUpload = ({ multiple }) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const onDrop = (acceptedFiles) => setUploadedFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
  const removeFile = (indexToRemove) => setUploadedFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
  return (
    <Fragment>
      {uploadedFiles.length === 0 ? (
        <Dropzone onDrop={onDrop}>
          {({ getRootProps, getInputProps }) => (
            <div {...getRootProps()} className="dropzone-container">
              <input {...getInputProps()} />
              <div className="dz-message needsclick">
                <i className="icon-cloud-up fs-1 txt-primary" />
                <H5>Drag Files or Click to Browse</H5>
              </div>
            </div>
          )}
        </Dropzone>
      ) : (
        <Fragment>
          {multiple && (
            <Dropzone onDrop={onDrop}>
              {({ getRootProps, getInputProps }) => (
                <div {...getRootProps()} className="add-more-files-zone">
                  <input {...getInputProps()} />
                  <P>Click or drag more files to add</P>
                </div>
              )}
            </Dropzone>
          )}

          <div className="uploaded-files">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="file-card">
                {file.type.startsWith("image/") ? <img src={URL.createObjectURL(file)} alt={file.name} className="file-thumbnail" /> : <div className="file-placeholder">{file.name.split(".").pop()?.toUpperCase()} File</div>}
                <P className="file-name">{file.name}</P>
                <P className="file-size">{(file.size / 1024).toFixed(2)} KB</P>
                <button onClick={() => removeFile(index)} className="remove-button" title="Remove file">
                  ×
                </button>
              </div>
            ))}
          </div>
        </Fragment>
      )}
    </Fragment>
  );
};

export default CommonFileUpload;
