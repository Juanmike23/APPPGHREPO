/*
 * PGH-DOC
 * File: src/Variables/Chart/PieChartDynamic.jsx
 * Apa fungsi bagian ini:
 * - File ini menyediakan komponen utilitas global (table/chart/filter/cell).
 * Kenapa perlu:
 * - Perlu agar pengalaman pengguna konsisten, flow antar halaman jelas, dan perubahan UI tidak memecah perilaku fitur.
 * Aturan khususnya apa:
 * - Gunakan komponen global tabel/filter/export yang sudah tersedia; hindari duplikasi implementasi per halaman.
 * - Jaga konsistensi style/theme dan perilaku UX lintas unit.
 * - Integrasi data harus mengikuti adapter serverQuery/helper global yang sudah ada.
 */

  import React, { Fragment, memo, useEffect, useMemo, useState } from "react";
  import PropTypes from "prop-types";
  import classNames from "classnames";
  import { H5 } from "../../AbstractElements";
  import {
    Card,
    CardBody,
    Col,
    Row,
    Dropdown,
    DropdownToggle,
    DropdownMenu,
    DropdownItem,
  } from "@pgh/ui-bootstrap";
  import ReactApexChart from "react-apexcharts";
  
  const COLORS_DEFAULT = [
    "#4E79A7",
    "#F28E2B",
    "#E15759",
    "#76B7B2",
    "#59A14F",
    "#EDC948",
    "#B07AA1",
    "#FF9DA7",
    "#9C755F",
    "#BAB0AC",
    "#A0CBE8",
    "#FFBE7D",
    "#FF9D9A",
    "#B2DFE0",
    "#8CD17D",
    "#F1CE63",
    "#D4A6C8",
    "#FFBDC5",
    "#D7B5A6",
    "#D7D7D7",
    "#3B5D7A",
    "#C98B4E",
    "#B6474A",
    "#5F9C98",
    "#478645",
    "#D5B74A",
    "#8E5E8A",
    "#D97A8C",
    "#7B6658",
    "#9FA4A7",
  ];


  /* ===================== Helpers ===================== */
  const extractTableName = (url) => {
    try {
      const raw = url.split("/api/")[1].split("/")[0];
      return raw.includes(".") ? raw.split(".").pop() : raw;
    } catch {
      return "Unknown";
    }
  };

  const normalizeRows = (data) => {
    const rows = Array.isArray(data) ? data : data?.rows || data?.value || [];

    return rows.map((row) => {
      let extra = row.ExtraData;

      // Handle case where ExtraData might be a JSON string instead of an object
      if (typeof extra === "string") {
        try {
          extra = JSON.parse(extra);
        } catch {
          extra = null;
        }
      }

      if (extra && typeof extra === "object") {
        const flattenedExtra = Object.entries(row.ExtraData).reduce(
          (acc, [k, v]) => {
            acc[`${k}`] = v ?? ""; // allow empty strings
            return acc;
          },
          {}
        );

        return { ...row, ...flattenedExtra };
      }

      return row;
    });
  };

  const sanitizeLegend = (str) =>
    String(str)
      .replace(/\s+/g, " ")
      .replace(/[^\w\s:._-]/g, "");


  /* ===================== Component ===================== */
  const PieChartDynamic = ({
    tableOptions = [], // [{ label: "FTE", value: "/api/fte" }, ...]
    defaultTable = "",
    defaultColumn = "",
    title,
    titleLabel,
    titleLabelVariant = "secondary",
    titlePlacement = "above", // "above" | "below"
    height = 400,
    colors,
    className,
    legendWidthPx = 240,
    hiddenColumns = [], // 👈 NEW PROP
  }) => {
    const [selectedTable, setSelectedTable] = useState(
      defaultTable || tableOptions[0]?.value || ""
    );
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [selectedColumn, setSelectedColumn] = useState(defaultColumn);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [error, setError] = useState("");

    const distinctCounts = useMemo(() => {
      if (!rows.length) return {};
      const counts = {};
      for (const col of columns) {
        const uniqueVals = new Set(
          rows.map((r) => {
            const val = r[col];
            return val === null || val === undefined ? "" : String(val).trim();
          })
        );
        counts[col] = uniqueVals.size;
      }
      return counts;
    }, [rows, columns]);
    const tableName = useMemo(
      () =>
        title ||
        extractTableName(
          tableOptions.find((t) => t.value === selectedTable)?.value || ""
        ),
      [selectedTable, tableOptions, title]
    );

    /* ===================== Fetch Data ===================== */
    useEffect(() => {
      if (!selectedTable) return;
      const ctrl = new AbortController();

      (async () => {
        setLoading(true);
        setError("");
        try {
          const res = await fetch(selectedTable, {
            signal: ctrl.signal,
            credentials: "include",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const normalized = normalizeRows(json);

          setRows(normalized);

          if (normalized.length > 0) {
            const cols = Object.keys(normalized[0]).filter(
              (c) =>
                !hiddenColumns.includes(c) && // 👈 from prop
                !["id", "Id", "Id", "ExtraData"].includes(c)
            );

            setColumns(cols);
            setSelectedColumn((prev) => {
              if (prev && cols.includes(prev)) return prev;
              if (defaultColumn && cols.includes(defaultColumn))
                return defaultColumn;
              return cols[0];
            });
          } else {
            setColumns([]);
            setSelectedColumn("");
          }
        } catch (e) {
          if (e.name !== "AbortError") setError(e.message || "Fetch error");
        } finally {
          setLoading(false);
        }
      })();

      return () => ctrl.abort();
    }, [selectedTable, defaultColumn, hiddenColumns]);

    /* ===================== Chart Data ===================== */
    const total = rows.length;

    const { labelsFull, labelsSafe, series } = useMemo(() => {
      if (!selectedColumn || total === 0) {
        return { labelsFull: [], labelsSafe: [], series: [] };
      }
      const counts = new Map();
      for (const row of rows) {
        const key = row?.[selectedColumn] ?? "Unknown";
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const rawLabels = Array.from(counts.keys());
      const safe = rawLabels.map(sanitizeLegend);
      const values = Array.from(counts.values());
      return { labelsFull: rawLabels, labelsSafe: safe, series: values };
    }, [rows, selectedColumn, total]);

    const summary = useMemo(() => {
      if (!series.length) return null;
      let maxIndex = 0;
      let minIndex = 0;
      series.forEach((v, i) => {
        if (v > series[maxIndex]) maxIndex = i;
        if (v < series[minIndex]) minIndex = i;
      });
      return {
        most: { name: labelsFull[maxIndex], value: series[maxIndex] },
        least: { name: labelsFull[minIndex], value: series[minIndex] },
      };
    }, [series, labelsFull]);

    /* ===================== Chart Options ===================== */
    const options = useMemo(
      () => ({
        chart: { type: "pie" },
        labels: labelsSafe,
      
          colors: ["#3f435dff","#eaca80ff", "#ffaf59ff",  "#F15A22"] ,// 👈 set colors here
          stroke: {
      show: true,
      width: 0, // ✅ no white border between slices
      colors: ["transparent"],
    },
        legend: {
          position: "right",
          formatter: (seriesName, opts) => {
            const value = opts?.w?.globals?.series?.[opts.seriesIndex];
            return value !== undefined ? `${seriesName} : ${value}` : seriesName;
          },
        },
        tooltip: {
          y: {
            formatter: (val, { seriesIndex }) =>
              `${labelsFull[seriesIndex]} : ${val}`,
          },
        },
        dataLabels: {
          enabled: true,
          formatter: (val) => `${val.toFixed(1)}%`,
        },
      }),
      [labelsSafe, labelsFull, colors]
    );

    /* ===================== UI Blocks ===================== */
    const TitleBlock = (
      <Row className="mb-2">
        <Col md="12" className="d-flex justify-content-center">
          <div className="chart-title text-center">
            {titleLabel ? (
              <span
                className={`chart-title__label badge rounded-pill bg-${titleLabelVariant} me-2`}
              >
                {titleLabel}
              </span>
            ) : null}
            <H5 className="chart-title__text mb-0">{tableName}</H5>
          </div>
        </Col>
      </Row>
    );

    const TableDropdown = (
      <Row className="align-items-center mb-3">
        <Col md="12">
          <Dropdown
            isOpen={dropdownOpen === "table"}
            toggle={() =>
              setDropdownOpen((open) => (open === "table" ? false : "table"))
            }
            className="w-100 btn-group mb-0"
          >
            <DropdownToggle
              className="dropbtn w-100 text-center"
              color="secondary"
            >
              {tableOptions.find((t) => t.value === selectedTable)?.label ||
                "Select Table"}
            </DropdownToggle>
            <DropdownMenu
              className="dropdown-content w-100"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {tableOptions.map((t) => (
                <DropdownItem
                  key={t.value}
                  active={t.value === selectedTable}
                  onClick={() => {
                    setSelectedTable(t.value);
                    setDropdownOpen(false);
                  }}
                  className="text-center"
                >
                  {t.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </Col>
      </Row>
    );

    const ColumnDropdown = (
      <Row className="align-items-center mb-3">
        <Col md="12">
          <Dropdown
            isOpen={dropdownOpen === "column"}
            toggle={() =>
              setDropdownOpen((open) => (open === "column" ? false : "column"))
            }
            className="w-100 btn-group mb-0"
          >
            <DropdownToggle className="dropbtn w-100 text-center" color="primary">
              {selectedColumn || "Select"} ({total})
            </DropdownToggle>
            <DropdownMenu
              className="dropdown-content w-100"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {columns.map((col) => (
                <DropdownItem
                  key={col}
                  active={col === selectedColumn}
                  onClick={() => {
                    setSelectedColumn(col);
                    setDropdownOpen(false);
                  }}
                  className="d-flex justify-content-between align-items-center"
                >
                  <span>{col}</span>
                  <small className="text-muted">
                    ({distinctCounts[col] ?? 0})
                  </small>
                </DropdownItem>
              ))}

              {!columns.length && (
                <DropdownItem disabled className="text-center">
                  No columns
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        </Col>
      </Row>
    );

    const scopeStyle = { ["--legend-width"]: `${legendWidthPx}px` };

    /* ===================== Render ===================== */
    return (
      <Fragment>
        <Col sm="12" xl="6">
          <Card>
            <CardBody
              className={classNames("chart-block piechartaudit", className)}
              style={scopeStyle}
            >
              {/* <h1 className="text-center">TEST</h1> */}
              {loading && <div>Loading chart…</div>}
              {!loading && error && (
                <div className="text-danger">Error: {error}</div>
              )}

              {!loading && !error && (
                <Col>
                  {/* {titlePlacement === "above" && TitleBlock} */}
                  <Row className="align-items-center mb-3">
                    {tableOptions.length > 0 && (
                      <Col md="6" sm="12" className="mb-2 mb-md-0">
                        {TableDropdown}
                      </Col>
                    )}
                    <Col md="6" sm="12">
                      {ColumnDropdown}
                    </Col>
                  </Row>

                  {titlePlacement === "below" && TitleBlock}

                  {series.length > 0 ? (
                    <ReactApexChart
                      key={`${selectedColumn}-${selectedTable}`}
                      options={options}
                      series={series}
                      type="pie"
                      height={height}
                    />
                  ) : (
                    <div className="text-muted">No data available</div>
                  )}

                  {summary && (
                    <Col className="ms-3 mt-2">
                      <h6 className="f-w-200">
                        Most: {summary.most.name} ({summary.most.value})
                      </h6>
                      <h6 className="f-w-200">
                        Least: {summary.least.name} ({summary.least.value})
                      </h6>
                    </Col>
                  )}
                </Col>
              )}
            </CardBody>
          </Card>
        </Col>
      </Fragment>
    );
  };

  PieChartDynamic.propTypes = {
    tableOptions: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
      })
    ),
    defaultTable: PropTypes.string,
    defaultColumn: PropTypes.string,
    title: PropTypes.string,
    titleLabel: PropTypes.string,
    titleLabelVariant: PropTypes.oneOf([
      "primary",
      "secondary",
      "success",
      "info",
      "warning",
      "danger",
      "dark",
      "light",
    ]),
    titlePlacement: PropTypes.oneOf(["above", "below"]),
    height: PropTypes.number,
    colors: PropTypes.arrayOf(PropTypes.string),
    className: PropTypes.string,
    legendWidthPx: PropTypes.number,
    hiddenColumns: PropTypes.arrayOf(PropTypes.string), // 👈 NEW
  };

  export default memo(PieChartDynamic);
