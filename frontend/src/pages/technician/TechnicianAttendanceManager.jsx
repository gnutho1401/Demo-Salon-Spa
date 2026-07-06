import { useEffect, useState, useMemo } from "react";
import axiosClient from "../../api/axiosClient";
import TechnicianLayout from "../../layouts/TechnicianLayout";

export default function TechnicianAttendanceManager() {
  // Tabs & selections
  const [activeSubTab, setActiveSubTab] = useState("register"); // 'register' | 'my-shifts' | 'timesheet'
  const [timesheetFilter, setTimesheetFilter] = useState("weekly"); // 'weekly' | 'monthly'

  // Data states
  const [availableShifts, setAvailableShifts] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [timesheetData, setTimesheetData] = useState([]);
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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mini-calendar date selection for shift registration
  const [regDate, setRegDate] = useState(new Date());
  const [capableServices, setCapableServices] = useState([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [selectedShiftForReg, setSelectedShiftForReg] = useState(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);

  // Real-time ticking system clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch stats, shifts, registration, timesheet, logs
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

      // 4. Fetch Attendance Logs
      const attHistoryRes = await axiosClient.get("/attendance/my");
      setAttendanceHistory(attHistoryRes.data?.data || []);

      // 5. Fetch Timesheets based on selection
      const timesheetUrl = timesheetFilter === "weekly" ? "/timesheet/weekly" : "/timesheet/monthly";
      const timesheetRes = await axiosClient.get(timesheetUrl);
      setTimesheetData(timesheetRes.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Không tải được dữ liệu hệ thống");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timesheetFilter]);

  // Helper date formatter YYYY-MM-DD
  const formatDateLocal = (dateInput) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  };

  // Find today's shift that the technician is registered for
  const todayStr = formatDateLocal(new Date());
  const todayShift = useMemo(() => {
    return myShifts.find(s => formatDateLocal(s.ShiftDate) === todayStr);
  }, [myShifts, todayStr]);

  // Check-In handler
  const handleCheckIn = async () => {
    if (!todayShift) {
      alert("Hôm nay bạn không có ca trực nào được đăng ký!");
      return;
    }
    try {
      setActionLoading(true);
      const res = await axiosClient.post("/attendance/check-in", { shiftId: todayShift.ShiftId });
      alert(res.data?.data?.message || "Check-in thành công!");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Check-in thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  // Check-Out handler
  const handleCheckOut = async () => {
    if (!todayShift) return;
    try {
      setActionLoading(true);
      const res = await axiosClient.post("/attendance/check-out", { shiftId: todayShift.ShiftId });
      alert(res.data?.data?.message || "Check-out thành công!");
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Check-out thất bại");
    } finally {
      setActionLoading(false);
    }
  };

  const triggerOpenRegisterModal = (shift) => {
    setSelectedShiftForReg(shift);
    setSelectedServiceIds(capableServices.map(s => s.ServiceId)); // Default select all
    setShowRegisterModal(true);
  };

  // Register shift handler
  const handleRegisterShift = async () => {
    if (!selectedShiftForReg) return;
    if (selectedServiceIds.length === 0) {
      alert("Vui lòng chọn ít nhất một dịch vụ bạn sẽ làm trong ca trực này!");
      return;
    }
    try {
      setActionLoading(true);
      const res = await axiosClient.post("/technician/shifts/register", { 
        shiftId: Number(selectedShiftForReg.ShiftId),
        serviceIds: selectedServiceIds
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

  // Calculate live ticker hours today
  const liveTotalHoursToday = useMemo(() => {
    if (!todayShift || !todayShift.CheckInTime) return "--:--";
    if (todayShift.CheckOutTime) {
      return `${todayShift.CheckOutTime} (Đã ra ca)`;
    }
    const [inH, inM] = todayShift.CheckInTime.split(":").map(Number);
    const inDate = new Date();
    inDate.setHours(inH, inM, 0);

    const diffMs = currentTime - inDate;
    if (diffMs < 0) return "0h 00m";
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }, [todayShift, currentTime]);

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
            <h1 style={{ color: "#2f593a", margin: 0, fontSize: "1.8rem", fontWeight: "800" }}>⏰ Ca làm & Chấm công</h1>
            <p style={{ color: "#718096", margin: "4px 0 0 0", fontSize: "0.9rem" }}>Hệ thống quản lý ca trực độc lập, chấm công thực tế, tính giờ làm SaaS</p>
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
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px"
        }}>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", padding: "18px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "bold" }}>Ca đã đăng ký (Tuần)</span>
            <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#2f593a", marginTop: "8px" }}>{weeklyStats.registeredCount} ca</div>
          </div>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", padding: "18px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "bold" }}>Ca hoàn thành (Chấm công)</span>
            <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#319795", marginTop: "8px" }}>{weeklyStats.completedCount} ca</div>
            <small style={{ color: "#319795", fontSize: "0.75rem", fontWeight: "bold" }}>{weeklyStats.completedPercent}% hoàn tất</small>
          </div>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", padding: "18px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "bold" }}>Tổng giờ làm thực tế</span>
            <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#d69e2e", marginTop: "8px" }}>{weeklyStats.totalHours}h</div>
          </div>
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", padding: "18px", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "0.8rem", color: "#718096", fontWeight: "bold" }}>Thu nhập dự kiến (Tháng)</span>
            <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "#38a169", marginTop: "8px" }}>{Number(weeklyStats.estimatedEarnings || 0).toLocaleString()}đ</div>
          </div>
        </div>

        {/* MID GRID: LIVE ATTENDANCE LOG / PUNCH CARD & TAB SELECTIONS */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 2.3fr", gap: "24px", alignItems: "start", marginBottom: "24px" }}>
          
          {/* CHẤM CÔNG HÔM NAY (PUNCH CARD) */}
          <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
            <h3 style={{ color: "#2f593a", margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: "bold", borderBottom: "1px solid #edf2f7", paddingBottom: "10px" }}>
              🕒 Chấm công Hôm nay
            </h3>

            {/* Real-time Digital Clock */}
            <div style={{
              textAlign: "center",
              padding: "16px 0",
              fontSize: "2rem",
              fontWeight: "800",
              color: "#2f593a",
              letterSpacing: "2px",
              fontFamily: "'Courier New', Courier, monospace",
              backgroundColor: "#f7f9f6",
              borderRadius: "10px",
              border: "1px solid #e2dcd0",
              marginBottom: "16px"
            }}>
              {currentTime.toLocaleTimeString("vi-VN")}
            </div>

            {/* Today Shift Info */}
            <div style={{
              backgroundColor: "#fcfaf6",
              border: "1px solid #e2dcd0",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px"
            }}>
              {todayShift ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b style={{ color: "#2f593a", fontSize: "0.95rem" }}>{todayShift.ShiftName}</b>
                    <span style={{ fontSize: "0.75rem", backgroundColor: "#e2e8f0", padding: "2px 6px", borderRadius: "4px" }}>
                      Đăng ký ca trực
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "#4a5568" }}>
                    Thời gian: {todayShift.StartTime} - {todayShift.EndTime}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px", borderTop: "1px solid #e2dcd0", paddingTop: "12px" }}>
                    <div>
                      <small style={{ color: "#718096", fontSize: "0.75rem", display: "block" }}>Giờ vào</small>
                      <b style={{ fontSize: "0.9rem" }}>{todayShift.CheckInTime || "--:--"}</b>
                    </div>
                    <div>
                      <small style={{ color: "#718096", fontSize: "0.75rem", display: "block" }}>Giờ ra</small>
                      <b style={{ fontSize: "0.9rem" }}>{todayShift.CheckOutTime || "--:--"}</b>
                    </div>
                  </div>
                  <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "#718096" }}>
                    Tổng thời gian làm việc: <b style={{ color: "#2f593a" }}>{liveTotalHoursToday}</b>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, color: "#718096", fontSize: "0.85rem", fontStyle: "italic", textAlign: "center" }}>
                  ❌ Hôm nay bạn không có lịch trực ca trực nào. Vui lòng đăng ký ca trực ở bảng bên cạnh.
                </p>
              )}
            </div>

            {/* Check-In / Check-Out Actions */}
            {todayShift ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {!todayShift.CheckInTime && (
                  <button onClick={handleCheckIn} disabled={actionLoading} style={{
                    width: "100%",
                    backgroundColor: "#2f593a",
                    color: "white",
                    padding: "14px",
                    borderRadius: "10px",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(47, 89, 58, 0.25)"
                  }}>
                    🟢 CHECK-IN VÀO CA
                  </button>
                )}

                {todayShift.CheckInTime && !todayShift.CheckOutTime && (
                  <button onClick={handleCheckOut} disabled={actionLoading} style={{
                    width: "100%",
                    backgroundColor: "#c53030",
                    color: "white",
                    padding: "14px",
                    borderRadius: "10px",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(197, 48, 48, 0.25)"
                  }}>
                    🔴 CHECK-OUT RA CA
                  </button>
                )}

                {todayShift.CheckInTime && todayShift.CheckOutTime && (
                  <div style={{
                    padding: "12px",
                    backgroundColor: "rgba(72, 187, 120, 0.1)",
                    color: "#38a169",
                    border: "1px dashed #38a169",
                    borderRadius: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    fontSize: "0.9rem"
                  }}>
                    🎉 Bạn đã hoàn tất chấm công cho ngày hôm nay!
                  </div>
                )}
              </div>
            ) : null}
          </div>

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
              <button onClick={() => setActiveSubTab("timesheet")} style={{
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                padding: "12px 6px",
                fontSize: "0.95rem",
                fontWeight: "bold",
                cursor: "pointer",
                color: activeSubTab === "timesheet" ? "#2f593a" : "#718096",
                borderBottom: activeSubTab === "timesheet" ? "3px solid #2f593a" : "3px solid transparent",
                transition: "all 0.2s ease"
              }}>
                📊 Thống kê giờ làm (Timesheet)
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

                      return (
                        <button
                          key={idx}
                          onClick={() => setRegDate(day)}
                          style={{
                            border: "none",
                            outline: "none",
                            backgroundColor: isSelected ? "#2f593a" : "transparent",
                            color: isSelected ? "#ffffff" : "#2d3748",
                            borderRadius: "50%",
                            width: "32px",
                            height: "32px",
                            lineHeight: "32px",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative"
                          }}
                        >
                          {day.getDate()}
                          {hasOpenShift && !isSelected && (
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
                              <span style={{ fontSize: "0.75rem", color: "#718096" }}>
                                Trực: {s.RegisteredCount}/{s.MaxTechnicians} chỗ • <b>Còn {slotsLeft} chỗ trống</b>
                              </span>
                            </div>

                            {s.IsRegistered ? (
                              <span style={{ fontSize: "0.8rem", color: "#38a169", fontWeight: "bold" }}>✓ Đã đăng ký</span>
                            ) : s.Status === 'CLOSED' || slotsLeft <= 0 ? (
                              <span style={{ fontSize: "0.8rem", color: "#a0aec0" }}>Hết chỗ</span>
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

            {/* TAB CONTENT: TIMESHEET REPORTS */}
            {activeSubTab === "timesheet" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <b style={{ fontSize: "0.85rem" }}>Thống kê tổng giờ làm việc thực tế</b>
                  <div style={{ display: "flex", backgroundColor: "#edf2f7", borderRadius: "8px", padding: "2px" }}>
                    <button onClick={() => setTimesheetFilter("weekly")} style={{
                      border: "none",
                      outline: "none",
                      backgroundColor: timesheetFilter === 'weekly' ? "#ffffff" : "transparent",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}>
                      Xem theo Tuần
                    </button>
                    <button onClick={() => setTimesheetFilter("monthly")} style={{
                      border: "none",
                      outline: "none",
                      backgroundColor: timesheetFilter === 'monthly' ? "#ffffff" : "transparent",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}>
                      Xem theo Tháng
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #edf2f7", color: "#718096", textAlign: "left" }}>
                        <th style={{ padding: "8px" }}>Ngày</th>
                        <th style={{ padding: "8px" }}>Số ca hoàn thành</th>
                        <th style={{ padding: "8px", textAlign: "right" }}>Tổng số giờ làm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timesheetData.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: "20px", textAlign: "center", color: "#a0aec0", fontStyle: "italic" }}>
                            Không tìm thấy dữ liệu chấm công cho khoảng thời gian này.
                          </td>
                        </tr>
                      ) : (
                        timesheetData.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f7fafc" }}>
                            <td style={{ padding: "8px" }}>
                              {new Date(row.ShiftDate).toLocaleDateString("vi-VN", { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })}
                            </td>
                            <td style={{ padding: "8px" }}>{row.ShiftsCompleted} ca trực</td>
                            <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", color: "#2f593a" }}>
                              {row.TotalHours.toFixed(2)}h
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* BOTTOM SECTION: LỊCH SỬ CHẤM CÔNG */}
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2dcd0", borderRadius: "16px", padding: "24px", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
          <h3 style={{ color: "#2f593a", margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: "bold" }}>
            📋 Nhật ký lịch sử Chấm công chi tiết
          </h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #edf2f7", color: "#718096", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>Ngày trực</th>
                  <th style={{ padding: "10px" }}>Tên ca</th>
                  <th style={{ padding: "10px" }}>Giờ ca</th>
                  <th style={{ padding: "10px" }}>Giờ Check-in thực tế</th>
                  <th style={{ padding: "10px" }}>Giờ Check-out thực tế</th>
                  <th style={{ padding: "10px" }}>Tổng giờ làm</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "20px 0", textAlign: "center", color: "#a0aec0", fontStyle: "italic" }}>
                      Chưa có nhật ký chấm công thực tế nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  attendanceHistory.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f7fafc" }}>
                      <td style={{ padding: "10px", fontWeight: "bold" }}>
                        {new Date(row.ShiftDate).toLocaleDateString("vi-VN", { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: "10px" }}>{row.ShiftName}</td>
                      <td style={{ padding: "10px" }}>{row.StartTime} - {row.EndTime}</td>
                      <td style={{ padding: "10px" }}>{row.CheckInTime || "---"}</td>
                      <td style={{ padding: "10px" }}>{row.CheckOutTime || "---"}</td>
                      <td style={{ padding: "10px", fontWeight: "bold" }}>
                        {row.TotalHours !== null ? `${row.TotalHours}h` : "---"}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "bold",
                          backgroundColor: row.Status === 'ACTIVE' ? "rgba(221, 107, 32, 0.15)" : "rgba(72, 187, 120, 0.15)",
                          color: row.Status === 'ACTIVE' ? "#dd6b20" : "#38a169"
                        }}>
                          {row.Status === 'ACTIVE' ? "Đang trực" : "Hoàn thành"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
              width: "480px",
              padding: "24px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
              border: "1px solid #e2dcd0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #edf2f7", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, color: "#2f593a", fontSize: "1.15rem", fontWeight: "bold" }}>💼 Chọn dịch vụ cho ca trực</h3>
                <button onClick={() => setShowRegisterModal(false)} style={{ border: "none", backgroundColor: "transparent", fontSize: "1.2rem", cursor: "pointer", color: "#a0aec0" }}>&times;</button>
              </div>

              <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#fcfaf6", borderRadius: "10px", border: "1px solid #e2dcd0" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#2f593a" }}>
                  {selectedShiftForReg.ShiftName}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#718096", marginTop: "4px" }}>
                  Thời gian: {selectedShiftForReg.StartTime} - {selectedShiftForReg.EndTime} | Ngày: {new Date(selectedShiftForReg.ShiftDate).toLocaleDateString("vi-VN")}
                </div>
              </div>

              <div style={{ marginBottom: "12px", fontSize: "0.85rem", fontWeight: "bold", color: "#4a5568" }}>
                Dịch vụ bạn làm trong ca trực này:
              </div>

              <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                {capableServices.length === 0 ? (
                  <p style={{ fontSize: "0.8rem", color: "#e53e3e", fontStyle: "italic" }}>Bạn chưa có cấu hình dịch vụ làm việc được gán. Vui lòng liên hệ quản lý.</p>
                ) : (
                  capableServices.map(s => {
                    const isChecked = selectedServiceIds.includes(s.ServiceId);
                    return (
                      <label key={s.ServiceId} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #edf2f7", cursor: "pointer", backgroundColor: isChecked ? "rgba(47, 89, 58, 0.03)" : "transparent" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedServiceIds(prev => [...prev, s.ServiceId]);
                            } else {
                              setSelectedServiceIds(prev => prev.filter(id => id !== s.ServiceId));
                            }
                          }}
                          style={{ accentColor: "#2f593a", width: "16px", height: "16px" }}
                        />
                        <span style={{ fontSize: "0.85rem" }}>{s.ServiceName}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button onClick={() => setShowRegisterModal(false)} style={{ border: "1px solid #cbd5e0", backgroundColor: "#ffffff", color: "#4a5568", padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}>
                  Huỷ bỏ
                </button>
                <button onClick={handleRegisterShift} disabled={actionLoading} style={{ border: "none", backgroundColor: "#2f593a", color: "#ffffff", padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer" }}>
                  Xác nhận đăng ký ca
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
