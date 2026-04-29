/*
 * PGH-DOC
 *
 * File: src/Variables/Table/TableToolBarElement/PermissionTable.jsx
 *
 * Apa fungsi bagian ini:
 *
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 *
 * Kenapa perlu:
 *
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 *
 * Aturan khususnya apa:
 *
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 *
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 *
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

import React, { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormGroup,
  Label,
  Input,
  Spinner,
} from "@pgh/ui-bootstrap";
import { UserCheck } from "react-feather";
import { toast } from "react-toastify";

export default function AccessControlModal(apiUrl) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState("");
  const [resource, setResource] = useState("");
  const [permission, setPermission] = useState("");
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/access-control`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, resource, permission }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      toast.success("Access updated successfully.");
      setOpen(false);
      setUser("");
      setResource("");
      setPermission("");
    } catch (err) {
      console.error("Error:", err);
      toast.error("Failed to update access.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchColumns = async () => {
      try {
        const res = await fetch(apiUrl);
        const result = await res.json();
        setColumns(result);
      } catch (err) {
        console.error("Failed to fetch columns", err);
      }
    };

    fetchColumns();
  }, [apiUrl]);

  return (
    <>
      <UserCheck
        size={28}
        className="text-secondary"
        style={{
          cursor: "pointer",
          marginLeft: "8px",
        }}
        onClick={() => setOpen(true)}
      />

      <Modal isOpen={open} toggle={() => setOpen(false)} centered>
        <ModalHeader toggle={() => setOpen(false)}>
          Set Access Permissions
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label for="resourceSelect">Select Shown Column</Label>
            <Input
              id="resourceSelect"
              type="select"
              value={resource}
              onChange={(event) => setResource(event.target.value)}
            >
              <option value="">Select column</option>
              {columns?.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </Input>
          </FormGroup>

          <h5>Give Permission</h5>
          <FormGroup>
            <Label for="userInput">User</Label>
            <Input
              id="userInput"
              placeholder="Enter user email or ID"
              value={user}
              onChange={(event) => setUser(event.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label for="permissionSelect">Permission Level</Label>
            <Input
              id="permissionSelect"
              type="select"
              value={permission}
              onChange={(event) => setPermission(event.target.value)}
            >
              <option value="">Select permission</option>
              <option value="view">View</option>
              <option value="edit">Edit</option>
              <option value="delete">Delete</option>
            </Input>
          </FormGroup>
        </ModalBody>

        <ModalFooter>
          <Button color="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            color="success"
            disabled={loading || !user || !resource || !permission}
            onClick={handleSave}
          >
            {loading ? <Spinner size="sm" /> : "Save"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
