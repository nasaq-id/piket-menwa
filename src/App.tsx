import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './hooks/useAppStore';
import { AppHeader } from './components/AppHeader';
import { BottomTabs } from './components/BottomTabs';
import { ConfirmSheet } from './components/ConfirmSheet';
import { FaceCam } from './components/FaceCam';
import { KontakSheet } from './components/KontakSheet';
import { LogoutSheet } from './components/LogoutSheet';
import { PhotoPreview } from './components/PhotoPreview';
import { PinSheet } from './components/PinSheet';
import { Toast } from './components/Toast';
import { HariTab } from './tabs/HariTab';
import { MingguanTab } from './tabs/MingguanTab';
import { TukarTab } from './tabs/TukarTab';
import { ProfilePage, WelcomePage } from './Welcome';
import SuperView from './Super';

export default function App() {
  const store = useAppStore();
  const {
    tab, setTab, hash, meMember, members, profiling, cam, toast,
    admin, showPin, showLogout,
    preview, me, checks, doneCount, navHidden, pending, state, online, bellDot,
  } = store;

  const camModal = cam && (
    <FaceCam
      key={cam.mode}
      autoStart={cam.mode === 'identify'}
      title={cam.mode === 'register'
        ? 'Langkah 8 dari 8 — Scan wajah'
        : cam.mode === 'identify'
          ? 'Login dengan wajah'
          : cam.mode === 'enroll'
            ? `Daftarkan wajah${store.pendingLoginName ? ` — ${store.pendingLoginName}` : ''}`
            : `Absen ${store.nama(me)}`}
      getChallenge={store.faceChallenge}
      submit={store.faceSubmit}
      onClose={() => store.setCam(null)}
    />
  );


  if (hash === '#super') {
    return (
      <div className="phone wide tac">
        <SuperView onExit={() => { location.hash = ''; }} />
      </div>
    );
  }

  // Gate: belum masuk → welcome / form profil. Daily page hanya utk yg login.
  if (!meMember) {
    return (
      <div className="phone tac">
        {profiling
          ? <ProfilePage onDone={store.onProfileDone} onCancel={() => store.setProfiling(false)} names={members.map((m) => m.nama)} existing={members.map((m) => ({ nama: m.nama, angkatan: m.angkatan }))} scanning={cam?.mode === 'register'} />
          : <WelcomePage onLogin={store.credLogin} onFaceLogin={store.faceLogin} onRegister={() => store.setProfiling(true)} />}
        <AnimatePresence>{camModal}</AnimatePresence>
        <AnimatePresence>
          {toast && <Toast t={toast} onClose={() => store.setToast(null)} />}
        </AnimatePresence>
        <ConfirmSheet req={store.confirmReq} onResolve={store.resolveConfirm} />
      </div>
    );
  }

  return (
    <div className="phone tac">
      <AppHeader
        tab={tab}
        membersCount={members.length}
        offline={!online || state?.fromApi === false}
        admin={admin}
        bellDot={bellDot}
        onTitleTap={store.titleTap}
        onGear={store.gearClick}
        onBell={store.enableNotif}
        avatar={meMember.foto
          ? <img src={meMember.foto} alt={meMember.nama} />
          : <i className="pdot" style={{ background: meMember.warna }} />}
        onAvatar={() => store.setShowLogout(true)}
      />
      <AnimatePresence>
        {showPin && (
          <PinSheet
            pinInput={store.pinInput}
            setPinInput={store.setPinInput}
            submitPin={store.submitPin}
            onClose={() => store.setShowPin(false)}
            busy={store.pinBusy}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {/* Akun lama tanpa No. WA wajib lengkapi dulu (hanya saat online). */}
        {(store.showKontak || (state?.fromApi && !meMember.hasWa)) && (
          <KontakSheet
            forced={!meMember.hasWa}
            onSave={store.saveKontak}
            onClose={() => store.setShowKontak(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showLogout && (
          <LogoutSheet
            member={meMember}
            secretType={store.secretType}
            setSecretType={store.setSecretType}
            secretNew={store.secretNew}
            setSecretNew={store.setSecretNew}
            secretMsg={store.secretMsg}
            setSecretMsg={store.setSecretMsg}
            onSaveSecret={store.saveSecret}
            onEditKontak={() => { store.setShowLogout(false); store.setShowKontak(true); }}
            avatarBusy={store.avatarBusy}
            avatarInputRef={store.avatarInputRef}
            onAvatarFile={(f) => void store.onAvatarFile(f)}
            onRemoveAvatar={() => void store.removeAvatar()}
            onLogout={store.logout}
            onClose={() => store.setShowLogout(false)}
          />
        )}
      </AnimatePresence>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {tab === 'hari' && <HariTab store={store} />}
            {tab === 'minggu' && <MingguanTab store={store} />}
            {tab === 'tukar' && <TukarTab store={store} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {tab === 'hari' && checks.length > 0 && (
        <div className="progress"><i style={{ width: `${(doneCount / checks.length) * 100}%` }} /></div>
      )}
      <AnimatePresence>{camModal}</AnimatePresence>
      <AnimatePresence>
        {toast && <Toast t={toast} onClose={() => store.setToast(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {preview && (
          <PhotoPreview
            preview={preview}
            isAdmin={admin}
            viewerName={store.nama(me ?? '')}
            onClose={() => store.setPreview(null)}
          />
        )}
      </AnimatePresence>
      <ConfirmSheet req={store.confirmReq} onResolve={store.resolveConfirm} />
      <BottomTabs tab={tab} onTab={setTab} pendingCount={pending.length} hidden={navHidden} />
    </div>
  );
}
