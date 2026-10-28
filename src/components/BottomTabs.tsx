import { motion } from 'framer-motion';
import { ArrowLeftRight, CalendarCheck, CalendarDays, CalendarRange } from 'lucide-react';
import type { Tab } from '../hooks/useAppStore';

export function BottomTabs({ tab, onTab, pendingCount, hidden, admin }: {
  tab: Tab; onTab: (t: Tab) => void; pendingCount: number; hidden: boolean; admin: boolean; // admin → tab Laporan
}) {
  return (
    <motion.nav
      className="tabs"
      initial={false}
      animate={{ x: '-50%', y: hidden ? '110%' : '0%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
    >
      <button className={tab === 'hari' ? 'on' : ''} onClick={() => onTab('hari')} aria-current={tab === 'hari' ? 'page' : undefined}><CalendarDays size={20} /><span>Hari Ini</span></button>
      <button className={tab === 'minggu' ? 'on' : ''} onClick={() => onTab('minggu')} aria-current={tab === 'minggu' ? 'page' : undefined}><CalendarRange size={20} /><span>Mingguan</span></button>
      <button className={tab === 'tukar' ? 'on' : ''} onClick={() => onTab('tukar')} aria-current={tab === 'tukar' ? 'page' : undefined}><ArrowLeftRight size={20} /><span>Tukar{pendingCount ? ` (${pendingCount})` : ''}</span></button>
      {admin && <button className={tab === 'laporan' ? 'on' : ''} onClick={() => onTab('laporan')} aria-current={tab === 'laporan' ? 'page' : undefined}><CalendarCheck size={20} /><span>Laporan</span></button>}
    </motion.nav>
  );
}
