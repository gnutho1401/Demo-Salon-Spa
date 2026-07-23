const service = require("./internalAnalytics.service");
const { success, error } = require("../../utils/response");
const { normalizeRole } = require("./internalAnalytics.catalog");

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function exportRows(report) {
  return (report.data?.series || []).map((row) => ({
    label: row.label,
    value: row.value,
    ...(row.metrics || {}),
  }));
}

function spreadsheetXml(report) {
  const rows = exportRows(report);
  const columns = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set(["label", "value"])),
  );
  const rowXml = [columns, ...rows]
    .map((row) => {
      const values = Array.isArray(row) ? row : columns.map((column) => row[column]);
      return `<Row>${values.map((value) => {
        const isNumber = typeof value === "number";
        return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${escapeXml(value)}</Data></Cell>`;
      }).join("")}</Row>`;
    })
    .join("");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table>${rowXml}</Table></Worksheet></Workbook>`;
}

function ascii(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function simplePdf(report) {
  const rows = exportRows(report);
  const lines = [
    report.chart.title,
    `${report.range.startDate} - ${report.range.endDate}`,
    "",
    ...rows.slice(0, 32).map((row) =>
      Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(" | "),
    ),
  ];
  const stream = `BT /F1 11 Tf 46 800 Td ${lines.map((line, index) => `${index ? "0 -18 Td " : ""}(${ascii(line)}) Tj`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "ascii"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "ascii");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "ascii");
}

async function getCatalog(req, res) {
  return success(res, service.getCatalog(req.user));
}

async function getChart(req, res) {
  try {
    return success(res, await service.getChart(req.params.chartKey, req.query, req.user));
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
}

async function getDashboard(req, res) {
  try {
    return success(res, await service.getDashboard(req.query, req.user, req.query.keys));
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
}

async function exportChart(req, res) {
  try {
    if (normalizeRole(req.user?.role) !== "ADMIN") {
      return error(res, "Chỉ Admin được xuất báo cáo", 403);
    }
    const report = await service.getChart(req.params.chartKey, req.query, req.user);
    const format = String(req.query.format || "excel").toLowerCase();
    const safeName = `${req.params.chartKey}-${report.range.startDate}-${report.range.endDate}`;

    if (format === "pdf") {
      const pdf = simplePdf(report);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
      return res.send(pdf);
    }

    if (format !== "excel") {
      return error(res, "Định dạng xuất chỉ hỗ trợ pdf hoặc excel", 400);
    }
    const workbook = Buffer.from(`\uFEFF${spreadsheetXml(report)}`, "utf8");
    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.xls"`);
    return res.send(workbook);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
}

module.exports = { getCatalog, getChart, getDashboard, exportChart };
