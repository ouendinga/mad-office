import React, { useCallback, useEffect, useState } from 'react';
import Landing from './pages/Landing';
import AvatarGenerator from './pages/AvatarGenerator';
import Onboarding from './pages/Onboarding';
import Office from './pages/Office';
import { api, getToken, setToken } from './api';

// Recorrido: entrar → avatar → entrevista y ficha → oficina.
export default function App() {
  const [me, setMe] = useState(null); // { user, character }
  const [loading, setLoading] = useState(!!getToken());
  const [editAvatar, setEditAvatar] = useState(false);

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

  if (loading) return <div className="loading">Abriendo la oficina…</div>;
  if (!me) return <Landing onAuth={onAuth} />;

  const { user, character } = me;
  const hasAvatar = user.avatar_config && Object.keys(user.avatar_config).length > 0;

  if (!hasAvatar || editAvatar) {
    return (
      <AvatarGenerator
        user={user}
        onAvatarSaved={u => { setEditAvatar(false); setMe({ ...me, user: u }); }}
      />
    );
  }
  if (!character || !character.approved) {
    return <Onboarding user={user} character={character} onDone={load} />;
  }
  return <Office me={me} onLogout={logout} onEditAvatar={() => setEditAvatar(true)} onRefresh={load} />;
}
