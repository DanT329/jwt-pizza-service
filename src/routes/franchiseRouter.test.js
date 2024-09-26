const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database.js');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
  }
  
const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

let testUserAuthToken;
let testUserId;
let adminAuthToken;
let franchiseId;
let storeId;

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
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    testUserId = registerRes.body.user.id;

    //login admin and get token
      // Create an admin user
    const adminUser = await createAdminUser();

  // Log in the admin user and get the token
    const adminLoginRes = await request(app)
        .put('/api/auth') // Since login is a PUT request
        .send({ email: adminUser.email, password: adminUser.password });

    adminAuthToken = adminLoginRes.body.token;
  });

  test('should create a new franchise when the user is an admin', async () => {
    const newFranchise = {
      name: randomName(),
      admins: [{ email: 'f@jwt.com' }, {email: testUser.email}],
    };
  
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newFranchise);
  
    // Assert response status and data
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', newFranchise.name);
    expect(res.body.admins[0]).toHaveProperty('email', 'f@jwt.com');
    expect(res.body).toHaveProperty('id'); 
    franchiseId = res.body.id; //for other tests
  });

  test('unathorized franchise creation', async () => {
    const newFranchise = {
      name: randomName(),
      admins: [{ email: 'f@jwt.com' }],
    };
  
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${testUserAuthToken}`)
      .send(newFranchise);
  
    // Assert response status and data
    expect(res.statusCode).toBe(403);
  });

  

  test('should create a new franchise store for the created franchise', async () => {
    const newStore = {
      name: randomName(),
      franchiseId: franchiseId,  // Use the captured franchiseId
    };
  
    const res = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newStore);
  
    // Assert response status and data
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('name', newStore.name);
    expect(res.body).toHaveProperty('franchiseId', franchiseId);
    expect(res.body).toHaveProperty('id'); // Ensure the store has an ID
    storeId = res.body.id;
  });

  test('should return a list of all franchises', async () => {
    // Make the GET request to list all franchises
    const res = await request(app)
      .get('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`);
  
    // Assert response status
    expect(res.statusCode).toBe(200);
  
    // Assert the structure of the response
    expect(Array.isArray(res.body)).toBe(true); // Response should be an array
    expect(res.body.length).toBeGreaterThan(0); // There should be at least one franchise
  
    const franchise = res.body.find(f => f.id === franchiseId);
    
    // Assert that the created franchise is in the list
    expect(franchise).toHaveProperty('id', franchiseId);
    expect(franchise).toHaveProperty('name');
    expect(franchise).toHaveProperty('stores');
  });


  test('should delete a store from the franchise', async () => {
    // Make the DELETE request to remove the store
    const res = await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
  
    // Assert response status and message
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'store deleted');
  
    // Verify the store is actually deleted (attempting to fetch it should fail)
    const fetchRes = await request(app)
      .get(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
  
    // Assuming the API responds with 404 or appropriate error if store is not found
    expect(fetchRes.statusCode).toBe(404);
  });

  test('should return a list of franchises associated with the user', async () => {
    // Create a franchise for the test user
    const newFranchise = {
      name: randomName(),
      admins: [{ email: testUser.email }], // Make the test user an admin of the franchise
    };
  
    await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newFranchise);
  
    // Now, make the GET request to retrieve the franchises for the test user
    const res = await request(app)
      .get(`/api/franchise/${testUserId}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);
  
    // Assert response status
    expect(res.statusCode).toBe(200);
  
    // Assert the structure of the response
    expect(Array.isArray(res.body)).toBe(true); // Response should be an array
    expect(res.body.length).toBeGreaterThan(0); // There should be at least one franchise
  
    const franchise = res.body.find(f => f.name === newFranchise.name);
    
    // Assert that the created franchise is in the list
    expect(franchise).toHaveProperty('id'); // Franchise should have an ID
    expect(franchise).toHaveProperty('name', newFranchise.name);
    expect(franchise.admins).toContainEqual(expect.objectContaining({
      email: testUser.email,
    })); // Ensure the test user is listed as an admin
  });

  test('should delete a franchise by admin', async () => {
    // Create a new franchise to be deleted later
    const newFranchise = {
      name: randomName(),
      admins: [{ email: 'f@jwt.com' }],
    };
  
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newFranchise);
  
    const franchiseIdToDelete = createRes.body.id; // Capture the franchise ID for deletion
  
    // Make the DELETE request to remove the franchise
    const res = await request(app)
      .delete(`/api/franchise/${franchiseIdToDelete}`)
      .set('Authorization', `Bearer ${adminAuthToken}`);
  
    // Assert response status and message
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message', 'franchise deleted');
  
  });

  test('anauthorized delete franchise', async () => {
    // Create a new franchise to be deleted later
    const newFranchise = {
      name: randomName(),
      admins: [{ email: 'f@jwt.com' }],
    };
  
    const createRes = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${adminAuthToken}`)
      .send(newFranchise);
  
    const franchiseIdToDelete = createRes.body.id; // Capture the franchise ID for deletion
  
    // Make the DELETE request to remove the franchise
    const res = await request(app)
      .delete(`/api/franchise/${franchiseIdToDelete}`)
      .set('Authorization', `Bearer ${testUserAuthToken}`);
  
    // Assert response status and message
    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty('message', 'unable to delete a franchise');
  });