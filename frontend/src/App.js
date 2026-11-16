import React, { useCallback, useEffect, useRef, useState } from 'react';
import Landing from './pages/Landing';
import AvatarGenerator from './pages/AvatarGenerator';
import Onboarding from './pages/Onboarding';
import Offices from './pages/Offices';
import Office from './pages/Office';
import Gate from './pages/Gate';
import History from './pages/History';
import Companies from './pages/Companies';
import OrgChart from './pages/OrgChart';
import CompanySettings from './pages/CompanySettings';
import { api, capi, getToken, setToken, getCompany, setCompany, pendingInvite, clearInvite, getOwner, setOwner } from './api';

// Recorrido: entrar → elegir o crear empresa → avatar (una vez) → cargo en el organigrama →
// entrevista y ficha → oficina. Con un enlace de invitación, se entra directo en esa empresa.
export default function App() {
  const [gate, setGate] = useState(null); // { required, open, configured }
  const [me, setMe] = useState(null); // { user, companies }
  const [companyMe, setCompanyMe] = useState(null); // { user, character } en la empresa activa
  const [loading, setLoading] = useState(!!getToken());
  const [company, setActive] = useState(getCompany());
  const [view, setView] = useState('office'); // office | companies | history | org | empresa
  const [historyOf, setHistoryOf] = useState(null);
  const [editAvatar, setEditAvatar] = useState(false);
  const [notice, setNotice] = useState('');

  // «Atrás» del navegador o del móvil: cada vista deja su entrada en el historial y volver atrás
  // lleva a la anterior (antes sacaba de la app). Lo que llega por popstate no se vuelve a apilar.
  const fromPop = useRef(false);
  useEffect(() => {
    const onPop = e => {
      fromPop.current = true;
      setView((e.state && e.state.view) || 'office');
    };
    window.addEventListener('popstate', onPop);
    if (!window.history.state) window.history.replaceState({ view: 'office' }, '');
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    const cur = window.history.state && window.history.state.view;
    if (cur === view) return;
    if (view === 'office') window.history.replaceState({ view }, '');
    else window.history.pushState({ view }, '');
  }, [view]);

  // La puerta va antes que todo (solo existe en el VPS).
  useEffect(() => {
    api('/gate').then(setGate).catch(() => setGate({ required: false, open: true }));
  }, []);

  const load = useCallback(async () => {
    if (!getToken()) return setLoading(false);
    try {
      let data = await api('/me');
      // ¿Venía con una invitación? Se acepta y se entra en esa empresa.
      const code = pendingInvite();
      if (code) {
        try {
          const r = await api(`/invitations/${code}`, { method: 'POST' });
          setCompany(r.company.id);
          setActive(r.company.id);
          setNotice(`¡Bienvenido a ${r.company.name}!`);
          data = await api('/me');
        } catch (e) {
          setNotice(e.message);
        }
        clearInvite();
      }
      // Si la empresa guardada ya no es suya, a elegir.
      const cid = getCompany();
      if (cid && !data.companies.some(c => c.id === cid)) {
        setCompany(null);
        setActive(null);
      }
      setMe(data);
    } catch {
      setToken(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lo de mi personaje en la empresa activa (para la entrevista y la ficha).
  const active = me && me.companies.find(c => c.id === company);
  const activeKey = active ? `${active.id}|${active.character_id}|${active.approved}|${active.position_id}` : '';
  useEffect(() => {
    if (!activeKey) return setCompanyMe(null);
    capi('/me').then(setCompanyMe).catch(() => setCompanyMe(null));
  }, [activeKey]);

  const enter = id => {
    setCompany(id);
    setActive(id);
    setView('office');
  };

  const onAuth = (user, token) => {
    setToken(token);
    setLoading(true);
    load();
  };

  // Modo pruebas: entrar como un jugador de prueba y volver a la cuenta del dueño.
  const [owner, setOwnerState] = useState(getOwner());
  const become = (token, name) => {
    const o = owner || { token: getToken(), company };
    setOwner({ ...o, as: name });
    setOwnerState({ ...o, as: name });
    setToken(token);
    setView('office');
    setLoading(true);
    load();
  };
  const backToOwner = () => {
    setToken(owner.token);
    setCompany(owner.company);
    setActive(owner.company);
    setOwner(null);
    setOwnerState(null);
    setView('office');
    setLoading(true);
    load();
  };

  const logout = () => {
    if (owner) return backToOwner();
    setToken(null);
    setMe(null);
    setCompany(null);
    setActive(null);
  };

  if (!gate) return <div className="loading">Abriendo la oficina…</div>;
  // Sin pasar la puerta se puede llegar igual: con un enlace de invitación (se crea la cuenta con
  // contraseña propia) o con una cuenta que ya la tenga («Ya tengo cuenta»).
  const outside = gate.required && !gate.open;
  if (outside && !me && !pendingInvite() && gate.mode !== 'cuenta') {
    return <Gate configured={gate.configured} onOpen={() => { setGate({ ...gate, open: true }); setLoading(!!getToken()); load(); }}
      onAccount={() => setGate({ ...gate, mode: 'cuenta' })} />;
  }
  if (loading) return <div className="loading">Abriendo la oficina…</div>;
  if (!me) {
    return <Landing onAuth={(u, t) => { setGate({ ...gate, open: true }); onAuth(u, t); }} invite={pendingInvite()}
      needPassword={outside} startWith={outside && gate.mode === 'cuenta' ? 'login' : null}
      onBack={outside ? () => { clearInvite(); setGate({ ...gate, mode: null }); } : null}
      onGate={() => { setToken(null); setGate({ ...gate, open: false, mode: null }); }} />;
  }
  const ownerBar = owner && (
    <div className="owner-bar" role="status">
      🧪 Estás como <strong>{owner.as}</strong> (jugador de prueba)
      <button type="button" className="btn btn-primary btn-sm" onClick={backToOwner}>Volver a mi cuenta</button>
    </div>
  );

  const { user } = me;
  const hasAvatar = user.avatar_config && Object.keys(user.avatar_config).length > 0;

  if (!hasAvatar || editAvatar) {
    return (
      <AvatarGenerator
        user={user}
        onAvatarSaved={u => { setEditAvatar(false); setMe({ ...me, user: u }); }}
        // Si ya tenía avatar, vuelve a donde estaba; si es la primera vez, la salida es cerrar sesión.
        onCancel={hasAvatar ? () => setEditAvatar(false) : logout}
        cancelLabel={hasAvatar ? 'Volver sin cambiar' : 'Salir'}
      />
    );
  }

  if (!active || view === 'companies') {
    return (
      <Companies
        me={me}
        notice={notice}
        onEnter={id => { setNotice(''); enter(id); }}
        onChanged={load}
        onLogout={logout}
        onBack={active ? () => setView('office') : null}
      />
    );
  }

  // Primera vez en esta empresa: elegir cargo, luego la entrevista.
  if (!active.position_id) {
    return <OrgChart company={active} mode="choose" onDone={load} onBack={() => setView('companies')} />;
  }
  if (!active.approved) {
    if (!companyMe) return <div className="loading">Preparando tu entrevista…</div>;
    return (
      <Onboarding
        user={user}
        character={companyMe.character}
        company={active}
        onDone={load}
        onBack={() => setEditAvatar(true)}
      />
    );
  }

  if (view === 'history' && historyOf) return <History characterId={historyOf} onBack={() => setView('office')} />;
  if (view === 'org') return <OrgChart company={active} mode="manage" onDone={load} onBack={() => setView('office')} />;
  if (view === 'oficinas') return <Offices company={active} owner={!!user.is_admin && !owner} onBack={() => setView('office')} />;
  if (view === 'empresa') return <CompanySettings company={active} onChanged={load} onBack={() => setView('office')} />;

  return (
    <>{ownerBar}<Office
      key={`${active.id}|${user.id}`}
      owner={!!user.is_admin && !owner}
      onBecome={become}
      me={me}
      company={active}
      onLogout={logout}
      onEditAvatar={() => setEditAvatar(true)}
      onHistory={id => { setHistoryOf(id); setView('history'); }}
      onCompanies={() => setView('companies')}
      onOrg={() => setView('org')}
      onOffices={() => setView('oficinas')}
      onCompanySettings={() => setView('empresa')}
    /></>
  );
}
