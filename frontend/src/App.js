import React, { useCallback, useEffect, useState } from 'react';
import Landing from './pages/Landing';
import AvatarGenerator from './pages/AvatarGenerator';
import Onboarding from './pages/Onboarding';
import Office from './pages/Office';
import { api, getToken, setToken } from './api';
import Gate from './pages/Gate';

// Recorrido: entrar → avatar → entrevista y ficha → oficina.
export default function App() {
  const [me, setMe] = useState(null); // { user, character }
  const [loading, setLoading] = useState(!!getToken());
  const [editAvatar, setEditAvatar] = useState(false);
  const [gate, setGate] = useState(null); // { required, open, configured }

  // La puerta va antes que todo (solo existe en el VPS).
  useEffect(() => {
    api('/gate').then(setGate).catch(() => setGate({ required: false, open: true }));
  }, []);

  const load = useCallback(async () => {
    if (!getToken()) return setLoading(false);
    try {
      setMe(await api('/me'));
    } catch {
      setToken(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onAuth = (user, token) => {
    setToken(token);
    setLoading(true);
    load();
  };

  const logout = () => {
    setToken(null);
    setMe(null);
  };

  if (!gate) return <div className="loading">Abriendo la oficina…</div>;
  if (gate.required && !gate.open) {
    return <Gate configured={gate.configured} onOpen={() => { setGate({ ...gate, open: true }); setLoading(!!getToken()); load(); }} />;
  }
  if (loading) return <div className="loading">Abriendo la oficina…</div>;
  if (!me) return <Landing onAuth={onAuth} />;

  const { user, character } = me;
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
  if (!character || !character.approved) {
    return <Onboarding user={user} character={character} onDone={load} onBack={() => setEditAvatar(true)} />;
  }
  return <Office me={me} onLogout={logout} onEditAvatar={() => setEditAvatar(true)} onRefresh={load} />;
}
