import { useEffect, useState } from 'react';
import CustomerLayout from '../../components/layout/CustomerLayout';
import axiosClient from '../../api/axiosClient';

export default function MembershipPage() {
  const [mine, setMine] = useState(null);
  const [levels, setLevels] = useState([]);

  useEffect(() => {
    Promise.all([axiosClient.get('/membership/my'), axiosClient.get('/membership')])
      .then(([myRes, levelsRes]) => {
        setMine(myRes.data.data || myRes.data);
        setLevels(levelsRes.data.data || levelsRes.data || []);
      })
      .catch(() => {});
  }, []);

  const need = mine?.NextLevelMinPoints ? Math.max(mine.NextLevelMinPoints - (mine.LoyaltyPoints || 0), 0) : 0;

  return <CustomerLayout>
    <div className="section-head"><div><div className="eyebrow">Loyalty</div><h2 className="section-title">Điểm thưởng & hạng thành viên</h2></div></div>
    <div className="dashboard-card membership-hero">
      <div>
        <h3>Hạng hiện tại: {mine?.LevelName || 'Normal'}</h3>
        <p className="muted">Điểm thưởng: {mine?.LoyaltyPoints || 0}</p>
        <p>Ưu đãi: <b>{mine?.DiscountPercent || 0}%</b></p>
      </div>
      <div>
        {mine?.NextLevelName ? <p>Còn <b>{need}</b> điểm để lên hạng <b>{mine.NextLevelName}</b></p> : <p>Bạn đang ở hạng cao nhất.</p>}
      </div>
    </div>
    <div className="grid">
      {levels.map((l) => <div className="dashboard-card" key={l.MembershipLevelId}>
        <h3>{l.LevelName}</h3>
        <p>Từ {l.MinPoints} điểm</p>
        <p>Giảm {l.DiscountPercent}%</p>
        <p className="muted">{l.Description}</p>
      </div>)}
    </div>
  </CustomerLayout>;
}
