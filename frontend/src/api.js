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

// Empresa activa: la que se está mirando. Todo lo de «dentro» va a /api/companies/:cid/…
const COMPANY_KEY = 'mad_office_company';
let memCompany = null;

export function getCompany() {
  try {
    const v = localStorage.getItem(COMPANY_KEY);
    return v ? Number(v) : memCompany;
  } catch {
    return memCompany;
  }
}

export function setCompany(id) {
  memCompany = id || null;
  try {
    if (id) localStorage.setItem(COMPANY_KEY, String(id));
    else localStorage.removeItem(COMPANY_KEY);
  } catch {
    /* sin almacenamiento: vale la de memoria */
  }
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'No he podido hablar con la oficina. ¿Está encendida?', res.status, data.code);
  return data;
}

// Lo de dentro de la empresa activa.
export function capi(path, opts) {
  const cid = getCompany();
  if (!cid) return Promise.reject(new ApiError('Elige una empresa primero.', 400, 'sin_empresa'));
  return api(`/companies/${cid}${path === '/' ? '' : path}`, opts);
}

// Invitación pendiente (llegó por /invitacion/<código> o ?invite=): se acepta al entrar.
const INVITE_KEY = 'mad_office_invite';
export function pendingInvite() {
  const m = window.location.pathname.match(/^\/invitacion\/([\w-]+)/);
  const q = new URLSearchParams(window.location.search).get('invite');
  const fromUrl = (m && m[1]) || q;
  try {
    if (fromUrl) localStorage.setItem(INVITE_KEY, fromUrl);
    return fromUrl || localStorage.getItem(INVITE_KEY);
  } catch {
    return fromUrl || null;
  }
}
export function clearInvite() {
  try { localStorage.removeItem(INVITE_KEY); } catch { /* nada */ }
  if (/^\/invitacion\//.test(window.location.pathname) || window.location.search.includes('invite=')) {
    window.history.replaceState(null, '', '/');
  }
}

// Espera a que el despertador resuelva un turno. onSlow avisa si tarda (despertador apagado).
export async function waitTurn(turnId, { onSlow, timeoutMs = 120000 } = {}) {
  const t0 = Date.now();
  let warned = false;
  for (;;) {
    const t = await capi(`/turns/${turnId}`);
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
