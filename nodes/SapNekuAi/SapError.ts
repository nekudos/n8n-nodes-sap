import type { INode, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

function asObject(value: unknown): Record<string, unknown> | undefined {
	if (typeof value === 'string') {
		try {
			value = JSON.parse(value);
		} catch {
			return undefined;
		}
	}
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function messageText(value: unknown): string | undefined {
	const text = typeof value === 'string' ? value : asObject(value)?.value;
	return typeof text === 'string' && text.trim() ? text.trim() : undefined;
}

function findSapError(error: unknown): Record<string, unknown> | undefined {
	const visited = new Set<unknown>();
	const pending = [error];
	while (pending.length > 0) {
		const value = pending.shift();
		if (visited.has(value)) continue;
		visited.add(value);
		const object = asObject(value);
		if (!object) continue;

		const sapError = asObject(object.error);
		if (
			sapError &&
			(messageText(sapError.message) || sapError.innererror || Array.isArray(sapError.details))
		) {
			return sapError;
		}

		// Axios, legacy request helpers and already-normalized n8n errors.
		for (const key of ['response', 'data', 'body', 'cause', 'error']) {
			if (object[key] !== undefined) pending.push(object[key]);
		}
		const context = asObject(object.context);
		if (context?.data !== undefined) pending.push(context.data);
	}
	return undefined;
}

export function toSapApiError(node: INode, error: unknown, itemIndex: number): NodeApiError {
	const sapError = findSapError(error);
	const apiError = new NodeApiError(node, error as JsonObject, { itemIndex });
	apiError.context.itemIndex = itemIndex;
	if (!sapError) return apiError;

	const innerError = asObject(sapError.innererror);
	const details = [
		...(Array.isArray(innerError?.errordetails) ? innerError.errordetails : []),
		...(Array.isArray(sapError.details) ? sapError.details : []),
	];
	const detailMessages = details
		.map((detail) => asObject(detail))
		.filter((detail): detail is Record<string, unknown> => detail !== undefined);
	const message =
		messageText(sapError.message) ??
		detailMessages.map((detail) => messageText(detail.message)).find(Boolean);
	if (!message) return apiError;

	const description: string[] = [];
	const code = messageText(sapError.code);
	if (code) description.push(`SAP Error Code: ${code}`);
	const seenMessages = new Set([message]);
	for (const detail of detailMessages) {
		const text = messageText(detail.message);
		if (!text || seenMessages.has(text)) continue;
		seenMessages.add(text);
		const detailCode = messageText(detail.code);
		description.push(detailCode ? `${detailCode}: ${text}` : text);
	}
	const transactionId = messageText(innerError?.transactionid);
	const timestamp = messageText(innerError?.timestamp);
	if (transactionId) description.push(`SAP Transaction ID: ${transactionId}`);
	if (timestamp) description.push(`SAP Timestamp: ${timestamp}`);

	// NodeApiError can overwrite options.description with the OData V2 message object.
	// Normalize after construction so both the toast and error panel receive strings.
	apiError.message = message;
	apiError.description = description.length > 0 ? description.join('\n') : undefined;
	return apiError;
}
