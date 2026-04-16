import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import AvatarGenerator from './pages/AvatarGenerator';
import Office from './pages/Office';

const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('mad_office_token'));
  const [editAvatar, setEditAvatar] = useState(false);

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Token invalido');
          return res.json();
        })
        .then(users => {
          const storedUserId = localStorage.getItem('mad_office_user_id');
          const currentUser = users.find(u => u.id === parseInt(storedUserId));
          if (currentUser) setUser(currentUser);
          else throw new Error('Usuario no encontrado');
        })
        .catch(() => {
          localStorage.removeItem('mad_office_token');
          localStorage.removeItem('mad_office_user_id');
          setToken(null);
        });
    }
  }, [token]);

  const handleAuth = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('mad_office_token', authToken);
    localStorage.setItem('mad_office_user_id', userData.id);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setEditAvatar(false);
    localStorage.removeItem('mad_office_token');
    localStorage.removeItem('mad_office_user_id');
  };

  const handleAvatarSaved = (updatedUser) => {
    setUser(updatedUser);
    setEditAvatar(false);
  };

  const handleEditAvatar = () => {
    setEditAvatar(true);
  };

  if (!token) {
    return <Landing onAuth={handleAuth} />;
  }

  if (editAvatar || (user && (!user.avatar_config || Object.keys(user.avatar_config).length === 0))) {
    return <AvatarGenerator user={user} token={token} onAvatarSaved={handleAvatarSaved} />;
  }

  if (user) {
    return <Office user={user} token={token} onLogout={handleLogout} onEditAvatar={handleEditAvatar} setUser={setUser} />;
  }

  return <div className="loading">Cargando...</div>;
}

export default App;
