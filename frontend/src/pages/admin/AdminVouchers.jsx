import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient from "../../api/axiosClient";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog";

const emptyForm = {
  Code: "",
  DiscountType: "PERCENT",
  DiscountValue: "",
  MinOrderAmount: "",
  MaxDiscountAmount: "",
  StartDate: "",
  EndDate: "",
  Quantity: "",
  Status: "ACTIVE",
};

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(value || 0));
}

function dateText(value) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString("vi-VN");
}

function statusClass(value) {
  return `admin-status admin-status-${String(value || "default")
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function discountText(item) {
  if (item.DiscountType === "PERCENT")
    return `${Number(item.DiscountValue || 0)}%`;
  return money(item.DiscountValue);
}

export default function AdminVouchers() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({
    keyword: "",
    discountType: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  const scrollToGrid = () => {
    if (gridRef.current) {
      const elementPosition =
        gridRef.current.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - 180;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const scrollToItem = (id, type = "voucher") => {
    setTimeout(() => {
      const element = document.getElementById(`${type}-card-${id}`);
      if (element) {
        const elementPosition =
          element.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 180;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
        element.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        element.style.borderColor = "#d6b57e";
        element.style.boxShadow = "0 0 25px 6px rgba(214, 181, 126, 0.6)";
        setTimeout(() => {
          element.style.borderColor = "";
          element.style.boxShadow = "";
        }, 3000);
      } else {
        scrollToGrid();
      }
    }, 150);
  };

  async function load() {
    try {
      setError("");
      setLoading(true);

      const res = await axiosClient.get("/admin/vouchers", {
        params: {
          keyword: filters.keyword || undefined,
          discountType: filters.discountType || undefined,
          status: filters.status || undefined,
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        },
      });

      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được danh sách voucher",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      load();
      return;
    }
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  }, [filters.status, filters.discountType, filters.fromDate, filters.toDate]);

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter") {
      shouldScrollRef.current = true;
      load().then(() => {
        if (shouldScrollRef.current) {
          scrollToGrid();
          shouldScrollRef.current = false;
        }
      });
    }
  };

  const handleFilterClick = () => {
    shouldScrollRef.current = true;
    load().then(() => {
      if (shouldScrollRef.current) {
        scrollToGrid();
        shouldScrollRef.current = false;
      }
    });
  };

  const handleClearFilters = () => {
    const wasEmpty =
      filters.status === "" &&
      filters.discountType === "" &&
      filters.fromDate === "" &&
      filters.toDate === "";
    setFilters({
      keyword: "",
      discountType: "",
      status: "",
      fromDate: "",
      toDate: "",
    });
    if (wasEmpty) {
      shouldScrollRef.current = true;
      load().then(() => {
        if (shouldScrollRef.current) {
          scrollToGrid();
          shouldScrollRef.current = false;
        }
      });
    } else {
      shouldScrollRef.current = true;
    }
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((x) => x.Status === "ACTIVE").length,
      running: items.filter((x) => x.RuntimeStatus === "RUNNING").length,
      expired: items.filter((x) => x.RuntimeStatus === "EXPIRED").length,
      used: items.reduce((sum, x) => sum + Number(x.UsedCount || 0), 0),
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(item) {
    setEditingId(item.VoucherId);
    setForm({
      Code: item.Code || "",
      DiscountType: item.DiscountType || "PERCENT",
      DiscountValue: String(item.DiscountValue ?? ""),
      MinOrderAmount: String(item.MinOrderAmount ?? ""),
      MaxDiscountAmount:
        item.MaxDiscountAmount === null
          ? ""
          : String(item.MaxDiscountAmount ?? ""),
      StartDate: item.StartDate ? String(item.StartDate).slice(0, 10) : "",
      EndDate: item.EndDate ? String(item.EndDate).slice(0, 10) : "",
      Quantity: String(item.Quantity ?? ""),
      Status: item.Status || "ACTIVE",
    });
    setError("");
    setShowModal(true);
  }

  function validate() {
    if (!form.Code.trim()) throw new Error("Vui lòng nhập mã voucher");

    const value = Number(form.DiscountValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Giá trị giảm giá phải lớn hơn 0");
    }

    if (form.DiscountType === "PERCENT" && value > 100) {
      throw new Error("Voucher phần trăm phải từ 1 đến 100");
    }

    if (Number(form.MinOrderAmount || 0) < 0) {
      throw new Error("Đơn tối thiểu không hợp lệ");
    }

    if (form.MaxDiscountAmount !== "" && Number(form.MaxDiscountAmount) < 0) {
      throw new Error("Giảm tối đa không hợp lệ");
    }

    if (!form.StartDate) throw new Error("Vui lòng chọn ngày bắt đầu");
    if (!form.EndDate) throw new Error("Vui lòng chọn ngày kết thúc");

    if (new Date(form.StartDate) > new Date(form.EndDate)) {
      throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
    }

    if (Number(form.Quantity || 0) < 0) {
      throw new Error("Số lượng không hợp lệ");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        Code: form.Code.trim().toUpperCase(),
        DiscountType: form.DiscountType,
        DiscountValue: Number(form.DiscountValue),
        MinOrderAmount: Number(form.MinOrderAmount || 0),
        MaxDiscountAmount:
          form.MaxDiscountAmount === "" ? null : Number(form.MaxDiscountAmount),
        StartDate: form.StartDate,
        EndDate: form.EndDate,
        Quantity: Number(form.Quantity || 0),
        Status: form.Status,
      };

      let voucherId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/vouchers/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/vouchers", payload);
        const created = res.data.data || res.data;
        voucherId = created?.VoucherId || created?.id;
      }

      setShowModal(false);
      await load();
      if (voucherId) {
        scrollToItem(voucherId, "voucher");
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Lưu voucher thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyStatusChange(item, nextStatus) {
    try {
      setError("");
      await axiosClient.patch(`/admin/vouchers/${item.VoucherId}/status`, {
        status: nextStatus,
      });
      await load();
      scrollToItem(item.VoucherId, "voucher");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Đổi trạng thái thất bại",
      );
    }
  }

  async function applyRemove(item) {
    try {
      setError("");
      await axiosClient.delete(`/admin/vouchers/${item.VoucherId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Xóa voucher thất bại",
      );
    }
  }

  function changeStatus(item, nextStatus) {
    setConfirmAction({ type: "status", item, nextStatus });
  }

  function remove(item) {
    setConfirmAction({ type: "delete", item });
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction.type === "delete") {
        await applyRemove(confirmAction.item);
      } else {
        await applyStatusChange(confirmAction.item, confirmAction.nextStatus);
      }
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="admin-page admin-vouchers-page">
      <style>{`
        .admin-vouchers-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-vouchers-hero {
          padding: 32px;
          border-radius: 24px;
          background: linear-gradient(135deg, #1f140e 0%, #3a2519 100%);
          color: #ffffff;
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: center;
          box-shadow: 0 12px 30px rgba(31, 20, 14, 0.15);
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(214, 181, 126, 0.2);
        }

        .admin-vouchers-hero::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 181, 126, 0.1) 0%, transparent 70%);
          right: -50px;
          bottom: -50px;
        }

        .admin-vouchers-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-vouchers-hero p {
          margin: 0;
          color: #d8cbb5;
          font-size: 14.5px;
          opacity: 0.9;
          max-width: 600px;
          line-height: 1.5;
        }

        .admin-eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #d6b57e;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .admin-refresh-btn {
          border: 0;
          border-radius: 50px;
          padding: 12px 28px;
          font-weight: 700;
          color: #1f140e;
          background: linear-gradient(135deg, #d6b57e, #f0dfbf);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(214, 181, 126, 0.3);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .admin-refresh-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(214, 181, 126, 0.4);
          background: linear-gradient(135deg, #c7a36c, #e2d0ad);
        }

        .admin-refresh-btn:active {
          transform: translateY(0);
        }

        .admin-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .admin-stat-card {
          background: #ffffff;
          padding: 24px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          gap: 20px;
          border: 1px solid #f0f0f0;
          transition: all 0.3s ease;
        }

        .admin-stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px rgba(31, 20, 14, 0.05);
          border-color: rgba(214, 181, 126, 0.3);
        }

        .admin-stat-icon {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #fbf9f6;
          font-size: 26px;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.03);
          color: #3a2519;
          border: 1px solid #f0e9df;
        }

        .admin-stat-card p {
          margin: 0;
          font-size: 13px;
          color: #8c7e74;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .admin-stat-card h3 {
          margin: 4px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1f140e;
        }

        .admin-stat-card span {
          font-size: 12px;
          color: #bfaea3;
        }

        .admin-filter-panel.admin-vouchers-filter {
          background: #ffffff;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(31, 20, 14, 0.04);
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr 1.2fr 1.2fr auto auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(214, 181, 126, 0.15);
          backdrop-filter: blur(8px);
        }

        @media (max-width: 1024px) {
          .admin-filter-panel.admin-vouchers-filter {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .admin-filter-panel.admin-vouchers-filter {
            grid-template-columns: 1fr;
          }
        }

        .admin-filter-panel.admin-vouchers-filter input,
        .admin-filter-panel.admin-vouchers-filter select {
          padding: 11px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 10px;
          font-size: 14.5px;
          background: #fdfcfb;
          outline: none;
          transition: all 0.2s;
          color: #3a2519;
        }

        .admin-filter-panel.admin-vouchers-filter input:focus,
        .admin-filter-panel.admin-vouchers-filter select:focus {
          border-color: #c7a36c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.15);
        }

        .admin-vouchers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }

        @media (min-width: 992px) {
          .admin-vouchers-grid {
            grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
          }
        }

        .admin-voucher-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.03);
          border: 1px solid #f0e9df;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          position: relative;
          min-height: 220px;
        }

        .admin-voucher-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 15px 30px rgba(31, 20, 14, 0.08);
          border-color: #d6b57e;
        }

        .voucher-ticket-left {
          background: linear-gradient(135deg, #1f140e 0%, #3e271a 100%);
          width: 140px;
          min-width: 140px;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          color: #ffffff;
          position: relative;
        }

        .voucher-ticket-left::after {
          content: "";
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(214, 181, 126, 0.05);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .voucher-ticket-badge {
          font-size: 32px;
          margin-bottom: 12px;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));
        }

        .voucher-ticket-code {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #d6b57e;
          word-break: break-all;
          text-transform: uppercase;
        }

        .voucher-ticket-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 4px;
          font-weight: 700;
        }

        .voucher-ticket-divider {
          width: 20px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
        }

        .divider-notch {
          width: 20px;
          height: 10px;
          background: #fdfbf9; /* Matches page bg */
          border: 1px solid #f0e9df;
          z-index: 2;
          position: absolute;
          transition: all 0.3s ease;
        }

        .admin-voucher-card:hover .divider-notch {
          border-color: #d6b57e;
        }

        .divider-notch.top {
          top: -1px;
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
          border-top: none;
        }

        .divider-notch.bottom {
          bottom: -1px;
          border-top-left-radius: 10px;
          border-top-right-radius: 10px;
          border-bottom: none;
        }

        .divider-line {
          flex-grow: 1;
          width: 0;
          border-left: 2px dashed #f0e9df;
          margin: 10px 0;
          transition: all 0.3s ease;
        }

        .admin-voucher-card:hover .divider-line {
          border-color: #d6b57e;
        }

        .voucher-ticket-right {
          flex-grow: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          background: #ffffff;
        }

        .voucher-ticket-discount {
          margin-bottom: 12px;
          display: flex;
          align-items: baseline;
          color: #1f140e;
        }

        .voucher-ticket-discount .value {
          font-size: 36px;
          font-weight: 800;
          line-height: 1;
          color: #3a2519;
          letter-spacing: -1px;
        }

        .voucher-ticket-discount .unit {
          font-size: 16px;
          font-weight: 700;
          color: #d6b57e;
          margin-left: 4px;
          text-transform: uppercase;
        }

        .voucher-status-badge-container {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
        }

        .admin-status {
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .admin-status-running { background: #dcfce7; color: #15803d; }
        .admin-status-upcoming { background: #dbeafe; color: #1d4ed8; }
        .admin-status-expired { background: #fee2e2; color: #b91c1c; }
        .admin-status-sold-out { background: #fef3c7; color: #b45309; }
        .admin-status-inactive { background: #f1f5f9; color: #475569; }
        .admin-status-active { background: #dcfce7; color: #15803d; }

        .voucher-limits {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 6px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .voucher-limits strong {
          color: #334155;
        }

        .voucher-duration {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 14px;
        }

        .voucher-progress {
          margin-bottom: 18px;
          background: #faf8f5;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid #f5ede2;
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #8c7e74;
          margin-bottom: 6px;
        }

        .progress-labels strong {
          color: #3a2519;
        }

        .progress-bar-bg {
          width: 100%;
          height: 6px;
          background: #ebdcc5;
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #c7a36c, #d6b57e);
          border-radius: 10px;
          transition: width 0.4s ease;
        }

        .admin-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: auto;
        }

        .card-btn {
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid #ebdcc5;
          background: #ffffff;
          color: #5c4a3c;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .card-btn:hover {
          background: #fbf9f6;
          border-color: #c7a36c;
          color: #1f140e;
        }

        .card-btn.primary {
          background: linear-gradient(135deg, #1f140e 0%, #3a2519 100%);
          color: #ffffff;
          border: none;
        }

        .card-btn.primary:hover {
          background: linear-gradient(135deg, #322117 0%, #4f3323 100%);
          box-shadow: 0 4px 10px rgba(31, 20, 14, 0.2);
        }

        .card-btn.danger {
          color: #b91c1c;
          border-color: #fee2e2;
        }

        .card-btn.danger:hover {
          background: #fef2f2;
          border-color: #b91c1c;
        }

        /* Modal details & editor styles */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(31, 20, 14, 0.6);
          backdrop-filter: blur(4px);
          display: grid;
          place-items: center;
          z-index: 999;
          padding: 20px;
          animation: fadeIn 0.25s ease-out;
        }

        .modal-card {
          background: #ffffff;
          border-radius: 24px;
          width: 100%;
          max-width: 620px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(214, 181, 126, 0.2);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .admin-modal-close {
          position: absolute;
          top: 18px;
          right: 18px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: rgba(31, 20, 14, 0.05);
          border: 0;
          font-size: 22px;
          cursor: pointer;
          display: grid;
          place-items: center;
          color: #5c4a3c;
          transition: all 0.2s;
          z-index: 10;
        }

        .admin-modal-close:hover {
          background: rgba(31, 20, 14, 0.1);
          color: #1f140e;
          transform: rotate(90deg);
        }

        .admin-voucher-ticket.detail {
          background: linear-gradient(135deg, #1f140e 0%, #3e271a 100%);
          padding: 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #ffffff;
          border-bottom: 4px solid #d6b57e;
        }

        .admin-voucher-ticket.detail h3 {
          font-size: 28px;
          font-weight: 800;
          color: #d6b57e;
          margin: 4px 0 0 0;
          letter-spacing: 1px;
        }

        .admin-voucher-ticket.detail span {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
        }

        .admin-voucher-ticket.detail strong {
          font-size: 38px;
          font-weight: 800;
          color: #ffffff;
        }

        .admin-detail-grid {
          padding: 24px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          overflow-y: auto;
        }

        .admin-detail-grid p {
          margin: 0;
          background: #fdfcfb;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid #f5ede2;
          font-size: 13.5px;
          color: #5c4a3c;
        }

        .admin-detail-grid strong {
          color: #1f140e;
          display: block;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 4px;
          color: #8c7e74;
        }

        /* Luxury Voucher Editor layout */
        .luxury-voucher-editor {
          max-width: 820px;
        }

        .voucher-editor-head {
          padding: 24px;
          background: #faf8f5;
          border-bottom: 1px solid #ebdcc5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .voucher-editor-head {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .voucher-editor-head h3 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f140e;
        }

        .voucher-editor-head p {
          margin: 0;
          font-size: 12.5px;
          color: #8c7e74;
        }

        .voucher-preview-container {
          min-width: 280px;
        }

        .voucher-preview-label {
          font-size: 10px;
          font-weight: 700;
          color: #c7a36c;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
          text-align: center;
        }

        .voucher-ticket-preview {
          background: linear-gradient(135deg, #1f140e 0%, #3e271a 100%);
          border-radius: 16px;
          display: flex;
          overflow: hidden;
          height: 100px;
          box-shadow: 0 8px 20px rgba(31, 20, 14, 0.15);
          border: 1px solid rgba(214, 181, 126, 0.2);
          transition: all 0.3s ease;
        }

        .voucher-ticket-preview.inactive {
          filter: grayscale(1) opacity(0.6);
        }

        .preview-left {
          width: 100px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          color: #ffffff;
        }

        .preview-badge { font-size: 22px; margin-bottom: 4px; }
        .preview-code { font-size: 12px; font-weight: 800; color: #d6b57e; text-transform: uppercase; word-break: break-all; }
        .preview-label { font-size: 7px; color: rgba(255,255,255,0.4); letter-spacing: 1px; }

        .preview-divider {
          width: 14px;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          background: transparent;
        }

        .preview-notch {
          width: 14px;
          height: 7px;
          background: #faf8f5; /* Matches modal head bg */
          border-radius: 50%;
          position: absolute;
        }

        .preview-notch.top {
          top: -4px;
          border-top-left-radius: 0;
          border-top-right-radius: 0;
        }

        .preview-notch.bottom {
          bottom: -4px;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .preview-line {
          flex-grow: 1;
          width: 0;
          border-left: 1px dashed rgba(214, 181, 126, 0.3);
          margin: 6px 0;
        }

        .preview-right {
          flex-grow: 1;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: #ffffff;
        }

        .preview-discount { display: flex; align-items: baseline; margin-bottom: 4px; }
        .preview-discount .value { font-size: 24px; font-weight: 800; color: #ffffff; }
        .preview-discount .unit { font-size: 11px; font-weight: 700; color: #d6b57e; margin-left: 2px; }

        .preview-details { font-size: 9px; color: rgba(255,255,255,0.6); line-height: 1.3; }

        .voucher-editor-layout {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 24px;
          padding: 24px;
          overflow-y: auto;
          flex-grow: 1;
        }

        @media (max-width: 768px) {
          .voucher-editor-layout {
            grid-template-columns: 1fr;
          }
        }

        .voucher-section-title {
          display: flex;
          gap: 12px;
          align-items: center;
          margin: 16px 0 12px 0;
          border-bottom: 1px solid #f5ede2;
          padding-bottom: 8px;
        }

        .voucher-section-title:first-of-type {
          margin-top: 0;
        }

        .voucher-section-title span {
          font-size: 16px;
          font-weight: 800;
          color: #d6b57e;
          background: #fbf9f6;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 1px solid #ebdcc5;
        }

        .voucher-section-title h4 {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #1f140e;
        }

        .voucher-section-title p {
          margin: 0;
          font-size: 11px;
          color: #8c7e74;
        }

        .admin-form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }

        .admin-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #5c4a3c;
        }

        .admin-form-grid input,
        .admin-form-grid select {
          padding: 10px 14px;
          border: 1px solid #ebdcc5;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #fdfcfb;
          transition: all 0.2s;
          color: #1f140e;
        }

        .admin-form-grid input:focus,
        .admin-form-grid select:focus {
          border-color: #c7a36c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.1);
        }

        .voucher-editor-side {
          background: #faf8f5;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #ebdcc5;
          align-self: start;
        }

        .voucher-editor-side h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 700;
          color: #1f140e;
          border-bottom: 1px solid #ebdcc5;
          padding-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .voucher-summary-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px dashed #f5ede2;
          font-size: 13px;
        }

        .voucher-summary-card:last-child {
          border-bottom: none;
        }

        .voucher-summary-card span {
          color: #8c7e74;
        }

        .voucher-summary-card strong {
          color: #1f140e;
          font-weight: 700;
        }

        .voucher-editor-actions {
          padding: 20px 24px;
          border-top: 1px solid #ebdcc5;
          background: #faf8f5;
          margin-top: 0;
        }

        .admin-empty {
          text-align: center;
          padding: 40px;
          background: #ffffff;
          border-radius: 16px;
          color: #8c7e74;
          border: 1px dashed #ebdcc5;
          font-weight: 600;
        }

        .admin-loading-card {
          text-align: center;
          padding: 30px;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #f0e9df;
          color: #d6b57e;
          font-weight: 700;
        }

        .admin-error-card {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #b91c1c;
          padding: 14px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>

      <div className="admin-vouchers-hero">
        <div>
          <div className="admin-eyebrow">Vouchers Management</div>
          <h1>Quản lý voucher</h1>
          <p>
            Quản lý mã giảm giá, loại giảm, điều kiện đơn tối thiểu, giới hạn sử
            dụng, thời hạn và trạng thái voucher của Luxury Spa.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          <span>➕</span> Thêm voucher
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">🎟️</div>
          <div>
            <p>Tổng voucher</p>
            <h3>{stats.total}</h3>
            <span>Tất cả mã giảm giá</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">✓</div>
          <div>
            <p>Đang hoạt động</p>
            <h3>{stats.active}</h3>
            <span>Status ACTIVE</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🔥</div>
          <div>
            <p>Đang chạy</p>
            <h3>{stats.running}</h3>
            <span>Còn hạn & còn lượt</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">🧾</div>
          <div>
            <p>Đã sử dụng</p>
            <h3>{stats.used}</h3>
            <span>Tổng lượt dùng</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-vouchers-filter">
        <input
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm mã voucher..."
        />

        <select
          value={filters.discountType}
          onChange={(e) =>
            setFilters({ ...filters, discountType: e.target.value })
          }
        >
          <option value="">Tất cả loại</option>
          <option value="PERCENT">PERCENT</option>
          <option value="AMOUNT">AMOUNT</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>

        <input
          type="date"
          value={filters.fromDate}
          onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
        />

        <input
          type="date"
          value={filters.toDate}
          onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
        />

        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          Lọc
        </button>

        <button className="card-btn" onClick={handleClearFilters}>
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải danh sách voucher...</div>
      ) : null}

      {!loading ? (
        <div className="admin-vouchers-grid" ref={gridRef}>
          {items.map((item) => (
            <article
              className="admin-voucher-card"
              id={`voucher-card-${item.VoucherId}`}
              key={item.VoucherId}
            >
              <div className="voucher-ticket-left">
                <div className="voucher-ticket-badge">🎟️</div>
                <div className="voucher-ticket-code">{item.Code}</div>
                <div className="voucher-ticket-label">Voucher Code</div>
              </div>

              <div className="voucher-ticket-divider">
                <div className="divider-notch top"></div>
                <div className="divider-line"></div>
                <div className="divider-notch bottom"></div>
              </div>

              <div className="voucher-ticket-right">
                <div className="voucher-ticket-discount">
                  {item.DiscountType === "PERCENT" ? (
                    <>
                      <span className="value">
                        {Number(item.DiscountValue || 0)}
                      </span>
                      <span className="unit">% OFF</span>
                    </>
                  ) : (
                    <>
                      <span className="value">
                        {Number(item.DiscountValue || 0) / 1000}
                      </span>
                      <span className="unit">K OFF</span>
                    </>
                  )}
                </div>

                <div className="voucher-status-badge-container">
                  <span
                    className={statusClass(item.RuntimeStatus || item.Status)}
                  >
                    {item.RuntimeStatus || item.Status}
                  </span>
                  <span className={statusClass(item.Status)}>
                    {item.Status}
                  </span>
                </div>

                <div className="voucher-limits">
                  <span>
                    Đơn tối thiểu: <strong>{money(item.MinOrderAmount)}</strong>
                  </span>
                  <span>
                    Giảm tối đa:{" "}
                    <strong>
                      {item.MaxDiscountAmount === null
                        ? "Không giới hạn"
                        : money(item.MaxDiscountAmount)}
                    </strong>
                  </span>
                </div>

                <div className="voucher-duration">
                  Hạn dùng: {dateText(item.StartDate)} →{" "}
                  {dateText(item.EndDate)}
                </div>

                <div className="voucher-progress">
                  <div className="progress-labels">
                    <span>
                      Đã dùng: <strong>{item.UsedCount || 0}</strong>
                    </span>
                    <span>
                      Còn lại:{" "}
                      <strong>
                        {item.RemainingQuantity || 0} / {item.Quantity || 0}
                      </strong>
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(100, ((item.UsedCount || 0) / (item.Quantity || 1)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="admin-card-actions">
                  <button
                    className="card-btn"
                    onClick={() => setSelected(item)}
                  >
                    💡 Chi tiết
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openEdit(item)}
                  >
                    ✏️ Sửa
                  </button>

                  {item.Status === "ACTIVE" ? (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "INACTIVE")}
                    >
                      🔕 Tắt
                    </button>
                  ) : (
                    <button
                      className="card-btn"
                      onClick={() => changeStatus(item, "ACTIVE")}
                    >
                      🔔 Bật
                    </button>
                  )}

                  <button
                    className="card-btn danger"
                    onClick={() => remove(item)}
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có voucher phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-voucher-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div className="admin-voucher-ticket detail">
              <div>
                <span>VOUCHER CODE</span>
                <h3>{selected.Code}</h3>
              </div>
              <strong>{discountText(selected)}</strong>
            </div>

            <div className="admin-detail-grid">
              <p>
                <strong>Loại giảm giá</strong>
                {selected.DiscountType}
              </p>
              <p>
                <strong>Giá trị ưu đãi</strong>
                {discountText(selected)}
              </p>
              <p>
                <strong>Đơn tối thiểu</strong>
                {money(selected.MinOrderAmount)}
              </p>
              <p>
                <strong>Giảm tối đa</strong>
                {selected.MaxDiscountAmount === null
                  ? "Không giới hạn"
                  : money(selected.MaxDiscountAmount)}
              </p>
              <p>
                <strong>Ngày bắt đầu</strong>
                {dateText(selected.StartDate)}
              </p>
              <p>
                <strong>Ngày kết thúc</strong>
                {dateText(selected.EndDate)}
              </p>
              <p>
                <strong>Tổng số lượng phát hành</strong>
                {selected.Quantity || 0} vé
              </p>
              <p>
                <strong>Đã áp dụng thành công</strong>
                {selected.UsedCount || 0} lần
              </p>
              <p>
                <strong>Còn lại khả dụng</strong>
                {selected.RemainingQuantity || 0} vé
              </p>
              <p>
                <strong>Số khách hàng sở hữu</strong>
                {selected.CustomerCount || 0} khách
              </p>
              <p>
                <strong>Trạng thái hệ thống</strong>
                {selected.Status}
              </p>
              <p>
                <strong>Trạng thái vận hành</strong>
                {selected.RuntimeStatus || "N/A"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-voucher-form luxury-voucher-editor"
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-modal-close"
              onClick={() => setShowModal(false)}
            >
              ×
            </button>

            <div className="voucher-editor-head">
              <div>
                <span>{editingId ? "Edit Voucher" : "Create Voucher"}</span>
                <h3>{editingId ? "Sửa voucher" : "Thêm voucher mới"}</h3>
                <p>
                  Cấu hình mã giảm giá, điều kiện sử dụng, số lượng và thời hạn
                  áp dụng.
                </p>
              </div>

              <div className="voucher-preview-container">
                <div className="voucher-preview-label">LIVE PREVIEW</div>
                <div
                  className={`voucher-ticket-preview ${form.Status === "INACTIVE" ? "inactive" : ""}`}
                >
                  <div className="preview-left">
                    <div className="preview-badge">🎟️</div>
                    <div className="preview-code">{form.Code || "SPA20"}</div>
                    <div className="preview-label">MÃ GIẢM GIÁ</div>
                  </div>
                  <div className="preview-divider">
                    <div className="preview-notch top"></div>
                    <div className="preview-line"></div>
                    <div className="preview-notch bottom"></div>
                  </div>
                  <div className="preview-right">
                    <div className="preview-discount">
                      {form.DiscountType === "PERCENT" ? (
                        <>
                          <span className="value">
                            {form.DiscountValue || "20"}
                          </span>
                          <span className="unit">% OFF</span>
                        </>
                      ) : (
                        <>
                          <span className="value">
                            {(
                              Number(form.DiscountValue || 50000) / 1000
                            ).toFixed(0)}
                          </span>
                          <span className="unit">K OFF</span>
                        </>
                      )}
                    </div>
                    <div className="preview-details">
                      <div>
                        Hạn:{" "}
                        {form.StartDate ? dateText(form.StartDate) : "Ngày đi"}{" "}
                        → {form.EndDate ? dateText(form.EndDate) : "Hạn cuối"}
                      </div>
                      <div>Tối thiểu: {money(form.MinOrderAmount || 0)}</div>
                      <div>
                        Giảm tối đa:{" "}
                        {form.MaxDiscountAmount
                          ? money(form.MaxDiscountAmount)
                          : "Không giới hạn"}
                      </div>
                      <div>Số lượng: {form.Quantity || 0} vé</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="voucher-editor-layout">
              <div className="voucher-editor-main">
                <div className="voucher-section-title">
                  <span>1</span>
                  <div>
                    <h4>Thông tin voucher</h4>
                    <p>Nhập mã và loại giảm giá.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Mã voucher *
                    <input
                      value={form.Code}
                      onChange={(e) =>
                        setForm({ ...form, Code: e.target.value.toUpperCase() })
                      }
                      placeholder="SPA20"
                      required
                    />
                  </label>

                  <label>
                    Loại giảm *
                    <select
                      value={form.DiscountType}
                      onChange={(e) =>
                        setForm({ ...form, DiscountType: e.target.value })
                      }
                    >
                      <option value="PERCENT">PERCENT</option>
                      <option value="AMOUNT">AMOUNT</option>
                    </select>
                  </label>

                  <label>
                    Giá trị giảm *
                    <input
                      type="number"
                      min="1"
                      value={form.DiscountValue}
                      onChange={(e) =>
                        setForm({ ...form, DiscountValue: e.target.value })
                      }
                      placeholder={
                        form.DiscountType === "PERCENT" ? "20" : "50000"
                      }
                      required
                    />
                  </label>

                  <label>
                    Trạng thái
                    <select
                      value={form.Status}
                      onChange={(e) =>
                        setForm({ ...form, Status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                </div>

                <div className="voucher-section-title">
                  <span>2</span>
                  <div>
                    <h4>Điều kiện sử dụng</h4>
                    <p>Cấu hình đơn tối thiểu, giảm tối đa và số lượng.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Đơn tối thiểu (đ)
                    <input
                      type="number"
                      min="0"
                      value={form.MinOrderAmount}
                      onChange={(e) =>
                        setForm({ ...form, MinOrderAmount: e.target.value })
                      }
                      placeholder="300000"
                    />
                  </label>

                  <label>
                    Giảm tối đa (đ)
                    <input
                      type="number"
                      min="0"
                      value={form.MaxDiscountAmount}
                      onChange={(e) =>
                        setForm({ ...form, MaxDiscountAmount: e.target.value })
                      }
                      placeholder="Bỏ trống nếu không giới hạn"
                    />
                  </label>

                  <label>
                    Số lượng *
                    <input
                      type="number"
                      min="0"
                      value={form.Quantity}
                      onChange={(e) =>
                        setForm({ ...form, Quantity: e.target.value })
                      }
                      placeholder="100"
                      required
                    />
                  </label>
                </div>

                <div className="voucher-section-title">
                  <span>3</span>
                  <div>
                    <h4>Thời gian áp dụng</h4>
                    <p>Voucher chỉ hợp lệ trong khoảng ngày này.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Ngày bắt đầu *
                    <input
                      type="date"
                      value={form.StartDate}
                      onChange={(e) =>
                        setForm({ ...form, StartDate: e.target.value })
                      }
                      required
                    />
                  </label>

                  <label>
                    Ngày kết thúc *
                    <input
                      type="date"
                      value={form.EndDate}
                      onChange={(e) =>
                        setForm({ ...form, EndDate: e.target.value })
                      }
                      required
                    />
                  </label>
                </div>
              </div>

              <aside className="voucher-editor-side">
                <h4>Tóm tắt voucher</h4>

                <div className="voucher-summary-card">
                  <span>Mã Voucher</span>
                  <strong>{form.Code || "Chưa nhập"}</strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Giá trị ưu đãi</span>
                  <strong>
                    {form.DiscountType === "PERCENT"
                      ? `${form.DiscountValue || 0}%`
                      : money(form.DiscountValue || 0)}
                  </strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Đơn hàng tối thiểu</span>
                  <strong>{money(form.MinOrderAmount || 0)}</strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Giảm giá tối đa</span>
                  <strong>
                    {form.MaxDiscountAmount === "" ||
                    form.MaxDiscountAmount === null
                      ? "Không giới hạn"
                      : money(form.MaxDiscountAmount || 0)}
                  </strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Thời gian áp dụng</span>
                  <strong style={{ fontSize: "11px", whiteSpace: "pre-wrap" }}>
                    {form.StartDate || "--"} đến {form.EndDate || "--"}
                  </strong>
                </div>

                <div className="voucher-summary-card">
                  <span>Trạng thái</span>
                  <strong>{form.Status}</strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions voucher-editor-actions">
              <button
                type="button"
                className="card-btn"
                onClick={() => setShowModal(false)}
              >
                Hủy
              </button>

              <button
                className="card-btn primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Đang lưu..."
                  : editingId
                    ? "Cập nhật voucher"
                    : "Tạo voucher"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(confirmAction)}
        title={
          confirmAction?.type === "delete"
            ? "Xóa voucher?"
            : "Cập nhật trạng thái voucher?"
        }
        description={
          confirmAction?.type === "delete"
            ? "Voucher sẽ bị xóa khỏi hệ thống và không thể tiếp tục được khách hàng sử dụng."
            : "Trạng thái mới sẽ ảnh hưởng ngay đến khả năng áp dụng mã ưu đãi khi thanh toán."
        }
        details={
          confirmAction ? (
            <>
              <strong>{confirmAction.item.Code}</strong>
              <span> · Giá trị {discountText(confirmAction.item)}</span>
              {confirmAction.type === "status" ? (
                <span> · Trạng thái mới: {confirmAction.nextStatus}</span>
              ) : null}
            </>
          ) : null
        }
        confirmLabel={
          confirmAction?.type === "delete"
            ? "Xóa voucher"
            : "Cập nhật trạng thái"
        }
        tone={confirmAction?.type === "delete" ? "danger" : "warning"}
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmedAction}
      />
    </section>
  );
}
