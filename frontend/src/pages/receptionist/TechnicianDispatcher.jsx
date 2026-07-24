import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axiosClient, { resolveFileUrl } from "../../api/axiosClient";
import ReceptionistLayout from "../../layouts/ReceptionistLayout";

const DEFAULT_AVATAR = "https://www.w3schools.com/howto/img_avatar.png";

export default function TechnicianDispatcher() {
  const [date, setDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [technicians, setTechnicians] = useState([]);
  const [workloads, setWorkloads] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Bulk Transfer States
  const [fromTechId, setFromTechId] = useState("");
  const [toTechId, setToTechId] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferReport, setTransferReport] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Load Technicians
  async function loadData() {
    try {
      setLoading(true);
      setError("");
      // Fetch all active technicians
      const res = await axiosClient.get("/receptionist/technicians");
      const list = res.data.data || res.data || [];
      setTechnicians(list);

      // Load workload details for all techs on the selected date
      const workloadMap = {};
      await Promise.all(
        list.map(async (tech) => {
          try {
            const wlRes = await axiosClient.get(
              `/receptionist/technicians/${tech.TechnicianId}/workload`,
              { params: { date } },
            );
            workloadMap[tech.TechnicianId] = wlRes.data.data || wlRes.data;
          } catch (e) {
            console.error(
              `Failed to load workload for tech #${tech.TechnicianId}:`,
              e,
            );
          }
        }),
      );
      setWorkloads(workloadMap);
    } catch (err) {
      setError(
        err.response?.data?.message || "Không tải được danh sách kỹ thuật viên",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [date]);

  // Handle Bulk Transfer Submit
  async function handleBulkTransfer(e) {
    e.preventDefault();
    if (!fromTechId || !toTechId) {
      setError("Vui lòng chọn cả kỹ thuật viên đi và nhận");
      return;
    }
    if (fromTechId === toTechId) {
      setError("Chuyên viên đi và nhận phải khác nhau");
      return;
    }

    if (
      !window.confirm(
        "Bạn có chắc muốn chuyển giao toàn bộ ca hẹn chưa hoàn tất của chuyên viên này ngày hôm nay sang chuyên viên dự phòng?",
      )
    ) {
      return;
    }

    try {
      setTransferLoading(true);
      setError("");
      setSuccess("");
      setTransferReport(null);

      const res = await axiosClient.post(
        "/receptionist/technicians/transfer-appointments",
        {
          fromTechnicianId: Number(fromTechId),
          toTechnicianId: Number(toTechId),
          date,
        },
      );

      const report = res.data.data || res.data;
      setTransferReport(report);
      setSuccess(
        `Đã hoàn tất chuyển giao! Thành công: ${report.successCount} ca, Thất bại: ${report.failedCount} ca.`,
      );
      // Reload page workloads
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Chuyển giao lịch hẹn thất bại");
    } finally {
      setTransferLoading(false);
    }
  }

  const resolveAvatar = (url) => {
    if (!url) return DEFAULT_AVATAR;
    return resolveFileUrl(url);
  };

  return (
    <ReceptionistLayout>
      <div className="disp-container">
        <style>{`
          .disp-container {
            padding: 24px;
            font-family: 'Inter', sans-serif;
            color: #374151;
          }
          .disp-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
          .disp-title h2 {
            font-size: 1.75rem;
            font-weight: 800;
            color: #111827;
            margin: 0;
          }
          .disp-title p {
            color: #6b7280;
            font-size: 0.9rem;
            margin: 4px 0 0;
          }
          .disp-controls {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .disp-date-picker {
            height: 42px;
            padding: 0 16px;
            border-radius: 10px;
            border: 1px solid #d1d5db;
            font-size: 0.95rem;
            outline: none;
            background: #fff;
          }
          .disp-btn {
            height: 42px;
            padding: 0 20px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
          }
          .disp-btn.primary {
            background: #d91f68;
            color: #fff;
          }
          .disp-btn.primary:hover {
            background: #be125c;
            transform: translateY(-1px);
          }
          .disp-btn.light {
            background: #fff;
            border: 1px solid #d1d5db;
            color: #374151;
          }
          .disp-btn.light:hover {
            background: #f9fafb;
          }
          .disp-status-alert {
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 24px;
            font-size: 0.95rem;
          }
          .disp-status-alert.error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #991b1b;
          }
          .disp-status-alert.success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
          }
          .disp-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 20px;
          }
          .disp-card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03);
            border: 1px solid #f3f4f6;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .disp-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08);
          }
          .disp-card.day-off {
            background: #f9fafb;
            opacity: 0.8;
          }
          .disp-card-header {
            padding: 20px;
            display: flex;
            align-items: center;
            gap: 16px;
            border-bottom: 1px solid #f3f4f6;
          }
          .disp-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #e5e7eb;
          }
          .disp-tech-info b {
            font-size: 1.1rem;
            color: #111827;
            display: block;
          }
          .disp-tech-info span {
            font-size: 0.8rem;
            color: #6b7280;
            display: block;
            margin-top: 2px;
          }
          .disp-workload-tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 700;
            margin-top: 8px;
          }
          .disp-workload-tag.free {
            background: #d1fae5;
            color: #065f46;
          }
          .disp-workload-tag.overloaded {
            background: #fee2e2;
            color: #991b1b;
          }
          .disp-workload-tag.consecutive {
            background: #fef3c7;
            color: #92400e;
          }
          .disp-workload-tag.off {
            background: #e5e7eb;
            color: #374151;
          }
          .disp-card-body {
            padding: 20px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
          }
          .disp-body-title {
            font-size: 0.85rem;
            font-weight: 700;
            text-transform: uppercase;
            color: #4b5563;
            letter-spacing: 0.05em;
            margin-bottom: 12px;
          }
          .disp-appt-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-grow: 1;
          }
          .disp-appt-item {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 0.85rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .disp-appt-item:hover {
            border-color: #d1d5db;
            background: #f3f4f6;
          }
          .disp-appt-time {
            font-weight: 700;
            color: #d91f68;
          }
          .disp-appt-link {
            text-decoration: none;
            color: #3b82f6;
            font-weight: 600;
          }
          .disp-appt-link:hover {
            text-decoration: underline;
          }
          .disp-empty {
            color: #9ca3af;
            font-size: 0.85rem;
            text-align: center;
            padding: 20px 0;
          }
          /* Bulk Modal */
          .disp-modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .disp-modal {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
            max-width: 550px;
            width: 95%;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .disp-form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            text-align: left;
          }
          .disp-form-group label {
            font-size: 0.85rem;
            font-weight: 600;
            color: #4b5563;
          }
          .disp-select {
            height: 42px;
            padding: 0 12px;
            border-radius: 8px;
            border: 1px solid #d1d5db;
            font-size: 0.9rem;
            outline: none;
            background: #fff;
            width: 100%;
          }
          .disp-modal-actions {
            border-top: 1px solid #e5e7eb;
            padding-top: 16px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }
          .disp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
            text-align: left;
            margin-top: 8px;
          }
          .disp-table th, .disp-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #e5e7eb;
          }
          .disp-table th {
            background: #f9fafb;
            font-weight: 700;
            color: #4b5563;
          }
        `}</style>

        {/* Header section */}
        <div className="disp-header">
          <div className="disp-title">
            <h2>Bảng Điều phối Kỹ thuật viên & Tải trọng</h2>
            <p>
              Phân công kỹ thuật viên dự phòng khi nghỉ phép hoặc xử lý các ca
              quá tải.
            </p>
          </div>

          <div className="disp-controls">
            <input
              type="date"
              className="disp-date-picker"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              className="disp-btn primary"
              type="button"
              onClick={() => {
                setTransferReport(null);
                setFromTechId("");
                setToTechId("");
                setShowTransferModal(true);
              }}
            >
              🔄 Chuyển giao hàng loạt
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="disp-status-alert error">❌ {error}</div>}
        {success && (
          <div className="disp-status-alert success">✅ {success}</div>
        )}

        {/* Report summary if transfer completed */}
        {transferReport && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px",
                fontSize: "1.1rem",
                fontWeight: "bold",
              }}
            >
              📝 Báo cáo Chuyển giao Lịch hẹn
            </h3>
            <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
              <span>
                Thành công:{" "}
                <strong style={{ color: "#166534" }}>
                  {transferReport.successCount} ca
                </strong>
              </span>
              <span>
                Bị loại trừ (thất bại):{" "}
                <strong style={{ color: "#991b1b" }}>
                  {transferReport.failedCount} ca
                </strong>
              </span>
            </div>
            {transferReport.failures && transferReport.failures.length > 0 ? (
              <div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: "bold",
                    color: "#6b7280",
                  }}
                >
                  Danh sách các ca gặp lỗi trùng lịch / thiếu kỹ năng chuyên
                  môn:
                </span>
                <table className="disp-table">
                  <thead>
                    <tr>
                      <th>Mã ca</th>
                      <th>Giờ bắt đầu</th>
                      <th>Lý do thất bại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferReport.failures.map((f, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>#{f.appointmentId}</strong>
                        </td>
                        <td className="disp-appt-time">{f.startTime}</td>
                        <td style={{ color: "#ef4444" }}>{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "#166534", fontSize: "0.875rem", margin: 0 }}>
                🎉 Tất cả các ca đã được chuyển giao an toàn không gặp xung đột
                nào.
              </p>
            )}
          </div>
        )}

        {/* Grid loading state */}
        {loading ? (
          <div
            style={{ padding: "80px 0", textAlign: "center", color: "#6b7280" }}
          >
            <span style={{ fontSize: "1.2rem" }}>
              ⏳ Đang quét tải trọng và lịch trực KTV ngày {date}...
            </span>
          </div>
        ) : (
          <div className="disp-grid">
            {technicians.map((tech) => {
              const wl = workloads[tech.TechnicianId] || {
                totalAppointments: 0,
                isOverloaded: false,
                isConsecutiveOverloaded: false,
                isDayOff: false,
                appointments: [],
              };

              let tagClass = "free";
              let tagText = "Trống / Sẵn sàng";

              if (wl.isDayOff) {
                tagClass = "off";
                tagText = "Nghỉ phép";
              } else if (wl.isOverloaded) {
                tagClass = "overloaded";
                tagText = `Quá tải ca (>=5 ca)`;
              } else if (wl.isConsecutiveOverloaded) {
                tagClass = "consecutive";
                tagText = "Quá tải liên tục";
              } else if (wl.totalAppointments > 0) {
                tagClass = "consecutive";
                tagText = `${wl.totalAppointments} ca đang bận`;
              }

              return (
                <div
                  key={tech.TechnicianId}
                  className={`disp-card ${wl.isDayOff ? "day-off" : ""}`}
                >
                  <div className="disp-card-header">
                    <img
                      className="disp-avatar"
                      src={resolveAvatar(tech.ImageUrl)}
                      alt={tech.FullName}
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_AVATAR;
                      }}
                    />
                    <div className="disp-tech-info">
                      <b>{tech.FullName}</b>
                      <span>{tech.Specialization || "Kỹ thuật viên"}</span>
                      <span className={`disp-workload-tag ${tagClass}`}>
                        {tagText}
                      </span>
                    </div>
                  </div>

                  <div className="disp-card-body">
                    <div className="disp-body-title">
                      Lịch hẹn trong ngày ({wl.totalAppointments})
                    </div>
                    {wl.appointments.length === 0 ? (
                      <div className="disp-empty">
                        {wl.isDayOff
                          ? "💤 Nghỉ phép trọn ngày"
                          : "📭 Không có lịch hẹn nào"}
                      </div>
                    ) : (
                      <ul className="disp-appt-list">
                        {wl.appointments.map((appt) => (
                          <li
                            key={appt.AppointmentId}
                            className="disp-appt-item"
                          >
                            <div>
                              <span className="disp-appt-time">
                                {String(appt.StartTime).slice(0, 5)} -{" "}
                                {String(appt.EndTime).slice(0, 5)}
                              </span>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                  marginTop: "2px",
                                }}
                              >
                                Ca hẹn #{appt.AppointmentId}
                              </div>
                            </div>
                            <Link
                              className="disp-appt-link"
                              to={`/receptionist/appointments/${appt.AppointmentId}`}
                            >
                              Chi tiết ➔
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bulk Transfer Modal */}
        {showTransferModal && (
          <div className="disp-modal-backdrop">
            <form className="disp-modal" onSubmit={handleBulkTransfer}>
              <h3
                style={{
                  margin: "0 0 4px",
                  fontSize: "1.25rem",
                  fontWeight: "bold",
                }}
              >
                Chuyển giao lịch làm việc hàng loạt
              </h3>
              <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                Hữu ích khi một kỹ thuật viên nghỉ đột xuất. Hệ thống sẽ cố gắng
                chuyển tất cả các ca hẹn của họ sang kỹ thuật viên dự phòng khả
                dụng.
              </p>

              <div className="disp-form-group">
                <label>Từ kỹ thuật viên (Đi nghỉ phép/Đột xuất vắng mặt)</label>
                <select
                  className="disp-select"
                  value={fromTechId}
                  onChange={(e) => setFromTechId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn kỹ thuật viên --</option>
                  {technicians.map((t) => (
                    <option key={t.TechnicianId} value={t.TechnicianId}>
                      {t.FullName} ({t.Specialization || "Kỹ thuật viên"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="disp-form-group">
                <label>Sang kỹ thuật viên nhận (Backup / Dự phòng trực)</label>
                <select
                  className="disp-select"
                  value={toTechId}
                  onChange={(e) => setToTechId(e.target.value)}
                  required
                >
                  <option value="">-- Chọn kỹ thuật viên --</option>
                  {technicians
                    .filter(
                      (t) => String(t.TechnicianId) !== String(fromTechId),
                    )
                    .map((t) => (
                      <option key={t.TechnicianId} value={t.TechnicianId}>
                        {t.FullName} ({t.Specialization || "Kỹ thuật viên"})
                      </option>
                    ))}
                </select>
              </div>

              <div className="disp-form-group">
                <label>Ngày chuyển giao thực tế</label>
                <input
                  type="date"
                  className="disp-select"
                  value={date}
                  disabled
                  style={{ background: "#f3f4f6", cursor: "not-allowed" }}
                />
              </div>

              <div className="disp-modal-actions">
                <button
                  className="disp-btn primary"
                  type="submit"
                  disabled={transferLoading || !fromTechId || !toTechId}
                  style={{ background: "#d91f68", color: "#fff" }}
                >
                  {transferLoading
                    ? "Đang xử lý chuyển giao..."
                    : "Xác nhận chuyển ca"}
                </button>
                <button
                  className="disp-btn light"
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                >
                  Đóng
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ReceptionistLayout>
  );
}
