const { test, expect } = require('@playwright/test');

const API_URL = 'http://localhost:3001';

test.describe('API Endpoints', () => {
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

  test('GET /api/users should return users with bipolar mood states', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'david@madoffice.com' }
    });
    const { token } = await loginRes.json();

    const res = await request.get(`${API_URL}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const users = await res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(5);

    const david = users.find(u => u.name === 'David');
    expect(david).toBeDefined();
    // Bipolar mood fields
    expect(david.alegria).toBeDefined();
    expect(david.energia).toBeDefined();
    expect(david.optimismo).toBeDefined();
    expect(david.frustracion).toBeDefined();
    expect(david.estres).toBeDefined();
  });

  test('PUT /api/users/:id/avatar should update avatar config', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'david@madoffice.com' }
    });
    const { token, user } = await loginRes.json();

    const avatarConfig = { skinTone: 1, hairStyle: 3, hairColor: 2, clothes: 4, accessory: 1 };

    const res = await request.put(`${API_URL}/api/users/${user.id}/avatar`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { avatar_config: avatarConfig }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.avatar_config).toEqual(avatarConfig);
  });

  test('PUT /api/users/:id/profile should update name and email', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: 'david@madoffice.com' }
    });
    const { token, user } = await loginRes.json();

    const res = await request.put(`${API_URL}/api/users/${user.id}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'David Updated' }
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('David Updated');

    // Restore original name
    await request.put(`${API_URL}/api/users/${user.id}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'David' }
    });
  });
});
