import { test, expect, request } from '@playwright/test';
import { v4 as uuid } from 'uuid';

const httpCredentials = {
    username: process.env.AUTH_USERNAME || 'alchuev@gmail.com',
    password: process.env.AUTH_PASSWORD || 'JByYfaFv69gsP3m',
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
            Authorization: `Basic ${credentialsBase64}`,
            Accept: 'application/json',
            'Request-Id': uuid(),
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
                placeOrderResponse.status(),
                `Response code is ${placeOrderResponse.status()}, expected to be 201`
            ).toBe(201);
            return placeOrderResponse.json();
        });
        const certificateId = newOrderData.data.id;

        // Get order data
        const orderData =
            await test.step(`Get order data with id: ${certificateId}`, async () => {
                const getOrderResponse = await request.get(
                    `./traveling_abroad_certificate/${certificateId}`
                );
                expect(getOrderResponse.ok()).toBeTruthy();
                return getOrderResponse.json();
            });

        // Update countries
        const available_countries = orderData.data.available_countries;
        const updatedCountryOrder =
            await test.step(`Update countries for order with id: ${certificateId}`, async () => {
                const updateOrderResponse = await request.patch(
                    `./traveling_abroad_certificate/${certificateId}`,
                    {
                        data: {
                            country: available_countries
                                .filter(i =>
                                    [
                                        'Japan',
                                        'Australia',
                                        'Mozambique',
                                        'Angola',
                                    ].includes(i.name)
                                )
                                .map(i => i.id),
                        },
                    }
                );
                expect(
                    updateOrderResponse.ok(),
                    `Response code is ${updateOrderResponse.status()}, expected to be 200-299`
                ).toBeTruthy();
                return updateOrderResponse.json();
            });

        // Update currency
        const available_currencies =
            updatedCountryOrder.data.available_currencies;
        const updatedCurrencyOrder =
            await test.step(`Update currency for order with id: ${certificateId}`, async () => {
                const updateOrderResponse = await request.patch(
                    `./traveling_abroad_certificate/${certificateId}`,
                    {
                        data: {
                            currency_type: available_currencies[0],
                        },
                    }
                );
                expect(updateOrderResponse.ok()).toBeTruthy();
                return updateOrderResponse.json();
            });

        // Update tariff
        const available_tariffs = updatedCurrencyOrder.data.tariff_available;
        const updatedTariffOrder =
            await test.step(`Update tariff for order with id: ${certificateId}`, async () => {
                const updateOrderResponse = await request.patch(
                    `./traveling_abroad_certificate/${certificateId}`,
                    {
                        data: {
                            one_time_tariff: available_tariffs[0].id,
                        },
                    }
                );
                expect(updateOrderResponse.ok()).toBeTruthy();
                return updateOrderResponse.json();
            });

        // Update amount
        const available_amounts = updatedTariffOrder.data.amount_available;
        const updatedAmountOrder =
            await test.step(`Update amount for order with id: ${certificateId}`, async () => {
                const updateOrderResponse = await request.patch(
                    `./traveling_abroad_certificate/${certificateId}`,
                    {
                        data: {
                            amount_one_time_tariff: available_amounts[0].id,
                        },
                    }
                );
                expect(updateOrderResponse.ok()).toBeTruthy();
                return updateOrderResponse.json();
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

        const patchOrderData = {
            date_from: tripStartDate,
            date_to: tripEndDate,
            insuring_type: 'Физлицо',
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
