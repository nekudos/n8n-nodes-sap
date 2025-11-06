![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-sap

This is an n8n community node that provides integration with SAP systems through the NeKu.AI OData wrapper service.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

> [!IMPORTANT]
> **Prerequisites**: Before using this node, the NeKu.AI Connector must be installed and configured in your SAP system. To request the installation and setup of the NeKu.AI Connector, please contact us at [info@neku.ai](mailto:info@neku.ai).

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Select **Install**
3. Enter `n8n-nodes-sap` in **Enter npm package name**
4. Agree to the [risks](https://docs.n8n.io/integrations/community-nodes/risks/) of using community nodes
5. Select **Install**

### Manual Installation

To install the node manually:

```bash
npm install n8n-nodes-sap
```

For Docker-based n8n installations, add the following environment variable:

```bash
NPM_PACKAGES=n8n-nodes-sap
```

## Operations

The SAP Connector node supports the following operation:

- **Execute Report**: Send data to SAP OData endpoint `/ZNEKUAI_WRAPPER_SRV/ReportSet`

### Parameters

- **Report Name** (required): The name of the SAP report to execute (e.g., "MaterialType")
- **Report Payload**: JSON object containing the data to send to SAP (will be stringified)
- **NeKu AI User** (required): The NeKu.AI platform user identifier (supports expressions like `{{$execution.user.email}}`)
- **Return Raw Response**: Toggle to return the complete API response or just the processed data

## Credentials

### SAP Basic Authentication NeKu.AI API

To connect to your SAP system, you'll need to set up the following credentials:

1. **Base URL** (required): The base URL of your SAP system
   - Example: `https://s4hana.company.com`

2. **SAP Client** (required): Your SAP Client number (Mandant)
   - Example: `100`, `800`, etc.

3. **Username** (required): Your SAP username for authentication

4. **Password** (required): Your SAP password for authentication

### Setting up Credentials

1. In n8n, go to **Credentials** > **New**
2. Search for "SAP Basic Authentication NeKu.AI API"
3. Fill in the required fields:
   - Base URL of your SAP system
   - SAP Client number
   - Username
   - Password
4. Click **Save**

The credentials are automatically tested when saved to ensure connectivity with your SAP system.

## Compatibility

- **Minimum n8n version**: 0.200.0
- **Tested with n8n versions**: 0.200.0 and above

## Usage

### Basic Example

1. Add the **SAP Connector Neku.AI** node to your workflow
2. Select or create SAP credentials
3. Configure the node:
   - **Report Name**: Enter your SAP report name (e.g., "MaterialType")
   - **Report Payload**: Add a JSON object with your data
   - **NeKu AI User**: Provide the user identifier
4. Execute the workflow

### Example Payload

```json
{
  "MaterialNumber": "100001",
  "MaterialType": "FERT",
  "Description": "Finished Product"
}
```

### Using Variables

You can use n8n expressions in the **NeKu AI User** field to automatically populate the logged-in user's email:

```
={{$execution.user.email}}
```

Other available user properties:
- `={{$execution.user.firstName}}` - User's first name
- `={{$execution.user.lastName}}` - User's last name
- `={{$execution.user.id}}` - User's ID

### Response Handling

By default, the node returns processed data from the SAP response. Enable **Return Raw Response** to get the complete API response including metadata.

The node automatically extracts data from common SAP OData response structures:
- `d.results` (collection)
- `d` (single entity)
- `value` (array)

### Error Handling

The node includes built-in error handling:
- If **Continue on Fail** is enabled in the node settings, errors are returned as JSON objects
- Otherwise, errors will stop the workflow execution

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [n8n documentation](https://docs.n8n.io/)
- [SAP OData documentation](https://help.sap.com/docs/SAP_NETWEAVER_750/68bf513362174d54b58cddec28794093/7b3b16ea42bd46e293036f3b5deaa6d5.html)
- [GitHub Repository](https://github.com/nekudos/n8n-nodes-sap)

## Version History

### 0.1.0 (Current)

- Initial release
- Basic SAP OData POST integration via NeKu.AI wrapper
- Support for basic authentication
- CSRF token handling
- Configurable response processing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE.md)

## Author

**Serkan Ozcan**  
Email: serkan.ozcan@nekudos.com  
GitHub: [@serkanozcan](https://github.com/serkanozcan)

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/nekudos/n8n-nodes-sap).

