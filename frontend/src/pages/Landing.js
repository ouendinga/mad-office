import React, { useEffect, useState } from 'react';
import { api } from '../api';
import '../styles/landing.css';

const API_URL = process.env.REACT_APP_API_URL || '';

// needPassword: se llega sin la contraseña común (enlace de invitación o «Ya tengo cuenta»): la cuenta
// se crea con contraseña propia y se entra con ella.
export default function Landing({ onAuth, invite, needPassword = false, startWith = null, onBack = null, onGate = null }) {
  // Con invitación se abre directamente «Únete a…» (la revisión de UX vio que el aviso pasaba desapercibido).
  const [modal, setModal] = useState(startWith || (invite ? 'register' : null)); // 'login' | 'register' | null
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null); // { company } | { error }

  // A qué empresa invita el enlace (se puede ver sin haber entrado).
  useEffect(() => {
    if (!invite) return;
    api(`/invitations/${encodeURIComponent(invite)}`).then(setInviteInfo).catch(e => setInviteInfo({ error: e.message }));
  }, [invite]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, ...(password ? { password } : {}), ...(invite ? { invite } : {}) })
      });
      const data = await res.json();
      if (res.status === 403 && data.code === 'puerta' && onGate) return onGate();
      if (!res.ok) throw new Error(data.error);
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(password ? { password } : {}) })
      });
      const data = await res.json();
      if (data.code === 'clave') setShowPass(true); // abre el campo de la contraseña
      if (!res.ok) throw new Error(data.error);
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, keepEmail = false) => {
    setModal(type);
    setError('');
    if (!keepEmail) setEmail('');
    setName('');
    setPassword('');
    setShowPass(false);
  };
  const companyName = inviteInfo && inviteInfo.company ? inviteInfo.company.name : null;

  const closeModal = () => setModal(null);

  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="logo">
            <img className="logo-img" src="/logo.svg" alt="" width="32" height="32" />
            <span className="logo-text pixel-font">Mad Office</span>
          </div>
          <div className="header-buttons">
            {onBack && <button className="btn btn-ghost" onClick={onBack}>← Volver</button>}
            <button className="btn btn-ghost" onClick={() => openModal('login')}>Entrar</button>
            <button className="btn btn-primary" onClick={() => openModal('register')}>Crear cuenta</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      {invite && (
        <div className="invite-banner" role="status">
          {inviteInfo && inviteInfo.error
            ? <>⚠️ {inviteInfo.error}</>
            : <>✉️ Te han invitado a <strong>{inviteInfo && inviteInfo.company ? inviteInfo.company.name : 'una empresa'}</strong>. Crea tu cuenta (o entra si ya tienes) y pasarás directo.</>}
        </div>
      )}
      <section className="hero">
        <h1 className="hero-title">Mad Office</h1>
        <p className="hero-subtitle">La oficina donde tu personaje vive solo</p>
        <p className="hero-desc">Cada uno tiene una caricatura de sí mismo que trabaja, cotillea, hace tratos y escribe su diario sin que nadie le diga qué hacer. Tú solo puedes susurrarle un sueño cada noche. Por la mañana, él decide si te hace caso.</p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => openModal('register')}>Crear mi personaje</button>
          <button className="btn btn-ghost btn-lg" onClick={() => openModal('login')}>Ya tengo cuenta</button>
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <h2 className="section-title">Cómo va</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">&#x1F3A8;</div>
            <div className="step-number">1</div>
            <h3>Tu avatar</h3>
            <p>Pelo, ropa y gafas en pixel art. Un minuto.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">&#x1F3A4;</div>
            <div className="step-number">2</div>
            <h3>Una entrevista absurda</h3>
            <p>Seis preguntas y sale tu caricatura: manías, muletillas y un objetivo vital ridículo. La retocas y la apruebas.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">&#x1F319;</div>
            <div className="step-number">3</div>
            <h3>Le susurras de noche</h3>
            <p>De 18:00 a 09:00 le mandas un sueño de 200 caracteres. A las 9 se despierta y decide qué hacer con él.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="logo">
            <img className="logo-img" src="/logo.svg" alt="" width="24" height="24" />
            <span className="logo-text pixel-font">Mad Office</span>
          </div>
          <p>Mad Office · comedia de oficina con personajes de IA</p>
        </div>
      </footer>

      {/* Modals */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <button className="modal-close" onClick={closeModal}>&times;</button>
            {modal === 'register' ? (
              <form onSubmit={handleRegister}>
                <h2 className="modal-title">{invite && companyName ? `Únete a ${companyName}` : 'Crear cuenta'}</h2>
                {invite && <p className="modal-sub">Te han invitado. Crea tu cuenta y entrarás directo en la empresa.</p>}
                {error && <div className="modal-error">{error}</div>}
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
                </div>
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" required />
                </div>
                <div className="form-group">
                  <label>Contraseña{needPassword ? '' : ' (opcional)'}</label>
                  <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres" minLength={8} required={needPassword} />
                  <small className="form-hint">Con ella vuelves a entrar desde cualquier sitio.</small>
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear cuenta'}
                </button>
                <p className="modal-switch">¿Ya tienes cuenta? <button type="button" className="link-btn" onClick={() => openModal('login', true)}>Entra</button></p>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <h2 className="modal-title">Entrar</h2>
                {error && (
                  <div className="modal-error">
                    {error}
                    {/correo/i.test(error) && /nadie|no hay/i.test(error) && (
                      <> <button type="button" className="link-btn" onClick={() => openModal('register', true)}>Crear la cuenta con este correo</button></>
                    )}
                  </div>
                )}
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
                </div>
                {/* La contraseña es opcional (salvo fuera de la puerta): plegada bajo «Tengo contraseña». */}
                {needPassword || showPass ? (
                  <div className="form-group">
                    <label htmlFor="login-pass">Contraseña</label>
                    <input id="login-pass" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                      required={needPassword} autoFocus={!needPassword} />
                  </div>
                ) : (
                  <p className="form-fold"><button type="button" className="link-btn" onClick={() => setShowPass(true)}>Tengo contraseña</button></p>
                )}
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
                <p className="modal-switch">¿Primera vez? <button type="button" className="link-btn" onClick={() => openModal('register', true)}>Crea tu cuenta</button></p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
