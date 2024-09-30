const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
  }

let adminAuthToken;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
  }
  
  async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    await DB.addUser(user);
  
    user.password = 'toomanysecrets';
    return user;
  }

  beforeAll(async () => {
    //login admin and get token
      // Create an admin user
    const adminUser = await createAdminUser();

  // Log in the admin user and get the token
    const adminLoginRes = await request(app)
        .put('/api/auth') // Since login is a PUT request
        .send({ email: adminUser.email, password: adminUser.password });

    adminAuthToken = adminLoginRes.body.token;
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
    // I have not idea how to make sure the database closes but 1000 seems to make sure it has a chance before jest tears this all down.
  });
  

test('should add a new menu item when the user is an admin', async () => {
  const newMenuItem = {
    title: 'Student',
    description: 'No topping, no sauce, just carbs',
    image: 'pizza9.png',
    price: 0.0001,
  };

  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${adminAuthToken}`)
    .send(newMenuItem);

  expect(res.statusCode).toBe(200);
});