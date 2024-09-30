const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');

jest.mock('../database/database.js');

test('Get pizza menu', async () => {
    // Mock the DB.getMenu function to return a sample menu
    const sampleMenu = [{ id: 1, title: 'Test Pizza', image: 'testImage.png', price: 0.0030, description: 'A testy pizza' }];
    DB.getMenu.mockResolvedValue(sampleMenu);

    const response = await request(app).get('/api/order/menu');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(sampleMenu);
});
