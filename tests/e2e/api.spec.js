const { test, expect } = require('@playwright/test');

const API_URL = 'http://localhost:3001';

test.describe('API Endpoints', () => {
  let token;
  let userId;

  test('GET /api/health should return ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('POST /api/auth/register should create a new user', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: `api_test_${Date.now()}@madoffice.com`,
        name: 'API Test User'
      }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.token).toBeDefined();
    expect(body.user.name).toBe('API Test User');
    token = body.token;
    userId = body.user.id;
  });

  test('POST /api/auth/register should reject duplicate email', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        email: 'david@madoffice.com',
        name: 'David Duplicate'
      }
    });
    expect(res.status()).toBe(409);
  });

  test('POST /api/auth/login should return user and token', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'david@madoffice.com' }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.name).toBe('David');
    expect(body.token).toBeDefined();
    if (!token) token = body.token;
  });

  test('POST /api/auth/login should 404 for unknown email', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'nobody@madoffice.com' }
    });
    expect(res.status()).toBe(404);
  });

  test('GET /api/users should require auth', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/users`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/users should return users with mood states', async ({ request }) => {
    // Login first to get a token
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'david@madoffice.com' }
    });
    const { token: authToken } = await loginRes.json();

    const res = await request.get(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    expect(res.status()).toBe(200);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(5); // 5 default users

    // Check mood state fields
    const david = users.find(u => u.name === 'David');
    expect(david).toBeDefined();
    expect(david.happiness).toBeDefined();
    expect(david.stress).toBeDefined();
  });

  test('PUT /api/users/:id/avatar should update avatar config', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'david@madoffice.com' }
    });
    const { token: authToken, user } = await loginRes.json();

    const avatarConfig = {
      skinTone: 1,
      hairStyle: 3,
      hairColor: 2,
      clothes: 4,
      accessory: 1
    };

    const res = await request.put(`${API_URL}/api/users/${user.id}/avatar`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { avatar_config: avatarConfig }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.avatar_config).toEqual(avatarConfig);
  });
});
