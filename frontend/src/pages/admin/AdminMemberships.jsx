import { useEffect, useMemo, useState } from "react";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";

const DEFAULT_AVATAR = "/images/default-avatar.png";

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
    load();
  }, []);

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

      if (editingId) {
        await axiosClient.put(`/admin/memberships/${editingId}`, payload);
      } else {
        await axiosClient.post("/admin/memberships", payload);
      }

      setShowModal(false);
      await load();
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
      <div className="admin-membership-hero">
        <div>
          <div className="admin-eyebrow">Membership Management</div>
          <h1>Quản lý hạng thành viên</h1>
          <p>
            Cấu hình hạng khách hàng, điểm tối thiểu, phần trăm ưu đãi và theo
            dõi số lượng khách đang thuộc từng hạng.
          </p>
        </div>

        <button className="admin-refresh-btn" onClick={openCreate}>
          + Thêm hạng
        </button>
      </div>

      {error ? <div className="admin-error-card">{error}</div> : null}

      <div className="admin-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-icon">🏆</div>
          <div>
            <p>Tổng hạng</p>
            <h3>{stats.total}</h3>
            <span>Membership levels</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">👥</div>
          <div>
            <p>Khách đã phân hạng</p>
            <h3>{stats.customers}</h3>
            <span>Tổng customer có membership</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">%</div>
          <div>
            <p>Ưu đãi cao nhất</p>
            <h3>{stats.maxDiscount}%</h3>
            <span>DiscountPercent lớn nhất</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon">★</div>
          <div>
            <p>Mốc điểm cao nhất</p>
            <h3>{moneyPoint(stats.maxPoint)}</h3>
            <span>MinPoints lớn nhất</span>
          </div>
        </article>
      </div>

      <div className="admin-filter-panel admin-membership-filter">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm tên hạng hoặc mô tả..."
        />

        <button className="admin-refresh-btn" onClick={load}>
          Lọc
        </button>

        <button
          className="card-btn"
          onClick={() => {
            setKeyword("");
          }}
        >
          Xóa lọc
        </button>
      </div>

      {loading ? (
        <div className="admin-loading-card">Đang tải membership levels...</div>
      ) : null}

      {!loading ? (
        <div className="admin-membership-grid">
          {items.map((item, index) => (
            <article
              className={`admin-membership-card ${levelClass(item.LevelName)}`}
              key={item.MembershipLevelId}
            >
              <div className="admin-membership-medal">
                <span>#{index + 1}</span>
                <strong>{item.DiscountPercent}%</strong>
              </div>

              <div className="admin-membership-body">
                <div className="admin-membership-rank">Membership Level</div>
                <h3>{item.LevelName}</h3>
                <p>{item.Description || "Chưa có mô tả hạng thành viên."}</p>

                <div className="admin-membership-point">
                  <strong>{moneyPoint(item.MinPoints)} điểm</strong>
                  <span>điểm tối thiểu để đạt hạng</span>
                </div>

                <div className="admin-membership-info">
                  <div>
                    <span>Customer</span>
                    <strong>{item.CustomerCount || 0}</strong>
                  </div>
                  <div>
                    <span>Avg points</span>
                    <strong>{moneyPoint(item.AvgCustomerPoints || 0)}</strong>
                  </div>
                  <div>
                    <span>Total points</span>
                    <strong>{moneyPoint(item.TotalCustomerPoints || 0)}</strong>
                  </div>
                  <div>
                    <span>Discount</span>
                    <strong>{item.DiscountPercent}%</strong>
                  </div>
                </div>

                <div className="admin-card-actions">
                  <button className="card-btn" onClick={() => openDetail(item)}>
                    Chi tiết
                  </button>

                  <button
                    className="card-btn primary"
                    onClick={() => openEdit(item)}
                  >
                    Sửa
                  </button>

                  <button
                    className="card-btn danger"
                    onClick={() => remove(item)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!items.length ? (
            <div className="admin-empty">Không có membership phù hợp.</div>
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
                <strong>Điểm tối thiểu:</strong>{" "}
                {moneyPoint(selected.MinPoints)}
              </p>
              <p>
                <strong>Giảm giá:</strong> {selected.DiscountPercent}%
              </p>
              <p>
                <strong>Số customer:</strong> {selected.CustomerCount || 0}
              </p>
              <p>
                <strong>Tổng điểm:</strong>{" "}
                {moneyPoint(selected.TotalCustomerPoints || 0)}
              </p>
              <p>
                <strong>Điểm trung bình:</strong>{" "}
                {moneyPoint(selected.AvgCustomerPoints || 0)}
              </p>
            </div>

            <div className="membership-customer-box">
              <h4>Top khách hàng trong hạng này</h4>

              {loadingCustomers ? (
                <p className="admin-empty">Đang tải customer...</p>
              ) : null}

              {!loadingCustomers && customers.length ? (
                <div className="membership-customer-list">
                  {customers.map((c) => (
                    <div className="membership-customer-row" key={c.CustomerId}>
                      <img src={avatar(c.AvatarUrl)} alt={c.FullName} />
                      <div>
                        <strong>{c.FullName}</strong>
                        <span>{c.Email}</span>
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

              <div
                className={`membership-preview-card ${levelClass(form.LevelName)}`}
              >
                <small>LIVE PREVIEW</small>
                <strong>{form.LevelName || "GOLD MEMBER"}</strong>
                <b>{form.DiscountPercent || 10}% OFF</b>
                <span>{moneyPoint(form.MinPoints || 0)} điểm</span>
              </div>
            </div>

            <div className="membership-editor-layout">
              <div className="membership-editor-main">
                <div className="membership-section-title">
                  <span>01</span>
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
                    Giảm giá %
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
                  <span>Ưu đãi</span>
                  <strong>{form.DiscountPercent || 0}%</strong>
                </div>

                <div className="membership-summary-card">
                  <span>Mô tả</span>
                  <strong>{form.Description || "Chưa có mô tả"}</strong>
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
