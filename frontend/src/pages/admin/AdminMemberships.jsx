import { useEffect, useMemo, useState, useRef } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/avatars/default-avatar.png";

const emptyForm = {
  LevelName: "",
  MinPoints: "",
  DiscountPercent: "",
  Description: "",
};

function moneyPoint(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

function avatar(url) {
  return resolveFileUrl(url) || DEFAULT_AVATAR;
}

function levelClass(name) {
  const key = String(name || "default").toLowerCase();
  if (key.includes("diamond")) return "diamond";
  if (key.includes("gold")) return "gold";
  if (key.includes("silver")) return "silver";
  if (key.includes("bronze")) return "bronze";
  return "default";
}

export default function AdminMemberships() {
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const gridRef = useRef(null);
  const shouldScrollRef = useRef(false);
  const isInitialMount = useRef(true);

  const scrollToGrid = () => {
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  const scrollToItem = (id, type = "membership") => {
    let attempts = 0;
    const checkAndScroll = () => {
      const element = document.getElementById(`${type}-card-${id}`);
      if (element) {
        element.scrollIntoView({ block: "center", behavior: "smooth" });
        element.style.transition = "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
        element.style.borderColor = "#d6b57e";
        element.style.boxShadow = "0 0 25px 6px rgba(214, 181, 126, 0.6)";
        setTimeout(() => {
          element.style.borderColor = "";
          element.style.boxShadow = "";
        }, 3500);
      } else if (attempts < 15) {
        attempts++;
        setTimeout(checkAndScroll, 100);
      } else {
        scrollToGrid();
      }
    };
    setTimeout(checkAndScroll, 100);
  };

  async function load() {
    try {
      setError("");
      setLoading(true);

      const res = await axiosClient.get("/admin/memberships", {
        params: { keyword: keyword || undefined },
      });

      setItems(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được membership levels",
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
    // We only react to load here if shouldScrollRef is set,
    // which handles explicit filter keyword searches.
    if (shouldScrollRef.current) {
      load().then(() => {
        scrollToGrid();
        shouldScrollRef.current = false;
      });
    }
  }, [keyword === ""]); // Trigger load when keyword is cleared

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
    setKeyword("");
    shouldScrollRef.current = true;
    // Call load explicitly to clear
    axiosClient.get("/admin/memberships").then((res) => {
      setItems(res.data.data || res.data || []);
      scrollToGrid();
      shouldScrollRef.current = false;
    });
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      customers: items.reduce(
        (sum, x) => sum + Number(x.CustomerCount || 0),
        0,
      ),
      maxDiscount: Math.max(
        ...items.map((x) => Number(x.DiscountPercent || 0)),
        0,
      ),
      maxPoint: Math.max(...items.map((x) => Number(x.MinPoints || 0)), 0),
    };
  }, [items]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
    setError("");
  }

  function openEdit(item) {
    setEditingId(item.MembershipLevelId);
    setForm({
      LevelName: item.LevelName || "",
      MinPoints: String(item.MinPoints ?? ""),
      DiscountPercent: String(item.DiscountPercent ?? ""),
      Description: item.Description || "",
    });
    setShowModal(true);
    setError("");
  }

  async function openDetail(item) {
    try {
      setSelected(item);
      setCustomers([]);
      setLoadingCustomers(true);

      const res = await axiosClient.get(
        `/admin/memberships/${item.MembershipLevelId}/customers`,
      );

      setCustomers(res.data.data || res.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Không tải được customer của hạng này",
      );
    } finally {
      setLoadingCustomers(false);
    }
  }

  function validate() {
    if (!form.LevelName.trim()) throw new Error("Vui lòng nhập tên hạng");
    if (Number(form.MinPoints) < 0)
      throw new Error("Điểm tối thiểu không hợp lệ");
    if (
      Number(form.DiscountPercent) < 0 ||
      Number(form.DiscountPercent) > 100
    ) {
      throw new Error("Giảm giá phải từ 0 đến 100%");
    }
  }

  async function submit(e) {
    e.preventDefault();

    try {
      validate();
      setSaving(true);
      setError("");

      const payload = {
        LevelName: form.LevelName.trim(),
        MinPoints: Number(form.MinPoints || 0),
        DiscountPercent: Number(form.DiscountPercent || 0),
        Description: form.Description.trim() || null,
      };

      let mId = editingId;

      if (editingId) {
        await axiosClient.put(`/admin/memberships/${editingId}`, payload);
      } else {
        const res = await axiosClient.post("/admin/memberships", payload);
        const created = res.data.data || res.data;
        mId = created?.MembershipLevelId || created?.id;
      }

      setShowModal(false);
      await load();
      if (mId) {
        scrollToItem(mId, "membership");
      } else {
        scrollToGrid();
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Lưu membership thất bại",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    const ok = window.confirm(
      `Bạn chắc chắn muốn xóa hạng "${item.LevelName}"?`,
    );
    if (!ok) return;

    try {
      setError("");
      await axiosClient.delete(`/admin/memberships/${item.MembershipLevelId}`);
      await load();
      scrollToGrid();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Xóa membership thất bại",
      );
    }
  }

  return (
    <section className="admin-page admin-membership-page">
      <style>{`
        .admin-membership-page {
          padding: 24px;
          background: #fdfbf9;
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
        }

        .admin-membership-hero {
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

        .admin-membership-hero::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(214, 181, 126, 0.1) 0%, transparent 70%);
          right: -50px;
          bottom: -50px;
        }

        .admin-membership-hero h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(to right, #ffffff, #f0dfbf);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-membership-hero p {
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

        .admin-filter-panel.admin-membership-filter {
          background: #ffffff;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(31, 20, 14, 0.04);
          display: grid;
          grid-template-columns: 2fr auto auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 24px;
          position: sticky;
          top: 10px;
          z-index: 99;
          border: 1px solid rgba(214, 181, 126, 0.15);
          backdrop-filter: blur(8px);
        }

        .admin-filter-panel.admin-membership-filter input {
          padding: 11px 16px;
          border: 1px solid #ebdcc5;
          border-radius: 10px;
          font-size: 14.5px;
          background: #fdfcfb;
          outline: none;
          transition: all 0.2s;
          color: #3a2519;
        }

        .admin-filter-panel.admin-membership-filter input:focus {
          border-color: #c7a36c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.15);
        }

        .admin-membership-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 30px;
        }

        @media (min-width: 992px) {
          .admin-membership-grid {
            grid-template-columns: repeat(auto-fill, minmax(430px, 1fr));
          }
        }

        /* VIP Metal Card styles */
        .vip-card {
          height: 220px;
          border-radius: 20px;
          padding: 24px;
          color: #ffffff;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.15);
          transition: all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .vip-card::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 0%,
            rgba(255, 255, 255, 0.05) 30%,
            rgba(255, 255, 255, 0.15) 40%,
            rgba(255, 255, 255, 0.05) 50%,
            transparent 100%
          );
          transform: rotate(-30deg);
          transition: transform 0.8s ease;
          pointer-events: none;
        }

        .admin-membership-card:hover .vip-card {
          transform: translateY(-8px) rotateY(10deg);
          box-shadow: 0 20px 40px rgba(31, 20, 14, 0.25);
        }

        .admin-membership-card:hover .vip-card::after {
          transform: rotate(-30deg) translate(50%, 50%);
        }

        /* VIP Card Tiers Gradients */
        .vip-card.bronze {
          background: linear-gradient(135deg, #3f2512 0%, #7c4c28 50%, #9e6c46 100%);
          border-color: rgba(158, 108, 70, 0.4);
        }
        .vip-card.silver {
          background: linear-gradient(135deg, #2e3440 0%, #59616e 50%, #8892b0 100%);
          border-color: rgba(136, 146, 176, 0.4);
        }
        .vip-card.gold {
          background: linear-gradient(135deg, #18100b 0%, #3e281a 50%, #9a7b44 100%);
          border-color: rgba(214, 181, 126, 0.4);
        }
        .vip-card.diamond {
          background: linear-gradient(135deg, #09132d 0%, #162c64 50%, #0891b2 100%);
          border-color: rgba(8, 145, 178, 0.4);
        }
        .vip-card.default {
          background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
          border-color: rgba(100, 116, 139, 0.4);
        }

        .vip-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .vip-badge-chip {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .metallic-chip {
          width: 42px;
          height: 32px;
          background: linear-gradient(135deg, #e5e7eb 0%, #9ca3af 50%, #d1d5db 100%);
          border-radius: 6px;
          position: relative;
          border: 1px solid rgba(0, 0, 0, 0.1);
          box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.5);
        }

        .metallic-chip::before {
          content: "";
          position: absolute;
          top: 15%;
          left: 20%;
          width: 60%;
          height: 70%;
          border-right: 1px solid rgba(0, 0, 0, 0.15);
          border-bottom: 1px solid rgba(0, 0, 0, 0.15);
        }

        .vip-card.gold .metallic-chip {
          background: linear-gradient(135deg, #fef08a 0%, #ca8a04 50%, #fef9c3 100%);
        }

        .vip-label {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.7);
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        }

        .vip-crest {
          font-size: 26px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }

        .vip-card-body {
          margin-top: 14px;
        }

        .vip-tier-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin: 0 0 6px 0;
          text-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }

        .vip-card-number {
          font-family: 'Courier New', Courier, monospace;
          font-size: 16px;
          letter-spacing: 3px;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }

        .vip-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .vip-discount-badge {
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(4px);
          padding: 6px 14px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 800;
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .vip-min-points {
          text-align: right;
        }

        .vip-min-points span {
          font-size: 8px;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.6);
          display: block;
          font-weight: 700;
          margin-bottom: 2px;
        }

        .vip-min-points strong {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        /* Membership stats overlay (below VIP Card) */
        .admin-membership-card {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          border-radius: 24px;
          border: 1px solid #f0e9df;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: 0 6px 15px rgba(0,0,0,0.02);
        }

        .admin-membership-card:hover {
          border-color: #d6b57e;
          box-shadow: 0 15px 35px rgba(31, 20, 14, 0.08);
        }

        .membership-stats-overlay {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }

        .vip-desc {
          font-size: 13.5px;
          color: #8c7e74;
          line-height: 1.5;
          margin: 0 0 20px 0;
          min-height: 40px;
        }

        .vip-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: #fbf9f6;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid #f5ede2;
          margin-bottom: 20px;
          text-align: center;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-item span {
          font-size: 9px;
          color: #bfaea3;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-item strong {
          font-size: 14px;
          color: #3a2519;
          font-weight: 700;
        }

        /* Modal details styling */
        .membership-detail-banner {
          background: linear-gradient(135deg, #1f140e 0%, #3e271a 100%);
          padding: 36px 30px;
          color: #ffffff;
          position: relative;
          display: flex;
          flex-direction: column;
          border-bottom: 4px solid #d6b57e;
        }

        .membership-detail-banner.bronze { background: linear-gradient(135deg, #3f2512 0%, #7c4c28 50%, #9e6c46 100%); border-bottom-color: #9e6c46; }
        .membership-detail-banner.silver { background: linear-gradient(135deg, #2e3440 0%, #59616e 50%, #8892b0 100%); border-bottom-color: #8892b0; }
        .membership-detail-banner.gold { background: linear-gradient(135deg, #18100b 0%, #3e281a 50%, #9a7b44 100%); border-bottom-color: #d6b57e; }
        .membership-detail-banner.diamond { background: linear-gradient(135deg, #09132d 0%, #162c64 50%, #0891b2 100%); border-bottom-color: #38bdf8; }

        .membership-detail-banner span {
          font-size: 11px;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.6);
          font-weight: 700;
          text-transform: uppercase;
        }

        .membership-detail-banner h3 {
          font-size: 32px;
          font-weight: 800;
          margin: 6px 0;
          text-transform: uppercase;
        }

        .membership-detail-banner strong {
          font-size: 20px;
          color: #d6b57e;
          font-weight: 700;
        }

        .membership-detail-banner.diamond strong {
          color: #38bdf8;
        }

        .admin-membership-desc {
          padding: 20px 24px 0 24px;
          margin: 0;
          font-size: 14.5px;
          color: #5c4a3c;
          line-height: 1.6;
        }

        .membership-customer-box {
          padding: 0 24px 24px 24px;
          border-top: 1px solid #f5ede2;
          margin-top: 16px;
          display: flex;
          flex-direction: column;
        }

        .membership-customer-box h4 {
          margin: 16px 0 12px 0;
          font-size: 14px;
          font-weight: 700;
          color: #1f140e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .membership-customer-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 240px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .membership-customer-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #fbf9f6;
          border-radius: 12px;
          border: 1px solid #f5ede2;
          transition: all 0.2s ease;
        }

        .membership-customer-row:hover {
          background: #ffffff;
          border-color: #d6b57e;
          transform: translateX(4px);
        }

        .membership-customer-row img {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #ebdcc5;
        }

        .membership-customer-row div {
          flex-grow: 1;
        }

        .membership-customer-row strong {
          font-size: 13.5px;
          color: #1f140e;
          display: block;
        }

        .membership-customer-row span {
          font-size: 11px;
          color: #8c7e74;
        }

        .membership-customer-row b {
          font-size: 13.5px;
          color: #c7a36c;
        }

        /* Modal form style */
        .luxury-membership-editor {
          max-width: 780px;
        }

        .membership-editor-head {
          padding: 24px;
          background: #faf8f5;
          border-bottom: 1px solid #ebdcc5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
        }

        @media (max-width: 680px) {
          .membership-editor-head {
            flex-direction: column;
            align-items: stretch;
          }
        }

        .membership-editor-head h3 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1f140e;
        }

        .membership-editor-head p {
          margin: 0;
          font-size: 12.5px;
          color: #8c7e74;
        }

        .membership-preview-container {
          min-width: 290px;
        }

        .membership-preview-label {
          font-size: 10px;
          font-weight: 700;
          color: #c7a36c;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
          text-align: center;
        }

        .vip-card.preview {
          height: 140px;
          width: 290px;
          padding: 16px;
          box-shadow: 0 8px 20px rgba(31, 20, 14, 0.12);
        }

        .vip-card.preview .vip-tier-name {
          font-size: 18px;
          margin-bottom: 2px;
        }

        .vip-card.preview .vip-card-number {
          font-size: 12px;
          letter-spacing: 2px;
        }

        .vip-card.preview .metallic-chip {
          width: 32px;
          height: 24px;
        }

        .vip-card.preview .vip-discount-badge {
          padding: 4px 10px;
          font-size: 12px;
        }

        .vip-card.preview .vip-min-points strong {
          font-size: 14px;
        }

        .membership-editor-layout {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 24px;
          padding: 24px;
          overflow-y: auto;
          flex-grow: 1;
        }

        @media (max-width: 680px) {
          .membership-editor-layout {
            grid-template-columns: 1fr;
          }
        }

        .membership-section-title {
          display: flex;
          gap: 12px;
          align-items: center;
          margin: 16px 0 12px 0;
          border-bottom: 1px solid #f5ede2;
          padding-bottom: 8px;
        }

        .membership-section-title:first-of-type {
          margin-top: 0;
        }

        .membership-section-title span {
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

        .membership-section-title h4 {
          margin: 0;
          font-size: 14.5px;
          font-weight: 700;
          color: #1f140e;
        }

        .membership-section-title p {
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

        .admin-form-grid label.admin-form-wide {
          grid-column: 1 / -1;
        }

        .admin-form-grid input,
        .admin-form-grid select,
        .admin-form-grid textarea {
          padding: 10px 14px;
          border: 1px solid #ebdcc5;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          background: #fdfcfb;
          transition: all 0.2s;
          color: #1f140e;
          font-family: inherit;
        }

        .admin-form-grid input:focus,
        .admin-form-grid select:focus,
        .admin-form-grid textarea:focus {
          border-color: #c7a36c;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(214, 181, 126, 0.1);
        }

        .membership-editor-side {
          background: #faf8f5;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #ebdcc5;
          align-self: start;
        }

        .membership-editor-side h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 700;
          color: #1f140e;
          border-bottom: 1px solid #ebdcc5;
          padding-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .membership-summary-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px dashed #f5ede2;
          font-size: 13px;
        }

        .membership-summary-card:last-child {
          border-bottom: none;
        }

        .membership-summary-card span {
          color: #8c7e74;
        }

        .membership-summary-card strong {
          color: #1f140e;
          font-weight: 700;
        }

        .membership-editor-actions {
          padding: 20px 24px;
          border-top: 1px solid #ebdcc5;
          background: #faf8f5;
          margin-top: 0;
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

      <div className="admin-membership-hero">
        <div>
          <div className="admin-eyebrow">Membership Management</div>
          <h1>Quản lý hạng thành viên</h1>
          <p>
            Cấu hình hạng khách hàng VIP, điểm tích lũy tối thiểu, phần trăm ưu đãi đặc quyền và theo
            dõi số lượng khách đang thuộc từng hạng của Luxury Spa.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          <span>➕</span> Thêm hạng mới
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">🏆</div>
          <div>
            <p>Tổng hạng</p>
            <h3>{stats.total}</h3>
            <span>Tất cả các mốc VIP</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Khách đã phân hạng</p>
            <h3>{stats.customers}</h3>
            <span>Tổng khách hàng</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">%</div>
          <div>
            <p>Ưu đãi cao nhất</p>
            <h3>{stats.maxDiscount}%</h3>
            <span>Discount tối đa</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">★</div>
          <div>
            <p>Mốc điểm cao nhất</p>
            <h3>{moneyPoint(stats.maxPoint)}</h3>
            <span>MinPoints cao nhất</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-membership-filter">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeywordKeyDown}
          placeholder="Tìm tên hạng hoặc mô tả..."
        />

        <button className="admin-refresh-btn" onClick={handleFilterClick}>
          Lọc
        </button>

        <button className="card-btn" onClick={handleClearFilters}>
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải membership levels...</div>
      ) : null}

      {!loading ? (
        <div className="admin-membership-grid" ref={gridRef}>
          {items.map((item, index) => (
            <article
              className="admin-membership-card"
              id={`membership-card-${item.MembershipLevelId}`}
              key={item.MembershipLevelId}
            >
              <div className={`vip-card ${levelClass(item.LevelName)}`}>
                <div className="vip-card-header">
                  <div className="vip-badge-chip">
                    <div className="metallic-chip"></div>
                    <span className="vip-label">VIP TIER</span>
                  </div>
                  <div className="vip-crest">🏆</div>
                </div>

                <div className="vip-card-body">
                  <h3 className="vip-tier-name">{item.LevelName}</h3>
                  <div className="vip-card-number">•••• •••• •••• {1000 + item.MembershipLevelId}</div>
                </div>

                <div className="vip-card-footer">
                  <div className="vip-discount-badge">{item.DiscountPercent}% OFF</div>
                  <div className="vip-min-points">
                    <span>MIN POINTS</span>
                    <strong>{moneyPoint(item.MinPoints)}</strong>
                  </div>
                </div>
              </div>

              <div className="membership-stats-overlay">
                <p className="vip-desc">{item.Description || "Không có mô tả cho hạng thành viên này."}</p>

                <div className="vip-stats-grid">
                  <div className="stat-item">
                    <span>Khách hàng</span>
                    <strong>{item.CustomerCount || 0}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Tổng điểm</span>
                    <strong>{moneyPoint(item.TotalCustomerPoints || 0)}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Điểm trung bình</span>
                    <strong>{moneyPoint(item.AvgCustomerPoints || 0)}</strong>
                  </div>
                </div>

                <div className="admin-card-actions">
                  <button className="card-btn" onClick={() => openDetail(item)}>
                    👥 Khách hàng
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openEdit(item)}
                  >
                    ✏️ Sửa
                  </button>

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
            <div className="admin-empty">Không có hạng thành viên phù hợp.</div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="modal-card admin-membership-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            <div
              className={`membership-detail-banner ${levelClass(selected.LevelName)}`}
            >
              <span>MEMBERSHIP LEVEL</span>
              <h3>{selected.LevelName}</h3>
              <strong>{selected.DiscountPercent}% OFF</strong>
            </div>

            <p className="admin-membership-desc">
              {selected.Description || "Chưa có mô tả."}
            </p>

            <div className="admin-detail-grid">
              <p>
                <strong>Điểm tối thiểu</strong>
                {moneyPoint(selected.MinPoints)} điểm
              </p>
              <p>
                <strong>Ưu đãi giảm giá</strong>
                {selected.DiscountPercent}%
              </p>
              <p>
                <strong>Số lượng khách hàng</strong>
                {selected.CustomerCount || 0} khách
              </p>
              <p>
                <strong>Tổng điểm tích lũy</strong>
                {moneyPoint(selected.TotalCustomerPoints || 0)} điểm
              </p>
              <p>
                <strong>Điểm tích lũy trung bình</strong>
                {moneyPoint(selected.AvgCustomerPoints || 0)} điểm
              </p>
            </div>

            <div className="membership-customer-box">
              <h4>Top khách hàng trong hạng này</h4>

              {loadingCustomers ? (
                <p className="admin-empty">Đang tải danh sách customer...</p>
              ) : null}

              {!loadingCustomers && customers.length ? (
                <div className="membership-customer-list">
                  {customers.map((c) => (
                    <div className="membership-customer-row" key={c.CustomerId}>
                      <img src={avatar(c.AvatarUrl)} alt={c.FullName} />
                      <div>
                        <strong>{c.FullName}</strong>
                        <span>{c.Email || c.Phone || "Không có liên hệ"}</span>
                      </div>
                      <b>{moneyPoint(c.LoyaltyPoints)} điểm</b>
                    </div>
                  ))}
                </div>
              ) : null}

              {!loadingCustomers && !customers.length ? (
                <p className="admin-empty">Chưa có customer thuộc hạng này.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <form
            className="modal-card admin-membership-form luxury-membership-editor"
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

            <div className="membership-editor-head">
              <div>
                <span>
                  {editingId ? "Edit Membership" : "Create Membership"}
                </span>
                <h3>
                  {editingId ? "Sửa hạng thành viên" : "Thêm hạng thành viên"}
                </h3>
                <p>
                  Thiết lập tên hạng, điểm tối thiểu và phần trăm ưu đãi cho
                  khách hàng.
                </p>
              </div>

              <div className="membership-preview-container">
                <div className="membership-preview-label">LIVE PREVIEW</div>
                <div className={`vip-card preview ${levelClass(form.LevelName)}`}>
                  <div className="vip-card-header">
                    <div className="vip-badge-chip">
                      <div className="metallic-chip"></div>
                      <span className="vip-label">VIP TIER</span>
                    </div>
                    <div className="vip-crest">🏆</div>
                  </div>

                  <div className="vip-card-body">
                    <h3 className="vip-tier-name">{form.LevelName || "GOLD MEMBER"}</h3>
                    <div className="vip-card-number">•••• •••• •••• {editingId ? 1000 + editingId : "2026"}</div>
                  </div>

                  <div className="vip-card-footer">
                    <div className="vip-discount-badge">{form.DiscountPercent || 0}% OFF</div>
                    <div className="vip-min-points">
                      <span>MIN POINTS</span>
                      <strong>{moneyPoint(form.MinPoints || 0)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="membership-editor-layout">
              <div className="membership-editor-main">
                <div className="membership-section-title">
                  <span>1</span>
                  <div>
                    <h4>Thông tin hạng</h4>
                    <p>Đặt tên và mô tả hạng thành viên.</p>
                  </div>
                </div>

                <div className="admin-form-grid">
                  <label>
                    Tên hạng *
                    <input
                      value={form.LevelName}
                      onChange={(e) =>
                        setForm({ ...form, LevelName: e.target.value })
                      }
                      placeholder="Bronze / Silver / Gold / Diamond"
                      required
                    />
                  </label>

                  <label>
                    Giảm giá % *
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.DiscountPercent}
                      onChange={(e) =>
                        setForm({ ...form, DiscountPercent: e.target.value })
                      }
                      placeholder="10"
                      required
                    />
                  </label>

                  <label>
                    Điểm tối thiểu *
                    <input
                      type="number"
                      min="0"
                      value={form.MinPoints}
                      onChange={(e) =>
                        setForm({ ...form, MinPoints: e.target.value })
                      }
                      placeholder="1000"
                      required
                    />
                  </label>

                  <label className="admin-form-wide">
                    Mô tả
                    <textarea
                      value={form.Description}
                      onChange={(e) =>
                        setForm({ ...form, Description: e.target.value })
                      }
                      placeholder="Mô tả quyền lợi của hạng thành viên này..."
                      rows={4}
                    />
                  </label>
                </div>
              </div>

              <aside className="membership-editor-side">
                <h4>Tóm tắt cấu hình</h4>

                <div className="membership-summary-card">
                  <span>Tên hạng</span>
                  <strong>{form.LevelName || "Chưa nhập"}</strong>
                </div>

                <div className="membership-summary-card">
                  <span>Điểm tối thiểu</span>
                  <strong>{moneyPoint(form.MinPoints || 0)}</strong>
                </div>

                <div className="membership-summary-card">
                  <span>Ưu đãi giảm giá</span>
                  <strong>{form.DiscountPercent || 0}%</strong>
                </div>

                <div className="membership-summary-card">
                  <span>Mô tả ngắn</span>
                  <strong style={{ fontSize: "11px", whiteSpace: "pre-wrap" }}>
                    {form.Description || "Chưa có mô tả"}
                  </strong>
                </div>
              </aside>
            </div>

            <div className="admin-form-actions membership-editor-actions">
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
                    ? "Cập nhật membership"
                    : "Tạo membership"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
