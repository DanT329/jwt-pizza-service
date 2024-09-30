const request = require('supertest');
const app = require('../service');
const { DB} = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;
let testUserId;

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
  jest.setTimeout(60 * 1000 * 5); // 5 minutes
}


beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(password).toMatch(testUser.password);
  expect(loginRes.body.user).toMatchObject(user);
});



test('update user', async () => {
  const updateRes = await request(app)
    .put(`/api/auth/${testUserId}`)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({ email: 'newemail@test.com', password: 'newpassword' });

  expect(updateRes.status).toBe(200);
  // expect(updateRes.body.email).toBe('newemail@test.com');
});


test('logout', async () => {
  const logoutRes = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  
  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body.message).toBe('logout successful');
  const loggedIn = await DB.isLoggedIn(testUserAuthToken);
  expect(loggedIn).toBe(false);
  expect(testUserAuthToken).toBe(null);
});