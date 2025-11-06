import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class SapBasicNekuAiApi implements ICredentialType {
	name = 'sapBasicNekuAiApi';
	displayName = 'SAP Basic Authentication NeKu.AI API';
	documentationUrl = 'https://github.com/nekudos/n8n-nodes-sap';
	icon: Icon = { light: 'file:../icons/nekuai.svg', dark: 'file:../icons/nekuai.dark.svg' };
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://<sap-host>',
			description: 'The base URL of your SAP system, for example: https://s4hana.company.com',
			placeholder: 'https://s4hana.company.com',
			required: true,
		},
		{
			displayName: 'SAP Client',
			name: 'sapClient',
			type: 'string',
			default: '100',
			description: 'SAP Client number (Mandant), for example: 100, 800, etc.',
			placeholder: '100',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			description: 'SAP username for authentication',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'SAP password for authentication',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			auth: {
				username: '={{$credentials.username}}',
				password: '={{$credentials.password}}',
			},
			qs: {
				'sap-client': '={{$credentials.sapClient}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/sap/opu/odata/sap/ZNEKUAI_WRAPPER_SRV',
			method: 'GET',
			qs: {
				'sap-client': '={{$credentials.sapClient}}',
			},
		},
	};
}
