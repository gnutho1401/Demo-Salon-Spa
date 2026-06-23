import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

const QUICK_SUGGESTIONS = [
  'Tôi muốn tư vấn dịch vụ chăm sóc da',
  'Giá dịch vụ nail bao nhiêu?',
  'Hướng dẫn đặt lịch hẹn',
  'Dịch vụ nào phù hợp lần đầu?',
  'Có combo nào đang giảm giá không?',
];

/** Simple markdown-like formatting */
function formatAIText(text) {
  if (!text) return '';
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>');

  // Replace [Đặt lịch: Tên dịch vụ | ID | Stylist: Tên kỹ thuật viên | EmployeeID] with direct combined booking buttons
  formatted = formatted.replace(
    /\[Đặt lịch:\s*(.*?)\s*\|\s*(\d+)\s*\|\s*Stylist:\s*(.*?)\s*\|\s*(\d+)\s*\]/g,
    '<a href="/customer/booking?serviceId=$2&employeeId=$4" class="chat-booking-btn">📅 Đặt lịch: $1 cùng $3</a>'
  );

  // Replace [Đặt lịch: Tên dịch vụ | ID] with direct booking buttons
  formatted = formatted.replace(
    /\[Đặt lịch:\s*(.*?)\s*\|\s*(\d+)\s*\]/g,
    '<a href="/customer/booking?serviceId=$2" class="chat-booking-btn">📅 Đặt lịch: $1</a>'
  );

  return formatted;
}

function parseMessageWidget(text) {
  if (!text) return null;
  const match = text.match(/\[\[WIDGET:([^\]]+)\]\]/);
  if (!match) return null;

  const parts = match[1].split('|');
  const type = parts[0];
  const args = parts.slice(1);
  return { type, args, rawTag: match[0] };
}

function AiChatWidget({ type, args }) {
  const navigate = useNavigate();

  // Widget 1: MY_APPOINTMENTS
  if (type === 'MY_APPOINTMENTS') {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [msg, setMsg] = useState('');

    // Reschedule states
    const [reschedulingAptId, setReschedulingAptId] = useState(null);
    const [rescheduleInfo, setRescheduleInfo] = useState(null);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [rescheduleSelectedEmployeeId, setRescheduleSelectedEmployeeId] = useState('');
    const [rescheduleSelectedDate, setRescheduleSelectedDate] = useState('');
    const [rescheduleSlots, setRescheduleSlots] = useState([]);
    const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
    const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState('');
    const [rescheduleActionLoading, setRescheduleActionLoading] = useState(false);
    const [rescheduleError, setRescheduleError] = useState('');

    const dateOptions = [];
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateOptions.push({
        date: `${yyyy}-${mm}-${dd}`,
        label: `${i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : 'Ngày kia'} (${dd}/${mm})`
      });
    }

    const loadApts = async () => {
      try {
        setLoading(true);
        const res = await axiosClient.get('/appointments/my');
        const active = (res.data.data || res.data || []).filter(
          a => a.Status === 'PENDING' || a.Status === 'CONFIRMED' || a.Status === 'PENDING_PAYMENT'
        );
        setAppointments(active);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadApts();
    }, []);

    const handleCancel = async (id) => {
      if (!window.confirm('Bạn có chắc chắn muốn hủy lịch hẹn này?')) return;
      try {
        setActionLoading(id);
        await axiosClient.delete(`/appointments/${id}`);
        setMsg('Đã hủy lịch hẹn thành công!');
        loadApts();
      } catch (err) {
        alert(err.response?.data?.message || 'Không thể hủy lịch hẹn.');
      } finally {
        setActionLoading(null);
      }
    };

    const startReschedule = async (apt) => {
      setReschedulingAptId(apt.AppointmentId);
      setRescheduleError('');
      setRescheduleSelectedSlot('');
      setRescheduleSelectedDate(dateOptions[0].date);
      try {
        setRescheduleLoading(true);
        const res = await axiosClient.get(`/appointments/${apt.AppointmentId}/reschedule`);
        const info = res.data?.data || res.data || {};
        setRescheduleInfo(info);
        setRescheduleSelectedEmployeeId(String(info.EmployeeId || ''));
      } catch (err) {
        setRescheduleError('Không lấy được thông tin đổi lịch.');
      } finally {
        setRescheduleLoading(false);
      }
    };

    useEffect(() => {
      const loadRescheduleSlots = async () => {
        if (!reschedulingAptId || !rescheduleInfo || !rescheduleSelectedEmployeeId || !rescheduleSelectedDate) return;
        try {
          setRescheduleSlotsLoading(true);
          setRescheduleSelectedSlot('');
          const res = await axiosClient.get('/appointments/available-slots', {
            params: {
              serviceId: rescheduleInfo.ServiceId,
              employeeId: rescheduleSelectedEmployeeId,
              appointmentDate: rescheduleSelectedDate,
              excludeAppointmentId: reschedulingAptId
            }
          });
          const data = res.data.data;
          const slotsList = data && typeof data === 'object' && !Array.isArray(data) ? data.slots : data;
          setRescheduleSlots(slotsList || []);
        } catch (err) {
          setRescheduleSlots([]);
        } finally {
          setRescheduleSlotsLoading(false);
        }
      };
      loadRescheduleSlots();
    }, [reschedulingAptId, rescheduleInfo, rescheduleSelectedEmployeeId, rescheduleSelectedDate]);

    const confirmReschedule = async () => {
      if (!rescheduleSelectedSlot) return;
      try {
        setRescheduleActionLoading(true);
        setRescheduleError('');
        await axiosClient.post(`/appointments/${reschedulingAptId}/reschedule`, {
          appointmentDate: rescheduleSelectedDate,
          employeeId: Number(rescheduleSelectedEmployeeId),
          startTime: rescheduleSelectedSlot.length === 5 ? `${rescheduleSelectedSlot}:00` : rescheduleSelectedSlot,
          reason: 'Đổi lịch hẹn qua AI Assistant'
        });
        setMsg('Đã đổi lịch hẹn thành công!');
        setReschedulingAptId(null);
        setRescheduleInfo(null);
        loadApts();
      } catch (err) {
        setRescheduleError(err.response?.data?.message || 'Không thể đổi lịch hẹn.');
      } finally {
        setRescheduleActionLoading(false);
      }
    };

    if (loading) return <div className="ai-chat-widget">⌛ Đang tải lịch hẹn...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">📅 Lịch hẹn của bạn</div>
        {msg && <div style={{ color: '#2e7d32', fontSize: 12, marginBottom: 8 }}>{msg}</div>}
        {appointments.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Bạn không có lịch hẹn nào sắp tới.</div>
        ) : (
          <div className="ai-widget-apt-list">
            {appointments.map(a => (
              <div className="ai-widget-apt-item" key={a.AppointmentId} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div className="ai-widget-apt-info">
                    <strong>{a.ServiceName}</strong>
                    <span>Stylist: {a.EmployeeFullName || a.EmployeeName || 'Bất kỳ'}</span>
                    <span>Thời gian: {new Date(a.AppointmentDate).toLocaleDateString('vi-VN')} lúc {a.StartTime?.slice(0, 5)}</span>
                  </div>
                  {reschedulingAptId !== a.AppointmentId && (
                    <div className="ai-widget-apt-action" style={{ display: 'flex', gap: 6 }}>
                      <button 
                        style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                        onClick={() => startReschedule(a)}
                      >
                        Đổi lịch
                      </button>
                      <button 
                        disabled={actionLoading === a.AppointmentId}
                        onClick={() => handleCancel(a.AppointmentId)}
                        style={{ padding: '6px 12px', fontSize: 11, borderRadius: 8, border: 'none', background: '#ffe5ec', color: '#d81b60', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {actionLoading === a.AppointmentId ? '...' : 'Hủy'}
                      </button>
                    </div>
                  )}
                </div>

                {reschedulingAptId === a.AppointmentId && (
                  <div className="ai-widget-reschedule-panel" style={{ borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10 }}>
                    <div className="ai-widget-reschedule-title" style={{ fontSize: 12, fontWeight: 700, color: '#ff4778', marginBottom: 8 }}>
                      🔄 Chọn thời gian đổi lịch mới
                    </div>
                    {rescheduleLoading ? (
                      <div style={{ fontSize: 12, color: '#666' }}>⌛ Đang tải thông tin dịch vụ...</div>
                    ) : (
                      <>
                        {/* Date Selection */}
                        <div className="ai-widget-date-selector">
                          {dateOptions.map(opt => (
                            <button
                              key={opt.date}
                              className={`ai-date-chip ${rescheduleSelectedDate === opt.date ? 'active' : ''}`}
                              onClick={() => setRescheduleSelectedDate(opt.date)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Stylist Selection */}
                        {rescheduleInfo?.AvailableEmployees?.length > 0 && (
                          <div className="ai-widget-employee-selector-wrapper" style={{ marginTop: 8 }}>
                            <label className="ai-widget-label">Chọn Stylist:</label>
                            <div className="ai-widget-employee-list">
                              {rescheduleInfo.AvailableEmployees.map(emp => (
                                <div
                                  key={emp.EmployeeId}
                                  className={`ai-employee-card ${String(rescheduleSelectedEmployeeId) === String(emp.EmployeeId) ? 'active' : ''}`}
                                  onClick={() => setRescheduleSelectedEmployeeId(String(emp.EmployeeId))}
                                >
                                  <img 
                                    src={emp.ImageUrl || '/default-avatar.png'} 
                                    alt={emp.EmployeeName} 
                                    className="ai-employee-avatar" 
                                  />
                                  <div className="ai-employee-info">
                                    <span className="ai-employee-name">{emp.EmployeeName}</span>
                                    <span className="ai-employee-rating">⭐️ {Number(emp.AverageRating || 0).toFixed(1)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {rescheduleError && <div style={{ color: '#d32f2f', fontSize: 12, marginTop: 8 }}>{rescheduleError}</div>}

                        {/* Slots */}
                        <div className="ai-widget-slots-section" style={{ marginTop: 8 }}>
                          {rescheduleSlotsLoading ? (
                            <div className="ai-widget-slots-loading">⌛ Đang tìm giờ trống...</div>
                          ) : rescheduleSlots.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6b4f5a', padding: '6px 0' }}>
                              Không có khung giờ trực trống. Vui lòng chọn Stylist hoặc Ngày khác!
                            </div>
                          ) : (
                            <div className="ai-widget-slot-grid">
                              {rescheduleSlots.map(s => {
                                const timeStr = String(s.startTime || s).slice(0, 5);
                                return (
                                  <button 
                                    key={timeStr}
                                    className={`ai-widget-slot-btn ${rescheduleSelectedSlot === timeStr ? 'selected' : ''}`}
                                    onClick={() => setRescheduleSelectedSlot(timeStr)}
                                  >
                                    {timeStr}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Confirm / Close */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
                          <button
                            className="ai-widget-btn-secondary"
                            style={{ background: '#eee', color: '#666', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                            onClick={() => {
                              setReschedulingAptId(null);
                              setRescheduleInfo(null);
                            }}
                          >
                            Đóng
                          </button>
                          {rescheduleSelectedSlot && (
                            <button
                              disabled={rescheduleActionLoading}
                              className="ai-widget-btn-primary"
                              style={{ background: '#ff4778', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                              onClick={confirmReschedule}
                            >
                              {rescheduleActionLoading ? 'Đang cập nhật...' : `Xác nhận đổi sang ${rescheduleSelectedSlot}`}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget 2: MY_VOUCHERS
  if (type === 'MY_VOUCHERS') {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState('');

    useEffect(() => {
      const loadVouchers = async () => {
        try {
          const res = await axiosClient.get('/vouchers/my');
          const data = res.data.data || res.data || [];
          const active = data.filter(v => !v.UsedStatus && v.Status === 'ACTIVE');
          setVouchers(active);
        } catch {
          // silent
        } finally {
          setLoading(false);
        }
      };
      loadVouchers();
    }, []);

    const handleCopy = (code) => {
      navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(''), 2000);
    };

    if (loading) return <div className="ai-chat-widget">⌛ Đang tải voucher...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">🎁 Voucher của bạn</div>
        {vouchers.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Bạn chưa có voucher nào khả dụng.</div>
        ) : (
          <div className="ai-widget-vch-list">
            {vouchers.map(v => (
              <div className="ai-widget-vch-card" key={v.VoucherId}>
                <strong>{v.DiscountType === 'PERCENT' ? `Giảm ${v.DiscountValue}%` : `Giảm ${Number(v.DiscountValue).toLocaleString('vi-VN')}đ`}</strong>
                <span className="code" onClick={() => handleCopy(v.Code)}>
                  {copied === v.Code ? 'Đã copy!' : v.Code}
                </span>
                <span className="exp">HSD: {v.EndDate ? new Date(v.EndDate).toLocaleDateString('vi-VN') : 'Không hạn'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget 3: SLOTS
  if (type === 'SLOTS') {
    const serviceId = args[0];
    const initialEmployeeId = args[1];
    const initialDate = args[2];

    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
    const [selectedDate, setSelectedDate] = useState('');
    const [slots, setSlots] = useState([]);
    const [loadingEmployees, setLoadingEmployees] = useState(true);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [notes, setNotes] = useState('');
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [aptId, setAptId] = useState(null);
    const [error, setError] = useState('');

    // Generate date options for next 3 days
    const dateOptions = [];
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      let label = '';
      if (i === 0) label = 'Hôm nay';
      else if (i === 1) label = 'Ngày mai';
      else if (i === 2) label = 'Ngày kia';
      
      dateOptions.push({
        date: dateStr,
        label: `${label} (${dd}/${mm})`
      });
    }

    // Set initial date
    useEffect(() => {
      if (initialDate && initialDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setSelectedDate(initialDate);
      } else {
        setSelectedDate(dateOptions[0].date);
      }
    }, [initialDate]);

    // Load employees for service
    useEffect(() => {
      const loadEmployees = async () => {
        if (!serviceId) return;
        try {
          setLoadingEmployees(true);
          const res = await axiosClient.get(`/employees/by-service/${serviceId}`);
          const list = res.data?.data || [];
          setEmployees(list);
          // If no initial employee, or suggested employee not in list, select the first one
          if (!selectedEmployeeId || !list.some(e => String(e.EmployeeId) === String(selectedEmployeeId))) {
            if (list.length > 0) {
              setSelectedEmployeeId(String(list[0].EmployeeId));
            }
          }
        } catch (err) {
          console.error("Failed to load employees for service", err);
        } finally {
          setLoadingEmployees(false);
        }
      };
      loadEmployees();
    }, [serviceId]);

    // Fetch slots when employee or date changes
    useEffect(() => {
      const loadSlots = async () => {
        if (!serviceId || !selectedEmployeeId || !selectedDate) return;
        try {
          setLoadingSlots(true);
          setSelectedSlot('');
          const res = await axiosClient.get('/appointments/available-slots', {
            params: { 
              serviceId, 
              employeeId: selectedEmployeeId, 
              appointmentDate: selectedDate 
            }
          });
          const data = res.data.data;
          const slotsList = data && typeof data === 'object' && !Array.isArray(data) ? data.slots : data;
          setSlots(slotsList || []);
        } catch (err) {
          setSlots([]);
        } finally {
          setLoadingSlots(false);
        }
      };
      loadSlots();
    }, [serviceId, selectedEmployeeId, selectedDate]);

    const handleConfirmBooking = async () => {
      if (!selectedSlot) return;
      try {
        setBookingLoading(true);
        setError('');

        const payload = {
          serviceId: Number(serviceId),
          employeeId: Number(selectedEmployeeId),
          appointmentDate: selectedDate,
          startTime: selectedSlot.length === 5 ? `${selectedSlot}:00` : selectedSlot,
          notes: notes
        };

        const res = await axiosClient.post('/appointments', payload);
        const data = res.data.data;
        const newAptId = data.AppointmentId || data.appointmentId || data.id;

        setAptId(newAptId);
        setBookingSuccess(true);
      } catch (err) {
        setError(err.response?.data?.message || 'Đặt lịch thất bại.');
      } finally {
        setBookingLoading(false);
      }
    };

    if (loadingEmployees) return <div className="ai-chat-widget">⌛ Đang chuẩn bị dịch vụ...</div>;
    if (bookingSuccess) {
      return (
        <div className="ai-chat-widget">
          <div className="ai-widget-success">
            <span>🎉 Đặt lịch hẹn thành công lúc {selectedSlot} ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}!</span>
            <button 
              className="ai-widget-success-btn" 
              onClick={() => navigate(`/customer/payment/${aptId}?discount=0`)}
            >
              💳 Đến trang thanh toán
            </button>
          </div>
        </div>
      );
    }

    const selectedEmployee = employees.find(e => String(e.EmployeeId) === String(selectedEmployeeId));

    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">🕒 Chọn giờ hẹn trực tiếp</div>
        
        {/* Date chip selector */}
        <div className="ai-widget-date-selector">
          {dateOptions.map(opt => (
            <button
              key={opt.date}
              className={`ai-date-chip ${selectedDate === opt.date ? 'active' : ''}`}
              onClick={() => setSelectedDate(opt.date)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Stylist Selector */}
        {employees.length > 0 && (
          <div className="ai-widget-employee-selector-wrapper">
            <label className="ai-widget-label">Chọn Stylist:</label>
            <div className="ai-widget-employee-list">
              {employees.map(emp => (
                <div
                  key={emp.EmployeeId}
                  className={`ai-employee-card ${String(selectedEmployeeId) === String(emp.EmployeeId) ? 'active' : ''}`}
                  onClick={() => setSelectedEmployeeId(String(emp.EmployeeId))}
                >
                  <img src={emp.ImageUrl || '/default-avatar.png'} alt={emp.FullName} className="ai-employee-avatar" />
                  <div className="ai-employee-info">
                    <span className="ai-employee-name">{emp.FullName}</span>
                    <span className="ai-employee-rating">⭐️ {Number(emp.AverageRating || 0).toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: '#d32f2f', fontSize: 12, marginBottom: 8, marginTop: 8 }}>{error}</div>}

        {/* Slots selection */}
        <div className="ai-widget-slots-section">
          {loadingSlots ? (
            <div className="ai-widget-slots-loading">⌛ Đang tìm giờ trống...</div>
          ) : slots.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b4f5a', padding: '10px 0' }}>
              Không có giờ trống cho Stylist {selectedEmployee?.FullName || ''} vào ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}. Vui lòng chọn Stylist hoặc Ngày khác!
            </div>
          ) : (
            <>
              <div className="ai-widget-slot-grid">
                {slots.map(s => {
                  const timeStr = String(s.startTime || s).slice(0, 5);
                  return (
                    <button 
                      key={timeStr}
                      className={`ai-widget-slot-btn ${selectedSlot === timeStr ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(timeStr)}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
              {selectedSlot && (
                <div className="ai-widget-booking-form">
                  <input 
                    type="text" 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ghi chú cho stylist (không bắt buộc)..."
                  />
                  <button 
                    disabled={bookingLoading}
                    onClick={handleConfirmBooking}
                  >
                    {bookingLoading ? 'Đang đặt lịch...' : `🚀 Đặt lịch lúc ${selectedSlot}`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Widget 4: SERVICE_HISTORY
  if (type === 'SERVICE_HISTORY') {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const loadHistory = async () => {
        try {
          const res = await axiosClient.get('/customers/me/service-history');
          const data = res.data.data || res.data || {};
          setHistory(data.items || []);
        } catch {
          // silent
        } finally {
          setLoading(false);
        }
      };
      loadHistory();
    }, []);

    if (loading) return <div className="ai-chat-widget">⌛ Đang tải lịch sử dịch vụ...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">📜 Lịch sử dịch vụ đã dùng</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Bạn chưa hoàn thành dịch vụ nào trên hệ thống.</div>
        ) : (
          <div className="ai-widget-hist-list">
            {history.map((h, i) => (
              <div className="ai-widget-hist-item" key={h.AppointmentId || i}>
                <div className="ai-widget-hist-info">
                  <strong>{h.ServiceName}</strong>
                  <span>Stylist: {h.EmployeeName || 'Bất kỳ'} · Chi nhánh: {h.BranchName}</span>
                  <span>Thời gian: {new Date(h.AppointmentDate).toLocaleDateString('vi-VN')}</span>
                </div>
                <div>
                  <b style={{ fontSize: 12, color: '#ff4778' }}>{Number(h.Price || 0).toLocaleString('vi-VN')}đ</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const load = async () => {
    try {
      const [recRes, chatRes] = await Promise.all([
        axiosClient.get('/ai/my/recommendations'),
        axiosClient.get('/ai/my/chat'),
      ]);
      setRecommendations(recRes.data.data || recRes.data || []);
      setMessages(chatRes.data.data || chatRes.data || []);
    } catch {
      // silent
    }
  };

  useEffect(() => { load(); }, []);

  const ask = async (text) => {
    const q = (text || question).trim();
    if (!q) return;
    setError('');

    // Optimistic: show user message immediately
    const tempMsg = { ChatId: `temp-${Date.now()}`, Question: q, Answer: null, CreatedAt: new Date().toISOString() };
    setMessages((prev) => [...prev, tempMsg]);
    setQuestion('');
    inputRef.current?.focus();

    try {
      setLoading(true);
      const res = await axiosClient.post('/ai/chat', { question: q });
      const data = res.data.data;
      // Replace temp message with real response
      setMessages((prev) =>
        prev.map((m) => (m.ChatId === tempMsg.ChatId ? data : m))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.ChatId !== tempMsg.ChatId));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    ask();
  };

  const handleSuggestion = (text) => {
    ask(text);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const handleChatClick = (e) => {
    const btn = e.target.closest('.chat-booking-btn');
    if (btn) {
      e.preventDefault();
      const href = btn.getAttribute('href');
      if (href) {
        navigate(href);
      }
    }
  };

  return (
    <CustomerLayout>
      <div className="ai-chat-page">
        {/* Header */}
        <div className="ai-chat-header">
          <div className="eyebrow">✨ AI Assistant</div>
          <h2 className="section-title">Trợ lý AI Beauty Salon</h2>
          <p className="subtitle">Hỏi bất kỳ điều gì về dịch vụ, giá cả, đặt lịch — AI sẽ tư vấn cho bạn!</p>
        </div>

        <div className="ai-chat-container">
          {/* Chat Window */}
          <div className="ai-chat-window">
            <div className="ai-chat-messages" onClick={handleChatClick}>
              {messages.length === 0 && !loading && (
                <div className="ai-welcome">
                  <div className="ai-welcome-icon">🤖</div>
                  <h3>Xin chào! 👋</h3>
                  <p>Mình là trợ lý AI của Beauty Salon. Hãy hỏi mình bất cứ điều gì về dịch vụ làm đẹp nhé!</p>
                </div>
              )}

              {messages.map((m) => {
                const widget = parseMessageWidget(m.Answer);
                const cleanAnswer = widget ? m.Answer.replace(widget.rawTag, '').trim() : m.Answer;

                return (
                  <div key={m.ChatId || `${m.Question}-${m.CreatedAt}`}>
                    {/* User message */}
                    <div className="ai-msg user">
                      <div className="ai-msg-avatar">👤</div>
                      <div className="ai-msg-bubble">{m.Question}</div>
                    </div>
                    {m.CreatedAt && <div className="ai-msg-time" style={{ textAlign: 'right' }}>{formatTime(m.CreatedAt)}</div>}

                    {/* AI response */}
                    {cleanAnswer && (
                      <div className="ai-msg bot">
                        <div className="ai-msg-avatar">🤖</div>
                        <div
                          className="ai-msg-bubble"
                          dangerouslySetInnerHTML={{ __html: formatAIText(cleanAnswer) }}
                        />
                      </div>
                    )}

                    {/* Widget if exists */}
                    {widget && (
                      <AiChatWidget type={widget.type} args={widget.args} />
                    )}
                  </div>
                );
              })}

              {/* Typing indicator */}
              {loading && (
                <div className="ai-typing">
                  <div className="ai-msg-avatar" style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff4778, #ff9ab7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: 'white', flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(255,71,120,0.25)'
                  }}>🤖</div>
                  <div className="ai-typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}

              {error && <div className="ai-error-toast">{error}</div>}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="ai-chat-input-area">
              <form className="ai-chat-form" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi của bạn..."
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="ai-chat-send-btn"
                  disabled={loading || !question.trim()}
                  title="Gửi"
                >
                  ➤
                </button>
              </form>

              {/* Quick suggestions - only show when no messages */}
              {messages.length === 0 && (
                <div className="ai-quick-suggestions">
                  {QUICK_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="ai-suggestion-chip"
                      onClick={() => handleSuggestion(s)}
                      disabled={loading}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="ai-recommendations">
              <h3>💡 Gợi ý dịch vụ cho bạn</h3>
              <div className="ai-rec-grid">
                {recommendations.map((r, i) => (
                  <div className="ai-rec-card" key={r.RecommendationId || r.ServiceId || i}>
                    <strong>{r.ServiceName}</strong>
                    <span>{r.Reason || r.Description}</span>
                    {r.Price && <span style={{ color: '#ff4778', fontWeight: 700 }}>{Number(r.Price).toLocaleString('vi-VN')}đ • {r.DurationMinutes} phút</span>}
                    {r.ServiceId && (
                      <Link className="card-btn primary" to={`/customer/booking?serviceId=${r.ServiceId}`}>
                        Đặt lịch
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
