import { useEffect, useState, useMemo } from "react";
import axiosClient from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

export default function TechnicianAttendanceManager() {
  // Tabs & selections
  const [activeSubTab, setActiveSubTab] = useState("register"); // 'register' | 'my-shifts'

  // Data states
  const [availableShifts, setAvailableShifts] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({
    registeredCount: 0,
    completedCount: 0,
    completedPercent: 0,
    totalHours: 0,
    overtimeHours: 0,
    estimatedEarnings: 0
  });

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  // Mini-calendar date selection for shift registration
  const [regDate, setRegDate] = useState(new Date());
  const [capableServices, setCapableServices] = useState([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedShiftForReg, setSelectedShiftForReg] = useState(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  // Fetch stats, shifts, registration
  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      // 1. Fetch Weekly Performance Stats
      const statsRes = await axiosClient.get("/technician/shifts/stats");
      setWeeklyStats(statsRes.data?.data || {});

      // 2. Fetch Available Open Shifts for registration
      const openShiftsRes = await axiosClient.get("/technician/shifts");
      setAvailableShifts(openShiftsRes.data?.data?.shifts || []);
      setCapableServices(openShiftsRes.data?.data?.capableServices || []);

      // 3. Fetch My Registered Shifts
      const myShiftsRes = await axiosClient.get("/technician/my-shifts");
      setMyShifts(myShiftsRes.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Không tải được dữ liệu hệ thống");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper date formatter YYYY-MM-DD
  const formatDateLocal = (dateInput) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  };

  const triggerOpenRegisterModal = (shift) => {
    setSelectedShiftForReg(shift);
    setSelectedServiceIds(capableServices.map(s => s.ServiceId)); // Default select all
    setShowRegisterModal(true);
  };

  // Register shift handler
  const handleRegisterShift = async () => {
    if (!selectedShiftForReg) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.post("/technician/shifts/register", { 
        shiftId: Number(selectedShiftForReg.ShiftId),
        serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : capableServices.map(s => s.ServiceId)
      });
      alert(res.data?.data?.message || "Đăng ký ca trực thành công!");
      setShowRegisterModal(false);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Đăng ký ca trực thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel registered shift
  const handleCancelRegistration = async (shiftId) => {
    if (!confirm("Bạn có chắc chắn muốn huỷ đăng ký ca trực này?")) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.delete(`/technician/shifts/register/${shiftId}`);
      alert(res.data?.data?.message || "Đã huỷ đăng ký ca trực thành công!");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Huỷ đăng ký ca trực thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  // Group shifts by selected registration date
  const filteredRegDateShifts = useMemo(() => {
    const selectedDateStr = formatDateLocal(regDate);
    return availableShifts.filter(s => formatDateLocal(s.ShiftDate) === selectedDateStr);
  }, [availableShifts, regDate]);

  // Mini calendar generator
  const miniCalendarDays = useMemo(() => {
    const year = regDate.getFullYear();
    const month = regDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const padDaysCount = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const days = [];
    
    for (let i = 0; i < padDaysCount; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
    
    return days;
  }, [regDate]);

  return (
    <TechnicianLayout>
      <div style={{
        padding: "24px",
        backgroundColor: "#fcfaf6",
        color: "#2d3748",
        fontFamily: "'Outfit', sans-serif",
        minHeight: "100vh"
      }}>
        {/* Header Title */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e2dcd0",
          paddingBottom: "16px",
          marginBottom: "24px"
        }}>
          <div>
            <h1 style={{ color: "#2f593a", margin: 0, fontSize: "1.8rem", fontWeight: "800" }}>📅 Lịch làm việc & Ca trực</h1>
            <p style={{ color: "#718096", margin: "4px 0 0 0", fontSize: "0.9rem" }}>Đăng ký ca trực linh hoạt và quản lý phân công làm việc</p>
          </div>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "#ffffff",
            padding: "8px 16px",
            borderRadius: "10px",
            border: "1px solid #e2dcd0"
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#48bb78", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#4a5568" }}>Hệ thống trực tuyến</span>
          </div>
        </div>

        {/* PERFORMANCE STATS ROW */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "24px"
        }}>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", padding: "20px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "0.85rem", color: "#718096", fontWeight: "bold" }}>Ca làm việc đã đăng ký (Tuần)</span>
            <div style={{ fontSize: "2rem", fontWeight: "800", color: "#2f593a", marginTop: "8px" }}>{weeklyStats.registeredCount || 0} ca</div>
          </div>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", padding: "20px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "0.85rem", color: "#718096", fontWeight: "bold" }}>Thu nhập dự kiến (Tháng)</span>
            <div style={{ fontSize: "2rem", fontWeight: "800", color: "#38a169", marginTop: "8px" }}>{Number(weeklyStats.estimatedEarnings || 0).toLocaleString()}đ</div>
          </div>
        </div>

        {/* MID GRID: SHIFT CALENDAR & TAB SELECTIONS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>

          {/* TAB VIEWS CONTAINER */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
            {/* Tabs Header */}
            <div style={{ display: "flex", borderBottom: "2px solid #edf2f7", gap: "24px", marginBottom: "20px" }}>
              <button onClick={() => setActiveSubTab("register")} style={{
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                padding: "12px 6px",
                fontSize: "0.95rem",
                fontWeight: "bold",
                cursor: "pointer",
                color: activeSubTab === "register" ? "#2f593a" : "#718096",
                borderBottom: activeSubTab === "register" ? "3px solid #2f593a" : "3px solid transparent",
                transition: "all 0.2s ease"
              }}>
                📅 Đăng ký ca trực
              </button>
              <button onClick={() => setActiveSubTab("my-shifts")} style={{
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                padding: "12px 6px",
                fontSize: "0.95rem",
                fontWeight: "bold",
                cursor: "pointer",
                color: activeSubTab === "my-shifts" ? "#2f593a" : "#718096",
                borderBottom: activeSubTab === "my-shifts" ? "3px solid #2f593a" : "3px solid transparent",
                transition: "all 0.2s ease"
              }}>
                📖 Lịch ca của tôi
              </button>
            </div>

            {/* TAB CONTENT: REGISTER SHIFTS */}
            {activeSubTab === "register" && (
              <div style={{ display: "flex", gap: "20px" }}>
                {/* Mini Calendar (Left Column) */}
                <div style={{ flex: 1.1, borderRight: "1px solid #edf2f7", paddingRight: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <b style={{ fontSize: "0.85rem" }}>
                      Tháng {String(regDate.getMonth() + 1).padStart(2, '0')}, {regDate.getFullYear()}
                    </b>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => {
                        const prev = new Date(regDate);
                        prev.setMonth(regDate.getMonth() - 1);
                        setRegDate(prev);
                      }} style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", fontWeight: "bold" }}>&lt;</button>
                      <button onClick={() => {
                        const next = new Date(regDate);
                        next.setMonth(regDate.getMonth() + 1);
                        setRegDate(next);
                      }} style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", fontWeight: "bold" }}>&gt;</button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", textAlign: "center" }}>
                    {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(h => (
                      <small key={h} style={{ fontSize: "0.7rem", color: "#a0aec0", fontWeight: "bold" }}>{h}</small>
                    ))}
                    {miniCalendarDays.map((day, idx) => {
                      if (!day) return <div key={idx} />;
                      const isSelected = day.toDateString() === regDate.toDateString();
                      const dayStr = formatDateLocal(day);
                      // Check if any open shifts exist for this day
                      const hasOpenShift = availableShifts.some(s => formatDateLocal(s.ShiftDate) === dayStr);

                      // Check if the day is in the past (before today)
                      const todayStart = new Date();
                      todayStart.setHours(0, 0, 0, 0);
                      const isPast = day < todayStart;

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (isPast) return;
                            setRegDate(day);
                          }}
                          disabled={isPast}
                          style={{
                            border: "none",
                            outline: "none",
                            backgroundColor: isSelected ? "#2f593a" : "transparent",
                            color: isPast ? "#cbd5e0" : (isSelected ? "#ffffff" : "#2d3748"),
                            borderRadius: "50%",
                            width: "32px",
                            height: "32px",
                            lineHeight: "32px",
                            fontSize: "0.8rem",
                            cursor: isPast ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            opacity: isPast ? 0.4 : 1
                          }}
                        >
                          {day.getDate()}
                          {hasOpenShift && !isSelected && !isPast && (
                            <span style={{
                              position: "absolute",
                              bottom: "3px",
                              width: "4px",
                              height: "4px",
                              borderRadius: "50%",
                              backgroundColor: "#dd6b20"
                            }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Available Shifts List for Selected Day (Right Column) */}
                <div style={{ flex: 1.3 }}>
                  <b style={{ display: "block", fontSize: "0.85rem", color: "#2f593a", marginBottom: "12px" }}>
                    Chọn ca ngày - {regDate.toLocaleDateString("vi-VN")}
                  </b>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {filteredRegDateShifts.length === 0 ? (
                      <p style={{ color: "#718096", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                        Không có ca trực nào để đăng ký trong ngày này.
                      </p>
                    ) : (
                      filteredRegDateShifts.map(s => {
                        const slotsLeft = s.MaxTechnicians - s.RegisteredCount;
                        return (
                          <div key={s.ShiftId} style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            border: "1px solid #edf2f7",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            backgroundColor: s.IsRegistered ? "rgba(72,187,120,0.04)" : "transparent"
                          }}>
                            <div>
                              <div style={{ fontWeight: "bold", fontSize: "0.85rem" }}>
                                {s.ShiftName} ({s.StartTime} - {s.EndTime})
                              </div>
                            </div>

                            {s.IsRegistered ? (
                              <span style={{ fontSize: "0.8rem", color: "#38a169", fontWeight: "bold" }}>✓ Đã đăng ký</span>
                            ) : (
                              <button onClick={() => triggerOpenRegisterModal(s)} disabled={actionLoading} style={{
                                backgroundColor: "#2f593a",
                                color: "white",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                cursor: "pointer"
                              }}>
                                Đăng ký ca
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: MY SHIFTS */}
            {activeSubTab === "my-shifts" && (
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #edf2f7", color: "#718096", textAlign: "left" }}>
                      <th style={{ padding: "8px" }}>Ngày</th>
                      <th style={{ padding: "8px" }}>Ca làm</th>
                      <th style={{ padding: "8px" }}>Thời gian</th>
                      <th style={{ padding: "8px" }}>Trạng thái</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myShifts.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#a0aec0", fontStyle: "italic" }}>
                          Bạn chưa đăng ký ca làm việc nào.
                        </td>
                      </tr>
                    ) : (
                      myShifts.map((s, idx) => {
                        const shiftDate = new Date(s.ShiftDate);
                        const isPast = shiftDate < new Date().setHours(0,0,0,0);
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #f7fafc" }}>
                            <td style={{ padding: "8px", fontWeight: "bold" }}>
                              {shiftDate.toLocaleDateString("vi-VN", { weekday: 'short', day: 'numeric', month: 'numeric' })}
                            </td>
                            <td style={{ padding: "8px" }}>
                              <div>{s.ShiftName}</div>
                              {s.ServiceNames && (
                                <div style={{ fontSize: "0.7rem", color: "#718096", marginTop: "2px" }}>
                                  Dịch vụ: <i>{s.ServiceNames}</i>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "8px" }}>{s.StartTime} - {s.EndTime}</td>
                            <td style={{ padding: "8px" }}>
                              <span style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                backgroundColor: isPast ? "#edf2f7" : "rgba(72, 187, 120, 0.15)",
                                color: isPast ? "#718096" : "#38a169"
                              }}>
                                {isPast ? "Đã qua" : "Sắp tới"}
                              </span>
                            </td>
                            <td style={{ padding: "8px", textAlign: "right" }}>
                              {!isPast && (
                                <button onClick={() => handleCancelRegistration(s.ShiftId)} disabled={actionLoading} style={{
                                  backgroundColor: "transparent",
                                  border: "1px solid #e53e3e",
                                  color: "#e53e3e",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  cursor: "pointer"
                                }}>
                                  Huỷ ca
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>

        {/* Register Modal for selecting Services */}
        {showRegisterModal && selectedShiftForReg && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
            backdropFilter: "blur(4px)"
          }}>
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              width: "420px",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              border: "1px solid #e2dcd0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #edf2f7", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, color: "#2f593a", fontSize: "1.1rem", fontWeight: "bold" }}>📅 Xác nhận đăng ký ca trực</h3>
                <button onClick={() => setShowRegisterModal(false)} style={{ border: "none", backgroundColor: "transparent", fontSize: "1.2rem", cursor: "pointer", color: "#a0aec0" }}>&times;</button>
              </div>

              <div style={{ marginBottom: "20px", padding: "16px", backgroundColor: "#fcfaf6", borderRadius: "12px", border: "1px solid #e2dcd0" }}>
                <div style={{ fontSize: "1rem", fontWeight: "bold", color: "#2f593a", marginBottom: "6px" }}>
                  {selectedShiftForReg.ShiftName}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#4a5568", marginBottom: "4px" }}>
                  ⏰ Thời gian: <b>{selectedShiftForReg.StartTime} - {selectedShiftForReg.EndTime}</b>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#4a5568" }}>
                  📆 Ngày trực: <b>{new Date(selectedShiftForReg.ShiftDate).toLocaleDateString("vi-VN")}</b>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button onClick={() => setShowRegisterModal(false)} style={{ border: "1px solid #cbd5e0", backgroundColor: "#ffffff", color: "#4a5568", padding: "10px 18px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}>
                  Đóng
                </button>
                <button onClick={handleRegisterShift} disabled={actionLoading} style={{ border: "none", backgroundColor: "#2f593a", color: "#ffffff", padding: "10px 20px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}>
                  {actionLoading ? "Đang xử lý..." : "✓ Xác nhận đăng ký ngay"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
