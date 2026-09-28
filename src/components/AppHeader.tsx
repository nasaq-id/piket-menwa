import { Bell, Settings, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Tab } from '../hooks/useAppStore';

const tabTitle: Record<Tab, string> = {
  hari: 'Jadwal Piket Hari Ini',
  minggu: 'Jadwal Mingguan',
  tukar: 'Tukar Jadwal',
};

export function AppHeader({ tab, membersCount, offline, admin, bellDot, onTitleTap, onGear, onBell, avatar, onAvatar }: {
  tab: Tab; membersCount: number; offline: boolean; admin: boolean; bellDot: boolean;
  onTitleTap: () => void; onGear: () => void; onBell: () => void;
  avatar: ReactNode; onAvatar: () => void;
}) {
  return (
    <>
      <header className="hd">
        {avatar && (
          <button className="hdavatar" onClick={onAvatar} title="Profil" aria-label="Buka profil">
            {avatar}
          </button>
        )}
        <button type="button" className="hdtitle" onClick={onTitleTap} aria-label="Judul aplikasi">
          <h1>{tabTitle[tab]}</h1>
          <p>Ki Menwa YPKP • {membersCount} anggota{offline ? ' • Offline' : ''}</p>
        </button>
        <div className="hbtns">
          <button className="iconbtn" onClick={onGear} title="Mode admin" aria-label="Masuk/keluar mode admin"><Settings size={19} /></button>
          <button className="iconbtn bell" onClick={onBell} title="Pengingat H-1" aria-label="Aktifkan notifikasi">
            <Bell size={19} />{bellDot && <i className="dot" />}
          </button>
        </div>
      </header>
      {offline && <div className="offline"><WifiOff size={13} aria-hidden="true" /> Offline — memakai data tersimpan</div>}
      {admin && <div className="adminbar">Mode admin aktif — kelola di tab Mingguan/Tukar</div>}
    </>
  );
}
