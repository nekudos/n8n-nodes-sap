import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { toSapApiError } from './SapError';

interface ICredentials {
	baseUrl: string;
}

interface ICsrfResponse {
	token: string | undefined;
	cookieHeader: string;
}

interface ISapResponse {
	d?: {
		results?: IDataObject[];
		[key: string]: unknown;
	};
	value?: IDataObject[];
	[key: string]: unknown;
}

// Helper to fetch CSRF token and cookie
async function fetchCsrfAndCookie(
	executeFunctions: IExecuteFunctions,
	url: string,
): Promise<ICsrfResponse> {
	const res = await executeFunctions.helpers.httpRequestWithAuthentication.call(
		executeFunctions,
		'sapBasicNekuAiApi',
		{
			method: 'GET',
			url,
			headers: {
				'X-CSRF-Token': 'Fetch',
				Accept: 'application/json',
				'X-Requested-With': 'X',
			},
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		},
	);

	const token = res.headers['x-csrf-token'] as string | undefined;
	const setCookie = res.headers['set-cookie'] as string[] | undefined;
	const cookieHeader = setCookie ? setCookie.map((c) => c.split(';')[0]).join('; ') : '';

	return { token, cookieHeader };
}

export class SapNekuAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SAP Connector Neku.AI',
		name: 'sapNekuAi',
		icon: { light: 'file:../../icons/nekuai.svg', dark: 'file:../../icons/nekuai.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["reportName"]}}',
		description: 'POST JSON data to SAP OData endpoint /ZNEKUAI_WRAPPER_SRV/ReportSet',
		defaults: {
			name: 'SAP Connector Neku.AI',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'sapBasicNekuAiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Report Name',
				name: 'reportName',
				type: 'string',
				default: '',
				required: true,
				description: 'Required. Example: MaterialType.',
				placeholder: 'MaterialType',
			},
			{
				displayName: 'Report Payload (Object)',
				name: 'reportPayload',
				type: 'json',
				default: '{}',
				description: 'Provide a JSON object. It will be stringified into ReportPayload.',
			},
			{
				displayName: 'NeKu AI User',
				name: 'nekuAIUser',
				type: 'string',
				default: '',
				required: true,
				description: 'Required. Can also use an expression like {{$execution.user.email}}.',
				placeholder: '={{$execution.user.email}}',
			},
			{
				displayName: 'Return Raw Response',
				name: 'returnRaw',
				type: 'boolean',
				default: false,
				description: 'Whether to return the raw response from the API',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = (await this.getCredentials('sapBasicNekuAiApi')) as ICredentials;
		const baseUrl = credentials.baseUrl.replace(/\/$/, '');

		const endpoint = '/sap/opu/odata/sap/ZNEKUAI_WRAPPER_SRV/ReportSet';

		for (let i = 0; i < items.length; i++) {
			try {
				const reportName = this.getNodeParameter('reportName', i) as string;
				const reportPayload = this.getNodeParameter('reportPayload', i) as IDataObject;
				const nekuAIUser = this.getNodeParameter('nekuAIUser', i) as string;
				const returnRaw = this.getNodeParameter('returnRaw', i) as boolean;

				if (!reportName?.trim()) {
					throw new NodeOperationError(this.getNode(), 'Report Name is required.');
				}
				if (!nekuAIUser?.trim()) {
					throw new NodeOperationError(this.getNode(), 'NeKu AI User is required.');
				}

				const url = `${baseUrl}${endpoint}`;

				const { token, cookieHeader } = await fetchCsrfAndCookie(this, url);

				const body = {
					ReportId: '',
					ReportName: reportName,
					ReportPayload: reportPayload ?? {},
					NekuAIUser: nekuAIUser,
				};

				const res = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'sapBasicNekuAiApi',
					{
						method: 'POST',
						url,
						headers: {
							'Content-Type': 'application/json',
							Accept: 'application/json',
							'X-Requested-With': 'X',
							...(token ? { 'X-CSRF-Token': token } : {}),
							...(cookieHeader ? { Cookie: cookieHeader } : {}),
						},
						body,
					},
				);

				const payload = returnRaw
					? res
					: (((res as ISapResponse)?.d?.results ??
							(res as ISapResponse)?.d ??
							(res as ISapResponse)?.value ??
							res) as IDataObject);

				returnData.push({ json: payload as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				const nodeError =
					error instanceof NodeOperationError
						? new NodeOperationError(this.getNode(), error, { itemIndex: i })
						: toSapApiError(this.getNode(), error, i);
				nodeError.context.itemIndex = i;
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: nodeError.message },
						pairedItem: { item: i },
					});
				} else {
					throw nodeError;
				}
			}
		}

		return [returnData];
	}
}
