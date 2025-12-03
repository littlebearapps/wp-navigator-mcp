import { toolRegistry, registerAllTools } from './dist/tools/index.js';
import { loadEnvFromArgOrDotEnv, getConfigOrExit } from './dist/config.js';
import { makeWpRequest } from './dist/http.js';

// Load config
loadEnvFromArgOrDotEnv();
const config = getConfigOrExit();

// Register tools
registerAllTools();

// Create wpRequest bound to config
const wpRequest = makeWpRequest(config);

// Create a mock context
const mockContext = {
  wpRequest: (endpoint, options) => wpRequest(endpoint, options),
  config,
  clampText: (text) => text,
};

// Simulate the tool call with the EXACT value passed
const args = { plugin: 'wp-navigator-pro/wp-navigator-pro' };

console.log('=== Test: wpnav_get_plugin ===');
console.log('Input args.plugin:', JSON.stringify(args.plugin));

// Get the tool from registry
const tool = toolRegistry.getTool('wpnav_get_plugin');
if (!tool) {
  console.error('Tool not found!');
  process.exit(1);
}

// Call the handler
try {
  const result = await tool.handler(args, mockContext);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Error:', err.message);
}
