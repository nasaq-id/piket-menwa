// Lapisan data: coba API SQLite dulu, fallback ke localStorage (offline/PWA).
import {
  DEFAULT_SCHEDULE, DEFAULT_TASKS,
  dateStr, load, save, type DayKey,
} from './piket';

export interface Member { id: string; nama: string; warna: string; divisi: string; foto: string | null; angkatan: string | null; jabatan: string | null; lastSeen: number | null; hasWa: boolean }
export interface TaskRow { id: number; tanggal: string; judul: string; done: number; sort: number }
export interface SwapRow {
  id: string; requester: string; target: string;
  fromDay: DayKey; toDay: DayKey; alasan: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; createdAt: number;
}

interface RosterRow { day: DayKey; memberId: string; jamMulai: string; jamSelesai: string }

async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// Sama seperti get(), tapi ikut kirim PIN Admin (bila ada) — dipakai endpoint
// yang server-nya bedakan privasi user-biasa vs admin (evidence, lapsit).
async function getAuthed<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: getPin() ? { 'x-admin-pin': getPin() as string } : {},
    });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function post(url: string, body?: unknown): Promise<boolean> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getPin() ? { 'x-admin-pin': getPin() as string } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ---- web push (langganan notif tukar jadwal) ----
const urlB64ToU8 = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function ensurePush(memberId: string): Promise<boolean> {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = (await (await fetch('/api/push/public-key')).json()) as { publicKey: string };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToU8(publicKey) });
    }
    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, subscription: sub.toJSON() }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function dropPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* abaikan */ }
}
// ---- superadmin (dev) ----
export const getSuperPin = () => sessionStorage.getItem('super-pin');

// Hasil cek PIN admin/superadmin. blocked = salah 5× → diblokir 1 jam
// (member yang login otomatis di-logout). null = server tak terjangkau.
export type PinCheck = { ok: boolean; blocked?: boolean; sisa?: number; error?: string } | null;

// Member yang sedang login di HP ini (sesi berlaku hari ini saja) — dikirim
// saat cek PIN supaya salah PIN dihitung per akun, bukan per IP.
const currentMe = (): string => {
  try {
    return localStorage.getItem('piket-me-date') === dateStr(0) ? load('piket-me', '') : '';
  } catch {
    return '';
  }
};

async function checkPin(path: string, pin: string): Promise<PinCheck> {
  try {
    const memberId = currentMe();
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, memberId: memberId || undefined, attest: memberId ? getAttest(memberId, dateStr(0)) : undefined }),
    });
    if (!r.ok && r.status !== 423) return null;
    return (await r.json()) as PinCheck;
  } catch {
    return null;
  }
}

export async function verifySuper(pin: string): Promise<PinCheck> {
  const r = await checkPin('/api/super/verify', pin);
  if (r?.ok) sessionStorage.setItem('super-pin', pin);
  return r;
}

// Superadmin: akun/IP yang sedang diblokir karena salah PIN.
export interface PinBlock {
  key: string; memberId: string | null; nama: string | null; ip: string | null;
  fails: number; blockedUntil: number; lastKind: 'admin' | 'super' | null;
}
export async function unblockPin(key: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/super/pin-blocks/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { ...(getSuperPin() ? { 'x-super-pin': getSuperPin() as string } : {}) },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function superGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(path, {
      headers: getSuperPin() ? { 'x-super-pin': getSuperPin() as string } : {},
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function superPut(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(getSuperPin() ? { 'x-super-pin': getSuperPin() as string } : {}) },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { error?: string };
    return r.ok ? { ok: true } : { ok: false, error: j.error ?? 'gagal' };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

// Lokasi mako untuk geofence absen (null = belum diatur superadmin).
export async function loadMako(): Promise<{ lat: number; lng: number; radius: number } | null> {
  const s = await get<Record<string, string>>('/api/settings');
  if (!s?.mako_lat || !s.mako_lng) return null;
  return { lat: Number(s.mako_lat), lng: Number(s.mako_lng), radius: Number(s.mako_radius ?? 100) };
}

export interface Overview {
  members: number; faces: number; roster: number; online: number;
  attToday: number; attTotal: number; evToday: number; lapsitToday: number;
  swapsPending: number;
}

export interface FeedItem {
  t: number; jenis: string; teks: string;
}
// ---- PIN ketua (disimpan per sesi, tidak persisten) ----
export const getPin = () => sessionStorage.getItem('piket-pin');
export const setPin = (pin: string) => sessionStorage.setItem('piket-pin', pin);
export const clearPin = () => sessionStorage.removeItem('piket-pin');

export async function verifyPin(pin: string): Promise<PinCheck> {
  const r = await checkPin('/api/admin/verify', pin);
  if (r?.ok) setPin(pin);
  return r;
}

export interface AppState {
  fromApi: boolean;
  members: Member[];
  schedule: Record<DayKey, string[]>;
  jam: Record<DayKey, string>; // "09.00–15.00"
  swaps: SwapRow[];
  templateLen: number; // jumlah tugas master (dipakai buat hitung X/Y bukti)
}

export async function loadState(): Promise<AppState> {
  const s = await get<{
    members: Member[]; roster: RosterRow[];
    swaps: SwapRow[]; template: TaskRow[];
  }>('/api/state');
  if (s) {
    const schedule = { ...DEFAULT_SCHEDULE } as Record<DayKey, string[]>;
    const jam = {} as Record<DayKey, string>;
    for (const k of Object.keys(schedule) as DayKey[]) schedule[k] = [];
    for (const r of s.roster) {
      schedule[r.day].push(r.memberId);
      jam[r.day] = `${r.jamMulai}–${r.jamSelesai}`;
    }
    save('piket-members', s.members);
    return { fromApi: true, members: s.members, schedule, jam, swaps: s.swaps as SwapRow[], templateLen: s.template.length };
  }
  // offline fallback (anggota = cache terakhir, bisa kosong)
  const schedule = load('piket-schedule', DEFAULT_SCHEDULE);
  const swaps = load<SwapRow[]>('piket-swaps', []);
  return {
    fromApi: false,
    members: load<Member[]>('piket-members', []),
    schedule, jam: Object.fromEntries(Object.keys(schedule).map((d) => [d, '09.00–15.00'])) as Record<DayKey, string>,
    swaps, templateLen: DEFAULT_TASKS.length,
  };
}

export async function loadChecks(date: string, memberId: string): Promise<TaskRow[] | null> {
  const rows = await get<TaskRow[]>(`/api/checks?date=${date}&memberId=${encodeURIComponent(memberId)}`);
  return rows;
}

export function localChecks(date = dateStr(0)): TaskRow[] {
  const done: string[] = load<Record<string, string[]>>('piket-checks', {})[date] ?? [];
  return DEFAULT_TASKS.map((judul, i) => ({
    id: -i - 1, tanggal: date, judul, done: done.includes(judul) ? 1 : 0, sort: i,
  }));
}

export async function createSwapRemote(s: Omit<SwapRow, 'id' | 'status' | 'createdAt'>): Promise<boolean> {
  return post('/api/swaps', s);
}

export async function decideSwapRemote(id: string, approve: boolean, by: string): Promise<boolean> {
  return post(`/api/swaps/${id}/decide`, { approve, by });
}

export async function cancelSwapRemote(id: string, by: string): Promise<boolean> {
  return post(`/api/swaps/${id}/cancel`, { by });
}

export async function saveRosterRemote(
  schedule: Record<DayKey, string[]>, jam?: Record<DayKey, string>,
): Promise<boolean> {
  try {
    const roster = Object.entries(schedule).flatMap(([day, ids]) => {
      const [jamMulai, jamSelesai] = (jam?.[day as DayKey] ?? '09.00–15.00').split('–');
      return (ids as string[]).map((memberId) => ({
        day, memberId,
        jamMulai: jamMulai ?? '09.00', jamSelesai: jamSelesai ?? '15.00',
      }));
    });
    const r = await fetch('/api/roster', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(getPin() ? { 'x-admin-pin': getPin() as string } : {}),
      },
      body: JSON.stringify({ roster }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ---- roster per-minggu (drag-drop tab Mingguan: minggu depan/seterusnya) ----
export interface WeekRosterRow { day: DayKey; memberId: string; jamMulai: string; jamSelesai: string }

// weekStart = tanggal Senin minggu ybs (YYYY-MM-DD). Fallback ke template dasar
// bila minggu itu belum pernah di-drag-drop (overridden:false).
export async function loadWeekRoster(
  weekStart: string,
): Promise<{ schedule: Record<DayKey, string[]>; jam: Record<DayKey, string>; overridden: boolean } | null> {
  const s = await get<{ roster: WeekRosterRow[]; overridden: boolean }>(`/api/roster/week?start=${weekStart}`);
  if (!s) return null;
  const schedule = { Senin: [], Selasa: [], Rabu: [], Kamis: [], Jumat: [] } as Record<DayKey, string[]>;
  const jam = {} as Record<DayKey, string>;
  for (const r of s.roster) {
    schedule[r.day].push(r.memberId);
    jam[r.day] = `${r.jamMulai}–${r.jamSelesai}`;
  }
  return { schedule, jam, overridden: s.overridden };
}

// Simpan hasil drag-drop untuk 1 minggu spesifik — tidak mengubah template dasar.
export async function saveWeekRosterRemote(
  weekStart: string, schedule: Record<DayKey, string[]>, jam?: Record<DayKey, string>,
): Promise<boolean> {
  try {
    const roster = Object.entries(schedule).flatMap(([day, ids]) => {
      const [jamMulai, jamSelesai] = (jam?.[day as DayKey] ?? '09.00–15.00').split('–');
      return (ids as string[]).map((memberId) => ({
        day, memberId,
        jamMulai: jamMulai ?? '09.00', jamSelesai: jamSelesai ?? '15.00',
      }));
    });
    const r = await fetch('/api/roster/week', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(getPin() ? { 'x-admin-pin': getPin() as string } : {}),
      },
      body: JSON.stringify({ start: weekStart, roster }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Buang override 1 minggu → minggu itu kembali mengikuti template dasar.
export async function clearWeekRosterRemote(weekStart: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/roster/week?start=${weekStart}`, {
      method: 'DELETE',
      headers: { ...(getPin() ? { 'x-admin-pin': getPin() as string } : {}) },
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ---- wajah & absen ----
// FaceRow lama (raw embedding) TIDAK LAGI diambil di client sama sekali.
// Dashboard admin cukup butuh RINGKASAN (berapa vektor terdaftar per orang),
// bukan vektornya — dipakai Super.tsx.
export interface FaceSummary { memberId: string; count: number; updatedAt: number }

export async function loadFaceSummary(): Promise<FaceSummary[]> {
  return (await getAuthed<FaceSummary[]>('/api/faces/summary')) ?? [];
}

// Token atestasi wajah/PIN hari ini (bukti identitas ke server).
// Disimpan per member+tanggal; logout menghapus semuanya.
const attestKey = (memberId: string, tanggal: string) => `piket-attest:${tanggal}:${memberId}`;
export const saveAttest = (memberId: string, tanggal: string, token: string) => {
  try { sessionStorage.setItem(attestKey(memberId, tanggal), token); } catch { /* abaikan */ }
};
export const getAttest = (memberId: string, tanggal: string): string | undefined => {
  try { return sessionStorage.getItem(attestKey(memberId, tanggal)) ?? undefined; }
  catch { return undefined; }
};
export const clearAttest = () => {
  try {
    const rm: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('piket-attest:')) rm.push(k);
    }
    rm.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* abaikan */ }
};

// ---- Verifikasi wajah di server (challenge-response) ----
// HP hanya memotret; server (CompreFace + anti-spoofing) yang menilai.
export type FaceAction = 'kiri' | 'kanan';
export type FacePurpose = 'register' | 'login' | 'identify' | 'absen';
export async function requestChallenge(
  purpose: FacePurpose, extra: { preToken?: string; memberId?: string; geo?: GeoFix | null } = {},
): Promise<{ ok: true; challengeId: string; action: FaceAction } | { ok: false; error: string }> {
  const attest = extra.memberId ? getAttest(extra.memberId, dateStr(0)) : undefined;
  const r = await postResult<{ challengeId: string; action: FaceAction }>(
    '/api/face/challenge', { purpose, ...extra, attest }, 'gagal memulai scan',
  );
  return r.ok ? { ok: true, ...r.data } : r;
}

// Kirim 1 frame scan (front/turn) — server langsung menilai. turned/stop =
// petunjuk kapan berhenti memotret; keputusan akhir tetap di endpoint tujuan.
export async function sendFaceFrame(
  challengeId: string, kind: 'front' | 'turn', frame: string,
): Promise<{ turned: boolean; stop: boolean } | null> {
  try {
    const r = await fetch('/api/face/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, kind, frame }),
    });
    return r.ok ? ((await r.json()) as { turned: boolean; stop: boolean }) : null;
  } catch {
    return null;
  }
}

export interface AttRow {
  id: number; tanggal: string; memberId: string; jam: string; createdAt: number;
  status: 'tepat' | 'terlambat'; jarakM: number | null; // jarak ke mako saat absen
}
export interface GeoFix { lat: number; lng: number; acc: number }

export async function loadAttendance(from: string, to: string): Promise<AttRow[] | null> {
  return get<AttRow[]>(`/api/attendance?from=${from}&to=${to}`);
}

export async function markAttendance(
  tanggal: string, memberId: string, challengeId: string, frames: string[], geo: GeoFix | null,
): Promise<{ ok: true; jam?: string; status?: AttRow['status'] } | { ok: false; error: string }> {
  const r = await postResult<{ jam?: string; status?: AttRow['status'] }>(
    '/api/attendance', { tanggal, memberId, attest: getAttest(memberId, tanggal), challengeId, frames, geo }, 'gagal absen',
  );
  return r.ok ? { ok: true, ...r.data } : r;
}

// Heartbeat presence (fire-and-forget, tanpa PIN).
export function ping(memberId: string) {
  fetch('/api/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId }),
  }).catch(() => {});
}

// Online bila heartbeat < 90 detik.
export const isOnline = (m: { lastSeen: number | null }) =>
  !!m.lastSeen && Date.now() - m.lastSeen < 90000;

// ---- pendaftaran mandiri (profil + WA/NBP + PIN/password + wajah), tanpa login ----
// CATATAN PRIVASI: frame kamera hanya diproses sesaat di server (diubah jadi
// embedding terenkripsi), gambarnya TIDAK disimpan. Avatar profil terpisah
// lewat setProfilePhoto() setelah login.
export type AuthType = 'pin' | 'password';
export interface RegisterInput {
  nama: string; alias: string; nbp: string; jabatan: string;
  wa: string; authType: AuthType; secret: string;
}
export async function registerMember(
  p: RegisterInput, challengeId: string, frames: string[],
): Promise<{ ok: boolean; memberId?: string; error?: string }> {
  try {
    const r = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, challengeId, frames }),
    });
    const j = (await r.json()) as { memberId?: string; attest?: string; tanggal?: string; error?: string };
    if (r.ok && j.memberId && j.attest && j.tanggal) saveAttest(j.memberId, j.tanggal, j.attest);
    return r.ok ? { ok: true, memberId: j.memberId } : { ok: false, error: j.error ?? 'gagal' };
  } catch {
    return { ok: false, error: 'offline — butuh online untuk daftar' };
  }
}

export type KontakStatus = 'ok' | 'invalid' | 'taken';
// Cek ketersediaan per field — cuma field yang diisi yang dikirim.
export async function checkKontak(
  f: { wa?: string; nbp?: string; alias?: string },
): Promise<{ wa?: KontakStatus; nbp?: KontakStatus; alias?: KontakStatus } | null> {
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
  return get(`/api/register/check?${q}`);
}

// Foto profil OPSIONAL (avatar tampilan) — beda total dari data biometrik
// wajah, hanya foto yang dipilih sendiri oleh member. dataUrl='' = hapus avatar.
export async function setProfilePhoto(memberId: string, dataUrl: string): Promise<{ ok: boolean; foto: string | null; error?: string }> {
  try {
    const r = await fetch(`/api/members/${encodeURIComponent(memberId)}/foto`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foto: dataUrl }),
    });
    const j = (await r.json()) as { foto?: string | null; error?: string };
    return r.ok ? { ok: true, foto: j.foto ?? null } : { ok: false, foto: null, error: j.error ?? 'gagal' };
  } catch {
    return { ok: false, foto: null, error: 'offline' };
  }
}

// ---- Login: 2 jalur terpisah ----
// (1) manual: NBP / No. WA / alias + PIN/password → langsung masuk
//     (kecuali akun belum punya template wajah → wajib scan wajah dulu).
// (2) wajah saja: scan → server cari pemiliknya di semua anggota.
async function postResult<T>(url: string, body: unknown, fallback: string): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as T & { error?: string };
    return r.ok ? { ok: true, data: j } : { ok: false, error: j.error ?? fallback };
  } catch {
    return { ok: false, error: 'offline — butuh online' };
  }
}

type LoginOk = { memberId: string; nama: string; attest: string; tanggal: string };
const keepAttest = <T extends { ok: true; data: LoginOk } | { ok: false; error: string }>(r: T): T => {
  if (r.ok) saveAttest(r.data.memberId, r.data.tanggal, r.data.attest);
  return r;
};

export async function loginCredential(ident: string, secret: string) {
  const r = await postResult<
    ({ needEnroll: false } & LoginOk) | { needEnroll: true; memberId: string; nama: string; preToken: string }
  >('/api/login/credential', { ident, secret }, 'gagal masuk');
  if (r.ok && !r.data.needEnroll) saveAttest(r.data.memberId, r.data.tanggal, r.data.attest);
  return r;
}

export async function loginEnrollFace(preToken: string, challengeId: string, frames: string[]) {
  return keepAttest(await postResult<LoginOk>('/api/login/enroll-face', { preToken, challengeId, frames }, 'daftar wajah gagal'));
}

export async function loginIdentify(challengeId: string, frames: string[]) {
  return keepAttest(await postResult<LoginOk>('/api/login/identify', { challengeId, frames }, 'wajah tidak dikenali'));
}

// Ganti PIN/password & kontak: server minta token atestasi wajah hari ini.
export async function setLoginSecret(memberId: string, tanggal: string, authType: AuthType, secret: string) {
  return postResult<{ ok: true }>(
    '/api/secret/set', { memberId, authType, secret, attest: getAttest(memberId, tanggal) }, 'gagal simpan',
  );
}

export async function setKontak(
  memberId: string, tanggal: string, k: { wa: string; alias: string; nbp: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`/api/members/${encodeURIComponent(memberId)}/kontak`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...k, attest: getAttest(memberId, tanggal) }),
    });
    const j = (await r.json()) as { error?: string };
    return r.ok ? { ok: true } : { ok: false, error: j.error ?? 'gagal simpan' };
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export async function deleteMember(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/members/${id}`, {
      method: 'DELETE',
      headers: { ...(getSuperPin() ? { 'x-super-pin': getSuperPin() as string } : {}) },
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ---- bukti per tugas ----
export interface EvidenceRow {
  id: number; tanggal: string; tugas: string; memberId: string;
  file: string; createdAt: number;
}

export async function loadEvidence(from: string, to: string, memberId?: string): Promise<EvidenceRow[] | null> {
  const q = memberId ? `&memberId=${encodeURIComponent(memberId)}` : '';
  return getAuthed<EvidenceRow[]>(`/api/evidence?from=${from}&to=${to}${q}`);
}

export async function uploadEvidence(
  tanggal: string, memberId: string, tugas: string, dataUrl: string,
): Promise<{ ok: boolean; file?: string; error?: string }> {
  try {
    const r = await fetch('/api/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tanggal, memberId, tugas, dataUrl, attest: getAttest(memberId, tanggal) }),
    });
    const j = (await r.json()) as { file?: string; error?: string };
    return r.ok ? { ok: true, file: j.file } : { ok: false, error: j.error ?? 'gagal' };
  } catch {
    return { ok: false, error: 'offline — butuh online untuk upload bukti' };
  }
}

// ---- lapsit akhir piket ----
export interface LapsitRow {
  id: number; tanggal: string; memberId: string; catatan: string;
  lat: string | null; lng: string | null; acc: number | null; createdAt: number;
}

export async function loadLapsit(from: string, to: string, memberId?: string): Promise<LapsitRow[] | null> {
  const q = memberId ? `&memberId=${encodeURIComponent(memberId)}` : '';
  return getAuthed<LapsitRow[]>(`/api/lapsit?from=${from}&to=${to}${q}`);
}

export async function submitLapsit(
  tanggal: string, memberId: string, catatan: string, geo: { lat: number; lng: number; acc: number } | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/lapsit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tanggal, memberId, catatan,
        lat: geo ? String(geo.lat) : null,
        lng: geo ? String(geo.lng) : null,
        acc: geo ? geo.acc : null,
        attest: getAttest(memberId, tanggal),
      }),
    });
    const j = (await r.json()) as { error?: string };
    return r.ok ? { ok: true } : { ok: false, error: j.error ?? 'gagal' };
  } catch {
    return { ok: false, error: 'offline — butuh online untuk kirim lapsit' };
  }
}

// ---- Rincian Tugas (Opsional): checklist disinkron ke server, per orang ----
export async function loadBreakdown(date: string, memberId: string): Promise<string[]> {
  const r = await getAuthed<{ done: string[] }>(`/api/breakdown?date=${date}&memberId=${encodeURIComponent(memberId)}`);
  return r?.done ?? [];
}

export async function toggleBreakdown(tanggal: string, memberId: string, itemKey: string, done: boolean): Promise<boolean> {
  try {
    const r = await fetch('/api/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tanggal, memberId, itemKey, done, attest: getAttest(memberId, tanggal) }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Nilai piket hari ini (otomatis: foto wajib + checklist opsional + lapsit).
// Privat milik sendiri: kirim attest wajah hari itu agar server percaya.
export async function loadNilaiToday(date: string, memberId: string): Promise<number | null> {
  const attest = getAttest(memberId, date);
  const q = attest ? `&attest=${encodeURIComponent(attest)}` : '';
  const r = await getAuthed<{ nilai: number }>(`/api/nilai/today?date=${date}&memberId=${encodeURIComponent(memberId)}${q}`);
  return r?.nilai ?? null;
}
