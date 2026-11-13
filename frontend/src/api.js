// Cliente mínimo de la API. Los errores llegan ya en lenguaje humano desde el servidor.

export const API_URL = process.env.REACT_APP_API_URL || '';
export const WS_URL = process.env.REACT_APP_WS_URL || '';

export function getToken() {
  try {
    return localStorage.getItem('mad_office_token');
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem('mad_office_token', token);
    else localStorage.removeItem('mad_office_token');
  } catch {
    /* sin almacenamiento: la sesión dura lo que la pestaña */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'No he podido hablar con la oficina. ¿Está encendida?', res.status);
  return data;
}

// Espera a que el despertador resuelva un turno. onSlow avisa si tarda (despertador apagado).
export async function waitTurn(turnId, { onSlow, timeoutMs = 120000 } = {}) {
  const t0 = Date.now();
  let warned = false;
  for (;;) {
    const t = await api(`/turns/${turnId}`);
    if (t.status === 'done') return t.result;
    if (t.status === 'failed' || t.status === 'expired') {
      throw new ApiError('A la IA no le ha salido. Prueba otra vez.', 500);
    }
    if (!warned && Date.now() - t0 > 20000) {
      warned = true;
      if (onSlow) onSlow();
    }
    if (Date.now() - t0 > timeoutMs) throw new ApiError('La IA no contesta. ¿Está encendido el despertador?', 504);
    await new Promise(r => setTimeout(r, 1500));
  }
}

export const HUMOR_EMOJI = {
  euforico: '🤩', contento: '😊', normal: '😐', mosqueado: '😤', agobiado: '😵', triste: '😢', dormido: '😴',
};
