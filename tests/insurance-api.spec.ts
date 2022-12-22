import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

const httpCredentials = {
    username: process.env.AUTH_USERNAME || 'some@default.user',
    password: process.env.AUTH_PASSWORD || 'D3FAU1TP@$sw0rD',
};
const credentialsBase64 = Buffer.from(
    `${httpCredentials.username}:${httpCredentials.password}`
).toString('base64');

const testProductId = 166;

test.describe('order placement tests', () => {
    test.use({
        baseURL:
            process.env.PRODUCTION === '1'
                ? 'https://b2b.bestinsure.tech/api/'
                : 'http://insurance-backend-stg.i.bestdoctor.dev/api/',
        extraHTTPHeaders: {
            Accept: 'application/json',
            Authorization: `Basic ${credentialsBase64}`,
        },
    });

    test('should create new order @positive', async ({ request }) => {
        // Get product list
        const productListResponse = await request.get(`./traveling_abroad`);
        expect(productListResponse.ok()).toBeTruthy();
        const productList = await productListResponse.json();
        expect(productList.data.map(i => i.id).includes(testProductId)).toBe(
            true
        );

        // Get product info
        const productInfoResponse = await request.get(
            `./traveling_abroad/${testProductId}`
        );
        expect(productInfoResponse.ok()).toBeTruthy();
        const productInfo = await productInfoResponse.json();
        expect(productInfo.data.id).toBe(testProductId);

        // Place new order
        const placeOrderResponse = await request.post(
            './traveling_abroad_certificate',
            {
                data: {
                    is_available: true,
                    traveling_abroad: testProductId,
                },
            }
        );
        expect(placeOrderResponse.ok()).toBeTruthy();
        const newOrderData = await placeOrderResponse.json();
        console.log(newOrderData);
        const certificateId = newOrderData.data.id || newOrderData.data[0].id;

        // Get order data
        const getOrderResponse = await request.get(
            `./traveling_abroad_certificate/${certificateId}`
        );
        const orderData = await getOrderResponse.json();

        // Update order info
        const today = new Date();
        const tripStartDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 10
        ).toLocaleDateString('fr-CA');
        const tripEndDate = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + 30
        ).toLocaleDateString('fr-CA');
        const available_countries = orderData.data.available_countries;
        const patchOrderData = {
            amount_multiple_tariff: 69,
            country: available_countries
                .filter(i =>
                    ['Japan', 'Australia', 'Mozambique', 'Angola'].includes(
                        i.name
                    )
                )
                .map(i => i.id),
            date_from: tripStartDate,
            date_to: tripEndDate,
            days_count: 20,
            insuring_type: 'Физлицо',
            multiple_tariff: orderData.data.tariff_available[0].id,
            period: 365,
            start_alien: false,
            traveling_type: 'Однократная',
        };
        const updateOrderResponse = await request.patch(
            `./traveling_abroad_certificate/${certificateId}`,
            {
                data: patchOrderData,
            }
        );
        expect(updateOrderResponse.ok()).toBeTruthy();
        const updatedOrder = await updateOrderResponse.json();
        Object.keys(patchOrderData).forEach(k => {
            if (k !== 'country') {
                expect(updatedOrder.data[k]).toBe(patchOrderData[k]);
            } else {
                expect(updatedOrder.data[k].map(i => i.id)).toStrictEqual(
                    patchOrderData[k]
                );
            }
        });

        // Delete order
        const deleteOrderResponse = await request.delete(
            `./traveling_abroad_certificate/${certificateId}`
        );
        expect(deleteOrderResponse.ok()).toBeTruthy();

        // Get order returns 404
        const getDeletedOrderResponse = await request.get(
            `./traveling_abroad_certificate/${certificateId}`
        );
        expect(getDeletedOrderResponse.status()).toBe(404);
    });
});
