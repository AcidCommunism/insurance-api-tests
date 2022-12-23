import { test, expect } from '@playwright/test';

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
        const productList =
            await test.step('Get list of products', async () => {
                const productListResponse = await request.get(
                    `./traveling_abroad`
                );
                expect(
                    productListResponse.ok(),
                    `Response code is ${productListResponse.status()}, expected to be 200-299`
                ).toBeTruthy();
                return productListResponse.json();
            });
        await test.step(`Check that product list contains item with id ${testProductId}`, async () =>
            expect(
                productList.data.map(i => i.id).includes(testProductId)
            ).toBe(true));

        // Get product info
        const productInfo =
            await test.step(`Get product info (id: ${testProductId})`, async () => {
                const productInfoResponse = await request.get(
                    `./traveling_abroad/${testProductId}`
                );
                expect(
                    productInfoResponse.ok(),
                    `Response code is ${productInfoResponse.status()}, expected to be 200-299`
                ).toBeTruthy();
                return productInfoResponse.json();
            });
        await test.step(`Check that correct product is returned (id: ${testProductId})`, async () =>
            expect(productInfo.data.id).toBe(testProductId));

        // Place new order
        const newOrderData = await test.step('Create new order', async () => {
            const placeOrderResponse = await request.post(
                './traveling_abroad_certificate',
                {
                    data: {
                        is_available: true,
                        traveling_abroad: testProductId,
                    },
                }
            );
            expect(
                placeOrderResponse.ok(),
                `Response code is ${placeOrderResponse.status()}, expected to be 200-299`
            ).toBeTruthy();
            return placeOrderResponse.json();
        });
        const certificateId = newOrderData.data.id || newOrderData.data[0].id;

        // Get order data
        const orderData =
            await test.step(`Get order data with id: ${certificateId}`, async () => {
                const getOrderResponse = await request.get(
                    `./traveling_abroad_certificate/${certificateId}`
                );
                expect(
                    getOrderResponse.ok(),
                    `Response code is ${getOrderResponse.status()}, expected to be 200-299`
                ).toBeTruthy();
                return getOrderResponse.json();
            });

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

        const updatedOrder =
            await test.step(`Update order with id: ${certificateId}`, async () => {
                const updateOrderResponse = await request.patch(
                    `./traveling_abroad_certificate/${certificateId}`,
                    {
                        data: patchOrderData,
                    }
                );
                expect(
                    updateOrderResponse.ok(),
                    `Response code is ${updateOrderResponse.status()}, expected to be 200-299`
                ).toBeTruthy();
                return updateOrderResponse.json();
            });

        await test.step('Check that order data has been properly updated', async () => {
            Object.keys(patchOrderData).forEach(k => {
                if (k !== 'country') {
                    expect(updatedOrder.data[k]).toBe(patchOrderData[k]);
                } else {
                    expect(updatedOrder.data[k].map(i => i.id)).toStrictEqual(
                        patchOrderData[k]
                    );
                }
            });
        });

        // Delete order
        await test.step(`Delete order with id ${certificateId}`, async () => {
            const deleteOrderResponse = await request.delete(
                `./traveling_abroad_certificate/${certificateId}`
            );
            expect(
                deleteOrderResponse.ok(),
                `Response code is ${deleteOrderResponse.status()}, expected to be 200-299`
            ).toBeTruthy();
        });

        // Get order returns 404
        await test.step(`Should return 404 on GET /traveling_abroad_certificate/${certificateId}`, async () => {
            const getDeletedOrderResponse = await request.get(
                `./traveling_abroad_certificate/${certificateId}`
            );
            expect(getDeletedOrderResponse.status()).toBe(404);
        });
    });
});
