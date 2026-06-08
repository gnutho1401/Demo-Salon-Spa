import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

export default function AiAssistantPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [recRes, chatRes] = await Promise.all([
      axiosClient.get('/ai/my/recommendations'),
      axiosClient.get('/ai/my/chat'),
    ]);
    setRecommendations(recRes.data.data || recRes.data || []);
    setMessages(chatRes.data.data || chatRes.data || []);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const ask = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    try {
      setLoading(true);
      const res = await axiosClient.post('/ai/chat', { question });
      setMessages((prev) => [...prev, res.data.data]);
      setQuestion('');
    } finally {
      setLoading(false);
    }
  };

  return <CustomerLayout>
    <div className="section-head"><div><div className="eyebrow">AI Assistant</div><h2 className="section-title">AI tư vấn dịch vụ</h2></div></div>

    <div className="customer-two-columns">
      <div className="dashboard-card">
        <h3>Gợi ý dịch vụ</h3>
        {recommendations.map((r, i) => <div className="mini-item" key={r.RecommendationId || r.ServiceId || i}>
          <strong>{r.ServiceName}</strong>
          <span>{r.Reason || r.Description}</span>
          {r.ServiceId && <Link className="card-btn" to={`/customer/booking?serviceId=${r.ServiceId}`}>Đặt lịch</Link>}
        </div>)}
      </div>

      <div className="dashboard-card">
        <h3>Chat với AI lễ tân</h3>
        <div className="chat-box">
          {messages.map((m) => <div className="chat-item" key={m.ChatId || `${m.Question}-${m.CreatedAt}`}>
            <p><b>Bạn:</b> {m.Question}</p>
            <p><b>AI:</b> {m.Answer}</p>
          </div>)}
        </div>
        <form onSubmit={ask} className="chat-form">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ví dụ: Tôi nên chọn dịch vụ nào cho chăm sóc da?" />
          <button className="btn" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi'}</button>
        </form>
      </div>
    </div>
  </CustomerLayout>;
}
