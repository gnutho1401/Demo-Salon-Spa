import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient, { resolveFileUrl } from '../../api/axiosClient';

const DEFAULT_AVATAR = 'https://www.w3schools.com/howto/img_avatar.png';

const QUICK_SUGGESTIONS = [
  'Tôi muốn tư vấn dịch vụ chăm sóc da',
  'Giá dịch vụ nail bao nhiêu?',
  'Hướng dẫn đặt lịch hẹn',
  'Có combo nào đang giảm giá không?',
];

const WELCOME_MESSAGE = {
  ChatId: 'welcome',
  Question: null,
  Answer: '😊 Xin chào! Hiện tại tôi có thể hỗ trợ bạn trực tiếp các việc sau:\n- Tư vấn & đặt lịch dịch vụ (gõ "tôi bị đau lưng", "tôi muốn làm nail")\n- Xem lịch hẹn sắp tới & đổi lịch/hủy lịch (gõ "lịch hẹn của tôi")\n- Xem các voucher ưu đãi (gõ "voucher của tôi")\n- Xem lịch sử làm đẹp (gõ "lịch sử dịch vụ")',
  CreatedAt: new Date().toISOString()
};

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

function parseMessageSuggestions(text) {
  if (!text) return [];
  const match = text.match(/\[\[SUGGESTIONS:([^\]]+)\]\]/);
  if (!match) return [];
  return match[1].split('|').map(s => s.trim()).filter(Boolean);
}

function AiChatWidget({ type: initialType, args: initialArgs }) {
  const navigate = useNavigate();
  const [type, setType] = useState(initialType);
  const [args, setArgs] = useState(initialArgs);

  useEffect(() => {
    setType(initialType);
    setArgs(initialArgs);
  }, [initialType, initialArgs]);

  // Widget: SEARCH_SERVICES
  if (type === 'SEARCH_SERVICES') {
    const keyword = args[0] ? String(args[0]).toLowerCase().trim() : '';
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchServices = async () => {
        try {
          const res = await axiosClient.get('/services');
          let list = res.data?.data || res.data || [];
          if (keyword) {
            list = list.filter(
              (s) =>
                s.ServiceName.toLowerCase().includes(keyword) ||
                s.Description?.toLowerCase().includes(keyword)
            );
          }
          setServices(list.slice(0, 5));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchServices();
    }, [keyword]);

    if (loading) return <div className="ai-chat-widget">⌛ Đang tìm dịch vụ...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">🔍 Kết quả tìm kiếm dịch vụ</div>
        {services.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Không tìm thấy dịch vụ nào phù hợp.</div>
        ) : (
          <div className="ai-widget-service-list">
            {services.map((s) => (
              <div className="ai-widget-service-item" key={s.ServiceId}>
                <div className="ai-widget-service-info">
                  <h4>{s.ServiceName}</h4>
                  <p>{s.Description || 'Không có mô tả chi tiết.'}</p>
                  <div className="ai-widget-service-meta">
                    {Number(s.Price || 0).toLocaleString('vi-VN')}đ • {s.DurationMinutes} phút
                  </div>
                </div>
                <div className="ai-widget-service-action">
                  <button
                    type="button"
                    className="slots-btn"
                    onClick={() => {
                      setType('SLOTS');
                      setArgs([String(s.ServiceId), '', '']);
                    }}
                  >
                    Xem giờ trống
                  </button>
                  <button
                    type="button"
                    className="book-btn"
                    onClick={() => navigate(`/customer/booking?serviceId=${s.ServiceId}`)}
                  >
                    Đặt lịch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget: SEARCH_STYLISTS
  if (type === 'SEARCH_STYLISTS') {
    const keyword = args[0] ? String(args[0]).toLowerCase().trim() : '';
    const [stylists, setStylists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchStylists = async () => {
        try {
          const res = await axiosClient.get('/waiting-list/options');
          const data = res.data?.data || res.data || {};
          let list = data.employees || [];
          if (keyword) {
            list = list.filter(
              (e) =>
                e.FullName.toLowerCase().includes(keyword) ||
                (e.Specialization && e.Specialization.toLowerCase().includes(keyword)) ||
                (e.Position && e.Position.toLowerCase().includes(keyword))
            );
          }
          setStylists(list.slice(0, 5));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchStylists();
    }, [keyword]);

    if (loading) return <div className="ai-chat-widget">⌛ Đang tìm chuyên viên...</div>;
    return (
      <div className="ai-chat-widget">
        <div className="ai-widget-title">💇 Chuyên viên / stylist</div>
        {stylists.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b4f5a' }}>Không tìm thấy chuyên viên nào phù hợp.</div>
        ) : (
          <div className="ai-widget-stylist-list">
            {stylists.map((emp) => (
              <div className="ai-widget-stylist-item" key={emp.EmployeeId}>
                <div className="ai-widget-stylist-profile">
                  <img
                    src={resolveFileUrl(emp.ImageUrl) || DEFAULT_AVATAR}
                    alt={emp.FullName}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div className="ai-widget-stylist-details">
                    <h4>{emp.FullName}</h4>
                    <span>{emp.Specialization || emp.Position || 'Stylist'}</span>
                    <small>⭐ {Number(emp.AverageRating || 0).toFixed(1)} / 5</small>
                  </div>
                </div>
                <div className="ai-widget-stylist-action">
                  <button
                    type="button"
                    className="book-btn"
                    onClick={() => navigate(`/customer/booking?employeeId=${emp.EmployeeId}`)}
                  >
                    Đặt lịch ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Widget: MY_APPOINTMENTS
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
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      let label = '';
      if (i === 0) label = 'Hôm nay';
      else if (i === 1) label = 'Ngày mai';
      else if (i === 2) label = 'Ngày kia';
      else {
        const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        label = daysOfWeek[d.getDay()];
      }
      dateOptions.push({
        date: `${yyyy}-${mm}-${dd}`,
        label: `${label} (${dd}/${mm})`
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
                        style={{ background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px 10px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                        onClick={() => startReschedule(a)}
                      >
                        Đổi
                      </button>
                      <button 
                        disabled={actionLoading === a.AppointmentId}
                        onClick={() => handleCancel(a.AppointmentId)}
                        style={{ padding: '6px 10px', fontSize: 11, borderRadius: 8, border: 'none', background: '#ffe5ec', color: '#d81b60', fontWeight: 600, cursor: 'pointer' }}
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
                              type="button"
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
                                    src={emp.ImageUrl || DEFAULT_AVATAR} 
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
                                    type="button"
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
                            type="button"
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
                              type="button"
                              disabled={rescheduleActionLoading}
                              className="ai-widget-btn-primary"
                              style={{ background: '#ff4778', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                              onClick={confirmReschedule}
                            >
                              {rescheduleActionLoading ? '...' : `Xác nhận: ${rescheduleSelectedSlot}`}
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

  // Widget: MY_VOUCHERS
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

  // Widget: SLOTS
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

    const [vouchers, setVouchers] = useState([]);
    const [selectedVoucherId, setSelectedVoucherId] = useState('');
    const [serviceDetail, setServiceDetail] = useState(null);

    // Fetch active vouchers for user on load
    useEffect(() => {
      const loadVouchers = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
          const res = await axiosClient.get('/vouchers/my');
          const data = res.data?.data || res.data || [];
          const active = data.filter(v => !v.UsedStatus && v.Status === 'ACTIVE');
          setVouchers(active);
        } catch (err) {
          console.error("Failed to load vouchers", err);
        }
      };
      loadVouchers();
    }, []);

    // Fetch service detail to get Price
    useEffect(() => {
      const loadServiceDetail = async () => {
        if (!serviceId) return;
        try {
          const res = await axiosClient.get('/services');
          const list = res.data?.data || res.data || [];
          const found = list.find(s => String(s.ServiceId) === String(serviceId));
          setServiceDetail(found || null);
        } catch (err) {
          console.error("Failed to fetch service detail", err);
        }
      };
      loadServiceDetail();
    }, [serviceId]);

    // Calculate discount amount
    const selectedVoucher = vouchers.find(v => String(v.VoucherId || v.voucherId) === String(selectedVoucherId));
    
    const calculatedDiscount = useMemo(() => {
      if (!selectedVoucher || !serviceDetail) return 0;
      const total = Number(serviceDetail.Price || 0);
      const type = String(selectedVoucher.DiscountType || selectedVoucher.discountType || '').toUpperCase();
      const value = Number(selectedVoucher.DiscountValue || selectedVoucher.discountValue || 0);
      const maxDiscount = Number(selectedVoucher.MaxDiscountAmount || selectedVoucher.maxDiscountAmount || 0);
      const minOrder = Number(selectedVoucher.MinOrderAmount || selectedVoucher.minOrderAmount || 0);

      if (total <= 0) return 0;
      if (minOrder > 0 && total < minOrder) return 0;

      let discountAmount = 0;
      if (type === 'PERCENT' || type === 'PERCENTAGE') {
        discountAmount = Math.round((total * value) / 100);
        if (maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      } else {
        discountAmount = value;
      }
      return Math.min(discountAmount, total);
    }, [selectedVoucher, serviceDetail]);

    // Generate date options for next 7 days
    const dateOptions = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
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
      else {
        const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        label = daysOfWeek[d.getDay()];
      }
      
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
              type="button"
              className="ai-widget-success-btn" 
              onClick={() => navigate(`/customer/payment/${aptId}?voucherId=${selectedVoucherId || ''}&discount=${calculatedDiscount}`)}
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
              type="button"
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
                  <img src={emp.ImageUrl || DEFAULT_AVATAR} alt={emp.FullName} className="ai-employee-avatar" />
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
                      type="button"
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
                  {vouchers.length > 0 && (
                    <div className="ai-widget-voucher-select-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label htmlFor="widget-voucher-select">🎁 Áp dụng Voucher (nếu có):</label>
                      <select
                        id="widget-voucher-select"
                        value={selectedVoucherId}
                        onChange={(e) => setSelectedVoucherId(e.target.value)}
                      >
                        <option value="">-- Không áp dụng voucher --</option>
                        {vouchers.map(v => {
                          const discountType = String(v.DiscountType || '').toUpperCase();
                          const valStr = discountType === 'PERCENT' || discountType === 'PERCENTAGE' ? `${v.DiscountValue}%` : `${Number(v.DiscountValue).toLocaleString('vi-VN')}đ`;
                          const desc = `${v.Code} (Giảm ${valStr})`;
                          return (
                            <option key={v.VoucherId} value={v.VoucherId}>
                              {desc}
                            </option>
                          );
                        })}
                      </select>
                      {calculatedDiscount > 0 && (
                        <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 2, fontWeight: 600 }}>
                          ✓ Được giảm: -{calculatedDiscount.toLocaleString('vi-VN')}đ (Giá tạm tính: {(Number(serviceDetail?.Price || 0) - calculatedDiscount).toLocaleString('vi-VN')}đ)
                        </div>
                      )}
                    </div>
                  )}
                  <button 
                    type="button"
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

  // Widget: SERVICE_HISTORY
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

export default function AiChatFloatingWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync state to currentSession
  const currentSession = useMemo(() => {
    return sessions.find(s => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  const messages = useMemo(() => {
    return currentSession ? currentSession.messages : [];
  }, [currentSession]);

  // Load all sessions
  const loadSessions = async () => {
    const key = user 
      ? `ai_chat_workspace_sessions_${user.UserId || user.userId}` 
      : `ai_chat_workspace_sessions_guest`;
    
    const saved = localStorage.getItem(key);
    let parsedSessions = [];
    if (saved) {
      try {
        parsedSessions = JSON.parse(saved);
      } catch (err) {
        console.error("Failed to parse local sessions", err);
      }
    }

    // If logged in customer, also pull recent logs from the DB and merge
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const chatRes = await axiosClient.get('/ai/my/chat');
        const dbMessages = chatRes.data?.data || chatRes.data || [];
        if (dbMessages.length > 0) {
          // Check if there is already a database session in parsed sessions
          const dbSessionIndex = parsedSessions.findIndex(s => s.id === 'session-database');
          const dbSession = {
            id: 'session-database',
            title: 'Hội thoại gần đây (Lịch sử)',
            messages: dbMessages
          };
          if (dbSessionIndex > -1) {
            parsedSessions[dbSessionIndex] = dbSession;
          } else {
            parsedSessions.unshift(dbSession);
          }
        }
      } catch (err) {
        console.error("Failed to load server chat logs", err);
      }
    }

    if (parsedSessions.length === 0) {
      const defaultSession = {
        id: `session-${Date.now()}`,
        title: 'Cuộc trò chuyện mới',
        messages: [] // start empty/fresh to sync with page
      };
      parsedSessions.push(defaultSession);
    }

    setSessions(parsedSessions);
    // Set active session
    if (!currentSessionId || !parsedSessions.some(s => s.id === currentSessionId)) {
      setCurrentSessionId(parsedSessions[0].id);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [user, isOpen]);

  // Sync sessions array to localStorage and broadcast sync event
  useEffect(() => {
    if (sessions.length > 0) {
      const key = user 
        ? `ai_chat_workspace_sessions_${user.UserId || user.userId}` 
        : `ai_chat_workspace_sessions_guest`;
      
      const savedStr = localStorage.getItem(key);
      const newStr = JSON.stringify(sessions);
      if (savedStr !== newStr) {
        localStorage.setItem(key, newStr);
        window.dispatchEvent(new CustomEvent('ai-chat-sync', { detail: newStr }));
      }
    }
  }, [sessions, user]);

  // Listen to sync broadcast
  useEffect(() => {
    const handleSync = (e) => {
      const newStr = e.detail;
      if (newStr && JSON.stringify(sessions) !== newStr) {
        try {
          const parsed = JSON.parse(newStr);
          setSessions(parsed);
        } catch (err) {
          console.error("Sync parse failed", err);
        }
      }
    };
    window.addEventListener('ai-chat-sync', handleSync);
    return () => window.removeEventListener('ai-chat-sync', handleSync);
  }, [sessions]);

  // Listen to open-ai-chat global custom event
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-ai-chat', handleOpen);
    return () => window.removeEventListener('open-ai-chat', handleOpen);
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleCreateNewSession = () => {
    const activeSession = sessions.find(s => s.id === currentSessionId);
    if (activeSession && activeSession.messages.length === 0) {
      return;
    }

    const existingEmpty = sessions.find(s => s.messages.length === 0);
    if (existingEmpty) {
      setCurrentSessionId(existingEmpty.id);
      return;
    }

    const newSession = {
      id: `session-${Date.now()}`,
      title: 'Cuộc trò chuyện mới',
      messages: [] // empty list for fresh new chat
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setShowHistory(false);
  };

  const handleDeleteSession = async (sid, e) => {
    e.stopPropagation();
    
    // Prompts confirmation before deleting any session
    const targetSession = sessions.find(s => s.id === sid);
    const sessionName = targetSession ? targetSession.title : "cuộc trò chuyện này";
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${sessionName}"?`)) {
      return;
    }

    // If it's the database session, also clear it from the backend server
    if (sid === 'session-database') {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          setLoading(true);
          await axiosClient.delete('/ai/my/chat');
        } catch (err) {
          console.error("Failed to delete database history", err);
        } finally {
          setLoading(false);
        }
      }
    }

    if (sessions.length <= 1) {
      // Keep at least one blank session
      const resetSession = {
        id: `session-${Date.now()}`,
        title: 'Cuộc trò chuyện mới',
        messages: []
      };
      setSessions([resetSession]);
      setCurrentSessionId(resetSession.id);
      return;
    }

    const filtered = sessions.filter(s => s.id !== sid);
    setSessions(filtered);
    if (currentSessionId === sid) {
      setCurrentSessionId(filtered[0].id);
    }
  };

  const ask = async (text) => {
    const q = (text || question).trim();
    if (!q) return;
    setError('');

    const tempMsg = { ChatId: `temp-${Date.now()}`, Question: q, Answer: null, CreatedAt: new Date().toISOString() };
    
    // Add User question immediately
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...s.messages, tempMsg] };
      }
      return s;
    }));
    setQuestion('');
    if (inputRef.current) inputRef.current.focus();

    try {
      setLoading(true);
      const res = await axiosClient.post('/ai/chat', { question: q });
      const data = res.data.data;
      
      // Update session with AI response and rename title if needed
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const newTitle = s.title === 'Cuộc trò chuyện mới' ? (q.length > 20 ? q.slice(0, 20) + '...' : q) : s.title;
          return {
            ...s,
            title: newTitle,
            messages: s.messages.map(m => m.ChatId === tempMsg.ChatId ? data : m)
          };
        }
        return s;
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: s.messages.filter(m => m.ChatId !== tempMsg.ChatId) };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    ask();
  };

  const handleChatClick = (e) => {
    const btn = e.target.closest('.chat-booking-btn');
    if (btn) {
      e.preventDefault();
      const href = btn.getAttribute('href');
      if (href) {
        setIsOpen(false);
        navigate(href);
      }
    }
  };

  return (
    <div className="ai-chat-floating-container">
      {/* Floating Button Bubble */}
      <button 
        type="button" 
        className={`ai-chat-bubble-btn ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        title="Trợ lý ảo AI"
      >
        {isOpen ? '✕' : '✨'}
      </button>

      {/* Collapsible Chat Window Popup */}
      {isOpen && (
        <div className="ai-chat-popup-window">
          {/* Header */}
          <div className="ai-chat-popup-header">
            <div className="ai-chat-popup-header-info">
              <span className="logo-icon">🌸</span>
              <div>
                <h4>BeautyMS AI</h4>
                <small>{currentSession ? currentSession.title : 'Trợ lý ảo'}</small>
              </div>
            </div>
            <div className="ai-chat-popup-header-actions" style={{ display: 'flex', gap: 6 }}>
              <button 
                type="button" 
                className="new-chat-btn" 
                onClick={() => setShowHistory(!showHistory)} 
                title="Lịch sử trò chuyện"
                style={{ background: showHistory ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.2)' }}
              >
                📂 Lịch sử
              </button>
              <button 
                type="button" 
                className="new-chat-btn"
                onClick={handleCreateNewSession}
                title="Tạo hội thoại mới"
              >
                + Chat mới
              </button>
            </div>
          </div>

          {/* Drawer Lịch Sử Hội Thoại */}
          {showHistory && (
            <div className="ai-chat-popup-history-drawer">
              <div className="ai-chat-popup-history-drawer-header">
                <h5>Lịch sử trò chuyện</h5>
                <button type="button" onClick={() => setShowHistory(false)}>✕ Close</button>
              </div>
              <div className="ai-chat-popup-history-drawer-body">
                <button 
                  type="button" 
                  className="ai-chat-popup-new-session-btn"
                  onClick={handleCreateNewSession}
                >
                  ➕ Bắt đầu cuộc trò chuyện mới
                </button>
                <div className="ai-chat-sessions-list">
                  {sessions.map(s => (
                    <div 
                      key={s.id} 
                      className={`ai-chat-session-item ${currentSessionId === s.id ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentSessionId(s.id);
                        setShowHistory(false);
                      }}
                    >
                      <span className="session-title-text" style={{ fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        💬 {s.title}
                      </span>
                      <button 
                        type="button" 
                        className="delete-session-btn" 
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        title="Xóa hội thoại"
                        style={{ border: 'none', background: 'transparent', color: '#ff4778', cursor: 'pointer', fontSize: 13 }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages Body */}
          <div className="ai-chat-popup-body">
            <div className="ai-chat-messages-container" onClick={handleChatClick}>
              {messages.length === 0 && !loading && (
                <div className="ai-welcome" style={{ padding: '20px 10px', textAlign: 'center' }}>
                  <div className="ai-welcome-icon" style={{ fontSize: 32 }}>🤖</div>
                  <h3 style={{ fontSize: 16, margin: '10px 0 5px 0', color: '#ff4778' }}>Xin chào! 👋</h3>
                  <p style={{ fontSize: 12, color: '#6b4f5a', margin: 0 }}>Mình là trợ lý AI của Beauty Salon. Hãy gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện nhé!</p>
                </div>
              )}
              {messages.map((m, idx) => {
                const widget = m.Answer ? parseMessageWidget(m.Answer) : null;
                const suggestions = m.Answer ? parseMessageSuggestions(m.Answer) : [];
                
                // Clear widgets/suggestions tags from text
                let cleanAnswer = m.Answer || '';
                if (widget) cleanAnswer = cleanAnswer.replace(widget.rawTag, '');
                if (suggestions.length > 0) {
                  const suggMatch = cleanAnswer.match(/\[\[SUGGESTIONS:([^\]]+)\]\]/);
                  if (suggMatch) cleanAnswer = cleanAnswer.replace(suggMatch[0], '');
                }

                return (
                  <div key={m.ChatId || idx} className="ai-chat-message-group">
                    {/* User Question */}
                    {m.Question && (
                      <div className="ai-chat-msg user">
                        <div className="ai-chat-msg-text">{m.Question}</div>
                      </div>
                    )}
                    
                    {/* AI Answer */}
                    <div className="ai-chat-msg assistant">
                      <div className="avatar">🤖</div>
                      <div className="ai-chat-msg-content-wrapper">
                        <div 
                          className="ai-chat-msg-text"
                          dangerouslySetInnerHTML={{ __html: formatAIText(cleanAnswer) }}
                        />
                        
                        {/* Render interactive widgets inline */}
                        {widget && (
                          <div className="ai-chat-widget-wrapper">
                            <AiChatWidget type={widget.type} args={widget.args} />
                          </div>
                        )}

                        {/* Render suggestions chips inside popup body */}
                        {suggestions.length > 0 && (
                          <div className="ai-chat-suggestions-chips">
                            {suggestions.map((s, sIdx) => (
                              <button 
                                key={sIdx} 
                                type="button" 
                                className="suggestion-chip" 
                                onClick={() => ask(s)}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Waiting status */}
              {loading && !messages.some(m => m.Answer === null) && (
                <div className="ai-chat-msg assistant loading">
                  <div className="avatar">🤖</div>
                  <div className="ai-chat-loading-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Form Footer */}
          <form className="ai-chat-popup-footer" onSubmit={handleSubmit}>
            {error && <div className="ai-chat-popup-error">{error}</div>}
            
            {/* Show quick suggestion help if messages are fresh */}
            {messages.length <= 1 && (
              <div className="ai-chat-popup-quick-hints">
                {QUICK_SUGGESTIONS.map((hint, hIdx) => (
                  <button 
                    key={hIdx}
                    type="button"
                    onClick={() => ask(hint)}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}
            
            <div className="ai-chat-popup-input-bar">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Hỏi trợ lý ảo (vd: nặn mụn)..."
                disabled={loading}
              />
              <button type="submit" disabled={loading || !question.trim()}>
                Gửi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
