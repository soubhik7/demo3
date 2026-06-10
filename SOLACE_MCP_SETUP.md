# Solace Event Portal Designer MCP Server Setup

This document describes the setup and configuration of the Solace Event Portal Designer MCP Server for IBM watsonx Code Assistant (ICA).

## Overview

The Solace Event Portal MCP Server enables AI-assisted development with event-driven architecture by bringing Event Portal's comprehensive EDA design capabilities directly into your IDE. This integration allows you to:

- Retrieve design information including produced/consumed events and schemas
- Access AsyncAPI specifications
- Generate application code
- Create new application versions in Event Portal Designer
- Perform full CRUD operations on Event Portal Designer objects

## Prerequisites

✅ **Completed:**
- Python 3.13.13 (Required: Python 3.10+)
- uv 0.11.16 (Package manager for Python)
- Solace Cloud Account with Event Portal access

## Configuration

### MCP Server Configuration

The MCP server is configured in `.bob/mcp.json`:

```json
{
  "mcpServers": {
    "solace-event-portal-designer": {
      "command": "uvx",
      "args": [
        "--from",
        "solace-event-portal-designer-mcp",
        "solace-ep-designer-mcp"
      ],
      "env": {
        "SOLACE_API_TOKEN": "[paste token here]"
      }
    }
  }
}
```

### Setup Steps

1. **Get Solace API Token:**
   - Go to https://console.solace.cloud/
   - Navigate to account settings or API tokens section
   - Create a new API token with at least "Event Portal > Designer > Read" permissions
   - For write operations, add appropriate write permissions
   - Copy the token

2. **Configure the Token:**
   - Replace `[paste token here]` in `.bob/mcp.json` with your actual API token
   - Keep the token secure and never commit it to version control

3. **Restart IBM ICA:**
   - After updating the configuration, restart IBM watsonx Code Assistant
   - The MCP server will automatically download and start when ICA launches

### Region Configuration

By default, the server connects to the US region (`https://api.solace.cloud`). If your Solace Cloud account is in a different region, add the `SOLACE_API_BASE_URL` environment variable:

**Australia:**
```json
"env": {
  "SOLACE_API_TOKEN": "your-token",
  "SOLACE_API_BASE_URL": "https://api.solacecloud.com.au"
}
```

**Europe:**
```json
"env": {
  "SOLACE_API_TOKEN": "your-token",
  "SOLACE_API_BASE_URL": "https://api.solacecloud.eu"
}
```

**Singapore:**
```json
"env": {
  "SOLACE_API_TOKEN": "your-token",
  "SOLACE_API_BASE_URL": "https://api.solacecloud.sg"
}
```

## Available Tools

The MCP server provides comprehensive tools for:

- **Application Domains** - Create, read, update, delete, and list domains
- **Applications** - Manage applications and their versions
- **Events** - Manage events and their versions
- **Schemas** - Manage schemas and their versions
- **AsyncAPI Export** - Generate AsyncAPI specifications from application versions

## Example Usage

Once configured, you can use natural language prompts in IBM ICA:

- "List all application domains in my Event Portal"
- "Show me events in the OrderManagement domain"
- "Create a new schema for order events"
- "Export an AsyncAPI spec for application version X"
- "Show me all applications that publish the OrderCreated event"

## Verification

To verify the setup is working:

1. Restart IBM watsonx Code Assistant
2. Ask a simple question: "List my application domains"
3. If configured correctly, you'll see results from Event Portal

## Troubleshooting

### Authentication Errors
- Verify `SOLACE_API_TOKEN` is set correctly in `.bob/mcp.json`
- Check if the token has expired in the Cloud Console
- Ensure the token has appropriate permissions

### Connection Issues
- Verify you're using the correct region via `SOLACE_API_BASE_URL`
- Check network connectivity to `api.solace.cloud` (or your region's URL)

### Command Not Found
- Verify Python 3.10+ is installed: `python --version`
- Verify uv is installed: `uv --version`
- If using pip install method, verify: `which solace-ep-designer-mcp`

## Security Notes

- This MCP server is intended for use with AI assistants in a controlled environment with human oversight
- Not designed for automated workflows like GitHub Actions or unattended automation
- You share responsibility for data privacy of your Solace Cloud data
- Use API tokens with appropriate permissions
- Follow your organization's security policies
- Never commit API tokens to version control

## Additional Resources

- [Solace Event Portal Documentation](https://docs.solace.com/Cloud/Event-Portal/event-portal-overview.htm)
- [MCP Server GitHub Repository](https://github.com/SolaceLabs/solace-platform-mcp)
- [Solace Cloud Console](https://console.solace.cloud/)

## Installation Method (Alternative)

If you prefer to pre-install the package instead of using `uvx`:

```bash
# Install from PyPI
pip install solace-event-portal-designer-mcp

# Or install from Git
pip install git+https://github.com/SolaceLabs/solace-platform-mcp.git#subdirectory=solace-event-portal-designer-mcp
```

Then update `.bob/mcp.json` to use:
```json
"command": "solace-ep-designer-mcp"
```

Instead of the `uvx` command.

---

**Setup Date:** 2026-05-22  
**Python Version:** 3.13.13  
**uv Version:** 0.11.16  
**Region:** United States (default)