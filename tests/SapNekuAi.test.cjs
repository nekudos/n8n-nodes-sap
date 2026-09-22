const assert = require('node:assert/strict');
const { test } = require('node:test');
const { NodeApiError, NodeOperationError } = require('n8n-workflow');
const { SapNekuAi } = require('../dist/nodes/SapNekuAi/SapNekuAi.node');
const { toSapApiError } = require('../dist/nodes/SapNekuAi/SapError');

const node = {
	id: 'sap-test',
	name: 'SAP Connector Neku.AI',
	type: 'n8n-nodes-sap.sapNekuAi',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};
const sapMessage = 'No records were found matching these filters.';
function gatewayBody() {
	return {
		error: {
			code: 'SY/530',
			message: { lang: 'tr', value: sapMessage },
			innererror: {
				transactionid: 'TEST-TRANSACTION',
				timestamp: '20260922120000',
				errordetails: [
					{ code: '', message: sapMessage, severity: 'error' },
					{ code: '/IWBEP/CX_SD_GEN_DPC_BUSINS', message: sapMessage, severity: 'error' },
					{ code: 'ZREPORT/001', message: 'Check the material type filter.', severity: 'error' },
				],
			},
		},
	};
}
function axiosError(body = gatewayBody()) {
	return Object.assign(new Error('Request failed with status code 400'), {
		response: { status: 400, data: body },
	});
}

for (const [name, wrap] of Object.entries({
	'HTTP response object': (body) => axiosError(body),
	'HTTP response JSON string': (body) => axiosError(JSON.stringify(body)),
	'legacy response body': (body) => ({ statusCode: 400, response: { body } }),
	'legacy error body': (body) => ({ statusCode: 400, error: JSON.stringify(body) }),
	'direct OData body': (body) => ({ statusCode: 400, ...body }),
	'n8n error context': (body) => ({ httpCode: '400', context: { data: body } }),
	'nested cause': (body) => ({ statusCode: 400, cause: axiosError(body) }),
})) {
	test(`shows SAP business messages from ${name}`, () => {
		const error = toSapApiError(node, wrap(gatewayBody()), 2);
		assert.ok(error instanceof NodeApiError);
		assert.equal(error.message, sapMessage);
		assert.equal(error.httpCode, '400');
		assert.equal(error.context.itemIndex, 2);
		assert.equal(typeof error.description, 'string');
		assert.match(error.description, /SAP Error Code: SY\/530/);
		assert.match(error.description, /ZREPORT\/001: Check the material type filter\./);
		assert.match(error.description, /SAP Transaction ID: TEST-TRANSACTION/);
		assert.match(error.description, /SAP Timestamp: 20260922120000/);
		assert.ok(!error.description.includes(sapMessage), 'duplicate Gateway messages are omitted');
	});
}

test('repairs an already-normalized n8n error with an object description', () => {
	const original = new NodeApiError(node, axiosError());
	const error = toSapApiError(node, original, 3);
	assert.equal(error.message, sapMessage);
	assert.equal(typeof error.description, 'string');
	assert.equal(error.context.itemIndex, 3);
	assert.deepEqual(error.context.data, gatewayBody());
});

test('supports string messages and OData V4 details', () => {
	const error = toSapApiError(node, axiosError({ error: {
		code: 'VALIDATION', message: 'Invalid input',
		details: [{ code: 'MATERIAL', message: 'Material type is required.' }],
	} }), 0);
	assert.equal(error.message, 'Invalid input');
	assert.match(error.description, /MATERIAL: Material type is required\./);
});

test('uses a Gateway detail when the main message is missing', () => {
	const body = gatewayBody();
	delete body.error.message;
	body.error.innererror.errordetails.unshift(null, {}, { message: 42 });
	assert.equal(toSapApiError(node, axiosError(body), 0).message, sapMessage);
});

test('preserves standard HTTP and network errors without an OData message', () => {
	for (const body of ['<html>Unauthorized</html>', '{invalid JSON', null, { error: null }]) {
		const original = Object.assign(new Error('Unauthorized'), { response: { status: 401, data: body } });
		const expected = new NodeApiError(node, original);
		const actual = toSapApiError(node, original, 0);
		assert.equal(actual.message, expected.message);
		assert.equal(actual.httpCode, '401');
	}
	const networkError = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
	assert.equal(toSapApiError(node, networkError, 0).message, new NodeApiError(node, networkError).message);
});

function executionContext({ fail = true, continueOnFail = false, parameters = {}, itemCount = 1 } = {}) {
	const requests = [];
	const values = {
		reportName: 'MaterialType', reportPayload: { material_type: 'ZZ20' },
		nekuAIUser: 'tester@example.com', returnRaw: false, ...parameters,
	};
	return {
		requests,
		getInputData: () => Array.from({ length: itemCount }, () => ({ json: {} })),
		getCredentials: async () => ({ baseUrl: 'https://sap.example.com/' }),
		getNode: () => node,
		getNodeParameter: (name) => values[name],
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: async function (credential, options) {
				requests.push({ credential, ...options });
				if (options.method === 'GET') return { headers: {
					'x-csrf-token': 'test-token', 'set-cookie': ['sap-session=test; HttpOnly'],
				} };
				if (fail) throw axiosError();
				return { d: { ReportId: 'test-report', ReportName: 'MaterialType' } };
			},
		},
	};
}

test('execute throws a readable SAP error with HTTP status and item pairing', async () => {
	await assert.rejects(new SapNekuAi().execute.call(executionContext()), (error) => {
		assert.ok(error instanceof NodeApiError);
		assert.equal(error.message, sapMessage);
		assert.equal(typeof error.description, 'string');
		assert.equal(error.httpCode, '400');
		assert.equal(error.context.itemIndex, 0);
		return true;
	});
});

test('Continue on Fail returns the SAP message for each input item', async () => {
	const context = executionContext({ continueOnFail: true, itemCount: 2 });
	const result = await new SapNekuAi().execute.call(context);
	assert.deepEqual(result, [[
		{ json: { error: sapMessage }, pairedItem: { item: 0 } },
		{ json: { error: sapMessage }, pairedItem: { item: 1 } },
	]]);
});

test('successful reports keep the request, credentials, CSRF and response contracts', async () => {
	for (const returnRaw of [false, true]) {
		const context = executionContext({ fail: false, parameters: { returnRaw } });
		const result = await new SapNekuAi().execute.call(context);
		const report = { ReportId: 'test-report', ReportName: 'MaterialType' };
		assert.deepEqual(result, [[{ json: returnRaw ? { d: report } : report, pairedItem: { item: 0 } }]]);
		assert.equal(context.requests[1].credential, 'sapBasicNekuAiApi');
		assert.equal(context.requests[1].headers['X-CSRF-Token'], 'test-token');
		assert.equal(context.requests[1].headers.Cookie, 'sap-session=test');
		assert.deepEqual(context.requests[1].body.ReportPayload, { material_type: 'ZZ20' });
	}
});

test('required-field validation remains a NodeOperationError without making requests', async () => {
	const context = executionContext({ parameters: { reportName: '' } });
	await assert.rejects(new SapNekuAi().execute.call(context), (error) => {
		assert.ok(error instanceof NodeOperationError);
		assert.equal(error.message, 'Report Name is required.');
		assert.equal(error.context.itemIndex, 0);
		return true;
	});
	assert.equal(context.requests.length, 0);
});
